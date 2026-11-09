-- Prova do interruptor "usa o Vini" por pessoa (ADR-0009 §5) — 08/11/2026.
--
--   A. Membro novo nasce com o Vini LIGADO e reserva.
--   B. A dona desliga: o membro é recusado com `vini_desligado_para_voce`; a dona continua; religar volta.
--   C. O interruptor é por CONTA: desligar na conta P não desliga a mesma pessoa na conta Q.
--   D. Administrador (owner) não pode ser desligado (nem pela própria dona), e a reserva nunca o barra.
--   E. Negativos: membro não liga nem desliga (nem a si mesmo); dona de OUTRA conta não liga, não
--      desliga, não lê; anon não executa; pessoa que não é da conta recusa; valor nulo recusa.
--   F. O membro lê o próprio interruptor, mas não o dos outros; o nome em inglês do plano é legível por anon.
--
-- Cada caso confere o SQLSTATE (e o motivo) EXATOS, nunca "algum erro". Mundo próprio e `rollback` no fim.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void
language sql as $f$
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, p_obtido, p_esperado is not distinct from p_obtido);
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
    return estado;
  end;
end $f$;

-- Quantas linhas esta pessoa enxerga ao ler a coluna, como `authenticated`.
create function pg_temp.linhas_visiveis(p_pessoa uuid, p_conta uuid) returns text
language plpgsql as $f$
declare n integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_pessoa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.workspace_members where workspace_id = p_conta and usa_o_vini;
  execute 'reset role';
  return n::text;
end $f$;

-- Roda uma consulta que devolve um texto, como `authenticated` com a sessão de `p_pessoa`.
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

do $$
declare
  dp uuid := 'a0a0a0a0-0000-4000-8000-0000000e0001';  -- dona da conta P
  dq uuid := 'b0b0b0b0-0000-4000-8000-0000000e0002';  -- dona da conta Q
  m1 uuid := 'c0c0c0c0-0000-4000-8000-0000000e0003';  -- membro de P e de Q
  m2 uuid := 'd0d0d0d0-0000-4000-8000-0000000e0004';  -- outro membro de P
  p uuid; q uuid;
  anonimo text;
