-- O registro de download do MANUAL em PDF — fatia 3, 23/09/2026.
--
-- ─── A decisão (André, 23/09) ───────────────────────────────────────────────
--
-- "Baixar o manual em PDF → sim, também no Book" (spec da tela do manual,
-- 17/09), e o download passa por uma rota que autoriza pela marca, REGISTRA e
-- redireciona para endereço assinado de curta duração — o padrão do download
-- de assets (`brand_asset_downloads`, 15/09).
--
-- Tabela PRÓPRIA, e não a de assets: aquela tem chave e gatilho presos a
-- `brand_assets`, e o manual é uma importação (`brand_imports`), não um asset.
-- Generalizar a outra mexeria num histórico já em produção; a tela de
-- Registros, quando existir, junta as duas.
--
-- ─── O que o registro afirma, e o que não afirma ────────────────────────────
--
-- Registra o download INICIADO pelo botão do produto. Não é prova de que
-- ninguém obteve o arquivo por outro caminho: quem lê o manual recebe os bytes
-- do PDF para ver as páginas — é a leitura, e ela não passa por aqui. Dizer
-- "quem baixou" em vez de "downloads iniciados" seria afirmar mais do que o
-- registro sabe.
--
-- ─── Histórico ─────────────────────────────────────────────────────────────
--
-- Nem quem administra reescreve: sem `update` e sem `delete`. Apagar a
-- importação ou o login NÃO apaga o registro — a referência vira `null` e o
-- e-mail e o nome do arquivo ficam, copiados no momento do download. É o mesmo
-- desenho de `brand_asset_downloads`, e deixa o pedido de exclusão de login
-- (LGPD, estacionado em 23/09) livre de mais uma chave que o bloqueie.

create table public.downloads_do_manual (
  id           uuid primary key default gen_random_uuid(),
  import_id    uuid references public.brand_imports(id) on delete set null,
  brand_id     uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pessoa       uuid references auth.users(id) on delete set null,
  pessoa_email text not null,
  file_name    text not null,
  -- `clock_timestamp()`, como nos outros registros: `now()` é o horário da
  -- transação e deixaria sem ordem os downloads gravados juntos.
  created_at   timestamptz not null default clock_timestamp()
);

-- "Downloads do manual desta marca, do mais recente para trás."
create index downloads_do_manual_marca_idx
  on public.downloads_do_manual (brand_id, created_at desc);
-- As chaves estrangeiras, para `on delete set null` não varrer a tabela.
create index downloads_do_manual_import_idx
  on public.downloads_do_manual (import_id) where import_id is not null;
create index downloads_do_manual_pessoa_idx
  on public.downloads_do_manual (pessoa) where pessoa is not null;
create index downloads_do_manual_workspace_idx
  on public.downloads_do_manual (workspace_id);

alter table public.downloads_do_manual enable row level security;

/*
 * Quem grava: quem pode ler a marca, e só em nome de si mesmo.
 *
 * O gatilho abaixo PREENCHE pessoa, e-mail, marca, conta e nome do arquivo a
 * partir da sessão e da importação — o que o cliente mandar nesses campos é
 * descartado. A policy é avaliada DEPOIS do gatilho, sobre a linha corrigida.
 */
create policy "Quem alcança a marca registra o próprio download do manual"
  on public.downloads_do_manual for insert to authenticated
  with check (
    pessoa = (select auth.uid())
    and public.tem_capacidade_na_marca(brand_id, 'consultar')
  );

/* Quem lê: quem administra AQUELA marca — informação de administração. */
create policy "Quem administra a marca lê os downloads do manual"
  on public.downloads_do_manual for select to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'administrar'));

-- Privilégios ditos explicitamente: no Supabase hospedado, tabela nova nasce
-- com escrita para `authenticated` (medido em 17/09), e o local não.
revoke all on public.downloads_do_manual from anon;
revoke all on public.downloads_do_manual from authenticated;
grant select, insert on public.downloads_do_manual to authenticated;

create function private.completar_download_do_manual()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
  importacao record;
begin
  if quem is null then
    raise exception 'download sem sessão não é registrável'
      using errcode = '42501';
  end if;

  select i.brand_id, i.workspace_id, i.report ->> 'arquivo' as arquivo
    into importacao
    from public.brand_imports i
   where i.id = new.import_id;

  -- Importação sem marca (a marca foi apagada) também não é registrável: não
  -- há a quem atribuir o download, e a policy recusaria de qualquer jeito.
  if not found or importacao.brand_id is null then
    raise exception 'o manual do download não existe'
      using errcode = 'foreign_key_violation';
  end if;

  -- Tudo o que identifica o evento vem do banco, e não do pedido.
  new.pessoa       := quem;
  new.pessoa_email := coalesce((select u.email from auth.users u where u.id = quem), '(sem e-mail)');
  new.brand_id     := importacao.brand_id;
  new.workspace_id := importacao.workspace_id;
  new.file_name    := coalesce(nullif(btrim(importacao.arquivo), ''), 'manual.pdf');
  return new;
end;
$$;

revoke execute on function private.completar_download_do_manual() from public, anon, authenticated;

create trigger downloads_do_manual_completar
  before insert on public.downloads_do_manual
  for each row execute function private.completar_download_do_manual();
