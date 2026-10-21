-- Prova das licenças do Brennimark Fonts (beta) — 16/10/2026.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE (e o detalhe) conferidos
-- onde há recusa, e `rollback` no fim. Caso cuja preparação falha reprova.
--
-- Perguntas:
--   1. Só a EQUIPE alcança: visitante e cliente (mesmo dono de conta) recebem
--      42501 em toda função, e as tabelas não são alcançáveis pela API.
--   2. As regras do plano valem no BANCO: individual até 2 computadores,
--      estúdio N, validade 90 dias contada da criação, número único.
--   3. O limite de computadores vale, é idempotente para o MESMO computador, e
--      revogar libera o lugar.
--   4. Licença revogada ou vencida não emite certificado.
--   5. Ativar tarde não estende a validade.
--   6. Cada ação da equipe fica no registro, com motivo.
-- (A corrida no limite está em `prova-concorrencia-licencas-do-fonts.sh`.)

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (equipe uuid, dono uuid, estranho uuid, lic_ind uuid, lic_est uuid);

create function pg_temp.como(p_quem uuid, p_sql text) returns text
language plpgsql as $f$
declare estado text; det text; n integer;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute p_sql;
    get diagnostics n = row_count;
    estado := 'ACEITOU';
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, det = pg_exception_detail;
    if estado = 'P0001' then estado := estado || coalesce(':' || nullif(det, ''), ''); end if;
  end;
  return estado;
end $f$;

create function pg_temp.anonimo(p_sql text) returns text
language plpgsql as $f$
declare estado text;
begin
  begin
    execute 'set local role anon';
    execute p_sql;
    estado := 'ACEITOU';
    execute 'reset role';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
  end;
  return estado;
end $f$;

create function pg_temp.valor(p_quem uuid, p_sql text) returns text
language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute p_sql into v;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  return v;
end $f$;

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void
language sql as $f$
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, replace(replace(p_obtido, 'true', 't'), 'false', 'f'), p_esperado = replace(replace(p_obtido, 'true', 't'), 'false', 'f'));
$f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_eq uuid := 'f0f0f0f0-f0f0-40f0-80f0-f0f0f0f00001';
  u_dono uuid := 'f0f0f0f0-f0f0-40f0-80f0-f0f0f0f00002';
  u_fora uuid := 'f0f0f0f0-f0f0-40f0-80f0-f0f0f0f00003';
  w1 uuid;
begin
  insert into auth.users (id, email, aud, role) values
    (u_eq, 'prova-fonts-equipe@local.test', 'authenticated', 'authenticated'),
    (u_dono, 'prova-fonts-dono@local.test', 'authenticated', 'authenticated'),
    (u_fora, 'prova-fonts-fora@local.test', 'authenticated', 'authenticated');
  insert into public.workspaces (name, slug) values ('Prova Fonts', 'prova-fonts') returning id into w1;
  insert into public.workspace_members (workspace_id, user_id, role) values (w1, u_dono, 'owner');
  insert into private.equipe_brennimark (user_id, nome, motivo) values (u_eq, 'Equipe de prova', 'prova');
  insert into mundo (equipe, dono, estranho) values (u_eq, u_dono, u_fora);
end $$;

-- A equipe cria as duas licenças que os casos usam.
update mundo set
  lic_ind = (pg_temp.valor(equipe, $q$select (public.console_fonts_criar_licenca('individual', 2, 'Ana Designer', 'ana@exemplo.test', '', 90, 'prova'))->>'id'$q$))::uuid,
  lic_est = (pg_temp.valor(equipe, $q$select (public.console_fonts_criar_licenca('studio', 20, 'Bruno Diretor', 'bruno@agencia.test', 'Agência Prova', 90, 'prova'))->>'id'$q$))::uuid;

-- ─── 1. Só a equipe alcança ─────────────────────────────────────────────────
do $$
declare m mundo; chamadas text[];
  c text;
