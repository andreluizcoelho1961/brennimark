-- Prova do registro de envios de e-mail de marketing — 22/10/2026.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE (e o NOME da
-- constraint) conferidos onde há recusa, e `rollback` no fim.
--
-- Perguntas:
--   1. Só a EQUIPE alcança: visitante, cliente e dono de conta recebem 42501 em
--      toda função, e a tabela não é alcançável pela API.
--   2. Só é elegível quem aceitou, confirmou e não saiu; os filtros de cargo e
--      de equipe valem; o limite é de 1 a 25.
--   3. A mesma campanha nunca sai duas vezes para a mesma pessoa; "falhou" e a
--      reserva parada há mais de 15 minutos voltam; outra campanha é à parte.
--   4. As constraints têm o nome certo (único, forma, situação, conclusão).
--   5. Apagar o cadastro apaga o registro dos envios (cascata).
--   6. Cada reserva fica no registro da equipe, com motivo.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (equipe uuid, dono uuid, estranho uuid, ca uuid, cb uuid, cc uuid, cd uuid, ce uuid);

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
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, replace(replace(p_obtido, 'true', 't'), 'false', 'f'), coalesce(p_esperado = replace(replace(p_obtido, 'true', 't'), 'false', 'f'), false));
$f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_eq uuid := 'f0f0f0f0-f0f0-40f0-80f0-f0f0f0f00011';
  u_dono uuid := 'f0f0f0f0-f0f0-40f0-80f0-f0f0f0f00012';
  u_fora uuid := 'f0f0f0f0-f0f0-40f0-80f0-f0f0f0f00013';
  w1 uuid;
  a uuid; b uuid; c uuid; d uuid; e uuid;
begin
  insert into auth.users (id, email, aud, role) values
    (u_eq, 'prova-email-equipe@local.test', 'authenticated', 'authenticated'),
    (u_dono, 'prova-email-dono@local.test', 'authenticated', 'authenticated'),
    (u_fora, 'prova-email-fora@local.test', 'authenticated', 'authenticated');
  insert into public.workspaces (name, slug) values ('Prova Email', 'prova-email') returning id into w1;
  insert into public.workspace_members (workspace_id, user_id, role) values (w1, u_dono, 'owner');
  insert into private.equipe_brennimark (user_id, nome, motivo) values (u_eq, 'Equipe de prova', 'prova');

  -- A e B: elegíveis (A é a mais antiga). C: aceitou e não confirmou. D: confirmou e saiu. E: não aceitou.
  insert into public.cadastros_gratuitos (email, nome, cargo, respostas, primeira_origem, ultima_origem, aceite_marketing, aceite_versao, aceite_em, confirmado_em, criado_em)
    values ('prova-a@email.test', 'Ana', 'designer', '{"equipe":"2-5"}', 'grids', 'grids', true, '2026-10-18', now(), now(), now() - interval '4 days') returning id into a;
  insert into public.cadastros_gratuitos (email, nome, cargo, respostas, primeira_origem, ultima_origem, aceite_marketing, aceite_versao, aceite_em, confirmado_em, criado_em)
    values ('prova-b@email.test', 'Bruno', 'diretor-de-arte', '{"equipe":"so-eu"}', 'kit', 'kit', true, '2026-10-18', now(), now(), now() - interval '3 days') returning id into b;
  insert into public.cadastros_gratuitos (email, nome, cargo, primeira_origem, ultima_origem, aceite_marketing, aceite_versao, aceite_em, criado_em)
    values ('prova-c@email.test', 'Carla', 'designer', 'cores', 'cores', true, '2026-10-18', now(), now() - interval '2 days') returning id into c;
  insert into public.cadastros_gratuitos (email, nome, cargo, primeira_origem, ultima_origem, aceite_marketing, aceite_versao, aceite_em, confirmado_em, descadastrado_em, criado_em)
    values ('prova-d@email.test', 'Davi', 'designer', 'fonts', 'fonts', true, '2026-10-18', now(), now(), now(), now() - interval '1 day') returning id into d;
  insert into public.cadastros_gratuitos (email, nome, primeira_origem, ultima_origem, criado_em)
    values ('prova-e@email.test', 'Elisa', 'grids', 'grids', now()) returning id into e;

  insert into mundo (equipe, dono, estranho, ca, cb, cc, cd, ce) values (u_eq, u_dono, u_fora, a, b, c, d, e);
end $$;

