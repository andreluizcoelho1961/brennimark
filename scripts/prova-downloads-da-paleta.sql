-- Prova do registro de download da PALETA — 03/11/2026.
--
--   1. quem alcança a marca registra o próprio download, e o BANCO preenche
--      pessoa, e-mail e conta — o que o pedido mandar nesses campos é descartado;
--   2. ninguém registra download de marca que não alcança — nem de outra marca
--      da mesma conta, nem de outra conta, nem anon; formato e contagem fora da
--      lista fechada são recusados pela constraint certa;
--   3. só quem ADMINISTRA a marca lê o registro; quem consulta não lê, e a
--      outra conta não lê;
--   4. ninguém reescreve nem apaga — nem quem administra;
--   5. o registro não prende o login, e apagar o login troca o e-mail pelo apelido.
--
-- Mesmo método das outras: mundo próprio, papel `authenticated` (superusuário
-- passa por cima de RLS e provaria nada), SQLSTATE conferido onde há erro
-- esperado, preparação que falha REPROVA, `rollback` no fim.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (conta_a uuid, conta_b uuid, admin_a uuid, admin_b uuid, consultor uuid,
                         a1 uuid, a2 uuid, b1 uuid);
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

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_admin_a  uuid := 'd1d1d1d1-0000-4000-8000-00000000000a';
  u_admin_b  uuid := 'd1d1d1d1-0000-4000-8000-00000000000b';
  u_consulta uuid := 'd1d1d1d1-0000-4000-8000-0000000000c1';
  ca uuid; cb uuid; x1 uuid; x2 uuid; y1 uuid;
begin
  perform pg_temp.entrar(u_admin_a, 'dp-admin-a@local.test');
  perform pg_temp.entrar(u_admin_b, 'dp-admin-b@local.test');
  perform pg_temp.entrar(u_consulta, 'dp-consulta@local.test');
  ca := private.abrir_conta_de_assinatura('Conta A da Paleta', 'dp-admin-a@local.test', u_admin_a);
  cb := private.abrir_conta_de_assinatura('Conta B da Paleta', 'dp-admin-b@local.test', u_admin_b);
  x1 := pg_temp.marca(ca, 'dp-a1');
  x2 := pg_temp.marca(ca, 'dp-a2');
  y1 := pg_temp.marca(cb, 'dp-b1');

  -- O consultor alcança só a1.
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  perform public.conceder_acesso(ca, 'dp-consulta@local.test', 'consulta', array[x1]);
  perform set_config('request.jwt.claims', '', true);

  insert into mundo values (ca, cb, u_admin_a, u_admin_b, u_consulta, x1, x2, y1);
end $$;

-- ─── 1. Quem alcança a marca registra; o banco preenche o resto ────────────
do $$
declare m record; r record; linha record;
begin
  select * into m from mundo;

  -- O pedido MENTE em tudo que o banco preenche: outra pessoa, outro e-mail,
  -- outra conta.
  r := pg_temp.como(m.consultor, format(
    'insert into public.downloads_de_paleta (brand_id, workspace_id, pessoa, pessoa_email, formato, cores) '
    || 'values (%L, %L, %L, ''mentira@x'', ''ase'', 4) returning ''GRAVOU''',
    m.a1, m.conta_b, m.admin_b));
  perform pg_temp.registrar('o consultor registra o download da paleta da marca que alcança', 'GRAVOU', r.saida);

  select * into linha from public.downloads_de_paleta where brand_id = m.a1;
  if not found then raise exception 'premissa falhou: o registro do consultor nao existe'; end if;
  perform pg_temp.registrar('a pessoa é quem está na sessão, não a que o pedido disse', m.consultor::text, linha.pessoa::text);
  perform pg_temp.registrar('o e-mail vem do login', 'dp-consulta@local.test', linha.pessoa_email);
  perform pg_temp.registrar('a conta vem da marca', m.conta_a::text, linha.workspace_id::text);
  perform pg_temp.registrar('formato e contagem ficam como pedidos', 'ase/4', linha.formato || '/' || linha.cores);

  r := pg_temp.como(m.admin_a, format(
    'insert into public.downloads_de_paleta (brand_id, workspace_id, pessoa_email, formato, cores) '
    || 'values (%L, %L, '''', ''png'', 6) returning ''GRAVOU''', m.a2, m.conta_a));
  perform pg_temp.registrar('quem administra a conta registra em qualquer marca dela', 'GRAVOU', r.saida);
end $$;

