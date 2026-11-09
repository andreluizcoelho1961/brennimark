-- O registro de download da PALETA — 03/11/2026.
--
-- ─── A decisão (André, 03/11) ───────────────────────────────────────────────
--
-- O Cores exporta a paleta aprovada da marca em ASE, CSS, JSON e PNG. Esses
-- arquivos nascem no navegador, a partir das cores aprovadas do manual: não há
-- `brand_assets` por trás deles, e `brand_asset_downloads` tem gatilho preso a
-- um asset. Tabela PRÓPRIA, pelo mesmo motivo e no mesmo desenho de
-- `downloads_do_manual` (23/09): generalizar a outra mexeria num histórico já
-- em produção.
--
-- ─── O que o registro afirma, e o que não afirma ────────────────────────────
--
-- O CLIQUE em "baixar", gravado antes de o arquivo ser montado. Não prova que o
-- arquivo chegou ao disco, e não diz quais cores entraram, só quantas.
--
-- Não há texto livre: `formato` é uma lista fechada e `cores` um número. O que
-- o pedido mandar em pessoa, e-mail e conta é descartado; o gatilho preenche a
-- partir da sessão e da marca.
--
-- ─── Histórico ─────────────────────────────────────────────────────────────
--
-- Sem `update` e sem `delete`, nem para quem administra. Apagar o login NÃO
-- apaga o registro: a referência vira nula e o e-mail vira o apelido da conta
-- removida (mesma regra das outras três tabelas de registro).

create table public.downloads_de_paleta (
  id           uuid primary key default gen_random_uuid(),
  -- Sem chave para a marca, como `brand_asset_downloads`: apagar a marca não
  -- apaga o registro (ele fica guardado, e a policy de leitura deixa de alcançá-lo).
  brand_id     uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pessoa       uuid references auth.users(id) on delete set null,
  pessoa_email text not null,
  formato      text not null,
  cores        smallint not null,
  -- `clock_timestamp()`, como nos outros registros: `now()` é o horário da
  -- transação e deixaria sem ordem os downloads gravados juntos.
  created_at   timestamptz not null default clock_timestamp(),
  constraint downloads_de_paleta_formato_check check (formato in ('ase', 'css', 'json', 'png')),
  constraint downloads_de_paleta_cores_check check (cores between 1 and 200)
);

create index downloads_de_paleta_marca_idx
  on public.downloads_de_paleta (brand_id, created_at desc);
create index downloads_de_paleta_pessoa_idx
  on public.downloads_de_paleta (pessoa) where pessoa is not null;
create index downloads_de_paleta_workspace_idx
  on public.downloads_de_paleta (workspace_id);

alter table public.downloads_de_paleta enable row level security;

/*
 * Quem grava: quem pode ler a marca, e só em nome de si mesmo. O gatilho abaixo
 * preenche pessoa, e-mail e conta; a policy é avaliada DEPOIS dele, sobre a
 * linha já corrigida.
 */
create policy "Quem alcança a marca registra o próprio download da paleta"
  on public.downloads_de_paleta for insert to authenticated
  with check (
    pessoa = (select auth.uid())
    and public.tem_capacidade_na_marca(brand_id, 'consultar')
  );

/* Quem lê: quem administra AQUELA marca — informação de administração. */
create policy "Quem administra a marca lê os downloads da paleta"
  on public.downloads_de_paleta for select to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'administrar'));

-- Privilégios ditos explicitamente: no Supabase hospedado, tabela nova nasce
-- com escrita para `authenticated` (medido em 17/09), e o local não.
revoke all on public.downloads_de_paleta from anon;
revoke all on public.downloads_de_paleta from authenticated;
grant select, insert on public.downloads_de_paleta to authenticated;

create function private.completar_download_da_paleta()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
  conta uuid;
begin
  if quem is null then
    raise exception 'download sem sessão não é registrável'
      using errcode = '42501';
  end if;

  select b.workspace_id into conta from public.brands b where b.id = new.brand_id;
  if not found then
    raise exception 'a marca do download não existe'
      using errcode = 'foreign_key_violation';
  end if;

  -- Tudo o que identifica o evento vem do banco, e não do pedido.
  new.pessoa       := quem;
  new.pessoa_email := coalesce((select u.email from auth.users u where u.id = quem), '(sem e-mail)');
  new.workspace_id := conta;
  return new;
end;
$$;

revoke execute on function private.completar_download_da_paleta() from public, anon, authenticated;

create trigger downloads_de_paleta_completar
  before insert on public.downloads_de_paleta
  for each row execute function private.completar_download_da_paleta();

-- ─── Conta removida: o e-mail do registro vira o apelido ───────────────────
-- A função é a de 24/09 (`conta_removida`) com UMA linha a mais: sem ela, o
-- e-mail de quem removeu a conta ficaria legível nesta tabela.
create or replace function private.preparar_conta_removida()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  apelido text := private.apelido_de_conta_removida(old.id);
begin
  -- A participação nas marcas sai AQUI, com o login ainda existente: o
  -- registro de acesso grava "acesso removido" apontando para ele sem violar a
  -- chave. Deixada para a cascata, derrubava a exclusão inteira.
  delete from public.brand_members where user_id = old.id;

  -- As cópias de e-mail viram o apelido (decisão 2). Depois desta função, a
  -- chave de cada registro vira nula; o apelido é o que sobra da pessoa.
  update public.brand_access_log      set pessoa_email = apelido where pessoa = old.id;
  update public.brand_access_log      set autor_email  = apelido where autor  = old.id;
  update public.brand_asset_downloads set pessoa_email = apelido where pessoa = old.id;
  update public.downloads_do_manual   set pessoa_email = apelido where pessoa = old.id;
  update public.downloads_de_paleta   set pessoa_email = apelido where pessoa = old.id;

  -- As concessões feitas PARA ela: acesso de quem não existe mais termina, e
  -- o e-mail vira o apelido. As que ela deu para outros continuam valendo.
  update public.concessoes_de_acesso
     set email = apelido,
         revogada_em = coalesce(revogada_em, clock_timestamp())
   where convertida_para = old.id;

  return old;
end;
$$;

revoke execute on function private.preparar_conta_removida() from public, anon, authenticated;
