-- As imagens de leitura das páginas — o Vini VÊ o manual — 26/09/2026.
--
-- ─── Por quê ────────────────────────────────────────────────────────────────
--
-- Decisão do André, 26/09/2026. Com o manual inteiro em texto (#47), o Vini
-- passou a raciocinar — e errou a paleta do Bradesco: a página 22 é uma TABELA
-- de amostras, e o texto extraído dela é uma sopa de códigos sem coluna nem
-- nome. Quem olha a página conta 17 tons; quem lê o texto, não. A IA principal
-- (Gemini) enxerga imagem: com a página ao lado do texto, ela lê a tabela como
-- uma pessoa lê.
--
-- ─── O que entra ────────────────────────────────────────────────────────────
--
--   1. `brand_source_pages.miniatura_path` — a coluna já existia, vazia desde o
--      ADR-0006 (12/09), que desligou a imagem de página quando o objetivo era
--      REMONTAR a página. O objetivo agora é outro: a IA ler. O caminho é
--      DETERMINÍSTICO — `<conta>/<marca>/pagina-<documento>-<n>.jpg` —, então
--      gerar de novo sobrescreve o mesmo arquivo, e o check abaixo tranca a
--      forma: uma página nunca aponta para arquivo de outra, nem de outra marca.
--   2. `registrar_imagem_de_leitura(documento, página)` — quem EDITA a marca
--      registra a imagem que acabou de enviar. SECURITY DEFINER porque a
--      tabela não tem política de escrita para sessão (a importação escreve
--      pela função de registro); confere a capacidade na marca e que o arquivo
--      EXISTE no Storage, no caminho exato, antes de gravar.
--
-- A exclusão da marca já enfileira `miniatura_path` (`apagar_marca_leva_imagens`),
-- e a limpeza de órfãos (`limpeza_de_material_orfao`) já a conta como
-- referência: nada muda lá.
--
-- ⚖️ Tradeoff: ~200 KB por página no Storage (um manual de 47 páginas, ~10 MB).
-- Reversível: apagar a coluna preenchida e os arquivos não afeta o resto.

alter table public.brand_source_pages
  add constraint brand_source_pages_miniatura_na_forma check (
    miniatura_path is null
    or miniatura_path = workspace_id::text || '/' || brand_id::text
         || '/pagina-' || source_document_id::text || '-' || pagina::text || '.jpg'
  );

create function public.registrar_imagem_de_leitura(p_source_document_id uuid, p_pagina integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  linha record;
  caminho text;
begin
  if (select auth.uid()) is null then
    raise exception 'sessão obrigatória' using errcode = '28000';
  end if;

  select p.id, p.workspace_id, p.brand_id into linha
    from public.brand_source_pages p
   where p.source_document_id = p_source_document_id and p.pagina = p_pagina;
  -- Página inexistente e página de marca alheia respondem igual.
  if linha.id is null or not public.tem_capacidade_na_marca(linha.brand_id, 'editar') then
    raise exception 'página não encontrada' using errcode = 'P0002';
  end if;

  caminho := linha.workspace_id::text || '/' || linha.brand_id::text
          || '/pagina-' || p_source_document_id::text || '-' || p_pagina::text || '.jpg';

  -- O arquivo tem de EXISTIR: registrar caminho sem arquivo faria o Vini
  -- procurar uma imagem que não há.
  if not exists (
    select 1 from storage.objects o where o.bucket_id = 'brand-assets' and o.name = caminho
  ) then
    raise exception 'imagem não enviada' using errcode = 'P0002';
  end if;

  update public.brand_source_pages set miniatura_path = caminho where id = linha.id;
  return caminho;
end;
$$;

revoke all on function public.registrar_imagem_de_leitura(uuid, integer) from public, anon;
grant execute on function public.registrar_imagem_de_leitura(uuid, integer) to authenticated;
