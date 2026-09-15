-- Os ARQUIVOS também passam a ser por marca — achado 2 do Codex Security, 15/09/2026.
--
-- ─── O que ficou para trás em 13/09 ──────────────────────────────────────
--
-- A migration `acesso_por_marca` reescreveu as policies das TABELAS e deixou
-- as de `storage.objects` intocadas. Conferido em produção em 15/09: as 11
-- policies dos três buckets perguntavam só "esta pessoa pertence à conta?".
-- Quem tinha a marca A lia, direto pelo Supabase, os arquivos da marca B — e
-- escapava do registro de download, que só a rota grava.
--
-- Não explorável naquele dia (1 conta, 1 pessoa, e o aplicativo não tem
-- convite de membro), mas aberto no primeiro convite.
--
-- ─── A regra, bucket a bucket ────────────────────────────────────────────
--
-- brand-assets   `conta/marca/arquivo`
--   · arquivo DA BIBLIOTECA (tem linha em `brand_assets`): nenhuma leitura
--     direta. Sai só por `/api/assets/[id]/download`, que autoriza pela RLS,
--     registra e assina com a chave de serviço. Decisão do André em 15/09: o
--     registro de download não pode ser contornável.
--   · imagem de página (sem linha na biblioteca): lê quem tem `consultar`
--     naquela marca. É o que `resolverImagensDeStorage` assina.
--   · escrever, alterar, apagar: `editar` naquela marca.
--
-- brand-imports  `conta/importação/hash.pdf` — a marca NÃO está no caminho
--   · PDF ligado a uma marca (linha em `brand_imports` com `brand_id`): lê
--     quem tem `consultar` nela; apaga quem tem `administrar`.
--   · PDF ainda sem marca (a importação em curso sobe o arquivo antes de a
--     marca existir): lê e apaga quem administra a CONTA.
--   · enviar: quem administra a conta — criar marca é poder da conta.
--
-- analysis-evidence  `conta/marca/<id-da-análise>-evidence.<ext>`
--   · o arquivo é amarrado à ANÁLISE pelos 36 primeiros caracteres do nome.
--   · ler: quem vê a análise (a RLS de `analysis_runs` exige `consultar`).
--   · enviar: só o autor da análise, e só para a própria análise.
--   · alterar, apagar: o autor, ou quem administra a marca.
--   O achado 1 era exatamente isso: qualquer membro da conta alterava ou
--   apagava a evidência da análise de outra marca.
--
-- ─── Por que as subconsultas comparam TEXTO ──────────────────────────────
--
-- Os segmentos do caminho são texto que o cliente escolhe ao subir. Converter
-- `(foldername(name))[2]::uuid` levanta erro num segmento que não é uuid, e
-- erro dentro de policy vira falha da consulta inteira — negação de serviço
-- com um nome de arquivo. Comparar `id::text = segmento` apenas não casa.

-- ════════════════════════════════════════════════════════════════════════
-- brand-assets
-- ════════════════════════════════════════════════════════════════════════
drop policy "Members can download brand assets" on storage.objects;
drop policy "Owners can upload brand assets" on storage.objects;
drop policy "Owners can update brand assets storage" on storage.objects;
drop policy "Owners can delete brand assets storage" on storage.objects;

create policy "Quem alcança a marca lê as imagens de página dela" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'brand-assets'
    and exists (
      select 1 from public.brand_members bm
      where bm.workspace_id::text = (storage.foldername(objects.name))[1]
        and bm.brand_id::text     = (storage.foldername(objects.name))[2]
        and bm.user_id = (select auth.uid())
        and 'consultar' = any (bm.capacidades))
    -- Arquivo da biblioteca não se lê direto: só pela rota que registra.
    and not exists (
      select 1 from public.brand_assets a where a.storage_path = objects.name)
  );

create policy "Quem edita a marca envia arquivo dela" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brand-assets'
    and exists (
      select 1 from public.brand_members bm
      where bm.workspace_id::text = (storage.foldername(objects.name))[1]
        and bm.brand_id::text     = (storage.foldername(objects.name))[2]
        and bm.user_id = (select auth.uid())
        and 'editar' = any (bm.capacidades))
  );

