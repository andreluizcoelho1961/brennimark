-- Registrar importação sem recursão entre `brand_imports` e o Storage.
--
-- ─── O defeito ───────────────────────────────────────────────────────────
--
-- Achado no ensaio de 18/09/2026, na primeira importação feita em produção
-- desde 12/09: "infinite recursion detected in policy for relation
-- brand_imports", e a marca não era criada.
--
-- O laço:
--   1. a policy de INSERT de `brand_imports` confere se o PDF existe, lendo
--      `storage.objects`;
--   2. a policy de SELECT de `storage.objects` para `brand-imports` (entrou em
--      15/09, com o Storage por marca) lê `brand_imports` para saber a marca;
--   3. que volta à policy de `brand_imports`.
--
-- Nenhuma prova pegou: todas gravavam `brand_imports` como superusuário, que
-- passa por cima das policies, e a suíte de navegador roda sem banco. A prova
-- nova (`scripts/prova-importacao-como-usuario.sh`) importa como usuário comum.
--
-- ─── A correção ──────────────────────────────────────────────────────────
--
-- A pergunta "o PDF está no Storage?" passa a ser respondida por uma função
-- DEFINER, que lê `storage.objects` sem acionar a policy — é o que quebra o
-- ciclo. A regra da importação continua a mesma, palavra por palavra: quem
-- registra é quem administra a marca, o caminho é o canônico, e o PDF precisa
-- ter subido antes.

create function public.pdf_de_importacao_existe(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  /*
   * Só responde sobre caminhos de uma conta da qual quem pergunta participa.
   * Sem isto, a função seria um oráculo: qualquer pessoa com sessão poderia
   * perguntar se um caminho existe no Storage de outra conta. Os caminhos
   * carregam dois uuids e um sha-256 — não se adivinham —, mas a fronteira não
   * depende disso.
   */
  select exists (
    select 1 from storage.objects o
     where o.bucket_id = 'brand-imports'
       and o.name = p_caminho
       and (storage.foldername(o.name))[1] in (
         select wm.workspace_id::text from public.workspace_members wm
          where wm.user_id = (select auth.uid())));
$$;

revoke execute on function public.pdf_de_importacao_existe(text) from public, anon;
grant execute on function public.pdf_de_importacao_existe(text) to authenticated, service_role;

drop policy "Quem administra a marca registra importação" on public.brand_imports;
create policy "Quem administra a marca registra importação" on public.brand_imports
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and brand_id is not null
    and public.tem_capacidade_na_marca(brand_id, 'administrar')
    and storage_path = workspace_id::text || '/' || import_id::text || '/' || pdf_sha256 || '.pdf'
    and public.pdf_de_importacao_existe(storage_path));
