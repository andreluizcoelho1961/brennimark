-- Prova da exclusão aos 12 meses do cancelamento — 08/10/2026.
--
-- Mundo próprio, SQLSTATE e NOME da constraint (ou a dica da função), e
-- `rollback` no fim. Perguntas:
--   1. Só o servidor chama as 5 funções; o dono não exclui a própria conta, o
--      dono de Y não exclui a de X, o visitante nada; Y não vê a assinatura de X.
--   2. O aviso vai só a quem tem 11 meses de cancelada e ainda não foi avisado;
--      a data prometida respeita os 30 dias; a reserva é de um só.
--   3. As três travas: 12 meses, aviso há 30 dias, conta cancelada.
--   4. Iniciar enfileira só a pasta da conta, nos três buckets, sem duplicar.
--   5. Concluir só com fila e pasta vazias; sai a área, a marca, os membros e os
--      logins criados por ela (o que está em outra conta fica); ficam o
--      registro da assinatura, o aviso do Stripe e o registro de acesso.
--   6. As constraints barram o estado incoerente escrito direto.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);

create function pg_temp.como(p_quem uuid, p_sql text) returns text
language plpgsql as $f$
declare estado text; n integer;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute p_sql;
    get diagnostics n = row_count;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    return 'ACEITOU ' || n;
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
    return estado;
  end;
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

create function pg_temp.papel(p_papel text, p_sql text) returns text
language plpgsql as $f$
declare estado text;
begin
  begin
    execute format('set local role %I', p_papel);
    execute p_sql;
    execute 'reset role';
    return 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
    return estado;
  end;
end $f$;

create function pg_temp.direto(p_sql text) returns text
language plpgsql as $f$
declare estado text; nome text;
begin
  begin
    execute p_sql;
    return 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, nome = constraint_name;
    return estado || ' ' || coalesce(nome, '');
  end;
end $f$;

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void
language sql as $f$
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, p_obtido, p_esperado is not distinct from p_obtido);
$f$;

create function pg_temp.erro(p_sql text) returns text
language plpgsql as $f$
declare estado text; dica text; nome text;
begin
  begin
    execute p_sql;
    return 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, dica = pg_exception_hint, nome = constraint_name;
    return estado || ' ' || coalesce(nullif(nome, ''), nullif(dica, ''), '');
  end;
end $f$;

create function pg_temp.conta(p_nome text) returns uuid language sql as $f$
  insert into public.workspaces (name) values (p_nome) returning id;
$f$;

-- Uma assinatura isolada por caso. `p_cancelada_ha` nulo = ativa.
create function pg_temp.assinatura(p_conta uuid, p_sub text, p_email text, p_cancelada_ha interval, p_avisada_ha interval default null)
returns void language sql as $f$
  insert into public.assinaturas (workspace_id, plano, provedor, id_externo_cliente, id_externo_assinatura,
                                  situacao, periodo_pago_ate, moeda, titular_email, created_at, cancelada_em, exclusao_avisada_em)
  values (p_conta, 'basico', 'stripe', 'cus_' || p_sub, p_sub,
          case when p_cancelada_ha is null then 'ativa' else 'cancelada' end, now(), 'BRL', p_email,
          now() - interval '3 years', now() - p_cancelada_ha, now() - p_avisada_ha);
$f$;

create function pg_temp.arquivo(p_bucket text, p_nome text) returns void language sql as $f$
  insert into storage.objects (bucket_id, name) values (p_bucket, p_nome);
$f$;

create function pg_temp.listados(p_sql text) returns text language plpgsql as $f$
declare v text;
begin
  execute format('select coalesce(string_agg(x, %L order by x), %L) from (%s) t(x)', ',', '', p_sql) into v;
  return v;
end $f$;

do $$
declare
  dono_x uuid := 'a0a0a0a0-0000-4000-8000-0000000e0001';      -- titular da conta X, criado pela compra
  convidado_x uuid := 'a0a0a0a0-0000-4000-8000-0000000e0002'; -- criado pela conta X, só nela
  duplo uuid := 'a0a0a0a0-0000-4000-8000-0000000e0003';       -- criado pela conta X, mas também na Y
  externo uuid := 'a0a0a0a0-0000-4000-8000-0000000e0004';     -- de outra agência, membro da X
  dono_y uuid := 'b0b0b0b0-0000-4000-8000-0000000e0005';
  x uuid; y uuid; c uuid; marca_x uuid;