begin
  insert into public.workspaces (name) values ('Prova vini P') returning id into p;
  insert into public.workspaces (name) values ('Prova vini Q') returning id into q;
  insert into auth.users (id, email, aud, role) values
    (dp, 'prova-vini-dp@local.test', 'authenticated', 'authenticated'),
    (dq, 'prova-vini-dq@local.test', 'authenticated', 'authenticated'),
    (m1, 'prova-vini-m1@local.test', 'authenticated', 'authenticated'),
    (m2, 'prova-vini-m2@local.test', 'authenticated', 'authenticated');
  insert into public.workspace_members (workspace_id, user_id, role) values
    (p, dp, 'owner'), (q, dq, 'owner'), (p, m1, 'member'), (q, m1, 'member'), (p, m2, 'member');

  -- A
  perform pg_temp.registrar('A1 membro novo nasce com o Vini ligado', 'true',
    (select usa_o_vini::text from public.workspace_members where workspace_id = p and user_id = m1));
  perform pg_temp.registrar('A2 membro ligado reserva', 'true/reservado', pg_temp.reservar(m1, p));

  -- B
  perform pg_temp.registrar('B1 a dona desliga o membro', 'ACEITOU', pg_temp.chamar('authenticated', dp,
    format('select public.definir_uso_do_vini(%L, %L, false)', p, 'prova-vini-m1@local.test')));
  perform pg_temp.registrar('B2 membro desligado é recusado com o motivo certo', 'false/vini_desligado_para_voce', pg_temp.reservar(m1, p));
  perform pg_temp.registrar('B3 a dona continua perguntando', 'true/reservado', pg_temp.reservar(dp, p));
  perform pg_temp.registrar('B4 outro membro da mesma conta não foi afetado', 'true/reservado', pg_temp.reservar(m2, p));
  perform pg_temp.registrar('B5 a dona vê quem está desligado', 'false',
    pg_temp.como(dp, format('select usa_o_vini::text from public.usos_do_vini_da_conta(%L) where email = %L', p, 'prova-vini-m1@local.test')));

  -- C
  perform pg_temp.registrar('C1 a mesma pessoa continua ligada na conta Q', 'true/reservado', pg_temp.reservar(m1, q));

  -- B (religar)
  perform pg_temp.registrar('B6 a dona religa', 'ACEITOU', pg_temp.chamar('authenticated', dp,
    format('select public.definir_uso_do_vini(%L, %L, true)', p, 'PROVA-vini-m1@local.test')));
  perform pg_temp.registrar('B7 religado volta a reservar', 'true/reservado', pg_temp.reservar(m1, p));

  -- D
  perform pg_temp.registrar('D1 não se desliga a administradora', '22023', pg_temp.chamar('authenticated', dp,
    format('select public.definir_uso_do_vini(%L, %L, false)', p, 'prova-vini-dp@local.test')));
  update public.workspace_members set usa_o_vini = false where workspace_id = p and user_id = dp;
  perform pg_temp.registrar('D2 mesmo com a coluna falsa à força, a reserva nunca barra a administradora', 'true/reservado', pg_temp.reservar(dp, p));
  update public.workspace_members set usa_o_vini = true where workspace_id = p and user_id = dp;

  -- E
  perform pg_temp.registrar('E1 membro não desliga outro membro', '42501', pg_temp.chamar('authenticated', m1,
    format('select public.definir_uso_do_vini(%L, %L, false)', p, 'prova-vini-m2@local.test')));
  perform pg_temp.registrar('E2 membro não desliga a si mesmo nem religa', '42501', pg_temp.chamar('authenticated', m1,
    format('select public.definir_uso_do_vini(%L, %L, true)', p, 'prova-vini-m1@local.test')));
  perform pg_temp.registrar('E3 dona de OUTRA conta não desliga', '42501', pg_temp.chamar('authenticated', dq,
    format('select public.definir_uso_do_vini(%L, %L, false)', p, 'prova-vini-m2@local.test')));
  perform pg_temp.registrar('E4 dona de OUTRA conta não lê quem usa', '42501', pg_temp.chamar('authenticated', dq,
    format('select public.usos_do_vini_da_conta(%L)', p)));
  perform pg_temp.registrar('E5 membro não lê quem usa', '42501', pg_temp.chamar('authenticated', m1,
    format('select public.usos_do_vini_da_conta(%L)', p)));
  perform pg_temp.registrar('E6 anon não executa o interruptor', '42501', pg_temp.chamar('anon', dp,
    format('select public.definir_uso_do_vini(%L, %L, false)', p, 'prova-vini-m2@local.test')));
  perform pg_temp.registrar('E7 anon não executa a leitura', '42501', pg_temp.chamar('anon', dp,
    format('select public.usos_do_vini_da_conta(%L)', p)));
  perform pg_temp.registrar('E8 e-mail que não é de consulta desta conta recusa', '22023', pg_temp.chamar('authenticated', dp,
    format('select public.definir_uso_do_vini(%L, %L, false)', p, 'ninguem@local.test')));
  perform pg_temp.registrar('E9 pessoa de OUTRA conta recusa (dona de P, e-mail só de Q)', '22023', pg_temp.chamar('authenticated', dp,
    format('select public.definir_uso_do_vini(%L, %L, false)', p, 'prova-vini-dq@local.test')));
  perform pg_temp.registrar('E10 valor nulo recusa', '22023', pg_temp.chamar('authenticated', dp,
    format('select public.definir_uso_do_vini(%L, %L, null)', p, 'prova-vini-m2@local.test')));
  perform pg_temp.registrar('E11 as tentativas negadas não mudaram nada', 'true',
    (select usa_o_vini::text from public.workspace_members where workspace_id = p and user_id = m2));
  perform pg_temp.registrar('E12 a reserva não é executável por authenticated', '42501', pg_temp.chamar('authenticated', m1,
    format('select * from public.reservar_execucao_de_ia_server(%L, %L, null, gen_random_uuid(), ''assist'', 1, ''USD'')', m1, p)));

  -- F
  perform pg_temp.registrar('F1 o membro enxerga só a própria linha (1 linha), não a dos outros', '1', pg_temp.linhas_visiveis(m1, p));
  execute 'set local role anon';
  select nome_en into anonimo from public.planos where codigo = 'basico';
  execute 'reset role';
  perform pg_temp.registrar('F2 anon lê a coluna do nome em inglês (vazia nos planos antigos)', 'null', coalesce(anonimo, 'null'));
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
