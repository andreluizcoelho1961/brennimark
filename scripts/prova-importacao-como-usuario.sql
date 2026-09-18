-- Prova da importação feita como USUÁRIO COMUM — 18/09/2026.
--
-- Nasce de um defeito que três camadas deixaram passar: toda prova gravava
-- `brand_imports` como superusuário, que passa por cima das policies, e a suíte
-- de navegador roda sem banco. Em produção, a primeira importação depois de
-- 15/09 parou em "infinite recursion detected in policy for relation
-- brand_imports". Aqui, a importação passa pelas mesmas portas que a tela usa.
--
-- Mesmo método das outras: mundo próprio, SQLSTATE conferido, `rollback` no
-- fim, e caso cuja preparação falha REPROVA.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (conta uuid, outra uuid, admin uuid, consulta uuid, fora uuid, marca_viva uuid);
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

-- O PDF sobe como a tela faz: pelo papel da sessão, pela policy do Storage.
create function pg_temp.subir_pdf(p_quem uuid, p_caminho text) returns text
language sql as $f$
  select saida from pg_temp.como(p_quem, format(
    'insert into storage.objects (bucket_id, name, owner_id) values (''brand-imports'', %L, %L) returning ''SUBIU''',
    p_caminho, p_quem));
$f$;

-- Registrar a importação é o passo que recursava.
create function pg_temp.registrar_importacao(p_quem uuid, p_conta uuid, p_marca uuid,
                                             p_import uuid, p_sha text, p_caminho text) returns text
language sql as $f$
  select saida from pg_temp.como(p_quem, format(
    'insert into public.brand_imports (import_id, workspace_id, brand_id, storage_path, pdf_sha256, '
    || 'page_count, document_count, created_by) values (%L, %L, %L, %L, %L, 1, 0, %L) returning ''REGISTROU''',
    p_import, p_conta, p_marca, p_caminho, p_sha, p_quem));
$f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_admin uuid := 'dddddddd-0000-4000-8000-00000000aaaa';
  u_consulta uuid := 'dddddddd-0000-4000-8000-00000000bbbb';
  u_fora uuid := 'dddddddd-0000-4000-8000-00000000cccc';
  conta uuid; outra uuid; viva uuid;
begin
  perform pg_temp.entrar(u_admin, 'imp-admin@local.test');
  perform pg_temp.entrar(u_consulta, 'imp-consulta@local.test');
  perform pg_temp.entrar(u_fora, 'imp-fora@local.test');
  conta := private.abrir_conta_de_assinatura('Conta da Importação', 'imp-admin@local.test', u_admin);
  outra := private.abrir_conta_de_assinatura('Outra Conta', 'imp-fora@local.test', u_fora);

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (conta, 'imp-viva', 'Viva', 'V', 'marca existente', 'pt-BR', '{}','{}','{}','{}','{}')
  returning id into viva;

  -- `consulta` alcança a marca, mas só lê: é o caso "tem acesso, não administra".
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform public.conceder_acesso(conta, 'imp-consulta@local.test', 'consulta', array[viva]);
  perform set_config('request.jwt.claims', '', true);

  insert into mundo values (conta, outra, u_admin, u_consulta, u_fora, viva);
end $$;

-- ─── 1. A importação do administrador passa — o defeito de 18/09 ────────────
do $$
declare m record; imp uuid := gen_random_uuid(); sha text := repeat('a',64); caminho text; r text; n integer;
begin
  select * into m from mundo;
  caminho := m.conta::text||'/'||imp::text||'/'||sha||'.pdf';

  r := pg_temp.subir_pdf(m.admin, caminho);
  perform pg_temp.registrar('o administrador sobe o PDF', 'SUBIU', r);
  if r <> 'SUBIU' then raise exception 'premissa falhou: o PDF nao subiu (%)', r; end if;

  r := pg_temp.registrar_importacao(m.admin, m.conta, m.marca_viva, imp, sha, caminho);
  perform pg_temp.registrar('e registra a importacao SEM recursao', 'REGISTROU', r);

  -- A outra direção do laço: ler o PDF passa pela policy que consulta
  -- `brand_imports`. Ela precisa responder, e não recursar.
  r := pg_temp.como(m.admin, format(
    'select count(*)::text from storage.objects where bucket_id = ''brand-imports'' and name = %L', caminho));
  perform pg_temp.registrar('e le o proprio PDF depois de registrado', '1', r);
end $$;

