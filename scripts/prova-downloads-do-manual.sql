-- Prova do registro de download do MANUAL — fatia 3, 23/09/2026.
--
--   1. quem alcança a marca registra o próprio download, e o BANCO preenche
--      pessoa, e-mail, marca, conta e nome do arquivo — o que o pedido mandar
--      nesses campos é descartado;
--   2. ninguém registra download de manual de marca que não alcança — nem de
--      outra marca da mesma conta, nem de outra conta, nem anon;
--   3. só quem ADMINISTRA a marca lê o registro; quem consulta não lê, e a
--      outra conta não lê;
--   4. ninguém reescreve nem apaga — nem quem administra;
--   5. apagar a importação ou o login não apaga o registro.
--
-- Mesmo método das outras: mundo próprio, papel `authenticated` (superusuário
-- passa por cima de RLS e provaria nada), SQLSTATE conferido onde há erro
-- esperado, preparação que falha REPROVA, `rollback` no fim.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (conta_a uuid, conta_b uuid, admin_a uuid, admin_b uuid, consultor uuid,
                         a1 uuid, a2 uuid, b1 uuid, manual_a1 uuid, manual_a2 uuid, manual_sem_nome uuid);
grant select on mundo to authenticated, anon;

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;

create function pg_temp.como(p_quem uuid, p_sql text, p_papel text default 'authenticated',
                             out saida text, out nome text)