-- ─── 1. Só a equipe alcança ─────────────────────────────────────────────────
do $$
declare m mundo; chamadas text[]; c text;
begin
  select * into m from mundo;
  chamadas := array[
    $q$select public.console_email_resumo('campanha-x', null, null)$q$,
    $q$select public.console_email_reservar('campanha-x', null, null, 5, 'motivo')$q$,
    format('select public.console_email_marcar(''campanha-x'', %L, true)', m.ca)];
  foreach c in array chamadas loop
    perform pg_temp.registrar('visitante recusado: ' || left(c, 50), '42501', pg_temp.anonimo(c));
    perform pg_temp.registrar('cliente comum recusado: ' || left(c, 50), '42501', pg_temp.como(m.estranho, c));
    perform pg_temp.registrar('dono de conta recusado: ' || left(c, 50), '42501', pg_temp.como(m.dono, c));
  end loop;
  perform pg_temp.registrar('cliente nao le a tabela de envios', '42501', pg_temp.como(m.dono, 'select * from public.envios_de_email'));
  perform pg_temp.registrar('cliente nao grava envio direto', '42501',
    pg_temp.como(m.dono, format('insert into public.envios_de_email (campanha, cadastro_id) values (''campanha-x'', %L)', m.ca)));
  perform pg_temp.registrar('visitante nao le a tabela de envios', '42501', pg_temp.anonimo('select * from public.envios_de_email'));
end $$;

-- ─── 2. Quem é elegível e o limite ──────────────────────────────────────────
do $$
declare m mundo;
begin
  select * into m from mundo;
  perform pg_temp.registrar('elegiveis: so A e B (C nao confirmou, D saiu, E nao aceitou)', '2',
    pg_temp.valor(m.equipe, $q$select (public.console_email_resumo('campanha-x', null, null))->>'elegiveis'$q$));
  perform pg_temp.registrar('alcance sem filtro: 2', '2',
    pg_temp.valor(m.equipe, $q$select (public.console_email_resumo('campanha-x', null, null))->>'alcance'$q$));
  perform pg_temp.registrar('filtro de cargo designer: 1 (so A; C nao confirmou, D saiu)', '1',
    pg_temp.valor(m.equipe, $q$select (public.console_email_resumo('campanha-x', array['designer'], null))->>'alcance'$q$));
  perform pg_temp.registrar('filtro de equipe so-eu: 1 (so B)', '1',
    pg_temp.valor(m.equipe, $q$select (public.console_email_resumo('campanha-x', null, array['so-eu']))->>'alcance'$q$));
  perform pg_temp.registrar('filtro de cargo atendimento: 0', '0',
    pg_temp.valor(m.equipe, $q$select (public.console_email_resumo('campanha-x', array['atendimento'], null))->>'alcance'$q$));
  perform pg_temp.registrar('limite zero: recusado', '22023',
    pg_temp.como(m.equipe, $q$select public.console_email_reservar('campanha-x', null, null, 0, 'prova')$q$));
  perform pg_temp.registrar('limite 26: recusado', '22023',
    pg_temp.como(m.equipe, $q$select public.console_email_reservar('campanha-x', null, null, 26, 'prova')$q$));
  perform pg_temp.registrar('campanha com forma ruim: recusada', '23514',
    pg_temp.como(m.equipe, $q$select public.console_email_reservar('Campanha X!', null, null, 5, 'prova')$q$));
end $$;

