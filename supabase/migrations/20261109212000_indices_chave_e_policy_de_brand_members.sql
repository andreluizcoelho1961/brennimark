-- Três acertos de banco da auditoria de 09/11/2026 (prioridade menor). Nenhum muda o que alguém
-- pode ler ou escrever; só a velocidade de exclusões em cascata e a higiene do esquema.
--
-- 1. ÍNDICES DE COBERTURA para a chave estrangeira composta (brand_id, workspace_id) → brands(id,
--    workspace_id) em `analysis_runs`, `brand_chunks` e `ai_ledger` (advisor 0001). Sem índice com
--    essas duas colunas, apagar uma marca/conta (a exclusão aos 12 meses) varre a tabela filha inteira.
--    Índices NÃO são removidos aqui: os "nunca usados" (advisor 0005) ficam, a amostra é pequena.
--    `create index` comum trava escrita na tabela durante a criação; as tabelas são pequenas hoje.
--
-- 2. CHAVE PRIMÁRIA em `consumo_de_armazenamento` (advisor 0004): a identidade natural já é única
--    (`consumo_de_armazenamento_uma_por_dia`), mas `brand_id` é nulo para consumo da conta, e coluna
--    nula não entra em chave primária. Vira uma coluna `id` (uuid) própria; o índice único natural fica
--    como está (o upsert diário depende dele). Quem insere usa lista de colunas, então a coluna nova
--    não afeta ninguém.
--
-- 3. `brand_members`: as duas policies de SELECT para `authenticated` ("Pessoas veem o próprio acesso"
--    e "Quem administra a conta vê o acesso dela") viram UMA, com `or` (advisor 0006). Mesma regra,
--    uma avaliação por linha em vez de duas.
--
-- Reversibilidade: índices e coluna se removem; a policy volta a ser duas. Nenhum dado muda.

create index analysis_runs_brand_workspace_idx on public.analysis_runs (brand_id, workspace_id);
create index brand_chunks_brand_workspace_idx on public.brand_chunks (brand_id, workspace_id);
create index ai_ledger_brand_workspace_idx on public.ai_ledger (brand_id, workspace_id) where brand_id is not null;

alter table public.consumo_de_armazenamento add column id uuid not null default gen_random_uuid();
alter table public.consumo_de_armazenamento add constraint consumo_de_armazenamento_pkey primary key (id);

drop policy "Pessoas veem o próprio acesso" on public.brand_members;
drop policy "Quem administra a conta vê o acesso dela" on public.brand_members;
create policy "Pessoa vê o próprio acesso; quem administra vê o da conta" on public.brand_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or workspace_id in (
      select m.workspace_id from public.workspace_members m
       where m.user_id = (select auth.uid()) and m.role = 'owner'
    )
  );
