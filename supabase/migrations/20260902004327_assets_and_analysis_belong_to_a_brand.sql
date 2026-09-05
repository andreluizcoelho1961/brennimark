-- M2.0 — assets e análises passam a pertencer a uma marca, obrigatoriamente.
--
-- O momento importa: banco vazio. Zero assets, zero análises, zero marcas,
-- zero arquivos no Storage. Tornar estas colunas obrigatórias custa uma
-- migração hoje; com dados dentro, custaria decidir a que marca pertence cada
-- linha que nasceu sem marca — e essa decisão não tem resposta certa, só
-- palpites que viram vazamento entre clientes.

-- ─── brand_assets ──────────────────────────────────────────────────────────
--
-- A FK composta (brand_id, workspace_id) → brands(id, workspace_id) já existe.
-- O que faltava era a obrigatoriedade: com `brand_id` nulo, um asset ficava
-- pendurado no workspace e aparecia para TODAS as marcas dele.
alter table public.brand_assets
  alter column brand_id set not null;

-- `instance_key` era o identificador anterior: uma string escolhida no build.
-- Ela não pode conviver com `brand_id` — duas chaves para a mesma coisa é uma
-- chance de discordarem, e a discordância aqui é o asset de uma marca listado
-- na biblioteca de outra.
drop index if exists brand_assets_workspace_instance_idx;
alter table public.brand_assets drop column instance_key;

create index if not exists brand_assets_brand_idx
  on public.brand_assets(brand_id, created_at desc);

-- ─── analysis_runs ─────────────────────────────────────────────────────────
--
-- Aqui não havia coluna nenhuma: a análise pertencia ao WORKSPACE. Numa conta
-- com quatro marcas, o histórico era um só, e a peça analisada para a marca A
-- aparecia na lista da marca B — com o relatório da B, porque o relatório lê o
-- tema da marca ativa.
alter table public.analysis_runs
  add column brand_id uuid not null
    references public.brands(id) on delete cascade;

-- A FK composta é o que impede a mistura entre marcas do MESMO workspace. A
-- FK simples acima já impede referenciar marca inexistente; ela não impede
-- gravar, no workspace A, uma análise apontando para uma marca do workspace B.
-- A RLS também não impediria: ela olha o workspace da linha, e o workspace da
-- linha estaria certo.
alter table public.analysis_runs
  add constraint analysis_runs_brand_workspace_fkey
    foreign key (brand_id, workspace_id)
    references public.brands(id, workspace_id) on delete cascade;

create index analysis_runs_brand_idx
  on public.analysis_runs(brand_id, created_at desc);

-- ─── brand_documents ───────────────────────────────────────────────────────
--
-- Mesma razão, mesma janela. `instance_key` continua aqui por enquanto: a RPC
-- de publicação e o gatilho de versão escrevem nela, e removê-la exige
-- reescrever os dois. Fica registrada como dívida — o que esta migração
-- resolve é a coluna que deveria ser a chave estar opcional.
alter table public.brand_documents
  alter column brand_id set not null;

-- ─── A fila de exclusão aprende sobre buckets e sobre falha ────────────────
--
-- Ela nasceu para os PDFs de importação, num bucket só. Assets vivem em outro,
-- e a evidência de análise em outro ainda: sem saber de qual bucket apagar, a
-- drenagem tentaria no errado, receberia "não existe" e trataria como sucesso.
-- O arquivo ficaria para sempre.
alter table public.brand_deletions
  add column bucket_id text not null default 'brand-imports'
    check (bucket_id in ('brand-imports', 'brand-assets', 'analysis-evidence'));

-- Sem default daqui em diante: quem enfileira sabe de qual bucket é o arquivo,
-- e um default silencioso faria o caminho novo herdar o bucket do antigo.
alter table public.brand_deletions alter column bucket_id drop default;

-- Contabilidade de tentativa. Sem ela, uma falha permanente — arquivo que o
-- Storage recusa apagar — seria tentada de novo para sempre a cada abertura da
-- administração, sem ninguém nunca saber que existe.
alter table public.brand_deletions
  add column tentativas integer not null default 0 check (tentativas >= 0),
  add column ultimo_erro text,
  add column ultima_tentativa_at timestamptz;

-- A unicidade passa a incluir o bucket: o mesmo caminho pode existir em dois
-- buckets, e são dois arquivos diferentes.
alter table public.brand_deletions
  drop constraint brand_deletions_workspace_id_storage_path_key,
  add constraint brand_deletions_workspace_bucket_path_key
    unique (workspace_id, bucket_id, storage_path);

comment on column public.brand_deletions.tentativas is
  'Quantas vezes a exclusão do arquivo já foi tentada. A drenagem usa isto '
  'para adiar as que falham muito, em vez de repetir a mesma falha para sempre.';