create policy "Quem edita a marca altera arquivo dela" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'brand-assets'
    and exists (
      select 1 from public.brand_members bm
      where bm.workspace_id::text = (storage.foldername(objects.name))[1]
        and bm.brand_id::text     = (storage.foldername(objects.name))[2]
        and bm.user_id = (select auth.uid())
        and 'editar' = any (bm.capacidades))
  )
  with check (
    bucket_id = 'brand-assets'
    and exists (
      select 1 from public.brand_members bm
      where bm.workspace_id::text = (storage.foldername(objects.name))[1]
        and bm.brand_id::text     = (storage.foldername(objects.name))[2]
        and bm.user_id = (select auth.uid())
        and 'editar' = any (bm.capacidades))
  );

create policy "Quem edita a marca apaga arquivo dela" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'brand-assets'
    and exists (
      select 1 from public.brand_members bm
      where bm.workspace_id::text = (storage.foldername(objects.name))[1]
        and bm.brand_id::text     = (storage.foldername(objects.name))[2]
        and bm.user_id = (select auth.uid())
        and 'editar' = any (bm.capacidades))
  );

-- ════════════════════════════════════════════════════════════════════════
-- brand-imports
-- ════════════════════════════════════════════════════════════════════════
drop policy "Members read brand imports" on storage.objects;
drop policy "Owners delete brand imports" on storage.objects;
-- "Owners upload brand imports" continua: enviar o PDF de uma marca que ainda
-- não existe é poder da conta, como criar a própria marca.

create policy "Quem alcança a marca lê o PDF dela" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'brand-imports'
    and (
      exists (
        select 1 from public.brand_imports i
        where i.storage_path = objects.name
          and i.brand_id is not null
          and public.tem_capacidade_na_marca(i.brand_id, 'consultar'))
      or (
        -- PDF ainda sem marca: é da conta, até a importação terminar.
        not exists (
          select 1 from public.brand_imports i
          where i.storage_path = objects.name and i.brand_id is not null)
        and (storage.foldername(objects.name))[1] in (
          select wm.workspace_id::text from public.workspace_members wm
          where wm.user_id = (select auth.uid()) and wm.role = 'owner')
      )
    )
  );

create policy "Quem administra a marca apaga o PDF dela" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'brand-imports'
    and (
      exists (
        select 1 from public.brand_imports i
        where i.storage_path = objects.name
          and i.brand_id is not null
          and public.tem_capacidade_na_marca(i.brand_id, 'administrar'))
      or (
        not exists (
          select 1 from public.brand_imports i
          where i.storage_path = objects.name and i.brand_id is not null)
        and (storage.foldername(objects.name))[1] in (
          select wm.workspace_id::text from public.workspace_members wm
          where wm.user_id = (select auth.uid()) and wm.role = 'owner')
      )
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- analysis-evidence
-- ════════════════════════════════════════════════════════════════════════
drop policy "Members can view workspace analysis evidence" on storage.objects;
drop policy "Members can upload workspace analysis evidence" on storage.objects;
drop policy "Members can update workspace analysis evidence" on storage.objects;
drop policy "Members can delete workspace analysis evidence" on storage.objects;

-- Ler: quem vê a análise. A RLS de `analysis_runs` já exige `consultar` na
-- marca, então a subconsulta só encontra a linha para quem pode.
create policy "Quem vê a análise vê a evidência" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'analysis-evidence'
    and exists (
      select 1 from public.analysis_runs r
      where r.id::text           = left(storage.filename(objects.name), 36)
        and r.workspace_id::text = (storage.foldername(objects.name))[1]
        and r.brand_id::text     = (storage.foldername(objects.name))[2])
  );

-- Enviar: só o autor, e só para a própria análise — a linha nasce antes do
-- arquivo (`src/lib/analysis/server.ts`), então ela já existe aqui.
create policy "Autor envia a evidência da própria análise" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'analysis-evidence'
    and exists (
      select 1 from public.analysis_runs r
      where r.id::text           = left(storage.filename(objects.name), 36)
        and r.workspace_id::text = (storage.foldername(objects.name))[1]
        and r.brand_id::text     = (storage.foldername(objects.name))[2]
        and r.created_by = (select auth.uid()))
  );

create policy "Autor ou quem administra a marca altera a evidência" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'analysis-evidence'
    and exists (
      select 1 from public.analysis_runs r
      where r.id::text           = left(storage.filename(objects.name), 36)
        and r.workspace_id::text = (storage.foldername(objects.name))[1]
        and r.brand_id::text     = (storage.foldername(objects.name))[2]
        and (r.created_by = (select auth.uid())
             or public.tem_capacidade_na_marca(r.brand_id, 'administrar')))
  )
  with check (
    bucket_id = 'analysis-evidence'
    and exists (
      select 1 from public.analysis_runs r
      where r.id::text           = left(storage.filename(objects.name), 36)
        and r.workspace_id::text = (storage.foldername(objects.name))[1]
        and r.brand_id::text     = (storage.foldername(objects.name))[2]
        and (r.created_by = (select auth.uid())
             or public.tem_capacidade_na_marca(r.brand_id, 'administrar')))
  );