-- ─── 2. O caminho real: a função que a tela chama ───────────────────────────
do $$
declare m record; imp uuid := gen_random_uuid(); sha text := repeat('b',64); caminho text; r text; nova uuid := gen_random_uuid();
begin
  select * into m from mundo;
  caminho := m.conta::text||'/'||imp::text||'/'||sha||'.pdf';
  r := pg_temp.subir_pdf(m.admin, caminho);
  if r <> 'SUBIU' then raise exception 'premissa falhou: o PDF do caminho real nao subiu (%)', r; end if;

  r := pg_temp.como(m.admin, format(
    'select public.publish_brand_import(%L, %L, %L, ''imp-nova'', ''Nova'', ''N'', ''criada pela prova'', ''pt-BR'', '
    || '''{}''::jsonb, ''{}''::jsonb, ''{}''::jsonb, ''{}''::jsonb, ''{}''::jsonb, %L::jsonb, %L, 1, %L::jsonb)::text',
    m.conta, imp, nova,
    -- Uma seção, com a página de onde veio: é o mínimo que a função aceita, e
    -- é o que uma importação real produz.
    jsonb_build_array(jsonb_build_object('slug','capa','group','Manual','title','Capa','body','[]'::jsonb)),
    sha,
    jsonb_build_object('documentos', jsonb_build_array(jsonb_build_object('slug','capa','paginas', jsonb_build_array(1))))));
  perform pg_temp.registrar('publish_brand_import como usuario cria a marca',
    'criou', case when r ~ '^[0-9a-f-]{36}$' or r = 'OK' then 'criou' else r end);

  r := pg_temp.como(m.admin, format('select count(*)::text from public.brands where id = %L', nova));
  perform pg_temp.registrar('e a marca nova existe para o administrador', '1', r);
end $$;

-- ─── 3. As fronteiras que continuam de pé ───────────────────────────────────
do $$
declare m record; imp uuid; sha text; caminho text; r text;
begin
  select * into m from mundo;

  -- Quem só consulta não registra, mesmo com o PDF lá.
  imp := gen_random_uuid(); sha := repeat('c',64);
  caminho := m.conta::text||'/'||imp::text||'/'||sha||'.pdf';
  perform pg_temp.subir_pdf(m.admin, caminho);
  r := pg_temp.registrar_importacao(m.consulta, m.conta, m.marca_viva, imp, sha, caminho);
  perform pg_temp.registrar('quem so consulta NAO registra importacao', '42501', r);

  -- PDF que não subiu: a regra continua exigindo o arquivo antes do registro.
  imp := gen_random_uuid(); sha := repeat('d',64);
  caminho := m.conta::text||'/'||imp::text||'/'||sha||'.pdf';
  r := pg_temp.registrar_importacao(m.admin, m.conta, m.marca_viva, imp, sha, caminho);
  perform pg_temp.registrar('importacao sem PDF no Storage e recusada', '42501', r);

  -- Caminho fora do canônico.
  imp := gen_random_uuid(); sha := repeat('e',64);
  perform pg_temp.subir_pdf(m.admin, m.conta::text||'/'||imp::text||'/outro-nome.pdf');
  r := pg_temp.registrar_importacao(m.admin, m.conta, m.marca_viva, imp, sha,
                                    m.conta::text||'/'||imp::text||'/outro-nome.pdf');
  perform pg_temp.registrar('caminho fora do canonico e recusado', '42501', r);

  -- A função nova não é oráculo: de outra conta, a resposta é "não".
  r := pg_temp.como(m.fora, format('select public.pdf_de_importacao_existe(%L)::text',
    m.conta::text||'/'||gen_random_uuid()::text||'/x.pdf'));
  perform pg_temp.registrar('caminho inexistente responde nao', 'false', r);
  select name into caminho from storage.objects
   where bucket_id = 'brand-imports' and name like m.conta::text||'/%' limit 1;
  r := pg_temp.como(m.fora, format('select public.pdf_de_importacao_existe(%L)::text', caminho));
  perform pg_temp.registrar('PDF que EXISTE em outra conta tambem responde nao', 'false', r);

  r := pg_temp.como(null, format('select public.pdf_de_importacao_existe(%L)::text', caminho), 'anon');
  perform pg_temp.registrar('anonimo nao executa a funcao', '42501', r);

  -- O outro defeito do mesmo dia: a permissão explícita da função de capacidade.
  r := pg_temp.como(m.admin, format('select public.tem_capacidade_na_marca(%L, ''administrar'')::text', m.marca_viva));
  perform pg_temp.registrar('quem tem sessao EXECUTA tem_capacidade_na_marca', 'true', r);
  r := pg_temp.como(null, format('select public.tem_capacidade_na_marca(%L, ''consultar'')::text', m.marca_viva), 'anon');
  perform pg_temp.registrar('anonimo NAO executa tem_capacidade_na_marca', '42501', r);
end $$;

select case when passou then 'ok   ' else 'FALHA' end as st, caso, esperado, obtido
from resultado order by ordem;

select case when count(*) filter (where not passou) = 0
            then 'PROVA COMPLETA: ' || count(*) || ' verificacoes, todas verdes'
            else 'PROVA FALHOU: ' || count(*) filter (where not passou) || ' de ' || count(*)
       end as veredito
from resultado;

do $$
declare n integer;
begin
  select count(*) filter (where not passou) into n from resultado;
  if n > 0 then
    raise exception 'PROVA FALHOU: % verificacao(oes)', n using errcode = 'P0001';
  end if;
end $$;

rollback;
