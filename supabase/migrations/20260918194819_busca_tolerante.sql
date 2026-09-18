-- A busca de trechos deixa de exigir TODAS as palavras, e passa a tratar as
-- grafias americana e britânica como a mesma palavra — 18/09/2026.
--
-- ─── O defeito, visto no ensaio ─────────────────────────────────────────────
--
-- Pergunta: "what is the primary color?". O manual importado tem seis trechos
-- sobre cor — e escreve "colour", à britânica. A busca anterior:
--
--   1. exigia todas as palavras (`'primari' & 'color'`); o manual nunca diz
--      "primary", então nenhum trecho passava;
--   2. tratava "color" e "colour" como palavras distintas — o dicionário
--      inglês do Postgres não as une.
--
-- Zero trechos. A IA respondeu, corretamente, "não há diretriz documentada" —
-- sobre um manual que documenta. Afirmação falsa sobre o cliente, produzida
-- pela busca e não pelo modelo.
--
-- ─── O que muda ─────────────────────────────────────────────────────────────
--
--   • Cada palavra da pergunta vira um GRUPO: ela mais a sua outra grafia
--     (color | colour). A lista de pares está aqui, em palavras, e é reduzida
--     ao radical pelo mesmo dicionário da marca — nunca radical escrito à mão,
--     que quebraria calado se o dicionário mudasse.
--   • Primeira tentativa: TODOS os grupos (como antes, só que com grafias).
--   • Se ela não achar nada: QUALQUER grupo, os mais relevantes primeiro.
--
-- ⚖️ Tradeoff aceito: o plano B pode trazer trecho só parcialmente
-- relacionado. A IA continua citando fonte e status, e afirma apenas o que o
-- trecho diz — trecho a mais custa tokens; trecho a menos faz o produto
-- afirmar que o cliente não documentou o que documentou.
--
-- ⚖️ Perde-se a sintaxe de `websearch_to_tsquery` (aspas para frase, `-` para
-- excluir). Ninguém a digita num chat; quem digitar tem as palavras buscadas
-- normalmente.
--
-- ─── O que NÃO muda ─────────────────────────────────────────────────────────
--
-- `security invoker` (a RLS de brand_chunks decide o que a sessão vê), o
-- `brand_id` obrigatório, a resposta vazia para marca invisível, o teto de 20
-- trechos e o contrato de retorno — o código da aplicação não muda.
--
-- Os lexemas viram tsquery por `plainto_tsquery('simple', …)`, e não por
-- concatenação de texto: texto do cliente nunca é interpretado como sintaxe.

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
  radicais_a text[];
  radicais_b text[];
  teto integer := least(greatest(coalesce(p_limite, 8), 1), 20);
begin
  select b.language into idioma from public.brands b where b.id = p_brand_id;
  -- Marca invisível para esta sessão: a RLS de `brands` já não a devolveu.
  -- "Não existe" e "não é sua" respondem igual.
  if idioma is null then return; end if;

  config := public.config_de_busca(idioma);

  -- Os pares de grafia, reduzidos ao radical pelo dicionário da marca.
  -- Par cujo radical some (palavra vazia no dicionário) fica de fora.
  select array_agg(ra), array_agg(rb)
    into radicais_a, radicais_b
  from (
    select (tsvector_to_array(to_tsvector(config, v.a)))[1] as ra,
           (tsvector_to_array(to_tsvector(config, v.b)))[1] as rb
    from (values
      ('color', 'colour'), ('colors', 'colours'), ('colored', 'coloured'),
      ('gray', 'grey'), ('grayscale', 'greyscale'),
      ('center', 'centre'), ('centered', 'centred'),
      ('favorite', 'favourite'), ('behavior', 'behaviour'), ('humor', 'humour'),
      ('flavor', 'flavour'), ('harbor', 'harbour'), ('honor', 'honour'),
      ('labor', 'labour'), ('neighbor', 'neighbour'), ('rumor', 'rumour'),
      ('theater', 'theatre'), ('meter', 'metre'), ('fiber', 'fibre'),
      ('liter', 'litre'), ('caliber', 'calibre'),
      ('license', 'licence'), ('defense', 'defence'), ('offense', 'offence'),
      ('catalog', 'catalogue'), ('dialog', 'dialogue'), ('program', 'programme'),
      ('aluminum', 'aluminium'), ('jewelry', 'jewellery'),
      ('organization', 'organisation'), ('organize', 'organise'),
      ('customize', 'customise'), ('optimize', 'optimise'), ('analyze', 'analyse'),
      ('realize', 'realise'), ('recognize', 'recognise'), ('utilize', 'utilise'),
      ('emphasize', 'emphasise'), ('minimize', 'minimise'), ('maximize', 'maximise'),
      ('stylize', 'stylise'), ('visualize', 'visualise'), ('harmonize', 'harmonise'),
      ('standardize', 'standardise'), ('capitalize', 'capitalise'),
      ('italicize', 'italicise'), ('personalize', 'personalise'),
      ('modeling', 'modelling'), ('labeled', 'labelled'), ('labeling', 'labelling'),
      ('traveling', 'travelling'), ('canceled', 'cancelled'), ('leveling', 'levelling')
    ) as v(a, b)
  ) pares
  where ra is not null and rb is not null and ra <> rb;

  -- As palavras da pergunta, já sem palavras vazias e reduzidas ao radical
  -- pelo dicionário da marca — o mesmo que indexou os trechos.
  for lexema in
    select distinct t.lexeme
    from unnest(to_tsvector(config, coalesce(p_consulta, ''))) t
  loop
    grupo := plainto_tsquery('simple', lexema);
    if grupo::text = '' then continue; end if;

    -- A outra grafia, se a palavra estiver num par.
    for i in 1 .. coalesce(array_length(radicais_a, 1), 0) loop
      if radicais_a[i] = lexema and radicais_b[i] <> lexema then
        grupo := grupo || plainto_tsquery('simple', radicais_b[i]);
      elsif radicais_b[i] = lexema and radicais_a[i] <> lexema then
        grupo := grupo || plainto_tsquery('simple', radicais_a[i]);
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
