-- Prova da busca tolerante de trechos — 18/09/2026.
--
-- Nasce do ensaio: "what is the primary color?" num manual que escreve
-- "colour" e nunca diz "primary" voltava zero trechos, e a IA afirmava que a
-- marca não documentava cor. Ver a migration 20260918193759_busca_tolerante.
--
-- Mesmo método das outras provas: mundo próprio, a busca chamada COMO USUÁRIO
-- (superusuário passa por cima da RLS e provaria nada), preparação que falha
-- REPROVA, e `rollback` no fim.
--
-- O que ela tranca:
--   • grafia americana acha texto britânico, e vice-versa;
--   • todas as palavras continuam tendo prioridade — o plano B só entra
--     quando nenhum trecho tem todas;
--   • o plano B acha o que a busca anterior perdia;
--   • o isolamento não mudou: nem outra marca da mesma conta, nem outra conta;
--   • texto com cara de sintaxe não quebra a busca;
--   • o teto de 20 trechos continua valendo.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (conta uuid, outra uuid, admin uuid, consulta uuid, fora uuid,
                         marca_a uuid, marca_b uuid, marca_c uuid);
grant select on mundo to authenticated;

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;

create function pg_temp.como(p_quem uuid, p_sql text, p_papel text default 'authenticated', out saida text)
language plpgsql as $f$
begin
  begin
    perform set_config('request.jwt.claims',
      case when p_quem is null then '' else json_build_object('sub', p_quem, 'role', p_papel)::text end, true);
    execute format('set local role %I', p_papel);
    execute p_sql into saida;
    saida := coalesce(saida, 'OK');
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    saida := sqlstate;
  end;
end $f$;

create function pg_temp.entrar(p_id uuid, p_email text) returns void
language plpgsql as $f$
begin
  insert into auth.users (id, email, aud, role) values (p_id, p_email, 'authenticated', 'authenticated');
  insert into public.profiles (id, email, full_name) values (p_id, p_email, split_part(p_email,'@',1));
end $f$;

create function pg_temp.marca(p_conta uuid, p_key text) returns uuid
language sql as $f$
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (p_conta, p_key, p_key, p_key, 'marca da prova', 'en', '{}','{}','{}','{}','{}')
  returning id;
$f$;

-- Um documento por seção; o gatilho de `brand_documents` constrói os trechos,
-- como numa importação real. Gravado em nome do autor: o registro editorial
-- exige saber quem escreveu.
create function pg_temp.secao(p_conta uuid, p_marca uuid, p_slug text, p_titulo text,
                              p_corpo text, p_quem uuid, p_status text default 'draft') returns void
