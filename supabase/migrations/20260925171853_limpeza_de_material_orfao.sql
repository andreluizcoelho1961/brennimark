-- A limpeza periódica do material órfão — 24/09/2026.
--
-- ─── O buraco ──────────────────────────────────────────────────────────────
--
-- Desde o envio direto ao Storage (PR #33), subir um material são dois passos:
-- PREPARAR (a rota escolhe o caminho e assina um endereço de envio) e CONCLUIR
-- (a rota confere os bytes que chegaram e grava a linha em `brand_assets`).
-- Quem fecha a aba ENTRE os dois deixa o arquivo na pasta da marca sem linha
-- nenhuma que o mencione: não aparece no catálogo, ninguém baixa, a exclusão da
-- marca não o encontra — e ocupa o espaço da conta para sempre.
--
-- ─── O que entra ───────────────────────────────────────────────────────────
--
-- Uma função que ENCONTRA esses objetos e os põe na fila que já existe,
-- `brand_deletions`. Ela não apaga nada: quem apaga é a drenagem de sempre
-- (`drenarFilaDeExclusao`), que confirma a ausência por observação antes de
-- fechar cada pendência. Uma fila só, uma disciplina só.
--
-- ─── O que é órfão — TODAS as condições ao mesmo tempo ─────────────────────
--
--   1. mora no bucket `brand-assets`;
--   2. tem a forma EXATA de caminho de material (`src/lib/storage/caminhos.ts`):
--        <conta>/<marca>/<uuid>-<nome seguro>      original
--        <conta>/<marca>/miniatura-<uuid>.png      miniatura
--      Qualquer outra forma é de outro dono, ou de ninguém que se conheça —
--      e o que não se conhece não se apaga;
--   3. nenhuma linha do produto aponta para ele. A lista é deliberadamente
--      MAIS LARGA que o necessário: o original e a miniatura de `brand_assets`,
--      as imagens de página de `brand_documents.images` (que moram neste mesmo
--      bucket — ver `apagar_marca_leva_imagens`), as miniaturas do manifesto
--      (`brand_source_pages`), e, por garantia, os caminhos do documento-fonte
--      e da importação. Um caminho citado em qualquer lugar fica;
--   4. tem mais de 24 horas — criado E alterado. A autorização de envio dura
--      10 minutos (`PRAZO_DO_ENVIO_MS`); 24 horas é folga larga para o envio
--      mais lento e para relógio torto;
--   5. ainda não está na fila (mesma conta, mesmo bucket, mesmo caminho);
--   6. a conta da pasta existe, e a marca da pasta, se existe, é DESSA conta.
--      Pasta com conta inexistente ou marca de outra conta não tem forma de
--      material do produto, tem forma de acidente: fica;
--   7. há alguém para constar como quem pediu. Desde `conta_removida` a coluna
--      `requested_by` aceita nulo (o login apagado vira nulo), mas uma pendência
--      NOVA nasce com autor: primeiro quem enviou o arquivo (o dono do objeto,
--      se o login ainda existe); senão, quem administra a conta há mais tempo.
--      Sem nenhum dos dois, a conta não tem quem responda pela exclusão, e o
--      arquivo fica.
--
-- Na dúvida, não enfileira. Um órfão que sobra custa espaço; um arquivo vivo
-- apagado custa o material do cliente.
--
-- ─── Limite por execução ───────────────────────────────────────────────────
--
-- `p_limite` (padrão 500, teto 1000), aplicado DEPOIS de todos os filtros —
-- senão um objeto recusado para sempre no começo da ordem ocuparia a vaga de
-- todos os outros em toda execução. Ordem: o mais antigo primeiro.
--
-- ─── Quem executa ──────────────────────────────────────────────────────────
--
-- Só `service_role`: a varredura atravessa TODAS as contas, e nenhuma sessão
-- de usuário tem por que ver a pasta de outra. SECURITY DEFINER porque lê
-- `storage.objects` e `auth.users`; `search_path` vazio e nomes qualificados.
-- A rota que chama é protegida por segredo (`/api/manutencao/materiais-orfaos`).

create function public.enfileirar_materiais_orfaos(p_limite integer default 500)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  enfileirados integer;
  -- Minúsculas só: é o que `gen_random_uuid()` e `crypto.randomUUID()` geram.
  -- Um uuid em maiúsculas não foi escrito pelo produto.
  uuid_re constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  forma text;
  corte timestamptz := now() - interval '24 hours';
begin
  if p_limite is null or p_limite < 1 or p_limite > 1000 then
    raise exception 'o limite por execução vai de 1 a 1000' using errcode = '22023';
  end if;

  -- O nome seguro (`nomeSeguro`) só tem letras, dígitos, ponto, hífen e
  -- sublinhado, e no máximo 160 caracteres.
  forma := '^' || uuid_re || '/' || uuid_re || '/('
        || uuid_re || '-[A-Za-z0-9._-]{1,160}'
        || '|miniatura-' || uuid_re || '\.png)$';

  with referenciados (caminho) as (
    select a.storage_path from public.brand_assets a
    union
    select a.miniatura_path from public.brand_assets a where a.miniatura_path is not null
    union
    select imagem->>'src'
      from public.brand_documents d,
           jsonb_array_elements(coalesce(d.images, '[]'::jsonb)) as imagem
     where nullif(imagem->>'src', '') is not null
    union
    select p.miniatura_path from public.brand_source_pages p where p.miniatura_path is not null
    union
    select s.storage_path from public.brand_source_documents s
    union
    select i.storage_path from public.brand_imports i
  ),
  candidatos as (
    select
      o.name,
      o.created_at,
      w.id as conta,
      coalesce(
        (select u.id from auth.users u where u.id::text = o.owner_id),
        (select wm.user_id from public.workspace_members wm
          where wm.workspace_id = w.id and wm.role = 'owner'
          order by wm.created_at, wm.user_id
          limit 1)
      ) as quem
    from storage.objects o
    -- Comparação por texto, sem `::uuid`: o planejador não promete avaliar a
    -- forma antes do cast, e um nome fora do padrão derrubaria a varredura.
    join public.workspaces w on w.id::text = split_part(o.name, '/', 1)
    where o.bucket_id = 'brand-assets'
      and o.name ~ forma
      and o.created_at < corte
      and coalesce(o.updated_at, o.created_at) < corte
      and not exists (select 1 from referenciados r where r.caminho = o.name)
      -- A mesma chave do `on conflict`. Filtrar ANTES do limite é o que
      -- importa: sem isto, o que já está na fila ocuparia as vagas da
      -- execução e o `on conflict` as descartaria, sem enfileirar mais nada.
      and not exists (
        select 1 from public.brand_deletions f
         where f.workspace_id = w.id
           and f.bucket_id = 'brand-assets'
           and f.storage_path = o.name)
      and not exists (
        select 1 from public.brands b
         where b.id::text = split_part(o.name, '/', 2) and b.workspace_id <> w.id)
  )
  insert into public.brand_deletions (workspace_id, bucket_id, storage_path, requested_by)
  select c.conta, 'brand-assets', c.name, c.quem
    from candidatos c
   where c.quem is not null
   order by c.created_at, c.name
   limit p_limite
  on conflict (workspace_id, bucket_id, storage_path) do nothing;

  get diagnostics enfileirados = row_count;
  return enfileirados;
end;
$$;

revoke execute on function public.enfileirar_materiais_orfaos(integer) from public, anon, authenticated;
grant execute on function public.enfileirar_materiais_orfaos(integer) to service_role;

comment on function public.enfileirar_materiais_orfaos(integer) is
  'Enfileira em brand_deletions o material órfão do bucket brand-assets (envio abandonado entre '
  'preparar e concluir): forma de caminho de material, nenhuma referência no produto, mais de '
  '24 h, fora da fila. Não apaga nada — a drenagem apaga. Só service_role.';