begin
  x := pg_temp.conta('Prova Exclusao X');
  y := pg_temp.conta('Prova Exclusao Y');
  insert into auth.users (id, email, aud, role, raw_app_meta_data) values
    (dono_x,      'prova-excl-dono-x@local.test',  'authenticated', 'authenticated', jsonb_build_object('criado_pela_conta', x, 'criado_pela_cobranca', true)),
    (convidado_x, 'prova-excl-conv-x@local.test',  'authenticated', 'authenticated', jsonb_build_object('criado_pela_conta', x)),
    (duplo,       'prova-excl-duplo@local.test',   'authenticated', 'authenticated', jsonb_build_object('criado_pela_conta', x)),
    (externo,     'prova-excl-externo@local.test', 'authenticated', 'authenticated', '{}'::jsonb),
    (dono_y,      'prova-excl-dono-y@local.test',  'authenticated', 'authenticated', '{}'::jsonb);
  insert into public.workspace_members (workspace_id, user_id, role) values
    (x, dono_x, 'owner'), (x, convidado_x, 'member'), (x, duplo, 'member'), (x, externo, 'member'),
    (y, dono_y, 'owner'), (y, duplo, 'member');
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (x, 'marca-prova-excl', 'Marca X', 'X', 'x', 'pt-BR', '{}', '{}', '{}', '{}', '{}') returning id into marca_x;
  -- A conta X: cancelada há 13 meses, avisada há 31 dias. A Y: ativa.
  perform pg_temp.assinatura(x, 'sub_excl_x', 'prova-excl-dono-x@local.test', interval '13 months', interval '31 days');
  perform pg_temp.assinatura(y, 'sub_excl_y', 'prova-excl-dono-y@local.test', null);
  insert into public.eventos_de_cobranca (provedor, id_externo, tipo, id_externo_assinatura, resultado, processado_em)
  values ('stripe', 'evt_prova_excl_x', 'invoice.paid', 'sub_excl_x', 'processado', now());
  insert into public.registros_de_acesso (user_id, ip) values (convidado_x, '203.0.113.50');
  perform pg_temp.arquivo('brand-assets', x || '/' || marca_x || '/logo.png');
  perform pg_temp.arquivo('brand-imports', x || '/imp-1/manual.pdf');
  perform pg_temp.arquivo('analysis-evidence', x || '/' || marca_x || '/peca.png');
  perform pg_temp.arquivo('brand-assets', y || '/marca-y/logo.png');

  -- 1. Quem chama: só o servidor.
  perform pg_temp.registrar('o dono NAO lista avisos', '42501', pg_temp.como(dono_x, 'select * from public.cobranca_contas_a_avisar_da_exclusao(10)'));
  perform pg_temp.registrar('o dono NAO reserva aviso', '42501', pg_temp.como(dono_x, $s$select public.cobranca_aviso_de_exclusao('sub_excl_x', true)$s$));
  perform pg_temp.registrar('o dono NAO lista exclusoes', '42501', pg_temp.como(dono_x, 'select * from public.cobranca_contas_a_excluir(10)'));
  perform pg_temp.registrar('o dono NAO inicia a exclusao da PROPRIA conta', '42501', pg_temp.como(dono_x, format('select public.cobranca_iniciar_exclusao(%L)', x)));
  perform pg_temp.registrar('o dono de Y NAO conclui a exclusao de X', '42501', pg_temp.como(dono_y, format('select public.cobranca_concluir_exclusao(%L)', x)));
  perform pg_temp.registrar('o visitante NAO inicia exclusao', '42501', pg_temp.papel('anon', format('select public.cobranca_iniciar_exclusao(%L)', x)));
  perform pg_temp.registrar('o visitante NAO conclui exclusao', '42501', pg_temp.papel('anon', format('select public.cobranca_concluir_exclusao(%L)', x)));
  perform pg_temp.registrar('o servidor lista exclusoes', 'ACEITOU', pg_temp.papel('service_role', 'select * from public.cobranca_contas_a_excluir(10)'));
  perform pg_temp.registrar('o dono NAO escreve as colunas da exclusao', '42501', pg_temp.como(dono_x, $s$update public.assinaturas set exclusao_avisada_em = now()$s$));
  perform pg_temp.registrar('o dono de Y NAO ve a assinatura de X', '0',
    pg_temp.valor(dono_y, $s$select count(*)::text from public.assinaturas where id_externo_assinatura = 'sub_excl_x'$s$));

  -- 2. Quem recebe o aviso.
  c := pg_temp.conta('Prova Exclusao A1'); perform pg_temp.assinatura(c, 'sub_excl_a1', 'a1@local.test', interval '11 months 2 days');
  c := pg_temp.conta('Prova Exclusao A2'); perform pg_temp.assinatura(c, 'sub_excl_a2', 'a2@local.test', interval '10 months');
  c := pg_temp.conta('Prova Exclusao A3'); perform pg_temp.assinatura(c, 'sub_excl_a3', 'a3@local.test', interval '14 months');
  perform pg_temp.registrar('o aviso vai so a quem tem 11 meses de cancelada e nao foi avisado', 'sub_excl_a1,sub_excl_a3',
    pg_temp.listados($s$select id_externo_assinatura from public.cobranca_contas_a_avisar_da_exclusao(200) where id_externo_assinatura like 'sub_excl_%'$s$));
  perform pg_temp.registrar('o prazo prometido: o que vier depois, 12 meses do cancelamento ou 30 dias do aviso', 'true',
    (select abs(extract(epoch from (excluir_em - greatest(now() - interval '11 months 2 days' + interval '12 months', now() + interval '30 days')))) < 5
       from public.cobranca_contas_a_avisar_da_exclusao(200) where id_externo_assinatura = 'sub_excl_a1')::text);
  perform pg_temp.registrar('quem e avisado tarde nao perde os 30 dias', 'true',
    (select abs(extract(epoch from (excluir_em - (now() + interval '30 days')))) < 5
       from public.cobranca_contas_a_avisar_da_exclusao(200) where id_externo_assinatura = 'sub_excl_a3')::text);
  perform pg_temp.registrar('a 1a reserva do aviso ganha', 'true', public.cobranca_aviso_de_exclusao('sub_excl_a1', true)::text);
  perform pg_temp.registrar('a 2a perde', 'false', public.cobranca_aviso_de_exclusao('sub_excl_a1', true)::text);
  perform pg_temp.registrar('a reserva volta quando o envio falha', 'true', public.cobranca_aviso_de_exclusao('sub_excl_a1', false)::text);
  perform pg_temp.registrar('assinatura ativa nao e avisada', 'false', public.cobranca_aviso_de_exclusao('sub_excl_y', true)::text);

  -- 3. As travas da exclusão.
  c := pg_temp.conta('Prova Exclusao T1'); perform pg_temp.assinatura(c, 'sub_excl_t1', 't1@local.test', interval '11 months', interval '40 days');
  perform pg_temp.registrar('antes dos 12 meses: recusa', '55000 exclusao_antes_do_prazo', pg_temp.erro(format('select public.cobranca_iniciar_exclusao(%L)', c)));
  c := pg_temp.conta('Prova Exclusao T2'); perform pg_temp.assinatura(c, 'sub_excl_t2', 't2@local.test', interval '13 months', interval '10 days');
  perform pg_temp.registrar('aviso com menos de 30 dias: recusa', '55000 exclusao_sem_aviso', pg_temp.erro(format('select public.cobranca_iniciar_exclusao(%L)', c)));
  c := pg_temp.conta('Prova Exclusao T3'); perform pg_temp.assinatura(c, 'sub_excl_t3', 't3@local.test', interval '13 months');
  perform pg_temp.registrar('sem aviso nenhum: recusa', '55000 exclusao_sem_aviso', pg_temp.erro(format('select public.cobranca_iniciar_exclusao(%L)', c)));
  perform pg_temp.registrar('conta ativa: recusa', '55000 exclusao_antes_do_prazo', pg_temp.erro(format('select public.cobranca_iniciar_exclusao(%L)', y)));
  perform pg_temp.registrar('conta sem assinatura: recusa', 'P0002 exclusao_sem_assinatura',
    pg_temp.erro(format('select public.cobranca_iniciar_exclusao(%L)', pg_temp.conta('Prova Exclusao sem assinatura'))));
  perform pg_temp.registrar('so a conta que passou nas travas e listada', 'true',
    (select x in (select conta from public.cobranca_contas_a_excluir(100)) and y not in (select conta from public.cobranca_contas_a_excluir(100)))::text);
  perform pg_temp.registrar('concluir sem iniciar: recusa', '55000 exclusao_nao_iniciada', pg_temp.erro(format('select public.cobranca_concluir_exclusao(%L)', x)));

  -- 4. Iniciar: só a pasta da conta, nos três buckets; repetir não duplica.
  perform pg_temp.registrar('enfileira os 3 arquivos da conta X', '3', public.cobranca_iniciar_exclusao(x)::text);
  perform pg_temp.registrar('nenhum arquivo de Y entra na fila', '0',
    (select count(*)::text from public.brand_deletions where storage_path like y || '/%'));
  perform pg_temp.registrar('os 3 buckets', 'analysis-evidence,brand-assets,brand-imports',
    pg_temp.listados(format('select bucket_id from public.brand_deletions where workspace_id = %L', x)));
  perform pg_temp.registrar('iniciar de novo nao duplica', '0', public.cobranca_iniciar_exclusao(x)::text);
  perform pg_temp.registrar('a conta iniciada aparece para continuar', 'true',
    (select iniciada from public.cobranca_contas_a_excluir(100) where conta = x)::text);
  perform pg_temp.registrar('o aviso nao volta depois de iniciada', 'false', public.cobranca_aviso_de_exclusao('sub_excl_x', false)::text);

  -- 5. Concluir: só com a fila e a pasta vazias.
  perform pg_temp.registrar('com fila: pendente', 'pendente', public.cobranca_concluir_exclusao(x));
  delete from public.brand_deletions where workspace_id = x;
  perform pg_temp.registrar('fila vazia mas arquivo na pasta: pendente', 'pendente', public.cobranca_concluir_exclusao(x));
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where name like x || '/%';
  perform set_config('storage.allow_delete_query', 'false', true);
  perform pg_temp.registrar('fila e pasta vazias: excluida', 'excluida', public.cobranca_concluir_exclusao(x));

  perform pg_temp.registrar('a area saiu', '0', (select count(*)::text from public.workspaces where id = x));
  perform pg_temp.registrar('a marca saiu', '0', (select count(*)::text from public.brands where id = marca_x));
  perform pg_temp.registrar('os membros sairam', '0', (select count(*)::text from public.workspace_members where workspace_id = x));
  perform pg_temp.registrar('sairam os logins criados pela conta (titular e convidado)', '0',
    (select count(*)::text from auth.users where id in (dono_x, convidado_x)));
  perform pg_temp.registrar('ficou o login criado por X que tambem esta em Y', '1', (select count(*)::text from auth.users where id = duplo));
  perform pg_temp.registrar('ficou o login de outra agencia', '1', (select count(*)::text from auth.users where id = externo));
  perform pg_temp.registrar('o registro da assinatura ficou, sem a area e com a data', 'true',
    (select workspace_id is null and conta_excluida_em is not null and titular_email = 'prova-excl-dono-x@local.test'
       from public.assinaturas where id_externo_assinatura = 'sub_excl_x')::text);
  perform pg_temp.registrar('o aviso do Stripe ficou', '1', (select count(*)::text from public.eventos_de_cobranca where id_externo = 'evt_prova_excl_x'));
  perform pg_temp.registrar('o registro de acesso ficou, sem o dono', '1',
    (select count(*)::text from public.registros_de_acesso where ip = '203.0.113.50' and user_id is null));
  perform pg_temp.registrar('a conta Y continua inteira', '1', (select count(*)::text from storage.objects where name like y || '/%'));
  perform pg_temp.registrar('excluida nao aparece mais para excluir', 'false',
    (select exists (select 1 from public.cobranca_contas_a_excluir(100) where conta = x))::text);

  -- 6. As constraints, pelo nome.
  perform pg_temp.registrar('a area nao some da assinatura sem a exclusao', '23514 assinaturas_conta_so_some_excluida',
    pg_temp.erro($s$update public.assinaturas set workspace_id = null where id_externo_assinatura = 'sub_excl_y'$s$));
  perform pg_temp.registrar('iniciar sem aviso (direto) e barrado', '23514 assinaturas_exclusao_em_ordem',
    pg_temp.erro($s$update public.assinaturas set exclusao_iniciada_em = now() where id_externo_assinatura = 'sub_excl_t3'$s$));
  perform pg_temp.registrar('aviso em conta ativa (direto) e barrado', '23514 assinaturas_exclusao_em_ordem',
    pg_temp.erro($s$update public.assinaturas set exclusao_avisada_em = now() where id_externo_assinatura = 'sub_excl_y'$s$));
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
