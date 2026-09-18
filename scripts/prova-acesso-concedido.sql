-- Prova de "a conta nasce da assinatura, e todo acesso é concedido" — 17/09/2026.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE e nome de constraint
-- conferidos onde há erro esperado, dado isolado por caso, `rollback` no fim, e
-- caso cuja preparação falha REPROVA em vez de passar em silêncio.
--
-- Três perguntas:
--   1. Entrar deixou de criar conta?
--   2. A concessão pendente vira acesso — o certo, e só ele?
--   3. Quem concede é quem administra a conta, e o registro é honesto?

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (conta uuid, admin1 uuid, admin2 uuid, consulta uuid, membro uuid,
                         outra_conta uuid, dona_outra uuid, marca_um uuid, marca_dois uuid);

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;

create function pg_temp.tentar(p_quem uuid, p_sql text, out estado text, out nome text, out linhas integer)
language plpgsql as $f$
begin
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute p_sql;
    get diagnostics linhas = row_count;
    estado := case when linhas > 0 then 'ACEITOU' else 'ACEITOU-SEM-LINHA' end; nome := '';
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, nome = constraint_name;
    linhas := 0;
  end;
end $f$;

create function pg_temp.contar(p_quem uuid, p_sql text) returns integer
language plpgsql as $f$
declare n integer;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute p_sql into n;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  return n;
end $f$;

-- O que só o SISTEMA pode fazer: desde 18/09/2026 ninguém com sessão escreve
-- em `concessoes_de_acesso` direto. As constraints continuam sendo a última
-- barreira, e são provadas aqui, como sistema.
create function pg_temp.como_sistema(p_sql text, out estado text, out nome text)
language plpgsql as $f$
begin
  begin
    execute p_sql;
    estado := 'ACEITOU'; nome := '';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, nome = constraint_name;
  end;
end $f$;

-- Entrar é criar o usuário e o perfil: o gatilho do perfil é o que colhe as
-- concessões. Esta função é "a pessoa entrou pela primeira vez".
create function pg_temp.entrar(p_id uuid, p_email text) returns void
language plpgsql as $f$
begin
  insert into auth.users (id, email, aud, role)
  values (p_id, p_email, 'authenticated', 'authenticated');
  insert into public.profiles (id, email, full_name)
  values (p_id, p_email, split_part(p_email, '@', 1));
end $f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_admin1 uuid := '99999999-9999-4999-8999-99999999aaaa';
  u_dona_outra uuid := '99999999-9999-4999-8999-99999999bbbb';
  conta uuid; outra uuid; m1 uuid; m2 uuid;
