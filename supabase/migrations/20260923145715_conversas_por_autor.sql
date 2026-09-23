-- O histórico de conversas do Vini, por AUTOR e por marca — fatia 4d,
-- 23/09/2026.
--
-- ─── As decisões que esta migration materializa (spec do Assistente, 70–72) ─
--
--   • o histórico é por PESSOA e por MARCA: quem atende várias marcas não
--     mistura conversas;
--   • NINGUÉM lê a conversa de outra pessoa — nem quem administra a conta.
--     É a primeira coisa do produto que o dono da conta não alcança, e por
--     isso as policies são por AUTOR, não por marca nem por papel;
--   • a equipe do Brennimark também não lê (pergunta 72, André, 23/09): vê o
--     registro de uso no razão de IA, não o conteúdo;
--   • a conversa fica guardada, e a pessoa APAGA a sua de verdade (LGPD). Não
--     é marcação de "apagada": é `delete`, com a mensagem indo junto;
--   • o histórico de ANÁLISES continua da marca (`analysis_runs`) — análise é
--     trabalho sobre a peça, e quem trabalha na marca vê o de todos.
--
-- Os prompts gerados pelo copiloto (fatia 4c, ADR-0004 §3.5) entram aqui
-- como mensagens do tipo `prompt`, com a lista das regras que usaram.
--
-- ─── Por que a mensagem repete autor e marca ────────────────────────────────
--
-- A policy da mensagem compara `autor` direto, sem ir à conversa: é mais
-- simples de provar e não depende de subconsulta sob RLS. A coerência é
-- garantida pela chave estrangeira COMPOSTA (conversa, autor, marca): uma
-- mensagem não tem como dizer que é de um autor diferente do da conversa.

create table public.conversas (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  brand_id      uuid not null,
  -- Quem apaga o login apaga as conversas dele: são dados pessoais.
  autor         uuid not null references auth.users(id) on delete cascade,
  titulo        text not null,
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),

  constraint conversas_brand_fkey
    foreign key (brand_id, workspace_id) references public.brands(id, workspace_id) on delete cascade,
  constraint conversas_titulo_check check (titulo = btrim(titulo) and char_length(titulo) between 1 and 120),
  -- Alvo da chave composta das mensagens.
  constraint conversas_id_autor_marca_key unique (id, autor, brand_id)
);

-- A lista "Conversas" da janela: as da pessoa, naquela marca, mais recentes primeiro.
create index conversas_autor_marca_idx on public.conversas (autor, brand_id, atualizada_em desc);
create index conversas_brand_workspace_idx on public.conversas (brand_id, workspace_id);
create index conversas_workspace_idx on public.conversas (workspace_id);

create table public.mensagens_da_conversa (
  id           uuid primary key default gen_random_uuid(),
  conversa_id  uuid not null,
  autor        uuid not null,
  brand_id     uuid not null,
  papel        text not null,
  tipo         text not null,
  conteudo     text not null,
  -- Procedência, para a mensagem reaberta continuar citando: páginas dos
  -- trechos (chat) e regras usadas com status (prompt).
  paginas      jsonb not null default '{}'::jsonb,
  regras       jsonb not null default '[]'::jsonb,
  incompleta   boolean not null default false,
  criada_em    timestamptz not null default now(),

  constraint mensagens_da_conversa_conversa_fkey
    foreign key (conversa_id, autor, brand_id) references public.conversas(id, autor, brand_id) on delete cascade,
  constraint mensagens_da_conversa_papel_check check (papel in ('user', 'assistant')),
  constraint mensagens_da_conversa_tipo_check check (
    (papel = 'user' and tipo = 'pergunta') or (papel = 'assistant' and tipo in ('resposta', 'prompt'))
  ),
  constraint mensagens_da_conversa_conteudo_check check (char_length(conteudo) between 1 and 40000),
  constraint mensagens_da_conversa_paginas_check check (jsonb_typeof(paginas) = 'object'),
  constraint mensagens_da_conversa_regras_check check (jsonb_typeof(regras) = 'array')
);

create index mensagens_da_conversa_conversa_idx on public.mensagens_da_conversa (conversa_id, criada_em);
create index mensagens_da_conversa_autor_idx on public.mensagens_da_conversa (autor);

-- ─── Acesso: por AUTOR ─────────────────────────────────────────────────────
--
-- Ler e escrever pede duas coisas: ser o autor E ainda alcançar a marca. Quem
-- perdeu o acesso à marca deixa de ver a conversa (ela cita material da
-- marca), mas continua podendo APAGÁ-LA — o direito de exclusão não depende de
-- ainda trabalhar na marca.

alter table public.conversas enable row level security;
alter table public.mensagens_da_conversa enable row level security;

create policy "O autor lê as próprias conversas" on public.conversas
  for select to authenticated
  using (autor = (select auth.uid()) and public.tem_capacidade_na_marca(brand_id, 'consultar'));
create policy "O autor abre conversa numa marca que alcança" on public.conversas
  for insert to authenticated
  with check (autor = (select auth.uid()) and public.tem_capacidade_na_marca(brand_id, 'consultar'));
create policy "O autor atualiza o título e a data" on public.conversas
  for update to authenticated
  using (autor = (select auth.uid()) and public.tem_capacidade_na_marca(brand_id, 'consultar'))
  with check (autor = (select auth.uid()));
create policy "O autor apaga as próprias conversas" on public.conversas
  for delete to authenticated
  using (autor = (select auth.uid()));

create policy "O autor lê as próprias mensagens" on public.mensagens_da_conversa
  for select to authenticated
  using (autor = (select auth.uid()) and public.tem_capacidade_na_marca(brand_id, 'consultar'));
create policy "O autor grava mensagem na própria conversa" on public.mensagens_da_conversa
  for insert to authenticated
  with check (autor = (select auth.uid()) and public.tem_capacidade_na_marca(brand_id, 'consultar'));

-- Privilégios ditos explicitamente: no Supabase hospedado, tabela nova nasce
-- com escrita para `authenticated` (medido em 17/09), e o local não.
-- Mensagem não se edita: o que foi dito fica como foi dito, ou sai com a
-- conversa inteira.
revoke all on public.conversas from anon, authenticated;
revoke all on public.mensagens_da_conversa from anon, authenticated;
grant select, insert, delete on public.conversas to authenticated;
grant update (titulo, atualizada_em) on public.conversas to authenticated;
grant select, insert on public.mensagens_da_conversa to authenticated;

-- ─── Apagar sem depender de ainda alcançar a marca ─────────────────────────
--
-- A policy de `delete` sozinha não basta: no Postgres, `delete … where id = x`
-- também exige que a linha seja VISÍVEL pela policy de `select` — e quem
-- perdeu a marca não a vê mais. A prova pegou: a exclusão devolvia 0 linhas,
-- e o direito de apagar (LGPD) sumia junto com o acesso.
--
-- Esta função faz o que a policy promete, e só isso: apaga a conversa se, e
-- somente se, quem chama é o AUTOR. Não depende de marca, papel nem conta.
-- As mensagens vão junto pela chave estrangeira (`on delete cascade`).
create function public.apagar_conversa(p_conversa uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  apagadas integer;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  delete from public.conversas c
   where c.id = p_conversa and c.autor = (select auth.uid());
  get diagnostics apagadas = row_count;
  -- 0 é a resposta para "não existe" e para "não é sua": dizer diferente
  -- confirmaria a quem sonda que a conversa de outra pessoa existe.
  return apagadas;
end;
$$;

revoke execute on function public.apagar_conversa(uuid) from public, anon;
grant execute on function public.apagar_conversa(uuid) to authenticated;
