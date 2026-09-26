-- Sinônimos de manual de marca na busca de trechos — 26/09/2026.
--
-- ─── O defeito, visto no ensaio ─────────────────────────────────────────────
--
-- Pergunta: "Qual é o logotipo principal?". O manual do Bradesco responde na
-- página 4 — "versão preferencial / versão secundária… a secundária deve ser
-- utilizada quando não for possível usar a versão preferencial" — mas escreve
-- LOGO e PREFERENCIAL. A busca procura palavras: "logotipo" e "principal" não
-- estão lá, a página 4 não chegou ao Vini, e ele respondeu "não há diretriz
-- documentada" sobre um manual que documenta. É o mesmo defeito de 18/09
-- (color × colour), agora com sinônimos em vez de grafias.
--
-- ─── O que muda ─────────────────────────────────────────────────────────────
--
-- Os PARES de grafia da `busca_tolerante` viram GRUPOS: uma palavra da
-- pergunta que pertence a um grupo leva junto todas as outras do grupo
-- (logotipo | logo | logomarca). Os pares de grafia continuam, cada um como um
-- grupo de duas palavras. O resto é igual: todas as palavras primeiro, qualquer
-- uma no plano B; radicais sempre pelo dicionário da marca, nunca escritos à
-- mão; `plainto_tsquery('simple', …)` para que texto nunca vire sintaxe.
--
-- ⚖️ Tradeoff: um sinônimo largo demais traz trecho a mais. A lista é CURTA e
-- de vocabulário de manual de marca — nada de "marca", "imagem" ou "cor"
-- ligado a palavras genéricas. Trecho a mais custa tokens; trecho a menos faz o
-- produto afirmar que o cliente não documentou o que documentou.
--
-- Uma palavra de um idioma num manual de outro (logo num manual em português)
-- é reduzida pelo dicionário DA MARCA, o mesmo que indexou os trechos: o
-- radical pode sair esquisito, mas sai igual nos dois lados.
--
-- Achado da prova: termo de UMA letra ("é", "à") deixa de contar. O dicionário
-- português não os tem como palavra vazia, e "é" na pergunta derrubava a busca
-- de todas as palavras para o plano B.
--
-- ─── O que NÃO muda ─────────────────────────────────────────────────────────
--
-- `security invoker` (a RLS de brand_chunks decide), o `brand_id` obrigatório,
-- a resposta vazia para marca invisível, o teto de 20 e o contrato de retorno.
-- Nenhuma tabela, nenhum dado.