begin
  -- A conta desta prova nasce como manda a decisão: por ato explícito.
  perform pg_temp.entrar(u_admin1, 'ac-admin1@local.test');
  perform pg_temp.entrar(u_dona_outra, 'ac-outra@local.test');

  conta := private.abrir_conta_de_assinatura('Agência da Prova', 'ac-admin1@local.test', u_admin1);
  outra := private.abrir_conta_de_assinatura('Outra Agência', 'ac-outra@local.test', u_dona_outra);

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (conta, 'ac-um', 'AC Um', 'U', 'primeira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into m1;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (conta, 'ac-dois', 'AC Dois', 'D', 'segunda', 'pt-BR', '{}','{}','{}','{}','{}') returning id into m2;

  insert into mundo (conta, admin1, admin2, consulta, membro, outra_conta, dona_outra, marca_um, marca_dois)
  values (conta, u_admin1, '99999999-9999-4999-8999-99999999cccc',
          '99999999-9999-4999-8999-99999999dddd', '99999999-9999-4999-8999-99999999eeee',
          outra, u_dona_outra, m1, m2);

  -- Premissa: a conta abriu com o administrador já dentro (ele já tinha login,
  -- então a concessão foi colhida na hora).
  if not exists (select 1 from public.workspace_members
                  where workspace_id = conta and user_id = u_admin1 and role = 'owner') then
    raise exception 'premissa falhou: abrir conta nao deixou o administrador dentro dela';
  end if;
end $$;

-- ─── 1. Entrar não cria conta ───────────────────────────────────────────────
do $$
declare m record; antes integer; depois integer; tem integer;
begin
  select * into m from mundo;
  select count(*) into antes from public.workspaces;

  -- Ninguém concedeu nada a esta pessoa. Até 17/09/2026 ela sairia daqui dona
  -- de uma conta nova — era o cadastro público virando conta.
  perform pg_temp.entrar(m.membro, 'ac-ninguem@local.test');

  select count(*) into depois from public.workspaces;
  select count(*) into tem from public.workspace_members where user_id = m.membro;
  perform pg_temp.registrar('entrar SEM concessao nao cria conta', antes::text, depois::text);
  perform pg_temp.registrar('e a pessoa nao pertence a conta nenhuma', '0', tem::text);
end $$;

-- ─── 2. A concessão pendente vira acesso ────────────────────────────────────
do $$
declare m record; t record; n integer; nova uuid;
begin
  select * into m from mundo;

  -- 2.1 Consulta numa marca só.
  t := pg_temp.tentar(m.admin1, format(
    'select public.conceder_acesso(%L, ''ac-consulta@local.test'', ''consulta'', array[%L]::uuid[], ''AC Consulta'')',
    m.conta, m.marca_um));
  perform pg_temp.registrar('o administrador concede consulta numa marca', 'ACEITOU', t.estado);

  perform pg_temp.entrar(m.consulta, 'ac-consulta@local.test');

  select count(*) into n from public.workspace_members
   where workspace_id = m.conta and user_id = m.consulta and role = 'member';
  perform pg_temp.registrar('no primeiro login ela entra na conta como membro', '1', n::text);

  select count(*) into n from public.brand_members
   where brand_id = m.marca_um and user_id = m.consulta and capacidades = array['consultar']::text[];
  perform pg_temp.registrar('e recebe consultar NA marca concedida', '1', n::text);

  n := pg_temp.contar(m.consulta, format('select count(*) from public.brands where id = %L', m.marca_um));
  perform pg_temp.registrar('ela enxerga a marca concedida', '1', n::text);
  n := pg_temp.contar(m.consulta, format('select count(*) from public.brands where id = %L', m.marca_dois));
  perform pg_temp.registrar('e NAO enxerga a outra marca da mesma conta', '0', n::text);

  select count(*) into n from public.concessoes_de_acesso
   where email = 'ac-consulta@local.test' and convertida_em is not null and convertida_para = m.consulta;
  perform pg_temp.registrar('a concessao fica marcada como convertida, com quem a colheu', '1', n::text);

  -- 2.2 Administrador: entra na conta e alcança TODA marca dela, inclusive as
  -- que nascerem depois. É o que a derivação garante sem copiar nada.
  t := pg_temp.tentar(m.admin1, format(
    'select public.conceder_acesso(%L, ''ac-admin2@local.test'', ''administrador'')', m.conta));
  perform pg_temp.registrar('o administrador concede administracao a outro e-mail', 'ACEITOU', t.estado);

  perform pg_temp.entrar(m.admin2, 'ac-admin2@local.test');

  n := pg_temp.contar(m.admin2, format('select count(*) from public.brands where workspace_id = %L', m.conta));
  perform pg_temp.registrar('o novo administrador alcanca as duas marcas', '2', n::text);

  select count(*) into n from public.brand_members where user_id = m.admin2;
  perform pg_temp.registrar('sem NENHUMA linha copiada em brand_members', '0', n::text);

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (m.conta, 'ac-tres', 'AC Tres', 'T', 'nascida depois', 'pt-BR', '{}','{}','{}','{}','{}')
  returning id into nova;
  n := pg_temp.contar(m.admin2, format('select count(*) from public.brands where id = %L', nova));
  perform pg_temp.registrar('e alcanca a marca criada DEPOIS dele', '1', n::text);

  -- 2.3 Repetir a colheita não duplica nada.
  perform private.converter_concessoes(m.consulta, 'ac-consulta@local.test');
  select count(*) into n from public.brand_members
   where brand_id = m.marca_um and user_id = m.consulta;
  perform pg_temp.registrar('colher de novo nao duplica o acesso', '1', n::text);
end $$;

-- ─── 3. Quem concede, e o que o banco recusa ────────────────────────────────
do $$
declare m record; t record; n integer;
begin
  select * into m from mundo;

  t := pg_temp.tentar(m.consulta, format(
    'insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por) '
    || 'values (%L, %L, ''ac-intruso@local.test'', ''consulta'', %L)', m.conta, m.marca_um, m.consulta));
  perform pg_temp.registrar('quem so consulta NAO concede', '42501', t.estado);

  t := pg_temp.tentar(m.dona_outra, format(
    'insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por) '
    || 'values (%L, %L, ''ac-intruso@local.test'', ''consulta'', %L)', m.conta, m.marca_um, m.dona_outra));
  perform pg_temp.registrar('administrador de OUTRA conta NAO concede nesta', '42501', t.estado);

  -- Filtrado pela conta: ela enxerga as concessões DA CONTA DELA, e isso está
  -- certo. O que se prova aqui é que as desta conta não aparecem para ela.
  n := pg_temp.contar(m.dona_outra, format('select count(*) from public.concessoes_de_acesso where workspace_id = %L', m.conta));
  perform pg_temp.registrar('e nao le as concessoes desta conta', '0', n::text);
  n := pg_temp.contar(m.dona_outra, format('select count(*) from public.concessoes_de_acesso where workspace_id = %L', m.outra_conta));
  perform pg_temp.registrar('mas le as da conta dela', '1', n::text);

  n := pg_temp.contar(m.consulta, 'select count(*) from public.concessoes_de_acesso');
  perform pg_temp.registrar('quem so consulta nao le concessao nenhuma', '0', n::text);

  n := pg_temp.contar(m.admin1, format('select count(*) from public.concessoes_de_acesso where workspace_id = %L', m.conta));
  perform pg_temp.registrar('o administrador le as da conta dele', '3', n::text);

  -- Sem escrita direta: desde 18/09/2026 só as funções escrevem. Uma linha
  -- "ativa" inserida à mão seria histórico falso; uma apagada, histórico perdido.
  t := pg_temp.tentar(m.admin1, 'update public.concessoes_de_acesso set papel = ''administrador''');
  perform pg_temp.registrar('ninguem ALTERA concessao pela API', '42501', t.estado);
  t := pg_temp.tentar(m.admin1, format(
    'insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por) '
    || 'values (%L, %L, ''ac-direto@local.test'', ''consulta'', %L)', m.conta, m.marca_um, m.admin1));
  perform pg_temp.registrar('nem o administrador INSERE concessao direto', '42501', t.estado);
  t := pg_temp.tentar(m.admin1, 'delete from public.concessoes_de_acesso');
  perform pg_temp.registrar('nem o administrador APAGA concessao', '42501', t.estado);

  -- Revogar enquanto pendente MARCA a linha; ela fica como histórico.
  t := pg_temp.tentar(m.admin1, format(
    'select public.conceder_acesso(%L, ''ac-pendente@local.test'', ''consulta'', array[%L]::uuid[], ''Pendente'')',
    m.conta, m.marca_dois));
  perform pg_temp.registrar('concede a quem ainda nao entrou', 'ACEITOU', t.estado);
  t := pg_temp.tentar(m.admin1, format(
    'select public.revogar_acesso(%L, ''ac-pendente@local.test'')', m.conta));
  perform pg_temp.registrar('e revoga enquanto esta pendente', 'ACEITOU', t.estado);
  select count(*) into n from public.concessoes_de_acesso
   where email = 'ac-pendente@local.test' and situacao = 'revogada'
     and revogada_por = m.admin1 and revogada_em is not null;
  perform pg_temp.registrar('a linha revogada FICA, com autor e data', '1', n::text);

  -- E-mail entra normalizado: sem isto "Maria@x" e "maria@x" seriam duas
  -- concessões, e a pessoa colheria só uma. A constraint é a última barreira.
  t := pg_temp.como_sistema(format(
    'insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por) '
    || 'values (%L, %L, '' AC-Maiuscula@Local.Test '', ''consulta'', %L)', m.conta, m.marca_um, m.admin1));
  perform pg_temp.registrar('e-mail fora do padrao e recusado', 'concessoes_de_acesso_email_check', t.nome);

  -- Administrador é da conta inteira; consulta é sempre de uma marca.
  t := pg_temp.como_sistema(format(
    'insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por) '
    || 'values (%L, %L, ''ac-forma@local.test'', ''administrador'', %L)', m.conta, m.marca_um, m.admin1));
  perform pg_temp.registrar('administrador com marca e recusado', 'concessoes_de_acesso_alcance_check', t.nome);

  t := pg_temp.como_sistema(format(
    'insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por) '
    || 'values (%L, null, ''ac-forma@local.test'', ''consulta'', %L)', m.conta, m.admin1));
  perform pg_temp.registrar('consulta sem marca e recusada', 'concessoes_de_acesso_alcance_check', t.nome);

  -- Depois de convertida, conceder de novo é legítimo (a pessoa pode ter sido
  -- removida e chamada de volta).
  t := pg_temp.tentar(m.admin1, format(
    'select public.conceder_acesso(%L, ''ac-consulta@local.test'', ''consulta'', array[%L]::uuid[])',
    m.conta, m.marca_um));
  perform pg_temp.registrar('conceder de novo depois de convertida e aceito', 'ACEITOU', t.estado);

  -- Duas pendentes iguais não convivem; uma revogada e uma pendente, sim.
  t := pg_temp.como_sistema(format(
    'insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por) '
    || 'values (%L, %L, ''ac-dup@local.test'', ''consulta'', %L)', m.conta, m.marca_um, m.admin1));
  if t.estado <> 'ACEITOU' then raise exception 'premissa falhou: a primeira pendencia nao entrou (%)', t.estado; end if;
  t := pg_temp.como_sistema(format(
    'insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por) '
    || 'values (%L, %L, ''ac-dup@local.test'', ''consulta'', %L)', m.conta, m.marca_um, m.admin1));
  perform pg_temp.registrar('duas PENDENTES iguais nao convivem', 'concessoes_de_acesso_pendente_idx', t.nome);
  t := pg_temp.como_sistema(format(
    'insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por) '
    || 'values (%L, %L, ''ac-pendente@local.test'', ''consulta'', %L)', m.conta, m.marca_dois, m.admin1));
  perform pg_temp.registrar('mas a revogada nao impede uma pendente nova', 'ACEITOU', t.estado);

  -- A situação é derivada: não se escreve, não discorda dos fatos.
  t := pg_temp.como_sistema(format(
    'update public.concessoes_de_acesso set situacao = ''ativa'' where email = ''ac-dup@local.test'''));
  perform pg_temp.registrar('situacao nao se escreve a mao', '428C9', t.estado);

  -- As funções de sistema não são alcançáveis por quem tem sessão.
  t := pg_temp.tentar(m.admin1, 'select private.converter_concessoes(''00000000-0000-0000-0000-000000000000''::uuid, ''x@y.z'')');
  perform pg_temp.registrar('quem tem sessao NAO dispara a colheita', '42501', t.estado);
  t := pg_temp.tentar(m.admin1, 'select private.abrir_conta_de_assinatura(''Pirata'', ''x@y.z'')');
  perform pg_temp.registrar('quem tem sessao NAO abre conta', '42501', t.estado);
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
