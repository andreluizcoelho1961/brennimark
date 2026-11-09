-- Prova do teto global e da limpeza em solicitar_pareamento_fonts (auditoria 09/11/2026, M2).
--   A. Variar o `origem_hash` a cada pedido NÃO contorna o teto: 300 pedidos na última hora (origens
--      todas distintas) fazem o 301º ser barrado com P0003 mesmo vindo de uma origem nova.
--   B. Abaixo do teto, uma origem nova continua passando; o limite por origem (12/10 min) continua valendo.
--   C. Limpeza: pendente que nunca foi aprovado e venceu há mais de 1 dia é apagado no próximo pedido;
--      pendente recente, pareamento APROVADO antigo e pareamento REVOGADO antigo NUNCA são apagados.
-- A transação e as migrations são abertas pelo .sh; `rollback` no fim.
create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, p_obtido, p_esperado is not distinct from p_obtido);
$f$;
create function pg_temp.h(p_n integer) returns text language sql as $f$ select lpad(p_n::text, 64, '0') $f$;
create function pg_temp.pedir_como_anon(p_origem text) returns text language plpgsql as $f$
declare estado text;
begin
  begin
    execute 'set local role anon';
    perform public.solicitar_pareamento_fonts(gen_random_uuid(), encode(sha256(gen_random_uuid()::text::bytea), 'hex'),
      encode(sha256(gen_random_uuid()::text::bytea), 'hex'), p_origem, 'Mac da prova');
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
  antigo_pend uuid := gen_random_uuid(); recente_pend uuid := gen_random_uuid();
  antigo_aprov uuid := gen_random_uuid(); antigo_rev uuid := gen_random_uuid();
  u uuid := 'e5e5e5e5-0000-4000-8000-0000000a0001';
  w uuid;
  existentes integer;
begin
  select count(*) into existentes from public.fonts_pareamentos_de_dispositivo where criado_em > now() - interval '1 hour';
  perform pg_temp.registrar('B1 abaixo do teto, origem nova passa', 'ACEITOU', pg_temp.pedir_como_anon(pg_temp.h(900001)));

  -- C: preparar linhas antigas (inseridas como dono, fora do papel anon)
  insert into auth.users (id, email, aud, role) values (u, 'prova-pareamento-m2@local.test', 'authenticated', 'authenticated');
  insert into public.workspaces (name) values ('Prova pareamento M2') returning id into w;
  insert into public.fonts_pareamentos_de_dispositivo (id, token_hash, segredo_hash, origem_hash, rotulo_do_dispositivo, criado_em, expira_em)
    values (antigo_pend, pg_temp.h(700001), pg_temp.h(700002), pg_temp.h(700003), 'antigo pendente', now() - interval '3 days', now() - interval '3 days' + interval '10 minutes'),
           (recente_pend, pg_temp.h(700011), pg_temp.h(700012), pg_temp.h(700013), 'recente vencido', now() - interval '2 hours', now() - interval '2 hours' + interval '10 minutes');
  insert into public.fonts_pareamentos_de_dispositivo (id, token_hash, segredo_hash, origem_hash, rotulo_do_dispositivo, workspace_id, user_id, aprovado_em, criado_em, expira_em)
    values (antigo_aprov, pg_temp.h(700021), pg_temp.h(700022), pg_temp.h(700023), 'antigo aprovado', w, u, now() - interval '3 days', now() - interval '3 days', now() - interval '3 days' + interval '10 minutes');
  insert into public.fonts_pareamentos_de_dispositivo (id, token_hash, segredo_hash, origem_hash, rotulo_do_dispositivo, revogado_em, criado_em, expira_em)
    values (antigo_rev, pg_temp.h(700031), pg_temp.h(700032), pg_temp.h(700033), 'antigo revogado', now() - interval '2 days', now() - interval '3 days', now() - interval '3 days' + interval '10 minutes');

  perform pg_temp.registrar('C0 um pedido dispara a limpeza', 'ACEITOU', pg_temp.pedir_como_anon(pg_temp.h(900002)));
  perform pg_temp.registrar('C1 pendente vencido há mais de 1 dia foi apagado', '0', (select count(*)::text from public.fonts_pareamentos_de_dispositivo where id = antigo_pend));
  perform pg_temp.registrar('C2 pendente vencido há 2 horas fica', '1', (select count(*)::text from public.fonts_pareamentos_de_dispositivo where id = recente_pend));
  perform pg_temp.registrar('C3 aprovado antigo NUNCA é apagado', '1', (select count(*)::text from public.fonts_pareamentos_de_dispositivo where id = antigo_aprov));
  perform pg_temp.registrar('C4 revogado antigo NUNCA é apagado', '1', (select count(*)::text from public.fonts_pareamentos_de_dispositivo where id = antigo_rev));

  -- A: levar a última hora a 300 pedidos com origens todas distintas
  insert into public.fonts_pareamentos_de_dispositivo (id, token_hash, segredo_hash, origem_hash, rotulo_do_dispositivo, expira_em)
    select gen_random_uuid(), encode(sha256(('t' || g)::bytea), 'hex'), encode(sha256(('s' || g)::bytea), 'hex'),
           encode(sha256(('o' || g)::bytea), 'hex'), 'enchente', now() + interval '10 minutes'
      from generate_series(1, 300 - (select count(*)::integer from public.fonts_pareamentos_de_dispositivo where criado_em > now() - interval '1 hour')) g;
  perform pg_temp.registrar('A0 a última hora está em 300', '300', (select count(*)::text from public.fonts_pareamentos_de_dispositivo where criado_em > now() - interval '1 hour'));
  perform pg_temp.registrar('A1 origem NUNCA vista é barrada pelo teto global (P0003)', 'P0003', pg_temp.pedir_como_anon(pg_temp.h(900003)));
  perform pg_temp.registrar('A2 e outra origem nova também', 'P0003', pg_temp.pedir_como_anon(pg_temp.h(900004)));
end $$;

select case when passou then 'ok   ' else 'FALHA' end as st, caso, esperado, obtido from resultado order by ordem;
select case when count(*) filter (where not passou) = 0 then 'PROVA COMPLETA: ' || count(*) || ' verificacoes, todas verdes'
            else 'PROVA FALHOU: ' || count(*) filter (where not passou) || ' de ' || count(*) end as veredito from resultado;
do $$ declare n integer; begin select count(*) filter (where not passou) into n from resultado;
  if n > 0 then raise exception 'PROVA FALHOU: % verificacao(oes)', n using errcode = 'P0001'; end if; end $$;
rollback;