-- ─── 3. O ciclo: reservar, marcar, nunca repetir ────────────────────────────
do $$
declare m mundo;
begin
  select * into m from mundo;
  perform pg_temp.registrar('reservar 1: devolve so a pessoa mais antiga (A)', 'prova-a@email.test',
    pg_temp.valor(m.equipe, $q$select (public.console_email_reservar('campanha-x', null, null, 1, 'prova'))->0->>'email'$q$));
  perform pg_temp.registrar('o retorno traz o token de saida', 't',
    (select (e.situacao = 'reservado' and c.token_de_saida is not null)::text
       from public.envios_de_email e join public.cadastros_gratuitos c on c.id = e.cadastro_id
      where e.campanha = 'campanha-x' and e.cadastro_id = m.ca));
  perform pg_temp.registrar('reservar de novo: A nao volta, sai so B', 'prova-b@email.test',
    pg_temp.valor(m.equipe, $q$select (public.console_email_reservar('campanha-x', null, null, 25, 'prova'))->0->>'email'$q$));
  perform pg_temp.registrar('reservar de novo: ninguem sobrou', '0',
    pg_temp.valor(m.equipe, $q$select jsonb_array_length(public.console_email_reservar('campanha-x', null, null, 25, 'prova'))::text$q$));
  perform pg_temp.registrar('C, D e E nunca foram reservados', '0',
    (select count(*)::text from public.envios_de_email where cadastro_id in (m.cc, m.cd, m.ce)));

  perform pg_temp.registrar('marcar A como enviado', 'ACEITOU',
    pg_temp.como(m.equipe, format('select public.console_email_marcar(''campanha-x'', %L, true)', m.ca)));
  perform pg_temp.registrar('marcar A de novo: ja concluido', 'P0002',
    pg_temp.como(m.equipe, format('select public.console_email_marcar(''campanha-x'', %L, true)', m.ca)));
  perform pg_temp.registrar('marcar B como falhou', 'ACEITOU',
    pg_temp.como(m.equipe, format('select public.console_email_marcar(''campanha-x'', %L, false)', m.cb)));
  perform pg_temp.registrar('resumo: 1 enviado e 1 falha', '1/1',
    pg_temp.valor(m.equipe, $q$select ((public.console_email_resumo('campanha-x', null, null))->>'enviados') || '/' || ((public.console_email_resumo('campanha-x', null, null))->>'falhas')$q$));
  perform pg_temp.registrar('quem falhou volta (B), quem foi enviado nao (A)', 'prova-b@email.test',
    pg_temp.valor(m.equipe, $q$select (public.console_email_reservar('campanha-x', null, null, 25, 'prova'))->0->>'email'$q$));
  perform pg_temp.registrar('depois de reservar B, a fila esta vazia', '0',
    pg_temp.valor(m.equipe, $q$select jsonb_array_length(public.console_email_reservar('campanha-x', null, null, 25, 'prova'))::text$q$));

  -- A reserva parada ha mais de 15 minutos volta.
  update public.envios_de_email set reservado_em = now() - interval '20 minutes' where campanha = 'campanha-x' and cadastro_id = m.cb;
  perform pg_temp.registrar('reserva parada ha 20 minutos volta a ser candidata', 'prova-b@email.test',
    pg_temp.valor(m.equipe, $q$select (public.console_email_reservar('campanha-x', null, null, 25, 'prova'))->0->>'email'$q$));
  perform pg_temp.registrar('o reaproveitamento nao duplica a linha', '1',
    (select count(*)::text from public.envios_de_email where campanha = 'campanha-x' and cadastro_id = m.cb));

  -- Outra campanha é à parte.
  perform pg_temp.registrar('outra campanha: A e B voltam a ser elegiveis', '2',
    pg_temp.valor(m.equipe, $q$select jsonb_array_length(public.console_email_reservar('campanha-y', null, null, 25, 'prova'))::text$q$));
  perform pg_temp.registrar('marcar um envio que nao existe', 'P0002',
    pg_temp.como(m.equipe, format('select public.console_email_marcar(''campanha-z'', %L, true)', m.ca)));
end $$;

-- ─── 4. O nome exato de cada constraint ─────────────────────────────────────
do $$
declare m mundo; c text;
begin
  select * into m from mundo;

  c := 'ACEITOU';
  begin insert into public.envios_de_email (campanha, cadastro_id) values ('campanha-x', m.ca);
  exception when unique_violation then get stacked diagnostics c = constraint_name; end;
  perform pg_temp.registrar('duplicar (campanha, pessoa) direto: constraint certa', 'envios_um_por_pessoa', c);

  c := 'ACEITOU';
  begin insert into public.envios_de_email (campanha, cadastro_id) values ('Campanha X!', m.ca);
  exception when check_violation then get stacked diagnostics c = constraint_name; end;
  perform pg_temp.registrar('campanha com forma ruim direto: constraint certa', 'envios_campanha_forma', c);

  c := 'ACEITOU';
  begin insert into public.envios_de_email (campanha, cadastro_id, situacao, concluido_em) values ('campanha-w', m.ca, 'talvez', now());
  exception when check_violation then get stacked diagnostics c = constraint_name; end;
  perform pg_temp.registrar('situacao desconhecida: constraint certa', 'envios_situacao_valida', c);

  c := 'ACEITOU';
  begin insert into public.envios_de_email (campanha, cadastro_id, situacao) values ('campanha-w', m.ca, 'enviado');
  exception when check_violation then get stacked diagnostics c = constraint_name; end;
  perform pg_temp.registrar('enviado sem data de conclusao: constraint certa', 'envios_conclusao_coerente', c);
end $$;