begin
  select * into m from mundo;
  chamadas := array[
    format('select public.console_fonts_criar_licenca(''beta'', 1, ''X'', ''x@y.test'', '''', 90, ''motivo'')'),
    format('select public.console_fonts_ativar(%L, ''AAAAAAAAAAAAAAAAAAAA'', ''motivo'')', m.lic_ind),
    format('select public.console_fonts_ativacao(%L)', gen_random_uuid()),
    format('select public.console_fonts_revogar_ativacao(%L, ''motivo'')', gen_random_uuid()),
    format('select public.console_fonts_revogar_licenca(%L, ''motivo'')', m.lic_ind),
    'select public.console_fonts_licencas()'];
  foreach c in array chamadas loop
    perform pg_temp.registrar('visitante recusado: ' || left(c, 48), '42501', pg_temp.anonimo(c));
    perform pg_temp.registrar('cliente comum recusado: ' || left(c, 48), '42501', pg_temp.como(m.estranho, c));
    perform pg_temp.registrar('dono de conta recusado: ' || left(c, 48), '42501', pg_temp.como(m.dono, c));
  end loop;

  perform pg_temp.registrar('cliente nao le a tabela de licencas', '42501', pg_temp.como(m.dono, 'select * from private.licencas_fonts'));
  perform pg_temp.registrar('cliente nao le a tabela de ativacoes', '42501', pg_temp.como(m.dono, 'select * from private.ativacoes_fonts'));
  perform pg_temp.registrar('cliente nao grava licenca direto', '42501',
    pg_temp.como(m.dono, $q$insert into private.licencas_fonts (plano, max_dispositivos, titular_nome, titular_email, expira_em) values ('studio', 999, 'x', 'x@y.test', now() + interval '1 day')$q$));
  perform pg_temp.registrar('visitante nao le a tabela de licencas', '42501', pg_temp.anonimo('select * from private.licencas_fonts'));
end $$;

-- ─── 2. As regras do plano ──────────────────────────────────────────────────
do $$
declare m mundo;
begin
  select * into m from mundo;
  perform pg_temp.registrar('numero no formato BMF-BETA-000000', 't',
    (select (numero ~ '^BMF-BETA-[0-9]{6}$')::text from private.licencas_fonts where id = m.lic_ind));
  perform pg_temp.registrar('os numeros nao se repetem', '2',
    (select count(distinct numero)::text from private.licencas_fonts where id in (m.lic_ind, m.lic_est)));
  perform pg_temp.registrar('validade de 90 dias contada da criacao', '90',
    (select round(extract(epoch from (expira_em - emitida_em)) / 86400)::text from private.licencas_fonts where id = m.lic_ind));
  perform pg_temp.registrar('estudio guarda o limite escolhido (20)', '20',
    (select max_dispositivos::text from private.licencas_fonts where id = m.lic_est));
  perform pg_temp.registrar('individual com 3 computadores: recusado', '23514',
    pg_temp.como(m.equipe, $q$select public.console_fonts_criar_licenca('individual', 3, 'X', 'x@y.test', '', 90, 'prova')$q$));
  perform pg_temp.registrar('beta com 3 computadores: recusado', '23514',
    pg_temp.como(m.equipe, $q$select public.console_fonts_criar_licenca('beta', 3, 'X', 'x@y.test', '', 90, 'prova')$q$));
  perform pg_temp.registrar('estudio com 3 computadores: aceito', 'ACEITOU',
    pg_temp.como(m.equipe, $q$select public.console_fonts_criar_licenca('studio', 3, 'X', 'x@y.test', '', 90, 'prova')$q$));
  perform pg_temp.registrar('plano desconhecido: recusado', '23514',
    pg_temp.como(m.equipe, $q$select public.console_fonts_criar_licenca('gratis', 1, 'X', 'x@y.test', '', 90, 'prova')$q$));
  perform pg_temp.registrar('zero dispositivos: recusado', '23514',
    pg_temp.como(m.equipe, $q$select public.console_fonts_criar_licenca('studio', 0, 'X', 'x@y.test', '', 90, 'prova')$q$));
  perform pg_temp.registrar('validade de zero dias: recusada', '22023',
    pg_temp.como(m.equipe, $q$select public.console_fonts_criar_licenca('beta', 1, 'X', 'x@y.test', '', 0, 'prova')$q$));
  perform pg_temp.registrar('validade de 91 dias: recusada', '22023',
    pg_temp.como(m.equipe, $q$select public.console_fonts_criar_licenca('beta', 1, 'X', 'x@y.test', '', 91, 'prova')$q$));
  perform pg_temp.registrar('e-mail sem arroba: recusado', '23514',
    pg_temp.como(m.equipe, $q$select public.console_fonts_criar_licenca('beta', 1, 'X', 'semarroba', '', 90, 'prova')$q$));
end $$;

-- A trava dos 90 dias no PRÓPRIO banco, sem passar pela função: confere o nome exato.
do $$
declare c text := 'ACEITOU';
begin
  begin
    insert into private.licencas_fonts (plano, max_dispositivos, titular_nome, titular_email, expira_em)
    values ('beta', 1, 'Direto', 'direto@y.test', clock_timestamp() + interval '100 days');
  exception when check_violation then
    get stacked diagnostics c = constraint_name;
  end;
  perform pg_temp.registrar('inserção direta com 100 dias: constraint certa', 'licencas_fonts_validade_ate_90_dias', c);
end $$;

-- ─── 3. O limite de computadores ────────────────────────────────────────────
do $$
declare m mundo; a1 text; a1b text;
  c1 text := 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  c2 text := 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
  c3 text := 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
begin
  select * into m from mundo;
  a1 := pg_temp.valor(m.equipe, format('select (public.console_fonts_ativar(%L, %L, ''prova''))->>''activation_id''', m.lic_ind, c1));
  perform pg_temp.registrar('primeiro computador ativa', 't', (a1 is not null)::text);

  a1b := pg_temp.valor(m.equipe, format('select (public.console_fonts_ativar(%L, %L, ''prova''))->>''activation_id''', m.lic_ind, c1));
  perform pg_temp.registrar('o MESMO computador de novo devolve a mesma ativacao', 't', (a1 = a1b)::text);
  perform pg_temp.registrar('...e nao ocupa outro lugar', '1',
    (select count(*)::text from private.ativacoes_fonts where licenca_id = m.lic_ind and revogada_em is null));

  perform pg_temp.registrar('segundo computador ativa', 'ACEITOU',
    pg_temp.como(m.equipe, format('select public.console_fonts_ativar(%L, %L, ''prova'')', m.lic_ind, c2)));
  perform pg_temp.registrar('terceiro computador: limite de dispositivos', 'P0001:limite_de_dispositivos',
    pg_temp.como(m.equipe, format('select public.console_fonts_ativar(%L, %L, ''prova'')', m.lic_ind, c3)));
  perform pg_temp.registrar('o limite recusado nao deixou ativacao', '2',
    (select count(*)::text from private.ativacoes_fonts where licenca_id = m.lic_ind));

  perform pg_temp.registrar('revogar um computador', 'ACEITOU',
    pg_temp.como(m.equipe, format('select public.console_fonts_revogar_ativacao(%L, ''trocou de maquina'')', a1)));
  perform pg_temp.registrar('revogar de novo a mesma ativacao: nao encontrada', 'P0002',
    pg_temp.como(m.equipe, format('select public.console_fonts_revogar_ativacao(%L, ''de novo'')', a1)));
  perform pg_temp.registrar('o lugar foi liberado: o terceiro computador agora ativa', 'ACEITOU',
    pg_temp.como(m.equipe, format('select public.console_fonts_ativar(%L, %L, ''prova'')', m.lic_ind, c3)));
  perform pg_temp.registrar('ativacao revogada nao refaz certificado', 'P0001:licenca_revogada',
    pg_temp.como(m.equipe, format('select public.console_fonts_ativacao(%L)', a1)));

  perform pg_temp.registrar('codigo curto demais: recusado', '23514',
    pg_temp.como(m.equipe, format('select public.console_fonts_ativar(%L, ''curto'', ''prova'')', m.lic_est)));
  perform pg_temp.registrar('codigo com simbolo estranho: recusado', '23514',
    pg_temp.como(m.equipe, format('select public.console_fonts_ativar(%L, %L, ''prova'')', m.lic_est, 'DDDDDDDDDDDDDDDD<script>')));
  perform pg_temp.registrar('licenca que nao existe', 'P0002',
    pg_temp.como(m.equipe, format('select public.console_fonts_ativar(%L, %L, ''prova'')', gen_random_uuid(), c1)));

  -- Uma ativação de uma licença NÃO ocupa lugar em outra.
  perform pg_temp.registrar('o mesmo computador em OUTRA licenca ativa', 'ACEITOU',
    pg_temp.como(m.equipe, format('select public.console_fonts_ativar(%L, %L, ''prova'')', m.lic_est, c1)));
