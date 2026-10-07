-- Registros de acesso (Marco Civil) e aceites dos documentos — 07/10/2026.
--
-- Os Termos e a Política revisados (versão 2026-10-08) prometem duas coisas
-- que o produto não fazia; o André aprovou o desenho das duas tabelas.
--
-- ─── registros_de_acesso ────────────────────────────────────────────────
--
-- Marco Civil da Internet (Lei 12.965/2014), art. 15: o provedor de
-- aplicação guarda, em sigilo, por 6 meses, a data e a hora de uso a partir
-- de um IP. O `proxy` registra no máximo uma linha por pessoa, por hora e
-- por IP (a trava de frequência vive num cookie, não aqui).
--
--   * ninguém pela sessão lê nem escreve: `revoke all`, RLS sem policy. Só a
--     chave de serviço grava (pelo proxy) e só ela lê — sigilo, a consulta é
--     por ordem judicial, direto no banco;
--   * o IP vem do servidor (o cabeçalho da Vercel), nunca do navegador: uma
--     função chamável pela sessão deixaria cada um inventar o próprio IP;
--   * a pessoa sair NÃO apaga o registro (`set null`): ele existe justamente
--     para o caso em que se precisa saber depois;
--   * depois de 6 meses, a rotina diária apaga (`limpar_registros_de_acesso`).
--     A lei pede o mínimo de 6 meses; a LGPD pede não guardar além disso.
--
-- ─── aceites_de_documentos ──────────────────────────────────────────────
--
-- Os Termos dizem: "registramos a versão aceita, a data e o horário". Quem
-- compra aceita no /assinar (a versão também vai ao Stripe); quem é
-- convidado aceita ao criar a senha do primeiro acesso.
--
--   * a pessoa lê só os PRÓPRIOS aceites; ninguém pela sessão escreve — a
--     gravação é do servidor, nas rotas da senha;
--   * a pessoa sair apaga o aceite junto (`cascade`): sem a pessoa, o aceite
--     não prova nada, e a LGPD pede a eliminação.

create table public.registros_de_acesso (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id) on delete set null,
  ip          inet not null,
  acessado_em timestamptz not null default now()
);

create index registros_de_acesso_data_idx on public.registros_de_acesso (acessado_em);
create index registros_de_acesso_pessoa_idx on public.registros_de_acesso (user_id, acessado_em desc);

alter table public.registros_de_acesso enable row level security;
revoke all on table public.registros_de_acesso from public, anon, authenticated;
-- Explícito: no Supabase hospedado as tabelas novas ganham privilégios por
-- padrão, e no local não — o que vale é o que está escrito aqui.
grant select, insert on table public.registros_de_acesso to service_role;

create table public.aceites_de_documentos (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  documento  text not null constraint aceites_documento_valido check (documento in ('termos', 'privacidade')),
  versao     text not null constraint aceites_versao_em_data check (versao ~ '^\d{4}-\d{2}-\d{2}$'),
  origem     text not null constraint aceites_origem_valida check (origem in ('compra', 'primeiro-acesso')),
  ip         inet,
  aceito_em  timestamptz not null default now()
);

create index aceites_de_documentos_pessoa_idx on public.aceites_de_documentos (user_id, aceito_em desc);

alter table public.aceites_de_documentos enable row level security;
revoke all on table public.aceites_de_documentos from public, anon, authenticated;
grant select on table public.aceites_de_documentos to authenticated;
grant select, insert on table public.aceites_de_documentos to service_role;

create policy "A pessoa lê os próprios aceites" on public.aceites_de_documentos
  for select to authenticated
  using (user_id = (select auth.uid()));

-- A limpeza dos 6 meses. Só a chave de serviço chama (a rotina diária).
-- Devolve quantas linhas saíram, para o registro da rotina.
create function public.limpar_registros_de_acesso()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  removidos integer;
begin
  delete from public.registros_de_acesso
   where acessado_em < now() - interval '6 months';
  get diagnostics removidos = row_count;
  return removidos;
end;
$$;

revoke execute on function public.limpar_registros_de_acesso() from public, anon, authenticated;
grant execute on function public.limpar_registros_de_acesso() to service_role;