create or replace function public.buscar_trechos(
  p_brand_id uuid,
  p_consulta text,
  p_limite integer default 8
)
returns table (
  document_slug text,
  document_title text,
  group_name text,
  section text,
  status text,
  page_start integer,
  page_end integer,
  content text,
  relevancia real
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  idioma text;
  config regconfig;
  lexema text;
  grupo tsquery;
  todas tsquery;
  qualquer tsquery;
  achados integer;
  ids integer[];
  radicais text[];
  i integer;
  j integer;
  teto integer := least(greatest(coalesce(p_limite, 8), 1), 20);
begin
  select b.language into idioma from public.brands b where b.id = p_brand_id;
  -- Marca invisível para esta sessão: a RLS de `brands` já não a devolveu.
  -- "Não existe" e "não é sua" respondem igual.
  if idioma is null then return; end if;

  config := public.config_de_busca(idioma);

  -- Os grupos, reduzidos ao radical pelo dicionário da marca. Palavra cujo
  -- radical some (palavra vazia no dicionário) fica de fora.
  select array_agg(g.id order by g.id, g.radical), array_agg(g.radical order by g.id, g.radical)
    into ids, radicais
  from (
    select distinct v.id, (tsvector_to_array(to_tsvector(config, v.palavra)))[1] as radical
    from (values
      -- Vocabulário de manual de marca — português.
      (1, 'logotipo'), (1, 'logo'), (1, 'logomarca'), (1, 'logótipo'),
      (2, 'principal'), (2, 'preferencial'), (2, 'primária'), (2, 'prioritária'), (2, 'padrão'),
      (3, 'secundária'), (3, 'alternativa'), (3, 'alternativo'),
      (4, 'proteção'), (4, 'respiro'), (4, 'interferência'),
      (5, 'tipografia'), (5, 'fonte'), (5, 'tipográfica'), (5, 'tipográfico'),
      (6, 'cor'), (6, 'cores'), (6, 'paleta'), (6, 'cromática'), (6, 'cromático'),
      (7, 'ícone'), (7, 'iconografia'),
      (8, 'grafismo'), (8, 'padronagem'), (8, 'textura'),
      (9, 'fotografia'), (9, 'foto'), (9, 'fotográfico'),
      (10, 'incorreto'), (10, 'incorretos'), (10, 'proibido'), (10, 'errado'), (10, 'indevido'),
      (11, 'símbolo'), (11, 'monograma'), (11, 'ícone'),
      -- Vocabulário de manual de marca — inglês.
      (21, 'logo'), (21, 'logotype'), (21, 'wordmark'), (21, 'logomark'),
      (22, 'primary'), (22, 'main'), (22, 'preferred'), (22, 'principal'), (22, 'master'),
      (23, 'secondary'), (23, 'alternative'), (23, 'alternate'),
      (24, 'clearspace'), (24, 'exclusion'),
      (25, 'typography'), (25, 'typeface'), (25, 'font'),
      (26, 'color'), (26, 'colour'), (26, 'palette'), (26, 'swatch'),
      (27, 'icon'), (27, 'iconography'),
      (28, 'photography'), (28, 'photo'), (28, 'imagery'),
      (29, 'incorrect'), (29, 'misuse'), (29, 'prohibited'), (29, 'wrong'),
      (30, 'symbol'), (30, 'monogram'),
      -- Grafias americana e britânica (a lista da `busca_tolerante`, um grupo por par).
      (101, 'colors'), (101, 'colours'), (102, 'colored'), (102, 'coloured'),
      (103, 'gray'), (103, 'grey'), (104, 'grayscale'), (104, 'greyscale'),
      (105, 'center'), (105, 'centre'), (106, 'centered'), (106, 'centred'),
      (107, 'favorite'), (107, 'favourite'), (108, 'behavior'), (108, 'behaviour'),
      (109, 'humor'), (109, 'humour'), (110, 'flavor'), (110, 'flavour'),
      (111, 'harbor'), (111, 'harbour'), (112, 'honor'), (112, 'honour'),
      (113, 'labor'), (113, 'labour'), (114, 'neighbor'), (114, 'neighbour'),
      (115, 'rumor'), (115, 'rumour'), (116, 'theater'), (116, 'theatre'),
      (117, 'meter'), (117, 'metre'), (118, 'fiber'), (118, 'fibre'),
      (119, 'liter'), (119, 'litre'), (120, 'caliber'), (120, 'calibre'),
      (121, 'license'), (121, 'licence'), (122, 'defense'), (122, 'defence'),
      (123, 'offense'), (123, 'offence'), (124, 'catalog'), (124, 'catalogue'),
      (125, 'dialog'), (125, 'dialogue'), (126, 'program'), (126, 'programme'),
      (127, 'aluminum'), (127, 'aluminium'), (128, 'jewelry'), (128, 'jewellery'),
      (129, 'organization'), (129, 'organisation'), (130, 'organize'), (130, 'organise'),
      (131, 'customize'), (131, 'customise'), (132, 'optimize'), (132, 'optimise'),
      (133, 'analyze'), (133, 'analyse'), (134, 'realize'), (134, 'realise'),
      (135, 'recognize'), (135, 'recognise'), (136, 'utilize'), (136, 'utilise'),
      (137, 'emphasize'), (137, 'emphasise'), (138, 'minimize'), (138, 'minimise'),
      (139, 'maximize'), (139, 'maximise'), (140, 'stylize'), (140, 'stylise'),
      (141, 'visualize'), (141, 'visualise'), (142, 'harmonize'), (142, 'harmonise'),
      (143, 'standardize'), (143, 'standardise'), (144, 'capitalize'), (144, 'capitalise'),
      (145, 'italicize'), (145, 'italicise'), (146, 'personalize'), (146, 'personalise'),
      (147, 'modeling'), (147, 'modelling'), (148, 'labeled'), (148, 'labelled'),
      (149, 'labeling'), (149, 'labelling'), (150, 'traveling'), (150, 'travelling'),
      (151, 'canceled'), (151, 'cancelled'), (152, 'leveling'), (152, 'levelling')
    ) as v(id, palavra)
  ) g
  where g.radical is not null;

  -- As palavras da pergunta, já sem palavras vazias e reduzidas ao radical
  -- pelo dicionário da marca — o mesmo que indexou os trechos.
  for lexema in
    select distinct t.lexeme
    from unnest(to_tsvector(config, coalesce(p_consulta, ''))) t
  loop
    -- Uma letra só não é termo de busca. O dicionário português do Postgres
    -- não tem "é" nem "à" como palavra vazia: "Qual é o logotipo principal?"
    -- exigia "é" em TODOS os trechos, nenhum trecho completo passava, e o
    -- plano B trazia qualquer página com "é" (achado da prova, 26/09/2026).
    if char_length(lexema) < 2 then continue; end if;
    grupo := plainto_tsquery('simple', lexema);
    if grupo::text = '' then continue; end if;

    -- Os outros membros de todo grupo a que a palavra pertence.
    for i in 1 .. coalesce(array_length(ids, 1), 0) loop
      if radicais[i] = lexema then
        for j in 1 .. array_length(ids, 1) loop
          if ids[j] = ids[i] and radicais[j] <> lexema then
            grupo := grupo || plainto_tsquery('simple', radicais[j]);
          end if;
        end loop;
      end if;
    end loop;

    todas := case when todas is null then grupo else todas && grupo end;
    qualquer := case when qualquer is null then grupo else qualquer || grupo end;
  end loop;

  if todas is null then return; end if;

  return query
  select c.slug, c.title, c.group_name, c.section, c.status,
         c.page_start, c.page_end, c.content,
         ts_rank(c.tsv, todas) as relevancia
  from public.brand_chunks c
  where c.brand_id = p_brand_id
    and c.tsv @@ todas
  order by relevancia desc, c.slug, c.ordinal
  limit teto;

  get diagnostics achados = row_count;
  if achados > 0 then return; end if;

  -- Plano B: nenhum trecho tem todas as palavras. Qualquer uma serve, e a
  -- ordem por relevância põe primeiro os que casam mais palavras.
  return query
  select c.slug, c.title, c.group_name, c.section, c.status,
         c.page_start, c.page_end, c.content,
         ts_rank(c.tsv, qualquer) as relevancia
  from public.brand_chunks c
  where c.brand_id = p_brand_id
    and c.tsv @@ qualquer
  order by relevancia desc, c.slug, c.ordinal
  limit teto;
end;
$$;

-- `create or replace` preserva a ACL anterior; os privilégios ficam ditos
-- explicitamente mesmo assim, para o arquivo bastar sozinho num banco novo.
revoke all on function public.buscar_trechos(uuid, text, integer) from public, anon;
grant execute on function public.buscar_trechos(uuid, text, integer) to authenticated, service_role;
