-- Prova do razão sem teto para IA própria (ADR-0009) — 07/11/2026.
--
-- Decisão do André: quando a IA é da agência, o limite em dinheiro do razão
-- (`ai_budgets`) não vale. O que continua valendo: pausa geral, conta só para
-- leitura, trava (kill switch) da conta. Perguntas:
--   1. Conta da PLATAFORMA segue como antes: sem orçamento recusa, e passar do
--      limite recusa (controle: a mudança não afrouxou o que já existia).
--   2. Conta de IA PRÓPRIA reserva sem nenhuma linha de orçamento, e reserva
--      mesmo com um limite minúsculo já estourado.
--   3. Mesmo na IA própria, recusam a pausa geral, a trava da conta e a conta
--      só para leitura (assinatura em atraso há mais de 7 dias).
--   4. A reserva é gravada no razão (é dele que sai o histórico de uso), e a
--      mesma execução reservada duas vezes responde `ja_reservado`.
--   5. A conta que sai do modo próprio volta a ter teto.
--   6. Só a chave de serviço executa a função (anon e authenticated: 42501).
--
-- Cada caso confere o MOTIVO exato devolvido, não "algum erro". Mundo próprio e
-- `rollback` no fim.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void
language sql as $f$
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, p_obtido, p_esperado is not distinct from p_obtido);
$f$;

-- Chama a reserva como a chave de serviço e devolve "ok/motivo".
create function pg_temp.reservar(p_pessoa uuid, p_conta uuid, p_execucao uuid, p_micros bigint) returns text
language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role service_role';
  select r.ok::text || '/' || r.motivo into v
    from public.reservar_execucao_de_ia_server(p_pessoa, p_conta, null, p_execucao, 'assist', p_micros, 'USD') r;
  execute 'reset role';
  return v;
end $f$;

create function pg_temp.sqlstate_como(p_papel text, p_pessoa uuid, p_conta uuid) returns text
language plpgsql as $f$
declare estado text;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_pessoa, 'role', p_papel)::text, true);
    execute format('set local role %I', p_papel);
    perform * from public.reservar_execucao_de_ia_server(p_pessoa, p_conta, null, gen_random_uuid(), 'assist', 1, 'USD');
    execute 'reset role';
    return 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
    execute 'reset role';
    return estado;
  end;
end $f$;

do $$
declare
  up uuid := 'a0a0a0a0-0000-4000-8000-0000000e0001';
  uq uuid := 'b0b0b0b0-0000-4000-8000-0000000e0002';
  ur uuid := 'c0c0c0c0-0000-4000-8000-0000000e0003';
  p uuid; q uuid; r uuid;
  e uuid;
