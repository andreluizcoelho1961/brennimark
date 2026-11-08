-- Prova do teto da agência e da franquia de perguntas (ADR-0009) — 08/11/2026.
--
-- Decisões do André: na IA PRÓPRIA o teto em dólar é da agência (nasce sem teto, a dona define);
-- na IA da PLATAFORMA tudo segue como antes; o plano pode ter FRANQUIA de perguntas por mês.
-- Perguntas:
--   A. Plataforma segue como antes: sem orçamento recusa; passar do limite recusa; linha da
--      conta com teto vazio também recusa (a restrição afrouxada não abre brecha).
--   B. IA própria: entrar no modo zera o teto padrão; sem teto reserva; com o teto que a
--      AGÊNCIA pôs, recusa ao passar (diário e mensal); a trava do Console e a pausa geral e a
--      conta só para leitura continuam valendo.
--   C. Sair do modo próprio devolve o teto padrão.
--   D. Franquia: acabou, recusa `franquia_esgotada`; análise de peça conta 2; reserva liberada
--      não gasta; pergunta de mês passado não conta; plano sem franquia não limita; vale nos
--      dois modos; a mesma execução repetida não gasta duas vezes.
--   E. Autorização (negativos): outra conta não define nem lê o teto; membro que não é dona
--      também não; conta da plataforma não define teto; valores inválidos recusam; anon não executa.
--   F. definir_teto não apaga a trava do Console.
--
-- Cada caso confere o MOTIVO exato (ou o SQLSTATE + hint exatos), nunca "algum erro". Mundo
-- próprio e `rollback` no fim.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void
language sql as $f$
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, p_obtido, p_esperado is not distinct from p_obtido);
$f$;

-- Reserva como a chave de serviço; devolve "ok/motivo".
create function pg_temp.reservar(p_pessoa uuid, p_conta uuid, p_execucao uuid, p_micros bigint, p_task text default 'assist') returns text
language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role service_role';
  select r.ok::text || '/' || r.motivo into v
    from public.reservar_execucao_de_ia_server(p_pessoa, p_conta, null, p_execucao, p_task, p_micros, 'USD') r;
  execute 'reset role';
  return v;
end $f$;

-- Executa uma chamada como `p_papel` (authenticated com a sessão de `p_pessoa`) e devolve
-- "SQLSTATE/hint" do erro, ou 'ACEITOU'.
create function pg_temp.chamar(p_papel text, p_pessoa uuid, p_sql text) returns text
language plpgsql as $f$
declare estado text; dica text;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_pessoa, 'role', p_papel)::text, true);
    execute format('set local role %I', p_papel);
    execute p_sql;
    execute 'reset role';
    return 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, dica = pg_exception_hint;
    execute 'reset role';
    return estado || '/' || coalesce(dica, '');
  end;
end $f$;

create function pg_temp.teto(p_conta uuid, p_periodo text) returns text
language sql as $f$
  select coalesce(limit_micros::text, 'null') from public.ai_budgets
   where workspace_id = p_conta and brand_id is null and period = p_periodo;
$f$;

do $$
declare
  up uuid := 'a0a0a0a0-0000-4000-8000-0000000f0001';  -- dona da conta P (própria)
  uq uuid := 'b0b0b0b0-0000-4000-8000-0000000f0002';  -- dona da conta Q (plataforma)
  ur uuid := 'c0c0c0c0-0000-4000-8000-0000000f0003';  -- dona da conta R (própria em atraso)
  um uuid := 'd0d0d0d0-0000-4000-8000-0000000f0004';  -- MEMBRO (não dona) da conta P
  us uuid := 'e0e0e0e0-0000-4000-8000-0000000f0005';  -- dona da conta S (plataforma com franquia)
  p uuid; q uuid; r uuid; s uuid;
  e uuid;
  rel jsonb;
