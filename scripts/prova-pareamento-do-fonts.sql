-- Prova do pareamento de dispositivos do Fonts (09/11/2026). A transação já foi aberta pelo .sh,
-- com a migration aplicada; aqui só o mundo e as conferências, e `rollback` no fim.
--
--   A. Fluxo feliz: pedir (anon) -> pendente -> aprovar (membro) -> aprovado -> validar (serviço).
--   B. Negativos de autorização: anon não aprova; membro de OUTRA conta não aprova na conta alheia;
--      ninguém lê ou escreve a tabela pelo navegador; validar é só da chave de serviço.
--   C. Segredo errado não revela estado; hash malformado é recusado (22023); limite de 12 pedidos
--      por origem em 10 minutos (P0003); aprovar duas vezes é recusado (P0002).
--   D. Revogação e saída da conta invalidam o dispositivo.
--
-- Cada caso confere resultado/SQLSTATE EXATOS. Mundo próprio.

\pset pager off

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void
language sql as $f$
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, p_obtido, p_esperado is not distinct from p_obtido);
$f$;

-- Roda p_sql com o papel dado; devolve 'ACEITOU' ou o SQLSTATE; p_pessoa pode ser null (anon).
create function pg_temp.chamar(p_papel text, p_pessoa uuid, p_sql text) returns text
language plpgsql as $f$
declare estado text;
begin
  begin
    perform set_config('request.jwt.claims',
      case when p_pessoa is null then '' else json_build_object('sub', p_pessoa, 'role', p_papel)::text end, true);
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

-- Devolve o texto da 1ª coluna da consulta, com o papel dado.
create function pg_temp.valor(p_papel text, p_pessoa uuid, p_sql text) returns text
language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims',
    case when p_pessoa is null then '' else json_build_object('sub', p_pessoa, 'role', p_papel)::text end, true);
  execute format('set local role %I', p_papel);
  execute p_sql into v;
  execute 'reset role';
  return coalesce(v, 'null');
exception when others then
  declare estado text;
  begin
    get stacked diagnostics estado = returned_sqlstate;
    execute 'reset role';
    return 'ERRO ' || estado;
  end;
end $f$;

create function pg_temp.h(p_n integer) returns text language sql as $f$ select lpad(p_n::text, 64, '0') $f$;

do $$
declare
  da uuid := 'a1a1a1a1-0000-4000-8000-0000000d0001';  -- dona da conta P
  db uuid := 'b1b1b1b1-0000-4000-8000-0000000d0002';  -- dona da conta Q (outra)
  p uuid; q uuid;
  pid uuid := 'd0d0d0d0-0000-4000-8000-000000000001';
  pid2 uuid := 'd0d0d0d0-0000-4000-8000-000000000002';
  n integer;
