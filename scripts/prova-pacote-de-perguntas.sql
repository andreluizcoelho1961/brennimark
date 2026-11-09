-- Prova do pacote avulso de perguntas (08/11/2026).
--
--   A. Sem pacote, a franquia efetiva é a do plano.
--   B. Pacote do mês soma; a mesma sessão não credita duas vezes; a reserva respeita a soma.
--   C. Virada de mês: o que sobrou do mês anterior vale até o fim do mês atual; excesso gasto
--      consome primeiro o pacote que vence antes; pacote de dois meses atrás expirou.
--   D. Pacote estornado não conta; plano sem franquia recusa o pacote.
--   E. Negativos: authenticated e anon não creditam; dona de OUTRA conta e membro não leem; ninguém
--      escreve na tabela pelo navegador; a leitura do uso é só da dona.
--
-- Cada caso confere o resultado (e o SQLSTATE) EXATOS. Mundo próprio e `rollback` no fim.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void
language sql as $f$
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, p_obtido, p_esperado is not distinct from p_obtido);
$f$;

-- n perguntas (linhas 'assist') no razão, no instante dado.
create function pg_temp.perguntas(p_conta uuid, p_pessoa uuid, p_n integer, p_quando timestamptz) returns void
language sql as $f$
  insert into public.ai_ledger (workspace_id, user_id, execution_id, task, status, reserved_micros, settled_micros, currency, created_at, settled_at)
  select p_conta, p_pessoa, gen_random_uuid(), 'assist', 'settled', 1000, 1000, 'USD', p_quando, p_quando from generate_series(1, p_n);
$f$;

create function pg_temp.reservar(p_pessoa uuid, p_conta uuid) returns text
language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role service_role';
  select r.ok::text || '/' || r.motivo into v
    from public.reservar_execucao_de_ia_server(p_pessoa, p_conta, null, gen_random_uuid(), 'assist', 1000, 'USD') r;
  execute 'reset role';
  return v;
end $f$;

create function pg_temp.chamar(p_papel text, p_pessoa uuid, p_sql text) returns text
language plpgsql as $f$
declare estado text;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_pessoa, 'role', p_papel)::text, true);
    execute format('set local role %I', p_papel);
    execute p_sql;
    execute 'reset role';
    return 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
    execute 'reset role';
    return estado;
  end;
end $f$;

-- Roda uma consulta de um texto como `authenticated` com a sessão de `p_pessoa`.
create function pg_temp.como(p_pessoa uuid, p_sql text) returns text
language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_pessoa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute p_sql into v;
  execute 'reset role';
  return v;
end $f$;

-- Credita como o webhook: service_role.
create function pg_temp.creditar(p_conta uuid, p_sessao text) returns text
language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role service_role';
  v := public.creditar_pacote_de_perguntas(p_conta, '100-perguntas', 100, 2900, 'BRL', p_sessao)::text;
  execute 'reset role';
  return v;
exception when others then
  declare estado text; dica text;
  begin
    get stacked diagnostics estado = returned_sqlstate, dica = pg_exception_hint;
    execute 'reset role';
    return estado || '/' || coalesce(dica, '');
  end;
end $f$;

create function pg_temp.efetiva(p_conta uuid) returns text
language sql as $f$ select coalesce(private.franquia_da_conta(p_conta)::text, 'null') $f$;

do $$
declare
  mes timestamptz := date_trunc('month', now());
  passado timestamptz := date_trunc('month', now()) - interval '10 days';       -- mês anterior
  retrasado timestamptz := date_trunc('month', now()) - interval '40 days';     -- dois meses atrás
  dp uuid := 'a0a0a0a0-0000-4000-8000-0000000f0001';  -- dona de P
  dr uuid := 'b0b0b0b0-0000-4000-8000-0000000f0002';  -- dona de R (outra conta)
  mp uuid := 'c0c0c0c0-0000-4000-8000-0000000f0003';  -- membro de P
  p uuid; r uuid; s uuid; t uuid; u uuid; v uuid; w uuid; x uuid;
  n text;
