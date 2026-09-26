-- Prova dos sinônimos na busca de trechos — 26/09/2026.
--
-- Nasce do ensaio: "Qual é o logotipo principal?" no manual do Bradesco, que
-- responde na página 4 com LOGO e versão PREFERENCIAL. A busca procurava as
-- palavras da pergunta, não achava a página, e a IA afirmava que a marca não
-- documentava. Ver a migration 20260926115535_sinonimos_na_busca.
--
-- Mesmo método da `prova-busca-tolerante`: mundo próprio (conteúdo FICTÍCIO),
-- a busca chamada COMO USUÁRIO, preparação que falha REPROVA, `rollback`.
--
-- O que ela tranca:
--   • o defeito do ensaio, em português e em inglês;
--   • sinônimo nos dois sentidos (a palavra do manual acha a da pergunta e
--     vice-versa);
--   • todas as palavras continuam tendo prioridade — sinônimo não abre a porta
--     para trecho que só tem metade da pergunta;
--   • palavra fora de todo grupo não ganha sinônimo;
--   • as grafias da busca tolerante continuam valendo;
--   • o isolamento não mudou.

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

create function pg_temp.marca(p_conta uuid, p_key text, p_idioma text) returns uuid
language sql as $f$
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (p_conta, p_key, p_key, p_key, 'marca da prova', p_idioma, '{}','{}','{}','{}','{}')
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
  values (p_conta, p_marca, 'prova-sinonimos', p_slug, 'Manual', p_titulo, p_status,
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

-- Os trechos NA ORDEM em que a busca devolve — o exato tem de vir primeiro.
create function pg_temp.ordem(p_quem uuid, p_marca uuid, p_pergunta text, p_limite int default 8)
returns text language sql as $f$
  select saida from pg_temp.como(p_quem, format(
    'select count(*)::text || '':'' || coalesce(string_agg(t.document_slug, '','' order by t.n), '''') '
    || 'from public.buscar_trechos(%L, %L, %s) with ordinality as t(document_slug, document_title, group_name, section, status, page_start, page_end, content, relevancia, n)',
    p_marca, p_pergunta, p_limite));
$f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_admin uuid := 'eeeeeeee-0000-4000-8000-00000000dddd';
  u_consulta uuid := 'eeeeeeee-0000-4000-8000-00000000eeee';
  u_fora uuid := 'eeeeeeee-0000-4000-8000-00000000ffff';
  conta uuid; outra uuid; a uuid; b uuid; c uuid;
begin
  perform pg_temp.entrar(u_admin, 'sinonimo-admin@local.test');
  perform pg_temp.entrar(u_consulta, 'sinonimo-consulta@local.test');
  perform pg_temp.entrar(u_fora, 'sinonimo-fora@local.test');
  conta := private.abrir_conta_de_assinatura('Conta dos Sinonimos', 'sinonimo-admin@local.test', u_admin);
  outra := private.abrir_conta_de_assinatura('Outra Conta dos Sinonimos', 'sinonimo-fora@local.test', u_fora);

  a := pg_temp.marca(conta, 'sinonimo-a', 'pt-BR');
  b := pg_temp.marca(conta, 'sinonimo-b', 'en');
  c := pg_temp.marca(outra, 'sinonimo-c', 'pt-BR');

  -- Marca A, em português: a forma do manual do ensaio, com texto fictício.
  perform pg_temp.secao(conta, a, 'logo-versoes', 'Logo horizontal Logo vertical',
    'Versão preferencial e versão secundária. Utilize a preferencial em todos os tipos de comunicação. A secundária entra quando não for possível usar a preferencial.', u_admin);
  perform pg_temp.secao(conta, a, 'area-de-respiro', 'Área de respiro',
    'Mantenha em volta do logo um respiro igual a duas vezes a altura da letra.', u_admin);
  perform pg_temp.secao(conta, a, 'tipografia', 'Tipografia',
    'A tipografia institucional é uma sem serifa em quatro pesos.', u_admin, 'ready');
  perform pg_temp.secao(conta, a, 'fotografia', 'Estilo de fotografia',
    'Pessoas em primeiro plano, luz natural, versão preferencial em cor.', u_admin);
  -- O defeito de 26/09 ("Quantas cores tem a marca?"): a isca tem "quanto",
  -- "cores" e "marcas"; a paleta, que responde, não tem "quanto".
  perform pg_temp.secao(conta, a, 'co-branding', 'Co-branding',
    'Quanto às marcas parceiras, respeite as cores de cada uma.', u_admin);
  perform pg_temp.secao(conta, a, 'paleta', 'Paleta de cores',
    'A paleta da marca tem duas cores: vermelho e branco.', u_admin);

  -- Marca B, MESMA conta, em inglês. `consulta` não tem acesso a ela.
  perform pg_temp.secao(conta, b, 'b-logo', 'Logotype',
    'The master logotype is used on every application. Keep a grey clearspace.', u_admin);

  -- Marca C, OUTRA conta: a isca perfeita em português.
  perform pg_temp.secao(outra, c, 'c-logo', 'Logotipo principal',
    'O logotipo principal da marca C é o horizontal.', u_fora);

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform public.conceder_acesso(conta, 'sinonimo-consulta@local.test', 'consulta', array[a]);
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
  -- "logotipo" acha "logo" e "principal" acha "preferencial", com TODAS as
  -- palavras: a fotografia fala de preferencial mas não de logo, e fica fora.
  -- Desde 26/09 o exato vem PRIMEIRO e os parciais completam depois.
  perform pg_temp.registrar('logotipo principal acha logo preferencial, primeiro',
    'logo-versoes', split_part(split_part(pg_temp.ordem(m.admin, m.marca_a, 'Qual é o logotipo principal?'), ':', 2), ',', 1));
  perform pg_temp.registrar('em ingles: main logo acha master logotype',
    '1:b-logo', pg_temp.buscar(m.admin, m.marca_b, 'what is the main logo?'));
end $$;

-- ─── 2. Os dois sentidos, e os outros grupos ───────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('a palavra do manual continua achando: logo preferencial, primeiro',
    'logo-versoes', split_part(split_part(pg_temp.ordem(m.admin, m.marca_a, 'logo preferencial'), ':', 2), ',', 1));
  perform pg_temp.registrar('protecao acha respiro, primeiro',
    'area-de-respiro', split_part(split_part(pg_temp.ordem(m.admin, m.marca_a, 'área de proteção do logotipo'), ':', 2), ',', 1));
  perform pg_temp.registrar('fonte acha tipografia',
    '1:tipografia', pg_temp.buscar(m.admin, m.marca_a, 'qual a fonte institucional?'));
  perform pg_temp.registrar('em ingles: exclusion acha clearspace',
    '1:b-logo', pg_temp.buscar(m.admin, m.marca_b, 'logo exclusion zone'));
end $$;

-- ─── 3. Sinônimo não abre a porta ──────────────────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  -- Palavra fora de todo grupo não ganha sinônimo: "unicórnio" não existe no
  -- manual, e o plano B traz só o que casa com "logotipo" (logo).
  perform pg_temp.registrar('sem trecho completo, o plano B traz so o que casa',
    '2:area-de-respiro,logo-versoes', pg_temp.buscar(m.admin, m.marca_a, 'logotipo unicórnio'));
  perform pg_temp.registrar('palavras ausentes do manual: zero',
    '0:', pg_temp.buscar(m.admin, m.marca_a, 'xilofone quântico'));
  perform pg_temp.registrar('pergunta vazia: zero',
    '0:', pg_temp.buscar(m.admin, m.marca_a, ''));
end $$;

-- ─── 3b. Palavras de pergunta e a busca que completa (26/09) ──────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('Quantas cores tem a marca? traz a paleta',
    'true', (pg_temp.ordem(m.admin, m.marca_a, 'Quantas cores tem a marca?') like '%paleta%')::text);
  perform pg_temp.registrar('quantas nao vira termo: a mesma resposta sem a palavra',
    pg_temp.ordem(m.admin, m.marca_a, 'cores da marca'),
    pg_temp.ordem(m.admin, m.marca_a, 'Quantas cores tem a marca?'));
  perform pg_temp.registrar('so palavras de pergunta: zero',
    '0:', pg_temp.ordem(m.admin, m.marca_a, 'quantas? onde? pode?'));
end $$;

-- ─── 4. As grafias da busca tolerante continuam ────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('gray acha grey',
    '1:b-logo', pg_temp.buscar(m.admin, m.marca_b, 'gray logo'));
end $$;

-- ─── 5. O isolamento não mudou ─────────────────────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('consulta le a marca concedida',
    'logo-versoes', split_part(split_part(pg_temp.ordem(m.consulta, m.marca_a, 'Qual é o logotipo principal?'), ':', 2), ',', 1));
  perform pg_temp.registrar('consulta NAO le outra marca da mesma conta',
    '0:', pg_temp.buscar(m.consulta, m.marca_b, 'main logo'));
  perform pg_temp.registrar('admin NAO le marca de outra conta',
    '0:', pg_temp.buscar(m.admin, m.marca_c, 'logotipo principal'));
  perform pg_temp.registrar('controle: o dono da conta C le a marca C',
    '1:c-logo', pg_temp.buscar(m.fora, m.marca_c, 'logo preferencial'));
  perform pg_temp.registrar('anon nao executa a busca',
    '42501', (select saida from pg_temp.como(null,
      format('select count(*)::text from public.buscar_trechos(%L, ''logo'', 8)', m.marca_a), 'anon')));
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
