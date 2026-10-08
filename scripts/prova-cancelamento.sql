-- Prova do cancelamento e do arrependimento — 08/10/2026.
--
-- Mesmo método das outras provas: mundo próprio (uma assinatura por caso),
-- SQLSTATE e NOME da constraint (ou a dica da função) conferidos, e
-- `rollback` no fim. Perguntas:
--   1. Só o servidor chama as 3 funções; o dono e o visitante não, e o dono
--      não escreve as colunas novas direto.
--   2. A conta A não vê a assinatura (nem o pedido) da conta B.
--   3. O arrependimento: 1a assinatura do e-mail, até 7 dias do PEDIDO, nunca
--      por falta de pagamento; decidido uma vez, e o aviso repetido não muda.
--   4. Quem desiste de cancelar tem o pedido esquecido.
--   5. O estorno: só no arrependimento, um por assinatura, repetível com o
--      mesmo identificador; pedido estornado não se esquece.
--   6. O e-mail: a primeira reserva ganha, a segunda perde, e a reserva volta
--      quando o envio falha.
--   7. As constraints barram o estado incoerente escrito direto.

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

-- Uma assinatura isolada por caso: o dado compartilhado entre casos foi o que
-- produziu o falso positivo de uma prova anterior.
create function pg_temp.assinatura(p_conta uuid, p_sub text, p_email text, p_criada timestamptz, p_situacao text default 'ativa')
returns void language sql as $f$
  insert into public.assinaturas (workspace_id, plano, provedor, id_externo_cliente, id_externo_assinatura,
                                  situacao, periodo_pago_ate, moeda, titular_email, created_at, cancelada_em)
  values (p_conta, 'basico', 'stripe', 'cus_' || p_sub, p_sub, p_situacao, p_criada + interval '1 month', 'BRL',
          p_email, p_criada, case when p_situacao = 'cancelada' then now() end);
$f$;

create function pg_temp.conta(p_nome text) returns uuid language sql as $f$
  insert into public.workspaces (name) values (p_nome) returning id;
$f$;

create function pg_temp.pedido(p_sub text, p_pedido boolean default true, p_falta boolean default false, p_em timestamptz default now())
returns jsonb language sql as $f$
  select public.cobranca_pedido_de_cancelamento('stripe', p_sub, p_pedido, p_falta, p_em);
$f$;

do $$
declare
  a uuid := 'a0a0a0a0-0000-4000-8000-0000000ca001';
  b uuid := 'b0b0b0b0-0000-4000-8000-0000000ca002';
  conta_a uuid; conta_b uuid; c uuid;
  r jsonb; quando timestamptz;
