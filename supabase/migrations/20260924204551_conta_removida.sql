-- Conta removida — o que o histórico guarda de quem teve o login apagado.
-- LGPD, pedido de exclusão. Decisões do André em 24/09/2026:
--
--   1. AUTORIA E TRILHAS ficam, e a autoria vira "conta removida": o logo que a
--      pessoa enviou continua na biblioteca, a concessão que ela deu continua
--      valendo, o consumo de IA continua no razão (registro financeiro, precisa
--      bater). A referência ao login vira nula.
--   2. AS CÓPIAS DE E-MAIL nos registros viram um APELIDO ANÔNIMO E ESTÁVEL:
--      `conta-removida-7f3a2c@removida.invalid`, que a tela mostra como
--      "Conta removida · 7F3A2C". O registro continua dizendo que a MESMA pessoa
--      fez aqueles downloads, sem dizer quem era. `.invalid` é domínio
--      reservado (RFC 2606): nunca entrega nada.
--   3. AS ANÁLISES DE PEÇA ficam com a marca ("o histórico de análises é da
--      marca", decisão de 23/09) — até aqui, apagar o autor as apagava junto.
--
-- O que já sumia junto e continua sumindo: perfil, participação nas contas e
-- nas marcas, e as conversas com o Vini ("some de verdade", 23/09).
--
-- ─── Por que apagar um login travava ────────────────────────────────────────
--
-- Onze chaves apontavam para o login sem regra de exclusão — qualquer rastro
-- de autoria impedia apagar. E havia uma segunda trava, escondida: ao apagar o
-- login, a participação nas marcas saía em cascata, o gatilho do registro de
-- acesso tentava gravar "acesso removido" APONTANDO PARA O LOGIN QUE SUMIA, e o
-- banco recusava a exclusão inteira. O gatilho abaixo remove a participação
-- ANTES, enquanto o login ainda existe.
--
-- Reversibilidade: as regras mudam depois; o que for anonimizado, não volta.

-- ─── 1. Autoria: a referência vira nula ─────────────────────────────────────

alter table public.brand_documents        alter column updated_by    drop not null;
alter table public.brand_assets           alter column created_by    drop not null;
alter table public.brand_imports          alter column created_by    drop not null;
alter table public.brand_deletions        alter column requested_by  drop not null;
alter table public.ai_ledger              alter column user_id       drop not null;
alter table public.brand_source_documents alter column created_by    drop not null;
alter table public.brand_asset_items      alter column created_by    drop not null;
alter table public.concessoes_de_acesso   alter column concedida_por drop not null;
alter table public.analysis_runs          alter column created_by    drop not null;

alter table public.brand_documents drop constraint brand_documents_updated_by_fkey,
  add constraint brand_documents_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;
alter table public.brand_assets drop constraint brand_assets_created_by_fkey,
  add constraint brand_assets_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.brand_imports drop constraint brand_imports_created_by_fkey,
  add constraint brand_imports_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.brand_deletions drop constraint brand_deletions_requested_by_fkey,
  add constraint brand_deletions_requested_by_fkey foreign key (requested_by) references auth.users(id) on delete set null;
alter table public.ai_ledger drop constraint ai_ledger_user_id_fkey,
  add constraint ai_ledger_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
alter table public.brand_source_documents drop constraint brand_source_documents_created_by_fkey,
  add constraint brand_source_documents_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.brand_members drop constraint brand_members_created_by_fkey,
  add constraint brand_members_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.brand_asset_items drop constraint brand_asset_items_created_by_fkey,
  add constraint brand_asset_items_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.concessoes_de_acesso drop constraint concessoes_de_acesso_concedida_por_fkey,
  add constraint concessoes_de_acesso_concedida_por_fkey foreign key (concedida_por) references auth.users(id) on delete set null;
alter table public.concessoes_de_acesso drop constraint concessoes_de_acesso_revogada_por_fkey,
  add constraint concessoes_de_acesso_revogada_por_fkey foreign key (revogada_por) references auth.users(id) on delete set null;
alter table public.concessoes_de_acesso drop constraint concessoes_de_acesso_convertida_para_fkey,
  add constraint concessoes_de_acesso_convertida_para_fkey foreign key (convertida_para) references auth.users(id) on delete set null;
-- Decisão 3: a análise fica com a marca; só o autor é esquecido.
alter table public.analysis_runs drop constraint analysis_runs_created_by_fkey,
  add constraint analysis_runs_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

/*
 * As concessões diziam "revogada ⇔ tem quem revogou" e "convertida ⇔ tem para
 * quem". Com quem revogou (ou o convertido) removido, a data fica e a pessoa
 * some — e a regra antiga travaria a exclusão. A regra passa a ser de mão
 * única: a pessoa só existe se o evento existiu.
 */
alter table public.concessoes_de_acesso drop constraint concessoes_de_acesso_revogacao_check,
  add constraint concessoes_de_acesso_revogacao_check check (revogada_por is null or revogada_em is not null);
alter table public.concessoes_de_acesso drop constraint concessoes_de_acesso_conversao_check,
  add constraint concessoes_de_acesso_conversao_check check (convertida_para is null or convertida_em is not null);

-- Índices nas chaves que não tinham: `on delete set null` sem índice varre a
-- tabela inteira a cada login apagado.
create index if not exists brand_source_documents_created_by_idx
  on public.brand_source_documents (created_by) where created_by is not null;
create index if not exists brand_members_created_by_idx
  on public.brand_members (created_by) where created_by is not null;
create index if not exists concessoes_de_acesso_convertida_para_idx
  on public.concessoes_de_acesso (convertida_para) where convertida_para is not null;
create index if not exists brand_access_log_autor_idx
  on public.brand_access_log (autor) where autor is not null;
create index if not exists brand_asset_downloads_pessoa_idx
  on public.brand_asset_downloads (pessoa) where pessoa is not null;

-- ─── 2. O apelido anônimo, antes de o login sumir ──────────────────────────

/*
 * O apelido: estável por pessoa (os registros continuam agrupáveis), sem
 * dizer quem era. Seis dígitos de um resumo do identificador com rótulo
 * próprio — o identificador some junto com o login.
 */
create function private.apelido_de_conta_removida(p_id uuid)
returns text
language sql
immutable
set search_path to ''
as $$
  select 'conta-removida-' || substr(md5('brennimark:conta-removida:' || p_id::text), 1, 6) || '@removida.invalid'
$$;

revoke execute on function private.apelido_de_conta_removida(uuid) from public, anon, authenticated;

create function private.preparar_conta_removida()
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

create trigger preparar_conta_removida
  before delete on auth.users
  for each row execute function private.preparar_conta_removida();