-- ─── 5. Apagar o cadastro apaga o registro dos envios ───────────────────────
do $$
declare m mundo;
begin
  select * into m from mundo;
  perform pg_temp.registrar('A tem registro em duas campanhas antes de apagar', '2',
    (select count(*)::text from public.envios_de_email where cadastro_id = m.ca));
  delete from public.cadastros_gratuitos where id = m.ca;
  perform pg_temp.registrar('apagar o cadastro apaga o registro dos envios', '0',
    (select count(*)::text from public.envios_de_email where cadastro_id = m.ca));
  perform pg_temp.registrar('o registro dos outros fica', 't',
    (select (count(*) >= 2)::text from public.envios_de_email where cadastro_id = m.cb));
end $$;

-- ─── 6. O registro da equipe ────────────────────────────────────────────────
do $$
begin
  perform pg_temp.registrar('cada reserva ficou no registro, com motivo', 't',
    (select (count(*) >= 7 and count(*) filter (where motivo is null or btrim(motivo) = '') = 0)::text
       from private.registro_da_equipe where acao = 'reservar envio de e-mail'));
end $$;


-- ─── 7. O idioma de cada destinatário (29/10/2026) ──────────────────────────
do $$
declare m mundo; f uuid; g uuid; h uuid;
begin
  select * into m from mundo;
  insert into public.cadastros_gratuitos (email, nome, cargo, respostas, primeira_origem, ultima_origem, aceite_marketing, aceite_versao, aceite_em, confirmado_em, criado_em)
    values ('prova-f@email.test', 'Fiona', 'designer', '{"idioma":"en"}', 'grids', 'grids', true, '2026-10-18', now(), now(), now() - interval '10 days') returning id into f;
  insert into public.cadastros_gratuitos (email, nome, cargo, respostas, primeira_origem, ultima_origem, aceite_marketing, aceite_versao, aceite_em, confirmado_em, criado_em)
    values ('prova-g@email.test', 'Gabi', 'designer', '{"idioma":"pt-BR"}', 'grids', 'grids', true, '2026-10-18', now(), now(), now() - interval '9 days') returning id into g;
  insert into public.cadastros_gratuitos (email, nome, cargo, respostas, primeira_origem, ultima_origem, aceite_marketing, aceite_versao, aceite_em, confirmado_em, criado_em)
    values ('prova-h@email.test', 'Hugo', 'designer', '{"idioma":"xx"}', 'grids', 'grids', true, '2026-10-18', now(), now(), now() - interval '8 days') returning id into h;

end $$;

do $$
declare m mundo; r jsonb;
begin
  select * into m from mundo;
  perform set_config('request.jwt.claims', json_build_object('sub', m.equipe, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  r := public.console_email_reservar('campanha-i', null, null, 25, 'prova');
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);

  perform pg_temp.registrar('idioma: respostas.idioma = en devolve en', 'en',
    (select x ->> 'idioma' from jsonb_array_elements(r) x where x ->> 'email' = 'prova-f@email.test'));
  perform pg_temp.registrar('idioma: respostas.idioma = pt-BR devolve pt-BR', 'pt-BR',
    (select x ->> 'idioma' from jsonb_array_elements(r) x where x ->> 'email' = 'prova-g@email.test'));
  perform pg_temp.registrar('idioma: valor desconhecido cai no padrao pt-BR', 'pt-BR',
    (select x ->> 'idioma' from jsonb_array_elements(r) x where x ->> 'email' = 'prova-h@email.test'));
  perform pg_temp.registrar('idioma: sem a chave nas respostas cai no padrao pt-BR', 'pt-BR',
    (select x ->> 'idioma' from jsonb_array_elements(r) x where x ->> 'email' = 'prova-b@email.test'));
  perform pg_temp.registrar('idioma: todo item devolvido traz idioma (so en ou pt-BR)', 't',
    (select (count(*) > 0 and bool_and(x ->> 'idioma' in ('en', 'pt-BR')))::text from jsonb_array_elements(r) x));
  perform pg_temp.registrar('idioma: os campos de antes continuam no retorno', 't',
    (select bool_and(x ? 'cadastro_id' and x ? 'email' and x ? 'nome' and x ? 'token' and x ? 'aceite_em')::text from jsonb_array_elements(r) x));
  perform pg_temp.registrar('idioma: fora da equipe continua recusando (42501)', '42501',
    pg_temp.como(m.dono, $q$select public.console_email_reservar('campanha-i', null, null, 5, 'prova')$q$));
  perform pg_temp.registrar('idioma: anonimo continua recusando', '42501',
    pg_temp.anonimo($q$select public.console_email_reservar('campanha-i', null, null, 5, 'prova')$q$));
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
