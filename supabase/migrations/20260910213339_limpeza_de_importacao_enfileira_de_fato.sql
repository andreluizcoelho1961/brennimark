-- A rede de segurança da importação não enfileirava nada.
--
-- `enqueue_import_cleanup` (20260830141619) é chamada pelo importador quando a
-- publicação falha E a remoção imediata do PDF também falha. É o que impede um
-- PDF de terceiro de ficar no Storage sem marca, sem procedência e sem entrada
-- em fila nenhuma.
--
-- Três dias depois, 20260902004327 ensinou a fila sobre buckets: acrescentou
-- `bucket_id` SEM default e trocou a unicidade por
-- `(workspace_id, bucket_id, storage_path)`. As outras funções que enfileiram
-- foram reescritas junto; esta ficou para trás, e passou a falhar em TODA
-- chamada:
--
--   * `on conflict (workspace_id, storage_path)` não corresponde a índice
--     nenhum → 42P10, antes de inserir qualquer linha;
--   * e, corrigido só isso, o insert sem `bucket_id` bateria no not null
--     (23502) — o default foi retirado de propósito, para quem enfileira
--     declarar de qual bucket é o arquivo.
--
-- O importador não confere o retorno da chamada, então a falha era silenciosa:
-- o objeto ficava fora do alcance até da fila.
--
-- A correção é só o insert. Todo o resto é preservado como estava:
--
--   * `security invoker` — a função roda com os direitos de quem chama, e a
--     RLS de `brand_deletions` ("Owners enqueue their own deletions") é a
--     segunda trava, independente da verificação de papel feita aqui dentro;
--   * `search_path` vazio e nomes qualificados;
--   * `execute` só para `authenticated`: é o navegador de quem importa que a
--     chama, então retirar esse grant desligaria a rede de segurança;
--   * a recusa de enfileirar o arquivo de uma importação publicada.
create or replace function public.enqueue_import_cleanup(
  p_workspace_id uuid,
  p_import_id uuid,
  p_pdf_sha256 text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  caminho text;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = p_workspace_id
      and workspace_members.user_id = actor
      and workspace_members.role = 'owner'
  ) then
    raise exception 'only workspace owners can clean up an import' using errcode = '42501';
  end if;

  caminho := p_workspace_id::text || '/' || p_import_id::text || '/' || p_pdf_sha256 || '.pdf';

  if exists (
    select 1 from public.brand_imports
    where brand_imports.workspace_id = p_workspace_id
      and brand_imports.storage_path = caminho
  ) then
    raise exception 'this file belongs to a published import' using errcode = '23505';
  end if;

  -- O PDF da importação vive em `brand-imports`, e é daí que a drenagem
  -- precisa apagá-lo. Idempotente: repetir a mesma limpeza não duplica a
  -- pendência.
  insert into public.brand_deletions (workspace_id, bucket_id, storage_path, requested_by)
  values (p_workspace_id, 'brand-imports', caminho, actor)
  on conflict (workspace_id, bucket_id, storage_path) do nothing;

  return true;
end;
$$;

revoke execute on function public.enqueue_import_cleanup(uuid, uuid, text) from public, anon;
grant execute on function public.enqueue_import_cleanup(uuid, uuid, text) to authenticated;
