-- O documento-fonte também decide por MARCA — achado 3 do Codex Security (15/09),
-- mais uma função que o relatório não viu e a varredura achou.
--
-- ─── O que estava para trás ──────────────────────────────────────────────
--
-- `acesso_por_marca` (13/09) converteu as policies e o gatilho de auditoria
-- editorial, mas duas funções `SECURITY DEFINER` continuaram perguntando "é
-- dona da CONTA?":
--
--   registrar_documento_fonte   registra o original e o manifesto de páginas
--   editar_documento_fonte      altera título, idioma e estado do original
--
-- Função definer contorna a RLS de propósito, então a verificação DENTRO dela é
-- a única que resta. Com o acesso por marca, ela errava nos dois sentidos:
--
--   PERMITIA DEMAIS: quem administra a conta mas recebeu só `consultar` numa
--   marca registrava e editava o documento-fonte dessa marca — a restrição por
--   marca não valia aqui.
--
--   RECUSAVA DE MENOS: quem recebeu `administrar` ou `editar` NA MARCA sem ser
--   dona da conta — o caso que o produto passou a vender — era barrado com
--   42501.
--
-- A varredura que achou a segunda (`editar_documento_fonte`) foi listar TODAS
-- as funções que citam `workspace_members` e perguntar quais mencionam `owner`
-- sem mencionar `brand_members`. O relatório externo só tinha visto a primeira.
--
-- ─── A capacidade de cada uma ────────────────────────────────────────────
--
-- Registrar é parte de importar: `administrar` na marca, o mesmo que a policy
-- de `brand_imports` já exige. Editar título, idioma e estado é trabalho
-- editorial: `editar`, o mesmo que `brand_documents` exige.
--
-- `brand_id` é NOT NULL nas duas tabelas envolvidas, então não há caso de linha
-- sem marca a tratar aqui — diferente de `capture_brand_document_version`.
--
-- Nas duas funções muda SÓ a verificação de autorização; o resto do corpo é o
-- que já estava lá.

