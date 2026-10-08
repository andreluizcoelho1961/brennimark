-- Prova dos pedidos de exportação — 08/10/2026.
--
-- Mundo próprio, SQLSTATE e NOME da constraint, e `rollback` no fim. Perguntas:
--   1. Só o DONO pede, e só pela própria conta; pedir de novo devolve o mesmo
--      pedido aberto; o membro, o dono de outra conta e o visitante não pedem.
--   2. Só o dono lê, e só os da própria conta.
--   3. Ninguém escreve direto pela sessão (nem marca a própria entrega).
--   4. O Console é só da equipe; marcar pede motivo e fica no registro.
--   5. As constraints barram o estado incoerente escrito direto.
--   6. A conta sair leva os pedidos.

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

do $$
declare
  dono_a uuid := 'a0a0a0a0-0000-4000-8000-0000000f0001';
  membro_a uuid := 'a0a0a0a0-0000-4000-8000-0000000f0002';
  dono_b uuid := 'b0b0b0b0-0000-4000-8000-0000000f0003';
  equipe uuid := 'c0c0c0c0-0000-4000-8000-0000000f0004';
  a uuid; b uuid; primeiro text; segundo text; id_a uuid;
begin
  insert into public.workspaces (name) values ('Prova Exportacao A') returning id into a;
  insert into public.workspaces (name) values ('Prova Exportacao B') returning id into b;
  insert into auth.users (id, email, aud, role) values
    (dono_a, 'prova-exp-dono-a@local.test', 'authenticated', 'authenticated'),
    (membro_a, 'prova-exp-membro-a@local.test', 'authenticated', 'authenticated'),
    (dono_b, 'prova-exp-dono-b@local.test', 'authenticated', 'authenticated'),
    (equipe, 'prova-exp-equipe@local.test', 'authenticated', 'authenticated');
  insert into public.workspace_members (workspace_id, user_id, role) values
    (a, dono_a, 'owner'), (a, membro_a, 'member'), (b, dono_b, 'owner');
  insert into private.equipe_brennimark (user_id, nome) values (equipe, 'Prova da equipe');

  -- 1. Quem pede: só o dono, só da própria conta.
  primeiro := pg_temp.valor(dono_a, format('select public.pedir_exportacao(%L)::text', a));
  perform pg_temp.registrar('o dono de A pede: pedido novo', 'true', (primeiro::jsonb ->> 'novo'));
  perform pg_temp.registrar('o pedido devolve a conta e quem pediu', 'Prova Exportacao A prova-exp-dono-a@local.test',
    (primeiro::jsonb ->> 'conta') || ' ' || (primeiro::jsonb ->> 'pedido_por'));
  segundo := pg_temp.valor(dono_a, format('select public.pedir_exportacao(%L)::text', a));
  perform pg_temp.registrar('pedir de novo devolve o MESMO pedido aberto', 'false mesmo',
    (segundo::jsonb ->> 'novo') || ' ' || case when segundo::jsonb ->> 'id' = primeiro::jsonb ->> 'id' then 'mesmo' else 'outro' end);
  perform pg_temp.registrar('um so pedido aberto em A', '1', (select count(*)::text from public.pedidos_de_exportacao where workspace_id = a));
  perform pg_temp.registrar('o membro (nao dono) de A NAO pede', '42501', pg_temp.como(membro_a, format('select public.pedir_exportacao(%L)', a)));
  perform pg_temp.registrar('o dono de B NAO pede pela conta A', '42501', pg_temp.como(dono_b, format('select public.pedir_exportacao(%L)', a)));
  perform pg_temp.registrar('o visitante NAO pede', '42501', pg_temp.papel('anon', format('select public.pedir_exportacao(%L)', a)));

  -- 2. Quem lê: só o dono, só a própria conta.
  perform pg_temp.registrar('o dono de A le o pedido de A', '1', pg_temp.valor(dono_a, 'select count(*)::text from public.pedidos_de_exportacao'));
  perform pg_temp.registrar('o dono de B NAO ve o pedido de A', '0',
    pg_temp.valor(dono_b, format('select count(*)::text from public.pedidos_de_exportacao where workspace_id = %L', a)));
  perform pg_temp.registrar('o membro de A NAO ve o pedido', '0', pg_temp.valor(membro_a, 'select count(*)::text from public.pedidos_de_exportacao'));
  perform pg_temp.registrar('o visitante NAO le', '42501', pg_temp.papel('anon', 'select * from public.pedidos_de_exportacao'));

  -- 3. Ninguém escreve direto pela sessão.
  perform pg_temp.registrar('o dono NAO insere direto', '42501', pg_temp.como(dono_a, format('insert into public.pedidos_de_exportacao (workspace_id) values (%L)', b)));
  perform pg_temp.registrar('o dono NAO marca a propria entrega', '42501', pg_temp.como(dono_a, 'update public.pedidos_de_exportacao set entregue_em = now()'));
  perform pg_temp.registrar('o dono NAO apaga o pedido', '42501', pg_temp.como(dono_a, 'delete from public.pedidos_de_exportacao'));

  -- 4. O Console: só a equipe.
  id_a := (primeiro::jsonb ->> 'id')::uuid;
  perform pg_temp.registrar('o dono NAO le o Console', '42501', pg_temp.como(dono_a, 'select public.console_pedidos_de_exportacao()'));
  perform pg_temp.registrar('o dono NAO marca entrega pelo Console', '42501',
    pg_temp.como(dono_a, format($s$select public.console_marcar_exportacao_entregue(%L, 'entreguei eu mesmo')$s$, id_a)));
  perform pg_temp.registrar('a equipe le os pedidos', 'true',
    pg_temp.valor(equipe, format($s$select (public.console_pedidos_de_exportacao() @> jsonb_build_array(jsonb_build_object('id', %L::text, 'conta', 'Prova Exportacao A')))::text$s$, id_a)));
  perform pg_temp.registrar('a equipe NAO marca sem motivo', '23514',
    pg_temp.como(equipe, format($s$select public.console_marcar_exportacao_entregue(%L, ' x ')$s$, id_a)));
  perform pg_temp.registrar('a equipe marca entregue, com motivo', 'ACEITOU 1',
    pg_temp.como(equipe, format($s$select public.console_marcar_exportacao_entregue(%L, 'zip enviado por e-mail')$s$, id_a)));
  perform pg_temp.registrar('a entrega fica no registro da equipe', '1',
    (select count(*)::text from private.registro_da_equipe where acao = 'entregar exportação' and alvo = 'conta ' || a and motivo = 'zip enviado por e-mail'));
  perform pg_temp.registrar('marcar de novo: ja entregue', 'P0002',
    pg_temp.como(equipe, format($s$select public.console_marcar_exportacao_entregue(%L, 'de novo')$s$, id_a)));
  perform pg_temp.registrar('depois de entregue, o dono pode pedir outra', 'true',
    (pg_temp.valor(dono_a, format('select public.pedir_exportacao(%L)::text', a))::jsonb ->> 'novo'));

  -- 5. As constraints, pelo nome.
  perform pg_temp.registrar('dois pedidos abertos na mesma conta sao barrados', '23505 pedidos_de_exportacao_um_aberto',
    pg_temp.erro(format('insert into public.pedidos_de_exportacao (workspace_id) values (%L)', a)));
  perform pg_temp.registrar('quem entregou sem entrega e barrado', '23514 pedidos_de_exportacao_entrega_coerente',
    pg_temp.erro(format('insert into public.pedidos_de_exportacao (workspace_id, entregue_por) values (%L, %L)', b, equipe)));
  perform pg_temp.registrar('entrega antes do pedido e barrada', '23514 pedidos_de_exportacao_entrega_depois_do_pedido',
    pg_temp.erro(format($s$insert into public.pedidos_de_exportacao (workspace_id, entregue_em) values (%L, now() - interval '1 day')$s$, b)));

  -- 6. A conta sair leva os pedidos dela.
  delete from public.workspaces where id = a;
  perform pg_temp.registrar('a conta sair leva os pedidos', '0', (select count(*)::text from public.pedidos_de_exportacao where workspace_id = a));
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