begin
  insert into auth.users (id, email, aud, role) values
    (da, 'prova-par-a@local.test', 'authenticated', 'authenticated'),
    (db, 'prova-par-b@local.test', 'authenticated', 'authenticated');
  insert into public.workspaces (name) values ('Prova pareamento P') returning id into p;
  insert into public.workspaces (name) values ('Prova pareamento Q') returning id into q;
  insert into public.workspace_members (workspace_id, user_id, role) values (p, da, 'owner'), (q, db, 'owner');

  -- A
  perform pg_temp.registrar('A1 anon pede o pareamento', 'ACEITOU', pg_temp.chamar('anon', null,
    format('select public.solicitar_pareamento_fonts(%L, %L, %L, %L, %L)', pid, pg_temp.h(1), pg_temp.h(2), pg_temp.h(3), 'MacBook do Andre')));
  perform pg_temp.registrar('A2 com o segredo certo, o estado é pendente', 'pendente', pg_temp.valor('anon', null,
    format('select estado from public.consultar_pareamento_fonts(%L, %L)', pid, pg_temp.h(2))));
  perform pg_temp.registrar('A3 antes de aprovar, o dispositivo NÃO valida', '0', pg_temp.valor('service_role', null,
    format('select count(*) from public.validar_dispositivo_fonts(%L)', pg_temp.h(1))));
  perform pg_temp.registrar('A4 membro da conta P aprova', 'ACEITOU', pg_temp.chamar('authenticated', da,
    format('select public.aprovar_pareamento_fonts(%L, %L)', pid, p)));
  perform pg_temp.registrar('A5 o estado vira aprovado', 'aprovado', pg_temp.valor('anon', null,
    format('select estado from public.consultar_pareamento_fonts(%L, %L)', pid, pg_temp.h(2))));
  perform pg_temp.registrar('A6 a chave de serviço valida e devolve a conta P', p::text, pg_temp.valor('service_role', null,
    format('select workspace_id from public.validar_dispositivo_fonts(%L)', pg_temp.h(1))));
  perform pg_temp.registrar('A7 o uso ficou registrado', 'true', (select (ultimo_uso_em is not null)::text
    from public.fonts_pareamentos_de_dispositivo where id = pid));

  -- B
  perform pg_temp.registrar('B1 anon NÃO aprova', '42501', pg_temp.chamar('anon', null,
    format('select public.aprovar_pareamento_fonts(%L, %L)', pid, p)));
  insert into public.fonts_pareamentos_de_dispositivo (id, token_hash, segredo_hash, origem_hash, rotulo_do_dispositivo, expira_em)
    values (pid2, pg_temp.h(11), pg_temp.h(12), pg_temp.h(13), 'Outro Mac', now() + interval '10 minutes');
  perform pg_temp.registrar('B2 dona da conta Q NÃO aprova pareamento na conta P', '42501', pg_temp.chamar('authenticated', db,
    format('select public.aprovar_pareamento_fonts(%L, %L)', pid2, p)));
  perform pg_temp.registrar('B3 ...e o pareamento seguiu pendente', 'null', (select coalesce(workspace_id::text, 'null')
    from public.fonts_pareamentos_de_dispositivo where id = pid2));
  perform pg_temp.registrar('B4 authenticated não lê a tabela', '42501', pg_temp.chamar('authenticated', da,
    'select * from public.fonts_pareamentos_de_dispositivo'));
  perform pg_temp.registrar('B5 anon não lê a tabela', '42501', pg_temp.chamar('anon', null,
    'select * from public.fonts_pareamentos_de_dispositivo'));
  perform pg_temp.registrar('B6 authenticated não escreve na tabela', '42501', pg_temp.chamar('authenticated', da,
    format('update public.fonts_pareamentos_de_dispositivo set revogado_em = null where id = %L', pid)));
  perform pg_temp.registrar('B7 anon não valida dispositivo', '42501', pg_temp.chamar('anon', null,
    format('select * from public.validar_dispositivo_fonts(%L)', pg_temp.h(1))));
  perform pg_temp.registrar('B8 authenticated não valida dispositivo', '42501', pg_temp.chamar('authenticated', da,
    format('select * from public.validar_dispositivo_fonts(%L)', pg_temp.h(1))));

  -- C
  perform pg_temp.registrar('C1 segredo errado não revela o estado', 'null', pg_temp.valor('anon', null,
    format('select estado from public.consultar_pareamento_fonts(%L, %L)', pid, pg_temp.h(99))));
  perform pg_temp.registrar('C2 hash malformado no pedido é recusado', '22023', pg_temp.chamar('anon', null,
    format('select public.solicitar_pareamento_fonts(%L, %L, %L, %L, %L)', gen_random_uuid(), 'xx', pg_temp.h(2), pg_temp.h(3), 'Mac')));
  perform pg_temp.registrar('C3 rótulo vazio é recusado', '22023', pg_temp.chamar('anon', null,
    format('select public.solicitar_pareamento_fonts(%L, %L, %L, %L, %L)', gen_random_uuid(), pg_temp.h(21), pg_temp.h(2), pg_temp.h(3), '   ')));
  perform pg_temp.registrar('C4 aprovar duas vezes é recusado', 'P0002', pg_temp.chamar('authenticated', da,
    format('select public.aprovar_pareamento_fonts(%L, %L)', pid, p)));
  -- origem h(3) já fez 1 pedido (A1); mais 11 chegam a 12 (pid2 tem origem h(13), não conta).
  for n in 1..11 loop
    perform public.solicitar_pareamento_fonts(gen_random_uuid(), pg_temp.h(100 + n), pg_temp.h(2), pg_temp.h(3), 'Mac ' || n);
  end loop;
  perform pg_temp.registrar('C5 o 13º pedido da mesma origem em 10 min é barrado', 'P0003', pg_temp.chamar('anon', null,
    format('select public.solicitar_pareamento_fonts(%L, %L, %L, %L, %L)', gen_random_uuid(), pg_temp.h(150), pg_temp.h(2), pg_temp.h(3), 'Mac 13')));
  perform pg_temp.registrar('C6 outra origem não é afetada', 'ACEITOU', pg_temp.chamar('anon', null,
    format('select public.solicitar_pareamento_fonts(%L, %L, %L, %L, %L)', gen_random_uuid(), pg_temp.h(151), pg_temp.h(2), pg_temp.h(4), 'Mac outra origem')));
  update public.fonts_pareamentos_de_dispositivo set expira_em = now() - interval '1 minute', criado_em = now() - interval '11 minutes'
    where id = pid2;
  perform pg_temp.registrar('C7 pareamento vencido não aprova', 'P0002', pg_temp.chamar('authenticated', db,
    format('select public.aprovar_pareamento_fonts(%L, %L)', pid2, q)));

  -- D
  update public.fonts_pareamentos_de_dispositivo set revogado_em = now() where id = pid;
  perform pg_temp.registrar('D1 revogado: o estado é revogado', 'revogado', pg_temp.valor('anon', null,
    format('select estado from public.consultar_pareamento_fonts(%L, %L)', pid, pg_temp.h(2))));
  perform pg_temp.registrar('D2 revogado: não valida mais', '0', pg_temp.valor('service_role', null,
    format('select count(*) from public.validar_dispositivo_fonts(%L)', pg_temp.h(1))));
  update public.fonts_pareamentos_de_dispositivo set revogado_em = null where id = pid;
  perform pg_temp.registrar('D3 sem revogação volta a validar', '1', pg_temp.valor('service_role', null,
    format('select count(*) from public.validar_dispositivo_fonts(%L)', pg_temp.h(1))));
  delete from public.workspace_members where workspace_id = p and user_id = da;
  perform pg_temp.registrar('D4 quem aprovou saiu da conta: o dispositivo deixa de valer', '0', pg_temp.valor('service_role', null,
    format('select count(*) from public.validar_dispositivo_fonts(%L)', pg_temp.h(1))));
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