CREATE OR REPLACE FUNCTION public.registrar_documento_fonte(p_workspace_id uuid, p_brand_id uuid, p_storage_path text, p_pdf_sha256 text, p_byte_size bigint, p_page_count integer, p_tipo text, p_idioma text, p_titulo text, p_paginas jsonb, p_created_by uuid, p_import_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  novo_id uuid;
  quantas integer;
  distintas integer;
  proxima_versao integer;
  menor integer;
  maior integer;
begin
  if p_created_by is null then
    raise exception 'autor é obrigatório' using errcode = '22004';
  end if;
  /*
   * Quem publica precisa ADMINISTRAR A MARCA (16/09/2026).
   *
   * Antes: `owner` da conta. A função é definer e contorna a RLS, então esta
   * verificação é a única que resta — e a antiga deixava passar quem
   * administra a conta com acesso restrito à marca.
   *
   * O par (marca, conta) é conferido junto: uma marca de OUTRA conta não
   * satisfaz a linha de acesso desta, e a inserção nem chega às FKs compostas.
   */
  if not exists (
    select 1 from public.brand_members
    where brand_members.brand_id = p_brand_id
      and brand_members.workspace_id = p_workspace_id
      and brand_members.user_id = p_created_by
      and 'administrar' = any (brand_members.capacidades)
  ) then
    raise exception 'só quem administra esta marca registra documento-fonte'
      using errcode = '42501';
  end if;

  if coalesce(jsonb_typeof(p_paginas), 'null') <> 'array' then
    raise exception 'páginas devem vir num array' using errcode = '22023';
  end if;

  /*
   * A verificação de completude, e ela é o motivo desta função existir.
   *
   * Três perguntas sobre o CONJUNTO, que nenhum `check` de linha responde:
   * quantas vieram, quantas são distintas, e qual a faixa. As três precisam
   * fechar em 1..page_count para a gravação acontecer.
   */
  select count(*), count(distinct (pagina->>'pagina')::integer),
         min((pagina->>'pagina')::integer), max((pagina->>'pagina')::integer)
    into quantas, distintas, menor, maior
  from jsonb_array_elements(p_paginas) as pagina;

  if quantas <> p_page_count then
    raise exception 'manifesto incompleto: % páginas para um PDF de %',
      quantas, p_page_count using errcode = '22023';
  end if;
  if distintas <> quantas then
    raise exception 'manifesto com página repetida: % linhas, % números distintos',
      quantas, distintas using errcode = '22023';
  end if;
  -- Com contagem certa e sem repetição, min=1 e max=N implicam 1..N sem furo.
  if menor <> 1 or maior <> p_page_count then
    raise exception 'manifesto com furo: faixa % a %, esperada 1 a %',
      menor, maior, p_page_count using errcode = '22023';
  end if;

  /*
   * ─── IDEMPOTÊNCIA: mesma marca, mesmo tipo, mesmo arquivo ──────────────
   *
   * A publicação acontece em dois passos que NÃO são atômicos entre si: o
   * navegador publica marca e seções, e depois uma rota de servidor registra o
   * documento-fonte e o manifesto. Se a resposta do segundo passo se perder na
   * rede, a interface precisa poder repetir — e repetir não pode criar um
   * segundo documento nem duplicar 743 linhas de manifesto.
   *
   * A chave natural é o `sha256`: mesmo arquivo, mesma marca, mesmo tipo é o
   * mesmo documento. Encontrado, devolve o id existente e não toca no
   * manifesto.
   *
   * Isto NÃO afrouxa a regra de "uma ativa por tipo": um arquivo DIFERENTE do
   * mesmo tipo continua barrado pelo índice, porque substituir é ato
   * explícito. O que passa a ser tolerado é a repetição do mesmo ato.
   */
  select id into novo_id
  from public.brand_source_documents
  where brand_id = p_brand_id
    and workspace_id = p_workspace_id
    and tipo = coalesce(nullif(p_tipo, ''), 'manual')
    and pdf_sha256 = p_pdf_sha256;

  if novo_id is not null then
    -- Repetir precisa fechar o vínculo, e não só devolver o id: a tentativa
    -- anterior pode ter gravado o documento e sido interrompida antes disto.
    perform private.vincular_importacao_ao_documento(
      p_import_id, novo_id, p_brand_id, p_workspace_id, p_pdf_sha256);
    return novo_id;
  end if;

  /*
   * A próxima versão DENTRO DO TIPO.
   *
   * Registrar um segundo manual não substitui o primeiro em silêncio: a versão
   * avança, e o índice de "uma ativa por tipo" recusa a inserção enquanto a
   * anterior estiver ativa. Substituir é ato explícito, não efeito colateral
   * de importar de novo — perder o manual vigente por reimportação seria a
   * pior forma de descobrir essa regra.
   */
  select coalesce(max(versao), 0) + 1 into proxima_versao
  from public.brand_source_documents
  where brand_id = p_brand_id
    and workspace_id = p_workspace_id
    and tipo = coalesce(nullif(p_tipo, ''), 'manual');

  insert into public.brand_source_documents (
    workspace_id, brand_id, storage_path, pdf_sha256, byte_size, page_count,
    tipo, idioma, titulo, estado_de_processamento, versao, created_by)
  values (
    p_workspace_id, p_brand_id, p_storage_path, p_pdf_sha256, p_byte_size, p_page_count,
    coalesce(nullif(p_tipo, ''), 'manual'), nullif(p_idioma, ''), coalesce(p_titulo, ''),
    'concluido', proxima_versao, p_created_by)
  returning id into novo_id;

  insert into public.brand_source_pages (
    workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt,
    rotacao, tem_texto, caracteres, miniatura_path, document_id,
    cobertura, motivo_da_cobertura, classificacao, confianca)
  select
    p_workspace_id, p_brand_id, novo_id,
    (p->>'pagina')::integer,
    (p->>'largura_pt')::numeric,
    (p->>'altura_pt')::numeric,
    coalesce((p->>'rotacao')::integer, 0),
    coalesce((p->>'tem_texto')::boolean, false),
    coalesce((p->>'caracteres')::integer, 0),
    nullif(p->>'miniatura_path', ''),
    nullif(p->>'document_id', '')::uuid,
    case when nullif(p->>'document_id', '') is null then 'sem-secao' else 'secao' end,
    coalesce(nullif(p->>'motivo_da_cobertura', ''),
             case when nullif(p->>'document_id', '') is null
                  then 'sem seção atribuída na importação' else '' end),
    nullif(p->>'classificacao', ''),
    nullif(p->>'confianca', '')::numeric
  from jsonb_array_elements(p_paginas) as p;

  perform private.vincular_importacao_ao_documento(
    p_import_id, novo_id, p_brand_id, p_workspace_id, p_pdf_sha256);

  return novo_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.editar_documento_fonte(p_id uuid, p_titulo text, p_idioma text, p_estado text, p_ator uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  conta uuid;
  marca uuid;
begin
  select workspace_id, brand_id into conta, marca
    from public.brand_source_documents where id = p_id;
  if conta is null then
    raise exception 'documento-fonte não encontrado' using errcode = 'P0002';
  end if;
  -- Editar título, idioma e estado é trabalho editorial: `editar` NA MARCA, o
  -- mesmo que `brand_documents` exige. Antes pedia dona da CONTA (16/09/2026).
  if not exists (
    select 1 from public.brand_members
    where brand_members.brand_id = marca
      and brand_members.user_id = p_ator
      and 'editar' = any (brand_members.capacidades)
  ) then
    raise exception 'só quem edita esta marca edita o documento-fonte'
      using errcode = '42501';
  end if;

  update public.brand_source_documents
  set titulo = coalesce(p_titulo, titulo),
      idioma = coalesce(p_idioma, idioma),
      estado_de_processamento = coalesce(nullif(p_estado, ''), estado_de_processamento),
      updated_at = now()
  where id = p_id;
end;
$function$;