language plpgsql as $f$
begin
  nome := '';
  begin
    perform set_config('request.jwt.claims',
      case when p_quem is null then json_build_object('role', p_papel)::text
           else json_build_object('sub', p_quem, 'role', p_papel)::text end, true);
    execute format('set local role %I', p_papel);
    execute p_sql into saida;
    saida := coalesce(saida, 'OK');
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    get stacked diagnostics saida = returned_sqlstate, nome = constraint_name;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
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
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (p_conta, p_key, p_key, p_key, 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id;
$f$;

-- Uma importação com o objeto no Storage (a importação exige que ele exista).
create function pg_temp.manual(p_conta uuid, p_marca uuid, p_dono uuid, p_arquivo text) returns uuid
language plpgsql as $f$
declare imp uuid := gen_random_uuid(); sha text := md5(random()::text) || md5(random()::text); id uuid;
begin
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('brand-imports', p_conta::text || '/' || imp::text || '/' || sha || '.pdf', p_dono::text, '{"size": 1000}');
  insert into public.brand_imports (import_id, workspace_id, brand_id, storage_path, pdf_sha256, page_count, document_count, created_by, report)
  values (imp, p_conta, p_marca, p_conta::text || '/' || imp::text || '/' || sha || '.pdf', sha, 3, 0, p_dono,
          case when p_arquivo is null then '{}'::jsonb else jsonb_build_object('arquivo', p_arquivo) end)
  returning brand_imports.id into id;
  return id;
end $f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_admin_a  uuid := 'd0d0d0d0-0000-4000-8000-00000000000a';
  u_admin_b  uuid := 'd0d0d0d0-0000-4000-8000-00000000000b';
  u_consulta uuid := 'd0d0d0d0-0000-4000-8000-0000000000c1';
  ca uuid; cb uuid; x1 uuid; x2 uuid; y1 uuid;
begin
  perform pg_temp.entrar(u_admin_a, 'dm-admin-a@local.test');
  perform pg_temp.entrar(u_admin_b, 'dm-admin-b@local.test');
  perform pg_temp.entrar(u_consulta, 'dm-consulta@local.test');
  ca := private.abrir_conta_de_assinatura('Conta A do Manual', 'dm-admin-a@local.test', u_admin_a);
  cb := private.abrir_conta_de_assinatura('Conta B do Manual', 'dm-admin-b@local.test', u_admin_b);
  x1 := pg_temp.marca(ca, 'dm-a1');
  x2 := pg_temp.marca(ca, 'dm-a2');
  y1 := pg_temp.marca(cb, 'dm-b1');

  -- O consultor alcança só a1.
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  perform public.conceder_acesso(ca, 'dm-consulta@local.test', 'consulta', array[x1]);
  perform set_config('request.jwt.claims', '', true);

  insert into mundo values (ca, cb, u_admin_a, u_admin_b, u_consulta, x1, x2, y1,
    pg_temp.manual(ca, x1, u_admin_a, 'Sony Vaio — manual.pdf'),
    pg_temp.manual(ca, x2, u_admin_a, 'segredo-da-a2.pdf'),
    pg_temp.manual(ca, x1, u_admin_a, null));
end $$;

-- ─── 1. Quem alcança a marca registra; o banco preenche o resto ────────────
do $$
declare m record; r record; linha record;
begin
  select * into m from mundo;

  -- O pedido MENTE em tudo que o banco preenche: outra pessoa, outra marca,
  -- outra conta, outro nome de arquivo.
  r := pg_temp.como(m.consultor, format(
    'insert into public.downloads_do_manual (import_id, brand_id, workspace_id, pessoa, pessoa_email, file_name) '
    || 'values (%L, %L, %L, %L, ''mentira@x'', ''mentira.pdf'') returning ''GRAVOU''',
    m.manual_a1, m.b1, m.conta_b, m.admin_b));
  perform pg_temp.registrar('o consultor registra o download do manual da marca que alcança', 'GRAVOU', r.saida);

  select * into linha from public.downloads_do_manual where import_id = m.manual_a1;
  if not found then raise exception 'premissa falhou: o registro do consultor nao existe'; end if;
  perform pg_temp.registrar('a pessoa é quem está na sessão, não a que o pedido disse', m.consultor::text, linha.pessoa::text);
  perform pg_temp.registrar('o e-mail vem do login', 'dm-consulta@local.test', linha.pessoa_email);
  perform pg_temp.registrar('a marca vem da importação', m.a1::text, linha.brand_id::text);
  perform pg_temp.registrar('a conta vem da importação', m.conta_a::text, linha.workspace_id::text);
  perform pg_temp.registrar('o nome do arquivo vem da importação', 'Sony Vaio — manual.pdf', linha.file_name);

  r := pg_temp.como(m.consultor, format(
    'insert into public.downloads_do_manual (import_id, brand_id, workspace_id, pessoa_email, file_name) '
    || 'values (%L, %L, %L, '''', '''') returning ''GRAVOU''', m.manual_sem_nome, m.a1, m.conta_a));
  if r.saida <> 'GRAVOU' then raise exception 'premissa falhou: registro sem nome de arquivo (%)', r.saida; end if;
  -- Lido como superusuário: quem consulta não lê o registro (caso 3), nem o
  -- próprio — pedir `returning file_name` a ele testaria a policy de leitura,
  -- não o nome.
  perform pg_temp.registrar('importação sem nome de arquivo vira "manual.pdf"', 'manual.pdf',
    (select file_name from public.downloads_do_manual where import_id = m.manual_sem_nome));

  r := pg_temp.como(m.admin_a, format(
    'insert into public.downloads_do_manual (import_id, brand_id, workspace_id, pessoa_email, file_name) '
    || 'values (%L, %L, %L, '''', '''') returning ''GRAVOU''', m.manual_a2, m.a2, m.conta_a));
  perform pg_temp.registrar('quem administra a conta registra em qualquer marca dela', 'GRAVOU', r.saida);
end $$;

-- ─── 2. Ninguém registra download de manual que não alcança ────────────────
do $$
declare m record; antes int; depois int;
begin
  select * into m from mundo;
  select count(*) into antes from public.downloads_do_manual;

  -- Mentir a marca não ajuda: o gatilho troca pela da importação (a2), e a
  -- policy confere a capacidade NELA.
  perform pg_temp.registrar('o consultor NÃO registra o manual de outra marca da mesma conta (a2)', '42501',
    (pg_temp.como(m.consultor, format(
      'insert into public.downloads_do_manual (import_id, brand_id, workspace_id, pessoa_email, file_name) '
      || 'values (%L, %L, %L, '''', '''')', m.manual_a2, m.a1, m.conta_a))).saida);
  perform pg_temp.registrar('quem administra OUTRA conta NÃO registra o manual da conta A', '42501',
    (pg_temp.como(m.admin_b, format(
      'insert into public.downloads_do_manual (import_id, brand_id, workspace_id, pessoa_email, file_name) '
      || 'values (%L, %L, %L, '''', '''')', m.manual_a1, m.b1, m.conta_b))).saida);
  perform pg_temp.registrar('anon NÃO registra', '42501',
    (pg_temp.como(null, format(
      'insert into public.downloads_do_manual (import_id, brand_id, workspace_id, pessoa_email, file_name) '
      || 'values (%L, %L, %L, '''', '''')', m.manual_a1, m.a1, m.conta_a), 'anon')).saida);
  perform pg_temp.registrar('manual que não existe não é registrável', '23503',
    (pg_temp.como(m.consultor, format(
      'insert into public.downloads_do_manual (import_id, brand_id, workspace_id, pessoa_email, file_name) '
      || 'values (%L, %L, %L, '''', '''')', gen_random_uuid(), m.a1, m.conta_a))).saida);

  select count(*) into depois from public.downloads_do_manual;
  perform pg_temp.registrar('nenhuma das recusas deixou linha', antes::text, depois::text);
end $$;

-- ─── 3. Só quem administra a marca lê ──────────────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('quem administra a conta A lê os 3 downloads dela', '3',
    (pg_temp.como(m.admin_a, 'select count(*)::text from public.downloads_do_manual')).saida);
  perform pg_temp.registrar('o consultor NÃO lê o registro — nem o próprio download', '0',
    (pg_temp.como(m.consultor, 'select count(*)::text from public.downloads_do_manual')).saida);
  perform pg_temp.registrar('quem administra OUTRA conta NÃO lê', '0',
    (pg_temp.como(m.admin_b, 'select count(*)::text from public.downloads_do_manual')).saida);
  perform pg_temp.registrar('anon NÃO lê', '42501',
    (pg_temp.como(null, 'select count(*)::text from public.downloads_do_manual', 'anon')).saida);
end $$;

-- ─── 4. Ninguém reescreve nem apaga ────────────────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('quem administra NÃO reescreve o registro', '42501',
    (pg_temp.como(m.admin_a, 'update public.downloads_do_manual set pessoa_email = ''apagado'' returning 1')).saida);
  perform pg_temp.registrar('quem administra NÃO apaga o registro', '42501',
    (pg_temp.como(m.admin_a, 'delete from public.downloads_do_manual returning 1')).saida);
  perform pg_temp.registrar('o consultor NÃO apaga o próprio download', '42501',
    (pg_temp.como(m.consultor, 'delete from public.downloads_do_manual returning 1')).saida);
end $$;

-- ─── 5. O registro sobrevive à importação e ao login ───────────────────────
do $$
declare m record; linha record;
begin
  select * into m from mundo;
  delete from public.brand_imports where id = m.manual_a1;
  select * into linha from public.downloads_do_manual where pessoa = m.consultor and file_name = 'Sony Vaio — manual.pdf';
  perform pg_temp.registrar('apagar a importação mantém o registro, sem a referência',
    'mantido/sem-import', case when not found then 'sumiu' when linha.import_id is null then 'mantido/sem-import' else 'mantido/com-import' end);

  -- Apagar o login do consultor hoje esbarra em OUTRA chave (a concessão de
  -- acesso aponta para ele — a pendência da LGPD estacionada em 23/09). Esta
  -- tabela não pode ser mais uma: a regra da chave é conferida no catálogo.
  perform pg_temp.registrar('a chave da pessoa é "on delete set null" — o registro não prende o login', 'n',
    (select c.confdeltype::text from pg_constraint c
      where c.conrelid = 'public.downloads_do_manual'::regclass and c.contype = 'f'
        and c.confrelid = 'auth.users'::regclass));
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