begin
  insert into auth.users (id, email, aud, role) values
    (dp, 'prova-pac-dp@local.test', 'authenticated', 'authenticated'),
    (dr, 'prova-pac-dr@local.test', 'authenticated', 'authenticated'),
    (mp, 'prova-pac-mp@local.test', 'authenticated', 'authenticated');

  insert into public.workspaces (name) values ('Prova pacote P') returning id into p;
  insert into public.workspaces (name) values ('Prova pacote R') returning id into r;
  insert into public.workspaces (name) values ('Prova pacote S') returning id into s;
  insert into public.workspaces (name) values ('Prova pacote T') returning id into t;
  insert into public.workspaces (name) values ('Prova pacote U') returning id into u;
  insert into public.workspaces (name) values ('Prova pacote V') returning id into v;
  insert into public.workspaces (name) values ('Prova pacote W') returning id into w;
  insert into public.workspaces (name) values ('Prova pacote X') returning id into x;

  insert into public.workspace_members (workspace_id, user_id, role) values
    (p, dp, 'owner'), (p, mp, 'member'), (r, dr, 'owner'),
    (s, dp, 'owner'), (t, dp, 'owner'), (u, dp, 'owner'), (v, dp, 'owner'), (w, dp, 'owner'), (x, dp, 'owner');

  -- Todas no plano "uma-marca-com-ia" (franquia 100), menos X, no plano próprio (sem franquia).
  insert into public.assinaturas (workspace_id, plano, provedor, id_externo_cliente, id_externo_assinatura, situacao, titular_email)
  select c, case when c = x then 'uma-marca-sem-ia' else 'uma-marca-com-ia' end, 'stripe',
         'cus_prova_' || substr(c::text, 1, 8), 'sub_prova_' || substr(c::text, 1, 8), 'ativa', 'prova-pac@local.test'
    from unnest(array[p, r, s, t, u, v, w, x]) c;

  -- A
  perform pg_temp.registrar('A1 sem pacote a franquia é a do plano', '100', pg_temp.efetiva(p));

  -- B
  perform pg_temp.registrar('B1 a chave de serviço credita o pacote', 'true', pg_temp.creditar(p, 'cs_prova_1'));
  perform pg_temp.registrar('B2 a franquia efetiva soma o pacote', '200', pg_temp.efetiva(p));
  perform pg_temp.registrar('B3 a mesma sessão repetida não credita de novo', 'false', pg_temp.creditar(p, 'cs_prova_1'));
  perform pg_temp.registrar('B4 e a franquia continua 200', '200', pg_temp.efetiva(p));
  perform pg_temp.registrar('B5 a mesma sessão em OUTRA conta também não credita (unicidade é da sessão)', 'false', pg_temp.creditar(r, 'cs_prova_1'));
  perform pg_temp.registrar('B6 a conta R ficou sem pacote', '100', pg_temp.efetiva(r));

  perform pg_temp.perguntas(p, dp, 150, mes + interval '1 minute');
  perform pg_temp.registrar('B7 com 150 usadas de 200 a reserva passa', 'true/reservado', pg_temp.reservar(dp, p));
  perform pg_temp.perguntas(p, dp, 49, mes + interval '2 minutes');   -- agora 200 usadas
  perform pg_temp.registrar('B8 com 200 usadas de 200 a franquia esgota', 'false/franquia_esgotada', pg_temp.reservar(dp, p));
  perform pg_temp.registrar('B9 outra conta sem pacote não é afetada (R passa)', 'true/reservado', pg_temp.reservar(dr, r));

  -- C. S: comprou mês passado, gastou exatamente a franquia do plano lá; a sobra vale este mês.
  insert into public.pacotes_de_perguntas (workspace_id, codigo, quantidade, valor_centavos, sessao_externa, comprado_em)
  values (s, '100-perguntas', 100, 2900, 'cs_prova_s', passado);
  perform pg_temp.perguntas(s, dp, 100, passado);
  perform pg_temp.registrar('C1 pacote do mês passado, sem excesso lá: sobra inteira este mês', '200', pg_temp.efetiva(s));

  -- T: comprou mês passado, gastou 130 lá (excesso 30): sobram 70.
  insert into public.pacotes_de_perguntas (workspace_id, codigo, quantidade, valor_centavos, sessao_externa, comprado_em)
  values (t, '100-perguntas', 100, 2900, 'cs_prova_t', passado);
  perform pg_temp.perguntas(t, dp, 130, passado);
  perform pg_temp.registrar('C2 excesso do mês passado consumiu parte do pacote: 100 + 70', '170', pg_temp.efetiva(t));

  -- U: comprou dois meses atrás: já expirou.
  insert into public.pacotes_de_perguntas (workspace_id, codigo, quantidade, valor_centavos, sessao_externa, comprado_em)
  values (u, '100-perguntas', 100, 2900, 'cs_prova_u', retrasado);
  perform pg_temp.registrar('C3 pacote de dois meses atrás expirou', '100', pg_temp.efetiva(u));

  -- V: um pacote há dois meses e outro mês passado; excesso de 50 no mês passado consome o que vence antes.
  insert into public.pacotes_de_perguntas (workspace_id, codigo, quantidade, valor_centavos, sessao_externa, comprado_em) values
    (v, '100-perguntas', 100, 2900, 'cs_prova_v1', retrasado),
    (v, '100-perguntas', 100, 2900, 'cs_prova_v2', passado);
  perform pg_temp.perguntas(v, dp, 150, passado);
  perform pg_temp.registrar('C4 o excesso consome o pacote que vence antes; o novo sobra inteiro', '200', pg_temp.efetiva(v));

  -- Compra neste mês + sobra do passado se somam.
  perform pg_temp.registrar('C5 compra deste mês soma à sobra do passado', 'true', pg_temp.creditar(s, 'cs_prova_s2'));
  perform pg_temp.registrar('C6 100 do plano + 100 de sobra + 100 comprados agora', '300', pg_temp.efetiva(s));

  -- D
  insert into public.pacotes_de_perguntas (workspace_id, codigo, quantidade, valor_centavos, sessao_externa, estornado_em)
  values (w, '100-perguntas', 100, 2900, 'cs_prova_w', now());
  perform pg_temp.registrar('D1 pacote estornado não conta', '100', pg_temp.efetiva(w));
  perform pg_temp.registrar('D2 plano sem franquia recusa o pacote (cobrado e não creditado sobe como erro)', '22023/pacote_sem_franquia', pg_temp.creditar(x, 'cs_prova_x'));
  perform pg_temp.registrar('D3 plano sem franquia continua sem franquia', 'null', pg_temp.efetiva(x));
  perform pg_temp.registrar('D4 nada foi gravado para a conta sem franquia', '0',
    (select count(*)::text from public.pacotes_de_perguntas where workspace_id = x));

  -- E
  perform pg_temp.registrar('E1 authenticated não credita (nem a dona)', '42501', pg_temp.chamar('authenticated', dp,
    format('select public.creditar_pacote_de_perguntas(%L, ''100-perguntas'', 100, 2900, ''BRL'', ''cs_prova_e1'')', p)));
  perform pg_temp.registrar('E2 anon não credita', '42501', pg_temp.chamar('anon', dp,
    format('select public.creditar_pacote_de_perguntas(%L, ''100-perguntas'', 100, 2900, ''BRL'', ''cs_prova_e2'')', p)));
  perform pg_temp.registrar('E3 a dona escreve na tabela pelo navegador? não', '42501', pg_temp.chamar('authenticated', dp,
    format('insert into public.pacotes_de_perguntas (workspace_id, codigo, quantidade, valor_centavos, sessao_externa) values (%L, ''x'', 1000, 1, ''cs_prova_e3'')', p)));
  perform pg_temp.registrar('E4 nem altera', '42501', pg_temp.chamar('authenticated', dp,
    format('update public.pacotes_de_perguntas set quantidade = 99999 where workspace_id = %L', p)));
  perform pg_temp.registrar('E5 nem apaga', '42501', pg_temp.chamar('authenticated', dp,
    format('delete from public.pacotes_de_perguntas where workspace_id = %L', p)));
  perform pg_temp.registrar('E6 a dona lê as compras da própria conta (1)', '1',
    pg_temp.como(dp, format('select count(*)::text from public.pacotes_de_perguntas where workspace_id = %L', p)));
  perform pg_temp.registrar('E7 dona de OUTRA conta lê 0 compras de P', '0',
    pg_temp.como(dr, format('select count(*)::text from public.pacotes_de_perguntas where workspace_id = %L', p)));
  perform pg_temp.registrar('E8 membro de consulta lê 0 compras de P', '0',
    pg_temp.como(mp, format('select count(*)::text from public.pacotes_de_perguntas where workspace_id = %L', p)));
  perform pg_temp.registrar('E9 anon lê a tabela? não', '42501', pg_temp.chamar('anon', dp, 'select count(*) from public.pacotes_de_perguntas'));
  perform pg_temp.registrar('E10 a dona vê no uso quanto vem de pacote', '100',
    pg_temp.como(dp, format('select (public.uso_do_vini_da_conta(%L)->>''perguntas_de_pacotes'')', p)));
  perform pg_temp.registrar('E11 a dona vê no uso a franquia do plano', '100',
    pg_temp.como(dp, format('select (public.uso_do_vini_da_conta(%L)->>''franquia_do_plano'')', p)));
  perform pg_temp.registrar('E12 dona de OUTRA conta não lê o uso de P', '42501', pg_temp.chamar('authenticated', dr,
    format('select public.uso_do_vini_da_conta(%L)', p)));
  perform pg_temp.registrar('E13 membro de consulta não lê o uso de P', '42501', pg_temp.chamar('authenticated', mp,
    format('select public.uso_do_vini_da_conta(%L)', p)));
  perform pg_temp.registrar('E14 as funções internas não são executáveis por authenticated', '42501', pg_temp.chamar('authenticated', dp,
    format('select private.perguntas_de_pacotes_no_mes(%L)', p)));
  perform pg_temp.registrar('E15 as tentativas negadas não mudaram a tabela de P (1 compra, 100)', '1/100',
    (select count(*) || '/' || sum(quantidade) from public.pacotes_de_perguntas where workspace_id = p));
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