end $$;

-- ─── 4 e 5. Revogada, vencida e a data não anda ─────────────────────────────
do $$
declare m mundo; cert1 jsonb; cert2 jsonb; vencida uuid; ativ uuid;
  c4 text := 'EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';
begin
  select * into m from mundo;

  -- 5. Ativar mais tarde NÃO estende a validade, e o certificado sai com a data da licença.
  cert1 := pg_temp.valor(m.equipe, format('select public.console_fonts_ativar(%L, %L, ''prova'')', m.lic_est, c4))::jsonb;
  perform pg_sleep(0.05);
  cert2 := pg_temp.valor(m.equipe, format('select public.console_fonts_ativacao(%L)', cert1->>'activation_id'))::jsonb;
  perform pg_temp.registrar('certificado: expires_at = expira_em da licenca', 't',
    ((cert1->>'expires_at')::timestamptz = (select expira_em from private.licencas_fonts where id = m.lic_est))::text);
  perform pg_temp.registrar('refazer o certificado devolve os MESMOS campos', 't', (cert1 = cert2)::text);
  perform pg_temp.registrar('certificado: plano, limite e computador certos', 'studio 20 ' || c4,
    (cert1->>'plan') || ' ' || (cert1->>'max_devices') || ' ' || (cert1->>'device_public_key'));
  perform pg_temp.registrar('certificado: tem os dez campos que o aplicativo exige (sem version e issuer, que o site acrescenta)', '8',
    (select count(*)::text from jsonb_object_keys(cert1)));

  -- 4. Vencida (a data é puxada para o passado por SQL de administrador).
  vencida := (pg_temp.valor(m.equipe, $q$select (public.console_fonts_criar_licenca('beta', 1, 'V', 'v@y.test', '', 1, 'prova'))->>'id'$q$))::uuid;
  ativ := (pg_temp.valor(m.equipe, format('select (public.console_fonts_ativar(%L, %L, ''prova''))->>''activation_id''', vencida, 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')))::uuid;
  update private.licencas_fonts set emitida_em = now() - interval '3 days', expira_em = now() - interval '1 day' where id = vencida;
  perform pg_temp.registrar('licenca vencida nao ativa computador novo', 'P0001:licenca_vencida',
    pg_temp.como(m.equipe, format('select public.console_fonts_ativar(%L, %L, ''prova'')', vencida, 'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')));
  perform pg_temp.registrar('licenca vencida nao refaz certificado', 'P0001:licenca_vencida',
    pg_temp.como(m.equipe, format('select public.console_fonts_ativacao(%L)', ativ)));

  -- Revogada.
  perform pg_temp.registrar('revogar a licenca', 'ACEITOU',
    pg_temp.como(m.equipe, format('select public.console_fonts_revogar_licenca(%L, ''pedido do titular'')', m.lic_est)));
  perform pg_temp.registrar('licenca revogada nao ativa', 'P0001:licenca_revogada',
    pg_temp.como(m.equipe, format('select public.console_fonts_ativar(%L, %L, ''prova'')', m.lic_est, 'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH')));
  perform pg_temp.registrar('licenca revogada nao refaz certificado', 'P0001:licenca_revogada',
    pg_temp.como(m.equipe, format('select public.console_fonts_ativacao(%L)', cert1->>'activation_id')));
  perform pg_temp.registrar('revogar a licenca de novo: nao encontrada', 'P0002',
    pg_temp.como(m.equipe, format('select public.console_fonts_revogar_licenca(%L, ''de novo'')', m.lic_est)));
end $$;

-- ─── 6. A equipe lê, e cada ação fica no registro ───────────────────────────
do $$
declare m mundo;
begin
  select * into m from mundo;
  perform pg_temp.registrar('a lista traz as licencas com os computadores', 't',
    (pg_temp.valor(m.equipe, 'select (jsonb_array_length(public.console_fonts_licencas()) >= 4)::text')));
  perform pg_temp.registrar('o registro guarda criar, ativar, revogar — todos com motivo', 't',
    (select (count(*) filter (where acao like '%licença do Fonts' and acao like 'criar%') >= 4
         and count(*) filter (where acao like 'ativar computador%') >= 5
         and count(*) filter (where acao like 'revogar%') >= 2
         and count(*) filter (where motivo is null or btrim(motivo) = '') = 0)::text
       from private.registro_da_equipe where acao like '%Fonts%' or acao like '%licença do Fonts'));
end $$;

select case when passou then 'ok   ' else 'FALHA' end as st, caso, esperado, obtido from resultado order by ordem;

select case when count(*) filter (where not passou) = 0
            then 'PROVA COMPLETA: ' || count(*) || ' verificacoes, todas verdes'
            else 'PROVA FALHOU: ' || count(*) filter (where not passou) || ' de ' || count(*) end as veredito
from resultado;

do $$
declare n integer;
begin
  select count(*) filter (where not passou) into n from resultado;
  if n > 0 then raise exception 'PROVA FALHOU: % verificacao(oes)', n using errcode = 'P0001'; end if;
end $$;

rollback;