create policy "Autor ou quem administra a marca apaga a evidência" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'analysis-evidence'
    and exists (
      select 1 from public.analysis_runs r
      where r.id::text           = left(storage.filename(objects.name), 36)
        and r.workspace_id::text = (storage.foldername(objects.name))[1]
        and r.brand_id::text     = (storage.foldername(objects.name))[2]
        and (r.created_by = (select auth.uid())
             or public.tem_capacidade_na_marca(r.brand_id, 'administrar')))
  );

-- ════════════════════════════════════════════════════════════════════════
-- A limpeza depois de apagar uma marca
-- ════════════════════════════════════════════════════════════════════════
--
-- Achado ao repassar os consumidores ANTES do verify, e não pela prova: ela não
-- exercitava a exclusão de marca.
--
-- `delete_brand_with_files` enfileira os arquivos e apaga a marca; os acessos
-- (`brand_members`), os assets e as análises somem em CASCATA. A drenagem
-- (`drenarFilaDeExclusao`) roda DEPOIS, com a sessão de quem administra a conta.
-- Com as regras acima e nada mais, ela:
--
--   1. mandaria remover, e nenhuma policy casaria — 0 arquivos, sem erro;
--   2. perguntaria se o arquivo ainda existe, não o enxergaria, e ouviria "não";
--   3. fecharia a pendência como removida.
--
-- Arquivo órfão no Storage para sempre, e o registro dizendo que saiu. Pior que
-- falhar: falhar se vê.
--
-- A regra abaixo devolve esses arquivos a quem administra a conta, e só a ele,
-- sob DUAS condições juntas:
--
--   · o arquivo está na fila de exclusão daquela conta; e
--   · a marca do caminho não tem acesso de NINGUÉM.
--
-- A segunda é a que importa. Sem ela, um dono de conta com acesso restrito
-- numa marca VIVA poderia enfileirar um arquivo dela ("Owners enqueue their
-- own deletions" aceita qualquer caminho da conta) e apagá-lo por esta porta.
-- Marca viva tem ao menos um acesso — o gatilho de criação e a semeadura
-- garantem —, então ela nunca satisfaz a condição. E quem administra a conta vê
-- todos os acessos da conta ("Quem administra a conta vê o acesso dela"), então
-- o `not exists` não é enganado pela RLS.
--
-- PDFs não precisam disto: com a importação apagada, eles já caem na regra do
-- "PDF sem marca", que é de quem administra a conta.
--
-- Fora do escopo, e registrado: imagens de página NÃO são enfileiradas por
-- `delete_brand_with_files` (só arquivos da biblioteca, PDFs e evidências). Isso
-- já deixava imagens órfãs antes desta migration.

create policy "Dono da conta vê arquivo enfileirado de marca apagada" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('brand-assets', 'analysis-evidence')
    and (storage.foldername(objects.name))[1] in (
      select wm.workspace_id::text from public.workspace_members wm
      where wm.user_id = (select auth.uid()) and wm.role = 'owner')
    and exists (
      select 1 from public.brand_deletions d
      where d.workspace_id::text = (storage.foldername(objects.name))[1]
        and d.bucket_id = objects.bucket_id
        and d.storage_path = objects.name)
    and not exists (
      select 1 from public.brand_members bm
      where bm.brand_id::text = (storage.foldername(objects.name))[2])
  );

create policy "Dono da conta apaga arquivo enfileirado de marca apagada" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('brand-assets', 'analysis-evidence')
    and (storage.foldername(objects.name))[1] in (
      select wm.workspace_id::text from public.workspace_members wm
      where wm.user_id = (select auth.uid()) and wm.role = 'owner')
    and exists (
      select 1 from public.brand_deletions d
      where d.workspace_id::text = (storage.foldername(objects.name))[1]
        and d.bucket_id = objects.bucket_id
        and d.storage_path = objects.name)
    and not exists (
      select 1 from public.brand_members bm
      where bm.brand_id::text = (storage.foldername(objects.name))[2])
  );
