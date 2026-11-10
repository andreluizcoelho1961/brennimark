-- Prova das funções SECURITY DEFINER executáveis por quem entra (auditoria de 09/11/2026, M3).
--
-- A regra "toda função DEFINER sem EXECUTE para authenticated" NÃO é a prática do projeto: as funções
-- que o navegador chama (RPC) precisam de EXECUTE, e a proteção real é a checagem DENTRO do corpo
-- (`private.eh_da_equipe()`, `auth.uid()` + papel/associação). Esta prova trava o que importa:
--
--   A. Nenhuma função DEFINER do schema `public` fica executável por `anon`, exceto as duas do
--      pareamento do Fonts (o desktop ainda não tem conta; desenho aprovado).
--   B. Nenhuma função DEFINER NOVA fica executável por `authenticated` sem estar na lista APROVADA
--      abaixo. Quem cria uma função e quer expô-la a quem entra precisa vir aqui, acrescentá-la à lista
--      e, ao fazê-lo, ter conferido que o corpo checa quem chama.
--   C. TODA `console_*` recusa (SQLSTATE 42501) uma pessoa autenticada que não é da equipe, e `anon`
--      não executa nenhuma (42501). A prova percorre as funções pelo catálogo: uma `console_*` nova
--      entra no teste sozinha, sem ninguém lembrar de listá-la.
--
-- Mundo próprio, `rollback` no fim. Roda contra o banco local (as migrations aplicadas).
\set ON_ERROR_STOP on
\pset pager off
begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;

-- As funções aprovadas (fora as console_*, que a seção C prova pelo catálogo). Em 09/11/2026 todas checam
-- `auth.uid()` ou uma função de capacidade no corpo, ou só devolvem fato sobre o próprio chamador.
create temp table aprovadas (nome text primary key);
insert into aprovadas values
 ('aceitar_termo_de_ia_propria'),('apagar_chave_de_ia'),('apagar_conversa'),('aprovar_cores_da_paleta'),
 ('aprovar_pareamento_fonts'),('aprovar_regras_de_grid'),('aprovar_regras_do_logo'),('aprovar_tipografia_da_marca'),
 ('arquivar_complemento'),('arquivo_pode_ser_apagado'),('caminhos_da_exportacao'),('conceder_acesso'),
 ('concluir_exportacao'),('consultar_pareamento_fonts'),('criar_complemento'),('criar_link_de_entrega'),
 ('definir_teto_da_ia_propria'),('definir_uso_do_vini'),('definir_vini_da_pessoa'),('descartar_rascunho_de_complemento'),
 ('guardar_chave_de_ia'),('iniciar_exportacao'),('kill_switch_ativo'),('listar_chaves_de_ia'),
 ('login_provisorio_da_conta'),('marca_do_caminho_existe'),('modo_de_ia_da_conta'),('pdf_de_importacao_existe'),
 ('pedir_exportacao'),('pessoas_da_conta'),('posso_usar_o_vini'),('publicar_complemento'),
 ('registrar_imagem_de_leitura'),('revogar_acesso'),('revogar_link_de_entrega'),('salvar_rascunho_de_complemento'),
 ('situacao_de_cobranca_da_conta'),('solicitar_pareamento_fonts'),('sou_da_equipe_brennimark'),
 ('tem_capacidade_na_marca'),('tem_capacidade_no_caminho'),('uso_do_vini_da_conta'),('usos_do_vini_da_conta');

-- A
select pg_temp.registrar('A1 anon não executa nenhuma função DEFINER além das duas do pareamento do Fonts', '(nenhuma)',
  coalesce((select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
      and p.proname not in ('consultar_pareamento_fonts', 'solicitar_pareamento_fonts')), '(nenhuma)'));

-- B
select pg_temp.registrar('B1 nenhuma função DEFINER nova executável por authenticated fora da lista aprovada', '(nenhuma)',
  coalesce((select string_agg(distinct p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute')
      and p.proname not like 'console\_%' and p.proname not in (select nome from aprovadas)), '(nenhuma)'));

-- C
create function pg_temp.chamar_como(p_papel text, p_pessoa uuid, p_sql text) returns text language plpgsql as $f$
declare estado text;
begin
  perform set_config('request.jwt.claims', case when p_pessoa is null then '' else json_build_object('sub', p_pessoa, 'role', p_papel)::text end, true);
  execute format('set local role %I', p_papel);
  begin
    execute p_sql;
    execute 'reset role';
    return 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
    execute 'reset role';
    return estado;
  end;
end $f$;

create function pg_temp.valor_como(p_pessoa uuid, p_sql text) returns text language plpgsql as $f$
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
  pessoa uuid := 'c3c3c3c3-0000-4000-8000-0000000e0001';
  f record;
  chamada text;
  total integer := 0;
  aceitas text := '';
  anon_aceitas text := '';
begin
  insert into auth.users (id, email, aud, role) values (pessoa, 'prova-console-nao-equipe@local.test', 'authenticated', 'authenticated');
  insert into public.profiles (id, email, full_name) values (pessoa, 'prova-console-nao-equipe@local.test', 'Nao equipe');

  perform pg_temp.registrar('C0 a pessoa de teste não é da equipe', 'false', pg_temp.valor_como(pessoa, 'select public.sou_da_equipe_brennimark()::text'));

  for f in
    select p.oid, p.proname, p.pronargs from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef and p.proname like 'console\_%' order by p.proname
  loop
    total := total + 1;
    chamada := format('select public.%I(%s)', f.proname, coalesce((select string_agg('null', ',') from generate_series(1, f.pronargs)), ''));
    if pg_temp.chamar_como('authenticated', pessoa, chamada) is distinct from '42501' then
      aceitas := aceitas || f.proname || ' ';
    end if;
    if pg_temp.chamar_como('anon', null, chamada) is distinct from '42501' then
      anon_aceitas := anon_aceitas || f.proname || ' ';
    end if;
  end loop;

  perform pg_temp.registrar('C1 toda console_* recusa (42501) quem não é da equipe', '(nenhuma)', coalesce(nullif(btrim(aceitas), ''), '(nenhuma)'));
  perform pg_temp.registrar('C2 anon não executa nenhuma console_* (42501)', '(nenhuma)', coalesce(nullif(btrim(anon_aceitas), ''), '(nenhuma)'));
  perform pg_temp.registrar('C3 a prova achou console_* para testar (>= 25)', 'true', (total >= 25)::text);
  raise notice 'console_* provadas: %', total;
end $$;

select case when passou then 'ok   ' else 'FALHA' end as st, caso, esperado, obtido from resultado order by ordem;
select case when count(*) filter (where not passou) = 0 then 'PROVA COMPLETA: ' || count(*) || ' verificacoes, todas verdes'
            else 'PROVA FALHOU: ' || count(*) filter (where not passou) || ' de ' || count(*) end as veredito from resultado;
do $$ declare n integer; begin select count(*) filter (where not passou) into n from resultado;
  if n > 0 then raise exception 'PROVA FALHOU: % verificacao(oes)', n using errcode = 'P0001'; end if; end $$;
rollback;