begin
  insert into public.workspaces (name) values ('Prova razão P (propria)') returning id into p;
  insert into public.workspaces (name) values ('Prova razão Q (plataforma)') returning id into q;
  insert into public.workspaces (name) values ('Prova razão R (propria em atraso)') returning id into r;
  insert into auth.users (id, email, aud, role) values
    (up, 'prova-razao-p@local.test', 'authenticated', 'authenticated'),
    (uq, 'prova-razao-q@local.test', 'authenticated', 'authenticated'),
    (ur, 'prova-razao-r@local.test', 'authenticated', 'authenticated');
  insert into public.workspace_members (workspace_id, user_id, role) values (p, up, 'owner'), (q, uq, 'owner'), (r, ur, 'owner');

  insert into public.planos (codigo, nome, maximo_de_marcas, teto_mensal_do_vini_micros, a_venda, ordem, modo_de_ia)
  values ('prova-razao-propria', 'Prova razão própria', 5, 0, false, 92, 'propria');

  insert into public.assinaturas (workspace_id, plano, provedor, id_externo_cliente, id_externo_assinatura, situacao, titular_email)
  values (p, 'prova-razao-propria', 'stripe', 'cus_rz_p', 'sub_rz_p', 'ativa', 'prova-razao-p@local.test'),
         (q, 'basico', 'stripe', 'cus_rz_q', 'sub_rz_q', 'ativa', 'prova-razao-q@local.test');
  insert into public.assinaturas (workspace_id, plano, provedor, id_externo_cliente, id_externo_assinatura, situacao, em_atraso_desde, titular_email)
  values (r, 'prova-razao-propria', 'stripe', 'cus_rz_r', 'sub_rz_r', 'em_atraso', now() - interval '10 days', 'prova-razao-r@local.test');

  -- Conta nova ganha limites padrão por gatilho (`workspaces_limites_da_conta_nova`):
  -- o mundo da prova começa sem eles, para cada caso dizer o que põe.
  delete from public.ai_budgets where workspace_id in (p, q, r);

  -- ─── 1. Controle: a plataforma segue como antes ─────────────────────────
  perform pg_temp.registrar('plataforma sem orçamento configurado: recusa', 'false/sem_orcamento_configurado',
    pg_temp.reservar(uq, q, gen_random_uuid(), 1000000));
  insert into public.ai_budgets (workspace_id, brand_id, period, limit_micros) values (q, null, 'daily', 1000);
  perform pg_temp.registrar('plataforma acima do limite diário: recusa', 'false/orcamento_do_workspace_esgotado',
    pg_temp.reservar(uq, q, gen_random_uuid(), 5000));

  -- ─── 2. IA própria ignora o limite em dinheiro ─────────────────────────
  perform pg_temp.registrar('IA própria sem NENHUMA linha de orçamento: reserva', 'true/reservado',
    pg_temp.reservar(up, p, gen_random_uuid(), 1000000));
  insert into public.ai_budgets (workspace_id, brand_id, period, limit_micros) values (p, null, 'daily', 1), (p, null, 'monthly', 1);
  perform pg_temp.registrar('IA própria com limite diário e mensal de 1 micro já estourados: reserva', 'true/reservado',
    pg_temp.reservar(up, p, gen_random_uuid(), 5000000));

  -- ─── 4. O razão registra; a mesma execução não duplica ──────────────────
  perform pg_temp.registrar('as duas reservas da IA própria ficaram no razão', '2',
    (select count(*)::text from public.ai_ledger where workspace_id = p and status = 'reserved'));
  e := gen_random_uuid();
  perform pg_temp.registrar('execução nova da IA própria', 'true/reservado', pg_temp.reservar(up, p, e, 10));
  perform pg_temp.registrar('a mesma execução de novo: ja_reservado', 'true/ja_reservado', pg_temp.reservar(up, p, e, 10));
  perform pg_temp.registrar('a repetida não gravou uma segunda linha', '1',
    (select count(*)::text from public.ai_ledger where execution_id = e));

  -- ─── 3. As travas continuam valendo na IA própria ──────────────────────
  update public.ai_budgets set kill_switch = true where workspace_id = p and period = 'daily';
  perform pg_temp.registrar('IA própria com a trava da conta ligada: recusa', 'false/kill_switch_workspace',
    pg_temp.reservar(up, p, gen_random_uuid(), 10));
  update public.ai_budgets set kill_switch = false where workspace_id = p and period = 'daily';

  update private.parametros_da_plataforma set vini_pausado = true where id;
  perform pg_temp.registrar('IA própria com a pausa geral ligada: recusa', 'false/plataforma_pausada',
    pg_temp.reservar(up, p, gen_random_uuid(), 10));
  update private.parametros_da_plataforma set vini_pausado = false where id;

  perform pg_temp.registrar('IA própria com assinatura em atraso há 10 dias: só leitura', 'false/conta_so_leitura',
    pg_temp.reservar(ur, r, gen_random_uuid(), 10));

  -- ─── 5. Saiu do modo próprio, o teto volta ─────────────────────────────
  update public.assinaturas set plano = 'basico' where workspace_id = p;
  perform pg_temp.registrar('conta que voltou ao plano da plataforma: o limite diário volta a valer', 'false/orcamento_do_workspace_esgotado',
    pg_temp.reservar(up, p, gen_random_uuid(), 5000000));

  -- ─── 6. Quem pode chamar ───────────────────────────────────────────────
  perform pg_temp.registrar('anon não executa a reserva', '42501', pg_temp.sqlstate_como('anon', up, p));
  perform pg_temp.registrar('authenticated não executa a reserva', '42501', pg_temp.sqlstate_como('authenticated', up, p));
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