-- ─── 2. Ninguém registra o que não alcança, e a lista é fechada ────────────
do $$
declare m record; antes int; depois int;
begin
  select * into m from mundo;
  select count(*) into antes from public.downloads_de_paleta;

  perform pg_temp.registrar('o consultor NÃO registra a paleta de outra marca da mesma conta (a2)', '42501',
    (pg_temp.como(m.consultor, format(
      'insert into public.downloads_de_paleta (brand_id, workspace_id, pessoa_email, formato, cores) '
      || 'values (%L, %L, '''', ''ase'', 3)', m.a2, m.conta_a))).saida);
  perform pg_temp.registrar('quem administra OUTRA conta NÃO registra a paleta da conta A', '42501',
    (pg_temp.como(m.admin_b, format(
      'insert into public.downloads_de_paleta (brand_id, workspace_id, pessoa_email, formato, cores) '
      || 'values (%L, %L, '''', ''ase'', 3)', m.a1, m.conta_b))).saida);
  perform pg_temp.registrar('anon NÃO registra', '42501',
    (pg_temp.como(null, format(
      'insert into public.downloads_de_paleta (brand_id, workspace_id, pessoa_email, formato, cores) '
      || 'values (%L, %L, '''', ''ase'', 3)', m.a1, m.conta_a), 'anon')).saida);
  perform pg_temp.registrar('marca que não existe não é registrável', '23503',
    (pg_temp.como(m.consultor, format(
      'insert into public.downloads_de_paleta (brand_id, workspace_id, pessoa_email, formato, cores) '
      || 'values (%L, %L, '''', ''ase'', 3)', gen_random_uuid(), m.conta_a))).saida);
  -- Constraint pelo NOME exato, não "algum erro".
  perform pg_temp.registrar('formato fora da lista é recusado pela constraint certa', 'downloads_de_paleta_formato_check',
    (pg_temp.como(m.consultor, format(
      'insert into public.downloads_de_paleta (brand_id, workspace_id, pessoa_email, formato, cores) '
      || 'values (%L, %L, '''', ''exe'', 3)', m.a1, m.conta_a))).nome);
  perform pg_temp.registrar('contagem de cores fora da faixa é recusada pela constraint certa', 'downloads_de_paleta_cores_check',
    (pg_temp.como(m.consultor, format(
      'insert into public.downloads_de_paleta (brand_id, workspace_id, pessoa_email, formato, cores) '
      || 'values (%L, %L, '''', ''ase'', 0)', m.a1, m.conta_a))).nome);

  select count(*) into depois from public.downloads_de_paleta;
  perform pg_temp.registrar('nenhuma das recusas deixou linha', antes::text, depois::text);
end $$;

-- ─── 3. Só quem administra a marca lê ──────────────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('quem administra a conta A lê os 2 downloads dela', '2',
    (pg_temp.como(m.admin_a, 'select count(*)::text from public.downloads_de_paleta')).saida);
  perform pg_temp.registrar('o consultor NÃO lê o registro — nem o próprio download', '0',
    (pg_temp.como(m.consultor, 'select count(*)::text from public.downloads_de_paleta')).saida);
  perform pg_temp.registrar('quem administra OUTRA conta NÃO lê', '0',
    (pg_temp.como(m.admin_b, 'select count(*)::text from public.downloads_de_paleta')).saida);
  perform pg_temp.registrar('anon NÃO lê', '42501',
    (pg_temp.como(null, 'select count(*)::text from public.downloads_de_paleta', 'anon')).saida);
end $$;

-- ─── 4. Ninguém reescreve nem apaga ────────────────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('quem administra NÃO reescreve o registro', '42501',
    (pg_temp.como(m.admin_a, 'update public.downloads_de_paleta set pessoa_email = ''apagado'' returning 1')).saida);
  perform pg_temp.registrar('quem administra NÃO apaga o registro', '42501',
    (pg_temp.como(m.admin_a, 'delete from public.downloads_de_paleta returning 1')).saida);
  perform pg_temp.registrar('o consultor NÃO apaga o próprio download', '42501',
    (pg_temp.como(m.consultor, 'delete from public.downloads_de_paleta returning 1')).saida);
end $$;

-- ─── 5. O registro não prende o login, e o e-mail vira apelido ─────────────
do $$
declare m record; linha record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('a chave da pessoa é "on delete set null" — o registro não prende o login', 'n',
    (select c.confdeltype::text from pg_constraint c
      where c.conrelid = 'public.downloads_de_paleta'::regclass and c.contype = 'f'
        and c.confrelid = 'auth.users'::regclass));

  -- Linha preparada como superusuário (a preparação não depende de RLS), mas
  -- com a sessão do admin B simulada: o gatilho recusa download sem sessão.
  perform set_config('request.jwt.claims', json_build_object('sub', m.admin_b, 'role', 'authenticated')::text, true);
  insert into public.downloads_de_paleta (brand_id, workspace_id, pessoa_email, formato, cores)
  values (m.b1, m.conta_b, '', 'css', 2);
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id = m.admin_b;
  select * into linha from public.downloads_de_paleta where brand_id = m.b1;
  perform pg_temp.registrar('apagar o login mantém o registro, sem a referência da pessoa',
    'mantido/sem-pessoa', case when not found then 'sumiu' when linha.pessoa is null then 'mantido/sem-pessoa' else 'mantido/com-pessoa' end);
  perform pg_temp.registrar('o e-mail vira o apelido da conta removida', 'apelido',
    case when linha.pessoa_email like 'conta-removida-%@removida.invalid' then 'apelido' else linha.pessoa_email end);
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