begin
  insert into public.workspaces (name) values ('Prova teto P (propria)') returning id into p;
  insert into public.workspaces (name) values ('Prova teto Q (plataforma)') returning id into q;
  insert into public.workspaces (name) values ('Prova teto R (propria em atraso)') returning id into r;
  insert into public.workspaces (name) values ('Prova teto S (plataforma com franquia)') returning id into s;
  insert into auth.users (id, email, aud, role) values
    (up, 'prova-teto-p@local.test', 'authenticated', 'authenticated'),
    (uq, 'prova-teto-q@local.test', 'authenticated', 'authenticated'),
    (ur, 'prova-teto-r@local.test', 'authenticated', 'authenticated'),
    (um, 'prova-teto-m@local.test', 'authenticated', 'authenticated'),
    (us, 'prova-teto-s@local.test', 'authenticated', 'authenticated');
  insert into public.workspace_members (workspace_id, user_id, role) values
    (p, up, 'owner'), (p, um, 'member'), (q, uq, 'owner'), (r, ur, 'owner'), (s, us, 'owner');

  insert into public.planos (codigo, nome, maximo_de_marcas, teto_mensal_do_vini_micros, a_venda, ordem, modo_de_ia, franquia_de_perguntas_por_mes)
  values ('prova-teto-propria', 'Prova teto própria', 5, 0, false, 92, 'propria', null),
         ('prova-teto-franquia', 'Prova teto franquia', 5, 0, false, 93, 'plataforma', 3);

  -- Conta nova ganha limites padrão por gatilho; as contas começam todas assim (5 e 60 dólares).
  perform pg_temp.registrar('conta nova nasce com o teto diário padrão', '5000000', pg_temp.teto(p, 'daily'));

  insert into public.assinaturas (workspace_id, plano, provedor, id_externo_cliente, id_externo_assinatura, situacao, titular_email)
  values (q, 'basico', 'stripe', 'cus_tf_q', 'sub_tf_q', 'ativa', 'prova-teto-q@local.test'),
         (s, 'prova-teto-franquia', 'stripe', 'cus_tf_s', 'sub_tf_s', 'ativa', 'prova-teto-s@local.test');

  -- ─── A. Plataforma segue como antes ────────────────────────────────────
  delete from public.ai_budgets where workspace_id = q;
  perform pg_temp.registrar('A1 plataforma sem orçamento: recusa', 'false/sem_orcamento_configurado',
    pg_temp.reservar(uq, q, gen_random_uuid(), 1000000));
  insert into public.ai_budgets (workspace_id, brand_id, period, limit_micros) values (q, null, 'daily', 1000);
  perform pg_temp.registrar('A2 plataforma acima do limite diário: recusa', 'false/orcamento_do_workspace_esgotado',
    pg_temp.reservar(uq, q, gen_random_uuid(), 5000));
  update public.ai_budgets set limit_micros = null where workspace_id = q and period = 'daily';
  perform pg_temp.registrar('A3 plataforma com teto diário VAZIO: recusa (restrição afrouxada não abre brecha)', 'false/sem_orcamento_configurado',
    pg_temp.reservar(uq, q, gen_random_uuid(), 10));

  -- ─── B. IA própria ─────────────────────────────────────────────────────
  insert into public.assinaturas (workspace_id, plano, provedor, id_externo_cliente, id_externo_assinatura, situacao, titular_email)
  values (p, 'prova-teto-propria', 'stripe', 'cus_tf_p', 'sub_tf_p', 'ativa', 'prova-teto-p@local.test');
  perform pg_temp.registrar('B1 entrar na IA própria zera o teto diário padrão', 'null', pg_temp.teto(p, 'daily'));
  perform pg_temp.registrar('B2 entrar na IA própria zera o teto mensal padrão', 'null', pg_temp.teto(p, 'monthly'));
  perform pg_temp.registrar('B3 IA própria sem teto: reserva mesmo com valor enorme', 'true/reservado',
    pg_temp.reservar(up, p, gen_random_uuid(), 900000000));

  perform pg_temp.registrar('B4 a dona define teto diário 1 dólar e mensal 5', 'ACEITOU',
    pg_temp.chamar('authenticated', up,
      format('select public.definir_teto_da_ia_propria(%L, 1000000, 5000000)', p)));
  perform pg_temp.registrar('B5 o teto ficou gravado', '1000000', pg_temp.teto(p, 'daily'));
  -- O que já foi reservado hoje (900 dólares do B3) estoura o novo teto: recusa.
  perform pg_temp.registrar('B6 com o teto da agência já estourado hoje: recusa', 'false/orcamento_do_workspace_esgotado',
    pg_temp.reservar(up, p, gen_random_uuid(), 10));
  -- Libera o razão para medir o mensal sozinho.
  delete from public.ai_ledger where workspace_id = p;
  perform pg_temp.registrar('B7 teto diário sem estouro: reserva', 'true/reservado',
    pg_temp.reservar(up, p, gen_random_uuid(), 600000));
  perform pg_temp.registrar('B8 passar do teto diário: recusa', 'false/orcamento_do_workspace_esgotado',
    pg_temp.reservar(up, p, gen_random_uuid(), 600000));
  perform pg_temp.registrar('B8b a dona troca para só teto mensal', 'ACEITOU',
    pg_temp.chamar('authenticated', up, format('select public.definir_teto_da_ia_propria(%L, null, 700000)', p)));
  perform pg_temp.registrar('B9 só teto mensal: o diário saiu', 'null', pg_temp.teto(p, 'daily'));
  perform pg_temp.registrar('B10 passar do teto mensal: recusa', 'false/orcamento_mensal_esgotado',
    pg_temp.reservar(up, p, gen_random_uuid(), 200000));

  -- Travas continuam valendo na IA própria.
  update public.ai_budgets set limit_micros = null where workspace_id = p;
  update public.ai_budgets set kill_switch = true where workspace_id = p and period = 'daily';
  perform pg_temp.registrar('B11 IA própria com a trava da conta: recusa', 'false/kill_switch_workspace',
    pg_temp.reservar(up, p, gen_random_uuid(), 10));
  -- F. definir_teto não apaga a trava do Console.
  perform pg_temp.registrar('F0 a dona define 2 e 8 dólares com a trava ligada', 'ACEITOU',
    pg_temp.chamar('authenticated', up, format('select public.definir_teto_da_ia_propria(%L, 2000000, 8000000)', p)));
  perform pg_temp.registrar('F1 definir o teto não desliga a trava do Console', 'true',
    (select kill_switch::text from public.ai_budgets where workspace_id = p and brand_id is null and period = 'daily'));
  update public.ai_budgets set kill_switch = false where workspace_id = p and period = 'daily';
  update private.parametros_da_plataforma set vini_pausado = true where id;
  perform pg_temp.registrar('B12 IA própria com a pausa geral: recusa', 'false/plataforma_pausada',
    pg_temp.reservar(up, p, gen_random_uuid(), 10));
  update private.parametros_da_plataforma set vini_pausado = false where id;
  insert into public.assinaturas (workspace_id, plano, provedor, id_externo_cliente, id_externo_assinatura, situacao, em_atraso_desde, titular_email)
  values (r, 'prova-teto-propria', 'stripe', 'cus_tf_r', 'sub_tf_r', 'em_atraso', now() - interval '10 days', 'prova-teto-r@local.test');
  perform pg_temp.registrar('B13 IA própria em atraso há 10 dias: só leitura', 'false/conta_so_leitura',
    pg_temp.reservar(ur, r, gen_random_uuid(), 10));

  -- Trocar de propria para propria não apaga o teto que a agência pôs.
  insert into public.planos (codigo, nome, maximo_de_marcas, teto_mensal_do_vini_micros, a_venda, ordem, modo_de_ia)
  values ('prova-teto-propria-2', 'Prova teto própria 2', 15, 0, false, 94, 'propria');
  update public.assinaturas set plano = 'prova-teto-propria-2' where workspace_id = p;
  perform pg_temp.registrar('B14 trocar de plano próprio para outro próprio mantém o teto da agência', '2000000', pg_temp.teto(p, 'daily'));

  -- ─── C. Sair do modo próprio devolve o padrão ──────────────────────────
  update public.ai_budgets set limit_micros = null where workspace_id = p;
  update public.assinaturas set plano = 'basico' where workspace_id = p;
  perform pg_temp.registrar('C1 voltou à plataforma: teto diário volta ao padrão', '5000000', pg_temp.teto(p, 'daily'));
  perform pg_temp.registrar('C2 voltou à plataforma: teto mensal volta ao padrão', '60000000', pg_temp.teto(p, 'monthly'));
  perform pg_temp.registrar('C3 voltou à plataforma: o teto volta a valer', 'false/orcamento_do_workspace_esgotado',
    pg_temp.reservar(up, p, gen_random_uuid(), 6000000));

  -- ─── D. Franquia de perguntas (plano com franquia 3, conta S) ─────────
  delete from public.ai_ledger where workspace_id = s;
  perform pg_temp.registrar('D1 pergunta 1 de 3', 'true/reservado', pg_temp.reservar(us, s, gen_random_uuid(), 10));
  e := gen_random_uuid();
  perform pg_temp.registrar('D2 pergunta 2 de 3', 'true/reservado', pg_temp.reservar(us, s, e, 10));
  perform pg_temp.registrar('D3 a mesma execução de novo não gasta franquia', 'true/ja_reservado', pg_temp.reservar(us, s, e, 10));
  perform pg_temp.registrar('D4 análise de peça conta 2 e não cabe (faltava 1)', 'false/franquia_esgotada',
    pg_temp.reservar(us, s, gen_random_uuid(), 10, 'analyse-image'));
  perform pg_temp.registrar('D5 pergunta 3 de 3 ainda cabe', 'true/reservado', pg_temp.reservar(us, s, gen_random_uuid(), 10));
  perform pg_temp.registrar('D6 a quarta: franquia esgotada', 'false/franquia_esgotada', pg_temp.reservar(us, s, gen_random_uuid(), 10));
  -- Liberar uma reserva devolve a franquia (falha não gasta pergunta).
  update public.ai_ledger set status = 'released', released_at = now()
   where id = (select id from public.ai_ledger where workspace_id = s order by created_at limit 1);
  perform pg_temp.registrar('D7 reserva liberada devolve a franquia', 'true/reservado', pg_temp.reservar(us, s, gen_random_uuid(), 10));
  -- Pergunta do mês passado não conta.
  update public.ai_ledger set created_at = created_at - interval '40 days' where workspace_id = s;
  perform pg_temp.registrar('D8 perguntas de mês passado não contam', 'true/reservado', pg_temp.reservar(us, s, gen_random_uuid(), 10));
  -- Plano sem franquia não limita.
  update public.assinaturas set plano = 'basico' where workspace_id = s;
  update public.ai_ledger set created_at = now() where workspace_id = s;
  update public.ai_budgets set limit_micros = 999000000 where workspace_id = s;
  perform pg_temp.registrar('D9 plano sem franquia não limita por perguntas', 'true/reservado', pg_temp.reservar(us, s, gen_random_uuid(), 10));

  -- ─── E. Autorização (negativos) ────────────────────────────────────────
  update public.assinaturas set plano = 'prova-teto-propria' where workspace_id = p;
  update public.ai_budgets set limit_micros = 2000000 where workspace_id = p and brand_id is null and period = 'daily';
  update public.ai_budgets set limit_micros = 8000000 where workspace_id = p and brand_id is null and period = 'monthly';
  perform pg_temp.registrar('E1 outra conta (dona de Q) NÃO define o teto da conta P', '42501/teto_so_a_dona',
    pg_temp.chamar('authenticated', uq, format('select public.definir_teto_da_ia_propria(%L, 1000000, 2000000)', p)));
  perform pg_temp.registrar('E2 membro que não é dona NÃO define o teto', '42501/teto_so_a_dona',
    pg_temp.chamar('authenticated', um, format('select public.definir_teto_da_ia_propria(%L, 1000000, 2000000)', p)));
  perform pg_temp.registrar('E3 outra conta NÃO lê o uso da conta P', '42501/uso_so_a_dona',
    pg_temp.chamar('authenticated', uq, format('select public.uso_do_vini_da_conta(%L)', p)));
  perform pg_temp.registrar('E4 membro que não é dona NÃO lê o uso', '42501/uso_so_a_dona',
    pg_temp.chamar('authenticated', um, format('select public.uso_do_vini_da_conta(%L)', p)));
  perform pg_temp.registrar('E5 conta da plataforma NÃO define teto de IA própria', '42501/teto_so_ia_propria',
    pg_temp.chamar('authenticated', uq, format('select public.definir_teto_da_ia_propria(%L, 1000000, 2000000)', q)));
  perform pg_temp.registrar('E6 valor negativo recusa', '22023/teto_invalido',
    pg_temp.chamar('authenticated', up, format('select public.definir_teto_da_ia_propria(%L, -5, 2000000)', p)));
  perform pg_temp.registrar('E7 diário maior que o mensal recusa', '22023/teto_invalido',
    pg_temp.chamar('authenticated', up, format('select public.definir_teto_da_ia_propria(%L, 9000000, 2000000)', p)));
  perform pg_temp.registrar('E8 anon não executa definir_teto', '42501/',
    pg_temp.chamar('anon', up, format('select public.definir_teto_da_ia_propria(%L, 1000000, 2000000)', p)));
  perform pg_temp.registrar('E9 anon não executa a leitura do uso', '42501/',
    pg_temp.chamar('anon', up, format('select public.uso_do_vini_da_conta(%L)', p)));
  perform pg_temp.registrar('E10 authenticated não executa a reserva', '42501/',
    pg_temp.chamar('authenticated', up,
      format('select * from public.reservar_execucao_de_ia_server(%L, %L, null, gen_random_uuid(), ''assist'', 1, ''USD'')', up, p)));
  perform pg_temp.registrar('E11 o teto da conta P não mudou com as tentativas negadas', '2000000', pg_temp.teto(p, 'daily'));

  -- A dona lê o próprio uso.
  perform pg_temp.registrar('E12 a dona lê o uso da própria conta', 'ACEITOU',
    pg_temp.chamar('authenticated', up, format('select public.uso_do_vini_da_conta(%L)', p)));
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
