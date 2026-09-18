-- Prova de conceder e revogar acesso — metade 1 de "Pessoas e acesso".
--
-- Mesmo método das outras: mundo próprio, SQLSTATE e nome de constraint
-- conferidos, dado isolado, `rollback` no fim, preparação que falha REPROVA.
--
-- Três perguntas:
--   1. O gesto do administrador vale para quem já entrou E para quem não entrou?
--   2. Quem NÃO administra a conta consegue conceder alguma coisa?
--   3. Revogar tira mesmo — e a conta pode ficar sem administrador?

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (conta uuid, outra_conta uuid, admin uuid, admin2 uuid, consulta uuid,
                         forasteiro uuid, marca_um uuid, marca_dois uuid, marca_alheia uuid);

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;

-- Executa COMO alguém e devolve o que saiu: o valor devolvido pela função, ou o
-- SQLSTATE e o nome da trava quando ela recusa.
create function pg_temp.como(p_quem uuid, p_sql text, out saida text, out nome text)
language plpgsql as $f$
begin
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute p_sql into saida;
    nome := '';
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    get stacked diagnostics saida = returned_sqlstate, nome = constraint_name;
  end;
end $f$;

create function pg_temp.entrar(p_id uuid, p_email text) returns void
language plpgsql as $f$
begin
  insert into auth.users (id, email, aud, role) values (p_id, p_email, 'authenticated', 'authenticated');
  insert into public.profiles (id, email, full_name) values (p_id, p_email, split_part(p_email,'@',1));
end $f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_admin uuid := 'aaaaaaaa-0000-4000-8000-00000000aaaa';
  u_admin2 uuid := 'aaaaaaaa-0000-4000-8000-00000000bbbb';
  u_consulta uuid := 'aaaaaaaa-0000-4000-8000-00000000cccc';
  u_fora uuid := 'aaaaaaaa-0000-4000-8000-00000000dddd';
  conta uuid; outra uuid; m1 uuid; m2 uuid; alheia uuid;