language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
  insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name,
    title, status, body, blocks, source_pages, sort_order, updated_by)
  values (p_conta, p_marca, 'prova-busca', p_slug, 'Manual', p_titulo, p_status,
    to_jsonb(array[p_corpo]), '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('start', 1, 'end', 1)), 0, p_quem);
  select set_config('request.jwt.claims', '', true);
$f$;

-- Quantos trechos a busca devolve, e de quais seções, vista por `p_quem`.
create function pg_temp.buscar(p_quem uuid, p_marca uuid, p_pergunta text, p_limite int default 8)
returns text language sql as $f$
  select saida from pg_temp.como(p_quem, format(
    'select count(*)::text || '':'' || coalesce(string_agg(document_slug, '','' order by document_slug), '''') '
    || 'from public.buscar_trechos(%L, %L, %s)', p_marca, p_pergunta, p_limite));
$f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_admin uuid := 'eeeeeeee-0000-4000-8000-00000000aaaa';
  u_consulta uuid := 'eeeeeeee-0000-4000-8000-00000000bbbb';
  u_fora uuid := 'eeeeeeee-0000-4000-8000-00000000cccc';
  conta uuid; outra uuid; a uuid; b uuid; c uuid;
begin
  perform pg_temp.entrar(u_admin, 'busca-admin@local.test');
  perform pg_temp.entrar(u_consulta, 'busca-consulta@local.test');
  perform pg_temp.entrar(u_fora, 'busca-fora@local.test');
  conta := private.abrir_conta_de_assinatura('Conta da Busca', 'busca-admin@local.test', u_admin);
  outra := private.abrir_conta_de_assinatura('Outra Conta da Busca', 'busca-fora@local.test', u_fora);

  a := pg_temp.marca(conta, 'busca-a');
  b := pg_temp.marca(conta, 'busca-b');
  c := pg_temp.marca(outra, 'busca-c');

  -- Marca A: o manual britânico, como o do ensaio.
  perform pg_temp.secao(conta, a, 'logo-colours', 'Logo Formats and Colours',
    'The logo must always appear in blue. Never recolour the logo.', u_admin);
  perform pg_temp.secao(conta, a, 'photography', 'Photographic Style',
    'Minimalism and class, with neutral colours and clean lines.', u_admin);
  perform pg_temp.secao(conta, a, 'backgrounds', 'Backgrounds',
    'Use a light grey background behind product shots.', u_admin);
  perform pg_temp.secao(conta, a, 'typography', 'Typography',
    'Headlines are set in the corporate typeface, centred on the page.', u_admin, 'ready');

  -- Marca B, MESMA conta: também fala de cor. `consulta` não tem acesso a ela.
  perform pg_temp.secao(conta, b, 'b-colours', 'Colours of B',
    'The primary colour of brand B is red.', u_admin);

  -- Marca C, OUTRA conta: "primary" e "colour" juntos — a isca perfeita.
  perform pg_temp.secao(outra, c, 'c-colours', 'Primary Colour',
    'The primary colour of brand C is green.', u_fora);

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform public.conceder_acesso(conta, 'busca-consulta@local.test', 'consulta', array[a]);
  perform set_config('request.jwt.claims', '', true);

  insert into mundo values (conta, outra, u_admin, u_consulta, u_fora, a, b, c);

  if (select count(*) from public.brand_chunks where brand_id = a) < 4 then
    raise exception 'premissa falhou: os trechos da marca A nao foram construidos';
  end if;
end $$;

-- ─── 1. O defeito do ensaio ────────────────────────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  -- Nenhum trecho tem "primary"; o plano B acha os dois que falam de cor.
  perform pg_temp.registrar('a pergunta do ensaio acha os trechos de cor',
    '2:logo-colours,photography', pg_temp.buscar(m.admin, m.marca_a, 'what is the primary color?'));
end $$;

-- ─── 2. Grafias equivalentes, nas duas direções ────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('color (americano) acha colour (britanico), com todas as palavras',
    '1:logo-colours', pg_temp.buscar(m.admin, m.marca_a, 'what color is the logo?'));
  perform pg_temp.registrar('colour acha colour',
    '1:logo-colours', pg_temp.buscar(m.admin, m.marca_a, 'what colour is the logo?'));
  perform pg_temp.registrar('gray acha grey',
    '1:backgrounds', pg_temp.buscar(m.admin, m.marca_a, 'gray background'));
  perform pg_temp.registrar('center acha centred',
    '1:typography', pg_temp.buscar(m.admin, m.marca_a, 'are headlines centered?'));
end $$;

-- ─── 3. Todas as palavras têm prioridade ───────────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  -- "logo" + "colour" casam só em logo-colours. photography fala de cor mas
  -- não de logo, e NÃO pode entrar: o plano B não é a regra, é a exceção.
  perform pg_temp.registrar('com um trecho completo, o parcial fica de fora',
    '1:logo-colours', pg_temp.buscar(m.admin, m.marca_a, 'logo colours'));
end $$;

-- ─── 4. Quando não há o que achar, não acha ────────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('palavras ausentes do manual: zero',
    '0:', pg_temp.buscar(m.admin, m.marca_a, 'xylophone quantum'));
  perform pg_temp.registrar('so palavras vazias: zero',
    '0:', pg_temp.buscar(m.admin, m.marca_a, 'what is the'));
  perform pg_temp.registrar('pergunta vazia: zero',
    '0:', pg_temp.buscar(m.admin, m.marca_a, ''));
end $$;

-- ─── 5. Texto com cara de sintaxe não quebra ───────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('operadores e aspas na pergunta sao so texto',
    '1:logo-colours', pg_temp.buscar(m.admin, m.marca_a, $q$ 'logo' & | ! ( ) :* <-> "colour" \ $q$));
end $$;

-- ─── 6. O isolamento não mudou ─────────────────────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('consulta le a marca concedida',
    '2:logo-colours,photography', pg_temp.buscar(m.consulta, m.marca_a, 'what is the primary color?'));
  perform pg_temp.registrar('consulta NAO le outra marca da mesma conta',
    '0:', pg_temp.buscar(m.consulta, m.marca_b, 'primary colour'));
  perform pg_temp.registrar('admin NAO le marca de outra conta',
    '0:', pg_temp.buscar(m.admin, m.marca_c, 'primary colour'));
  perform pg_temp.registrar('quem e de fora NAO le a marca A',
    '0:', pg_temp.buscar(m.fora, m.marca_a, 'colour'));
  -- Controle positivo das duas negativas acima: a isca existe e é achável.
  perform pg_temp.registrar('controle: o dono da conta C le a marca C',
    '1:c-colours', pg_temp.buscar(m.fora, m.marca_c, 'primary colour'));
  perform pg_temp.registrar('controle: o admin le a marca B',
    '1:b-colours', pg_temp.buscar(m.admin, m.marca_b, 'primary colour'));
  perform pg_temp.registrar('anon nao executa a busca',
    '42501', (select saida from pg_temp.como(null,
      format('select count(*)::text from public.buscar_trechos(%L, ''colour'', 8)', m.marca_a), 'anon')));
end $$;

-- ─── 7. O status atravessa, e o teto continua ──────────────────────────────
do $$
declare m record; i int;
begin
  select * into m from mundo;
  perform pg_temp.registrar('o status do trecho vem junto',
    'ready', pg_temp.como(m.admin, format(
      'select status from public.buscar_trechos(%L, ''centred headlines'', 8)', m.marca_a)));

  for i in 1..25 loop
    perform pg_temp.secao(m.conta, m.marca_a, 'paleta-' || i, 'Palette ' || i,
      'Palette swatch number ' || i || '.', m.admin);
  end loop;
  perform pg_temp.registrar('pedir 1000 trechos devolve no maximo 20',
    '20', split_part(pg_temp.buscar(m.admin, m.marca_a, 'palette', 1000), ':', 1));
  perform pg_temp.registrar('o teto vale tambem no plano B',
    '20', split_part(pg_temp.buscar(m.admin, m.marca_a, 'palette unicorn', 1000), ':', 1));
end $$;

-- ─── Veredito ──────────────────────────────────────────────────────────────
select ordem, case when passou then 'ok  ' else 'FALHOU' end as resultado, caso, esperado, obtido
from resultado order by ordem;

do $$
declare falhas int; total int;
begin
  select count(*) filter (where not passou), count(*) into falhas, total from resultado;
  if falhas > 0 then
    raise exception 'PROVA REPROVADA: % de % casos falharam', falhas, total;
  end if;
  raise notice 'PROVA APROVADA: % casos', total;
end $$;

rollback;