begin
  insert into auth.users (id, email, aud, role) values
    (a, 'prova-cancel-a@local.test', 'authenticated', 'authenticated'),
    (b, 'prova-cancel-b@local.test', 'authenticated', 'authenticated');
  conta_a := pg_temp.conta('Prova Cancelamento A');
  conta_b := pg_temp.conta('Prova Cancelamento B');
  insert into public.workspace_members (workspace_id, user_id, role) values (conta_a, a, 'owner'), (conta_b, b, 'owner');
  perform pg_temp.assinatura(conta_a, 'sub_prova_a', 'prova-cancel-a@local.test', now() - interval '2 days');
  perform pg_temp.assinatura(conta_b, 'sub_prova_b', 'prova-cancel-b@local.test', now() - interval '2 days');

  -- 1. Quem chama as funções: só o servidor.
  perform pg_temp.registrar('o dono NAO registra pedido de cancelamento pela sessao', '42501',
    pg_temp.como(a, $s$select public.cobranca_pedido_de_cancelamento('stripe', 'sub_prova_a', true, false, now())$s$));
  perform pg_temp.registrar('o dono NAO registra estorno pela sessao', '42501',
    pg_temp.como(a, $s$select public.cobranca_registrar_estorno('stripe', 'sub_prova_a', 're_inventado')$s$));
  perform pg_temp.registrar('o dono NAO reserva o aviso pela sessao', '42501',
    pg_temp.como(a, $s$select public.cobranca_aviso_de_cancelamento('stripe', 'sub_prova_a', true)$s$));
  perform pg_temp.registrar('o visitante NAO chama o pedido', '42501',
    pg_temp.papel('anon', $s$select public.cobranca_pedido_de_cancelamento('stripe', 'sub_prova_a', true, false, now())$s$));
  perform pg_temp.registrar('o visitante NAO chama o estorno', '42501',
    pg_temp.papel('anon', $s$select public.cobranca_registrar_estorno('stripe', 'sub_prova_a', 're_x')$s$));
  perform pg_temp.registrar('o visitante NAO chama o aviso', '42501',
    pg_temp.papel('anon', $s$select public.cobranca_aviso_de_cancelamento('stripe', 'sub_prova_a', true)$s$));
  perform pg_temp.registrar('o servidor chama o pedido', 'ACEITOU',
    pg_temp.papel('service_role', $s$select public.cobranca_pedido_de_cancelamento('stripe', 'sub_prova_b', true, false, now())$s$));
  perform pg_temp.registrar('o dono NAO escreve as colunas novas direto', '42501',
    pg_temp.como(a, $s$update public.assinaturas set arrependimento = true$s$));

  -- 2. Leitura: cada conta a sua (A não vê o pedido de B).
  perform pg_temp.registrar('B le o proprio pedido de cancelamento', '1',
    pg_temp.valor(b, $s$select count(*)::text from public.assinaturas where cancelamento_pedido_em is not null$s$));
  perform pg_temp.registrar('A NAO ve a assinatura de B', '0',
    pg_temp.valor(a, $s$select count(*)::text from public.assinaturas where id_externo_assinatura = 'sub_prova_b'$s$));

  -- 3. O arrependimento.
  r := pg_temp.pedido('sub_prova_a');
  perform pg_temp.registrar('1a assinatura do e-mail, pedido em 2 dias: arrependimento', 'true', r->>'arrependimento');
  perform pg_temp.registrar('o pedido devolve o e-mail e a conta', 'prova-cancel-a@local.test Prova Cancelamento A',
    (r->>'titular_email') || ' ' || (r->>'nome_da_conta'));
  quando := (select cancelamento_pedido_em from public.assinaturas where id_externo_assinatura = 'sub_prova_a');
  r := pg_temp.pedido('sub_prova_a', true, true, now() + interval '30 days');
  perform pg_temp.registrar('aviso repetido NAO muda a hora do pedido', 'true',
    ((select cancelamento_pedido_em from public.assinaturas where id_externo_assinatura = 'sub_prova_a') = quando)::text);
  perform pg_temp.registrar('aviso repetido NAO muda o arrependimento decidido', 'true', r->>'arrependimento');

  c := pg_temp.conta('Prova Cancelamento C');
  perform pg_temp.assinatura(c, 'sub_prova_c', 'prova-cancel-c@local.test', now() - interval '8 days');
  perform pg_temp.registrar('pedido 8 dias depois da compra: sem arrependimento', 'false', pg_temp.pedido('sub_prova_c')->>'arrependimento');

  c := pg_temp.conta('Prova Cancelamento D');
  perform pg_temp.assinatura(c, 'sub_prova_d', 'prova-cancel-d@local.test', now() - interval '8 days');
  perform pg_temp.registrar('o prazo conta do PEDIDO, nao da chegada do aviso', 'true',
    pg_temp.pedido('sub_prova_d', true, false, now() - interval '2 days')->>'arrependimento');

  c := pg_temp.conta('Prova Cancelamento E');
  perform pg_temp.assinatura(c, 'sub_prova_e1', 'prova-cancel-e@local.test', now() - interval '60 days', 'cancelada');
  c := pg_temp.conta('Prova Cancelamento E2');
  perform pg_temp.assinatura(c, 'sub_prova_e2', 'prova-cancel-e@local.test', now() - interval '1 day');
  perform pg_temp.registrar('e-mail que ja assinou antes: sem arrependimento', 'false', pg_temp.pedido('sub_prova_e2')->>'arrependimento');

  c := pg_temp.conta('Prova Cancelamento F');
  perform pg_temp.assinatura(c, 'sub_prova_f', 'prova-cancel-f@local.test', now() - interval '1 day', 'cancelada');
  perform pg_temp.registrar('cortada por falta de pagamento: sem arrependimento', 'false', pg_temp.pedido('sub_prova_f', true, true)->>'arrependimento');

  perform pg_temp.registrar('assinatura desconhecida: nada', null, pg_temp.pedido('sub_que_nao_existe')::text);

  -- 4. Desistir de cancelar.
  c := pg_temp.conta('Prova Cancelamento G');
  perform pg_temp.assinatura(c, 'sub_prova_g', 'prova-cancel-g@local.test', now() - interval '20 days');
  perform pg_temp.pedido('sub_prova_g');
  perform public.cobranca_aviso_de_cancelamento('stripe', 'sub_prova_g', true);
  perform pg_temp.pedido('sub_prova_g', false);
  perform pg_temp.registrar('quem desiste no Portal tem o pedido e o aviso esquecidos', 'true',
    (select cancelamento_pedido_em is null and arrependimento is null and cancelamento_avisado_em is null
       from public.assinaturas where id_externo_assinatura = 'sub_prova_g')::text);

  -- 5. O estorno.
  perform pg_temp.registrar('estorno sem arrependimento e recusado', '22023 cobranca_estorno_sem_arrependimento',
    pg_temp.erro($s$select public.cobranca_registrar_estorno('stripe', 'sub_prova_c', 're_c')$s$));
  perform pg_temp.registrar('estorno sem identificador e recusado', '22004 cobranca_estorno_sem_id',
    pg_temp.erro($s$select public.cobranca_registrar_estorno('stripe', 'sub_prova_a', '  ')$s$));
  perform pg_temp.registrar('estorno de assinatura desconhecida e recusado', 'P0002 cobranca_assinatura_desconhecida',
    pg_temp.erro($s$select public.cobranca_registrar_estorno('stripe', 'sub_que_nao_existe', 're_x')$s$));
  perform pg_temp.registrar('o estorno do arrependimento e registrado', 'ACEITOU',
    pg_temp.erro($s$select public.cobranca_registrar_estorno('stripe', 'sub_prova_a', 're_prova_a')$s$));
  perform pg_temp.registrar('registrar o MESMO estorno de novo nao e erro', 'ACEITOU',
    pg_temp.erro($s$select public.cobranca_registrar_estorno('stripe', 'sub_prova_a', 're_prova_a')$s$));
  perform pg_temp.registrar('um SEGUNDO estorno na mesma assinatura e recusado', '23505 cobranca_estorno_repetido',
    pg_temp.erro($s$select public.cobranca_registrar_estorno('stripe', 'sub_prova_a', 're_outro')$s$));
  perform pg_temp.registrar('o estado devolve estornada', 'true', pg_temp.pedido('sub_prova_a')->>'estornada');
  perform pg_temp.pedido('sub_prova_a', false);
  perform pg_temp.registrar('pedido ja estornado NAO se esquece', 'false',
    (select cancelamento_pedido_em is null from public.assinaturas where id_externo_assinatura = 'sub_prova_a')::text);
  perform pg_temp.registrar('o mesmo estorno em duas assinaturas e barrado', '23505 assinaturas_estorno_unico',
    pg_temp.erro($s$update public.assinaturas set estornada_em = now(), id_externo_estorno = 're_prova_a' where id_externo_assinatura = 'sub_prova_d'$s$));

  -- 6. O e-mail: um só.
  perform pg_temp.registrar('a 1a reserva do aviso ganha', 'true', public.cobranca_aviso_de_cancelamento('stripe', 'sub_prova_c', true)::text);
  perform pg_temp.registrar('a 2a reserva perde', 'false', public.cobranca_aviso_de_cancelamento('stripe', 'sub_prova_c', true)::text);
  perform pg_temp.registrar('o estado devolve avisado', 'true', pg_temp.pedido('sub_prova_c')->>'avisado');
  perform pg_temp.registrar('a reserva devolvida (envio falhou)', 'true', public.cobranca_aviso_de_cancelamento('stripe', 'sub_prova_c', false)::text);
  perform pg_temp.registrar('depois de devolvida, reserva de novo', 'true', public.cobranca_aviso_de_cancelamento('stripe', 'sub_prova_c', true)::text);
  perform pg_temp.registrar('sem pedido, nao ha aviso a reservar', 'false', public.cobranca_aviso_de_cancelamento('stripe', 'sub_prova_g', true)::text);

  -- 7. As constraints, pelo nome.
  perform pg_temp.registrar('arrependimento sem pedido e barrado', '23514 assinaturas_arrependimento_coerente',
    pg_temp.erro($s$update public.assinaturas set arrependimento = false where id_externo_assinatura = 'sub_prova_g'$s$));
  perform pg_temp.registrar('estorno sem identificador (direto) e barrado', '23514 assinaturas_estorno_coerente',
    pg_temp.erro($s$update public.assinaturas set estornada_em = now() where id_externo_assinatura = 'sub_prova_d'$s$));
  perform pg_temp.registrar('estorno sem arrependimento (direto) e barrado', '23514 assinaturas_estorno_so_no_arrependimento',
    pg_temp.erro($s$update public.assinaturas set estornada_em = now(), id_externo_estorno = 're_c' where id_externo_assinatura = 'sub_prova_c'$s$));
  perform pg_temp.registrar('aviso sem pedido e barrado', '23514 assinaturas_aviso_depois_do_pedido',
    pg_temp.erro($s$update public.assinaturas set cancelamento_avisado_em = now() where id_externo_assinatura = 'sub_prova_g'$s$));
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