begin
  perform pg_temp.entrar(u_admin, 'pa-admin@local.test');
  perform pg_temp.entrar(u_admin2, 'pa-admin2@local.test');
  perform pg_temp.entrar(u_consulta, 'pa-consulta@local.test');
  perform pg_temp.entrar(u_fora, 'pa-fora@local.test');

  conta := private.abrir_conta_de_assinatura('Agência PA', 'pa-admin@local.test', u_admin);
  outra := private.abrir_conta_de_assinatura('Outra PA', 'pa-fora@local.test', u_fora);

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (conta, 'pa-um', 'PA Um', 'U', 'primeira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into m1;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (conta, 'pa-dois', 'PA Dois', 'D', 'segunda', 'pt-BR', '{}','{}','{}','{}','{}') returning id into m2;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (outra, 'pa-alheia', 'PA Alheia', 'A', 'de outra conta', 'pt-BR', '{}','{}','{}','{}','{}')
  returning id into alheia;

  insert into mundo values (conta, outra, u_admin, u_admin2, u_consulta, u_fora, m1, m2, alheia);

  if not exists (select 1 from public.workspace_members
                  where workspace_id = conta and user_id = u_admin and role = 'owner') then
    raise exception 'premissa falhou: a conta nao abriu com administrador';
  end if;
end $$;

-- ─── 1. Conceder ────────────────────────────────────────────────────────────
do $$
declare m record; r record; n integer;
begin
  select * into m from mundo;

  -- 1.1 Quem JÁ entrou: vale agora, sem esperar login nenhum.
  r := pg_temp.como(m.admin, format(
    'select public.conceder_acesso(%L, ''pa-consulta@local.test'', ''consulta'', array[%L]::uuid[])',
    m.conta, m.marca_um));
  perform pg_temp.registrar('conceder a quem ja tem login vale na hora', 'aplicada', r.saida);

  select count(*) into n from public.brand_members
   where brand_id = m.marca_um and user_id = m.consulta and capacidades = array['consultar']::text[];
  perform pg_temp.registrar('e a pessoa recebe consultar NA marca', '1', n::text);
  select count(*) into n from public.workspace_members
   where workspace_id = m.conta and user_id = m.consulta and role = 'member';
  perform pg_temp.registrar('entrando na conta como membro, nao como administrador', '1', n::text);
  select count(*) into n from public.concessoes_de_acesso
   where workspace_id = m.conta and email = 'pa-consulta@local.test'
     and convertida_em is not null and concedida_por = m.admin;
  perform pg_temp.registrar('o registro diz quem concedeu, e ja convertida', '1', n::text);

  -- 1.2 Quem NÃO entrou: fica pendente, e não inventa usuário.
  r := pg_temp.como(m.admin, format(
    'select public.conceder_acesso(%L, ''pa-grafica@local.test'', ''consulta'', array[%L,%L]::uuid[])',
    m.conta, m.marca_um, m.marca_dois));
  perform pg_temp.registrar('conceder a quem nunca entrou fica pendente', 'pendente', r.saida);
  select count(*) into n from public.concessoes_de_acesso
   where email = 'pa-grafica@local.test' and convertida_em is null;
  perform pg_temp.registrar('uma pendencia por marca concedida', '2', n::text);
  select count(*) into n from auth.users where email = 'pa-grafica@local.test';
  perform pg_temp.registrar('e ninguem cria usuario por conceder', '0', n::text);

  -- 1.3 Conceder de novo com outras marcas SUBSTITUI a pendência, e não soma.
  r := pg_temp.como(m.admin, format(
    'select public.conceder_acesso(%L, ''pa-grafica@local.test'', ''consulta'', array[%L]::uuid[])',
    m.conta, m.marca_dois));
  select count(*) into n from public.concessoes_de_acesso
   where email = 'pa-grafica@local.test' and convertida_em is null;
  perform pg_temp.registrar('conceder de novo substitui a pendencia', '1', n::text);

  -- 1.4 Administrador: sem marca, porque alcança todas.
  r := pg_temp.como(m.admin, format(
    'select public.conceder_acesso(%L, ''pa-admin2@local.test'', ''administrador'')', m.conta));
  perform pg_temp.registrar('conceder administracao a quem ja entrou', 'aplicada', r.saida);
  select count(*) into n from public.workspace_members
   where workspace_id = m.conta and user_id = m.admin2 and role = 'owner';
  perform pg_temp.registrar('o novo administrador e owner da conta', '1', n::text);
  select count(*) into n from public.brand_members where user_id = m.admin2;
  perform pg_temp.registrar('sem copiar marca nenhuma para ele', '0', n::text);

  r := pg_temp.como(m.admin, format(
    'select public.conceder_acesso(%L, ''pa-x@local.test'', ''administrador'', array[%L]::uuid[])',
    m.conta, m.marca_um));
  perform pg_temp.registrar('administrador COM marca e recusado', '22023', r.saida);

  r := pg_temp.como(m.admin, format(
    'select public.conceder_acesso(%L, ''pa-x@local.test'', ''consulta'', array[]::uuid[])', m.conta));
  perform pg_temp.registrar('consulta SEM marca e recusada', '22023', r.saida);

  r := pg_temp.como(m.admin, format(
    'select public.conceder_acesso(%L, ''pa-x@local.test'', ''dono'', array[%L]::uuid[])', m.conta, m.marca_um));
  perform pg_temp.registrar('papel fora do vocabulario e recusado', '22023', r.saida);

  r := pg_temp.como(m.admin, format(
    'select public.conceder_acesso(%L, ''naoeemail'', ''consulta'', array[%L]::uuid[])', m.conta, m.marca_um));
  perform pg_temp.registrar('e-mail invalido e recusado', '22023', r.saida);

  -- 1.5 A fronteira que mais importa: marca de OUTRA conta.
  r := pg_temp.como(m.admin, format(
    'select public.conceder_acesso(%L, ''pa-x@local.test'', ''consulta'', array[%L]::uuid[])',
    m.conta, m.marca_alheia));
  perform pg_temp.registrar('conceder marca de OUTRA conta e recusado', '42501', r.saida);
end $$;

-- ─── 2. Quem não administra não concede ─────────────────────────────────────
do $$
declare m record; r record; n integer;
begin
  select * into m from mundo;

  r := pg_temp.como(m.consulta, format(
    'select public.conceder_acesso(%L, ''pa-intruso@local.test'', ''consulta'', array[%L]::uuid[])',
    m.conta, m.marca_um));
  perform pg_temp.registrar('quem so consulta NAO concede', '42501', r.saida);

  r := pg_temp.como(m.forasteiro, format(
    'select public.conceder_acesso(%L, ''pa-intruso@local.test'', ''consulta'', array[%L]::uuid[])',
    m.conta, m.marca_um));
  perform pg_temp.registrar('administrador de OUTRA conta NAO concede nesta', '42501', r.saida);

  r := pg_temp.como(m.consulta, format('select public.revogar_acesso(%L, ''pa-admin@local.test'')', m.conta));
  perform pg_temp.registrar('quem so consulta NAO revoga', '42501', r.saida);

  r := pg_temp.como(m.consulta, format('select count(*) from public.pessoas_da_conta(%L)', m.conta));
  perform pg_temp.registrar('quem so consulta NAO ve a lista de acesso', '42501', r.saida);

  r := pg_temp.como(m.forasteiro, format('select count(*) from public.pessoas_da_conta(%L)', m.conta));
  perform pg_temp.registrar('outra conta NAO ve a lista desta', '42501', r.saida);

  r := pg_temp.como(m.admin, format('select count(*) from public.pessoas_da_conta(%L)', m.conta));
  -- admin, admin2, consulta (entraram) + pa-grafica (pendente)
  perform pg_temp.registrar('o administrador ve quem tem acesso e quem esta pendente', '4', r.saida);
end $$;

-- ─── 3. Revogar ─────────────────────────────────────────────────────────────
do $$
declare m record; r record; n integer;
begin
  select * into m from mundo;

  -- 3.1 Uma marca só.
  r := pg_temp.como(m.admin, format(
    'select public.conceder_acesso(%L, ''pa-consulta@local.test'', ''consulta'', array[%L,%L]::uuid[])',
    m.conta, m.marca_um, m.marca_dois));
  select count(*) into n from public.brand_members where user_id = m.consulta;
  perform pg_temp.registrar('a pessoa passa a alcancar as duas marcas', '2', n::text);

  r := pg_temp.como(m.admin, format(
    'select public.revogar_acesso(%L, ''pa-consulta@local.test'', %L)', m.conta, m.marca_dois));
  perform pg_temp.registrar('revogar uma marca so', 'marca-revogada', r.saida);
  select count(*) into n from public.brand_members where user_id = m.consulta;
  perform pg_temp.registrar('sobra a outra marca, e a pessoa continua na conta', '1', n::text);

  -- 3.2 A pessoa inteira.
  r := pg_temp.como(m.admin, format('select public.revogar_acesso(%L, ''pa-consulta@local.test'')', m.conta));
  perform pg_temp.registrar('revogar a pessoa inteira', 'revogada', r.saida);
  select count(*) into n from public.brand_members where user_id = m.consulta;
  perform pg_temp.registrar('nao sobra marca nenhuma', '0', n::text);
  select count(*) into n from public.workspace_members
   where workspace_id = m.conta and user_id = m.consulta;
  perform pg_temp.registrar('e ela sai da conta', '0', n::text);

  -- 3.3 O histórico não é apagado junto: quem concedeu o quê continua registrado.
  select count(*) into n from public.concessoes_de_acesso
   where email = 'pa-consulta@local.test' and convertida_em is not null;
  perform pg_temp.registrar('o historico das concessoes ja convertidas fica', '3', n::text);

  -- 3.4 Pendência é revogável antes de virar acesso.
  r := pg_temp.como(m.admin, format('select public.revogar_acesso(%L, ''pa-grafica@local.test'')', m.conta));
  perform pg_temp.registrar('revogar quem so tinha pendencia', 'pendencia-revogada', r.saida);
  select count(*) into n from public.concessoes_de_acesso
   where email = 'pa-grafica@local.test' and convertida_em is null;
  perform pg_temp.registrar('e a pendencia some', '0', n::text);

  -- 3.5 A conta não pode ficar sem administrador.
  r := pg_temp.como(m.admin, format('select public.revogar_acesso(%L, ''pa-admin2@local.test'')', m.conta));
  perform pg_temp.registrar('com dois administradores, um pode sair', 'revogada', r.saida);
  r := pg_temp.como(m.admin, format('select public.revogar_acesso(%L, ''pa-admin@local.test'')', m.conta));
  perform pg_temp.registrar('o ULTIMO administrador nao sai', '23514', r.saida);
  perform pg_temp.registrar('e a trava e a nomeada', 'conta_sem_administrador', r.nome);
  select count(*) into n from public.workspace_members
   where workspace_id = m.conta and role = 'owner';
  perform pg_temp.registrar('a conta continua com administrador', '1', n::text);
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
