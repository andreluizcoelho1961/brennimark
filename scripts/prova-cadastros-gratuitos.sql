-- Prova dos cadastros gratuitos — 17/10/2026.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE e NOME da constraint
-- conferidos onde há recusa, e `rollback` no fim. Quatro perguntas:
--   1. Ninguém pela sessão — o visitante, nem quem está logado — lê, grava,
--      altera, apaga ou chama as funções; a lista tem e-mail de terceiros.
--   2. As constraints barram e-mail fora da forma ou em maiúsculas, nome vazio,
--      cargo e origem fora do vocabulário, respostas fora do formato e aceite
--      de marketing sem versão e data.
--   3. Voltar a se cadastrar atualiza a MESMA linha, e a caixa de marketing
--      desmarcada nunca retira um aceite já dado; marcada, renova e desfaz o
--      descadastro.
--   4. O link do e-mail: descadastrar e apagar, só pelo servidor, só com o token.

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

create function pg_temp.valor_do_servidor(p_sql text) returns text
language plpgsql as $f$
declare v text;
begin
  execute 'set local role service_role';
  execute p_sql into v;
  execute 'reset role';
  return v;
end $f$;

do $$
declare
  a uuid := 'a0a0a0a0-0000-4000-8000-00000000ca01';
  tok uuid;
  reg text := 'select public.registrar_cadastro(%L, %L, %L, %L, %L::jsonb, %L, %L, %L)';
begin
  insert into auth.users (id, email, aud, role) values
    (a, 'prova-cadastro-a@local.test', 'authenticated', 'authenticated');

  -- 0. O servidor grava, pela função.
  perform pg_temp.registrar('o servidor registra um cadastro', 'ACEITOU',
    pg_temp.papel('service_role', format(reg, 'ana@agencia.test', 'Ana', 'Estúdio Z', 'designer', '{"equipe":"2-5"}', 'kit', false, null)));

  -- 1. Ninguém pela sessão.
  perform pg_temp.registrar('o visitante nao le a lista', '42501', pg_temp.papel('anon', 'select * from public.cadastros_gratuitos'));
  perform pg_temp.registrar('o visitante nao grava na lista', '42501',
    pg_temp.papel('anon', $s$insert into public.cadastros_gratuitos (email, nome, primeira_origem, ultima_origem) values ('x@y.test', 'X', 'kit', 'kit')$s$));
  perform pg_temp.registrar('quem esta logado NAO le a lista', '42501', pg_temp.como(a, 'select * from public.cadastros_gratuitos'));
  perform pg_temp.registrar('quem esta logado NAO grava na lista', '42501',
    pg_temp.como(a, $s$insert into public.cadastros_gratuitos (email, nome, primeira_origem, ultima_origem) values ('x@y.test', 'X', 'kit', 'kit')$s$));
  perform pg_temp.registrar('quem esta logado NAO altera a lista', '42501', pg_temp.como(a, $s$update public.cadastros_gratuitos set nome = 'Z'$s$));
  perform pg_temp.registrar('quem esta logado NAO apaga da lista', '42501', pg_temp.como(a, 'delete from public.cadastros_gratuitos'));
  perform pg_temp.registrar('o visitante NAO chama registrar_cadastro', '42501',
    pg_temp.papel('anon', format(reg, 'forjado@x.test', 'Forjado', null, null, '{}', 'kit', true, '2026-10-17')));
  perform pg_temp.registrar('quem esta logado NAO chama registrar_cadastro', '42501',
    pg_temp.como(a, format(reg, 'forjado@x.test', 'Forjado', null, null, '{}', 'kit', true, '2026-10-17')));
  perform pg_temp.registrar('quem esta logado NAO chama descadastrar_cadastro', '42501',
    pg_temp.como(a, 'select public.descadastrar_cadastro(gen_random_uuid())'));
  perform pg_temp.registrar('o visitante NAO chama apagar_cadastro', '42501',
    pg_temp.papel('anon', 'select public.apagar_cadastro(gen_random_uuid())'));
  perform pg_temp.registrar('o servidor le a lista', 'ACEITOU', pg_temp.papel('service_role', 'select * from public.cadastros_gratuitos'));
  perform pg_temp.registrar('nada vazou: o cadastro forjado nao existe', '0',
    (select count(*)::text from public.cadastros_gratuitos where email = 'forjado@x.test'));

  -- 2. As constraints (como superusuario, para chegar nelas).
  perform pg_temp.registrar('e-mail em maiusculas e barrado', '23514 cadastros_email_em_minusculas',
    pg_temp.direto($s$insert into public.cadastros_gratuitos (email, nome, primeira_origem, ultima_origem) values ('Bia@Agencia.test', 'Bia', 'kit', 'kit')$s$));
  perform pg_temp.registrar('e-mail sem arroba e barrado', '23514 cadastros_email_valido',
    pg_temp.direto($s$insert into public.cadastros_gratuitos (email, nome, primeira_origem, ultima_origem) values ('bia.agencia.test', 'Bia', 'kit', 'kit')$s$));
  perform pg_temp.registrar('nome vazio e barrado', '23514 cadastros_nome_valido',
    pg_temp.direto($s$insert into public.cadastros_gratuitos (email, nome, primeira_origem, ultima_origem) values ('c@agencia.test', '   ', 'kit', 'kit')$s$));
  perform pg_temp.registrar('cargo fora do vocabulario e barrado', '23514 cadastros_cargo_valido',
    pg_temp.direto($s$insert into public.cadastros_gratuitos (email, nome, cargo, primeira_origem, ultima_origem) values ('d@agencia.test', 'D', 'ceo', 'kit', 'kit')$s$));
  perform pg_temp.registrar('origem fora do vocabulario e barrada', '23514 cadastros_origem_valida',
    pg_temp.direto($s$insert into public.cadastros_gratuitos (email, nome, primeira_origem, ultima_origem) values ('e@agencia.test', 'E', 'mockups', 'kit')$s$));
  perform pg_temp.registrar('respostas que nao sao objeto sao barradas', '23514 cadastros_respostas_valida',
    pg_temp.direto($s$insert into public.cadastros_gratuitos (email, nome, respostas, primeira_origem, ultima_origem) values ('f@agencia.test', 'F', '[1,2]'::jsonb, 'kit', 'kit')$s$));
  perform pg_temp.registrar('respostas gigantes sao barradas', '23514 cadastros_respostas_valida',
    pg_temp.direto(format($s$insert into public.cadastros_gratuitos (email, nome, respostas, primeira_origem, ultima_origem) values ('g@agencia.test', 'G', %L::jsonb, 'kit', 'kit')$s$, json_build_object('x', repeat('a', 2500))::text)));
  perform pg_temp.registrar('aceite de marketing sem versao e data e barrado', '23514 cadastros_aceite_com_prova',
    pg_temp.direto($s$insert into public.cadastros_gratuitos (email, nome, primeira_origem, ultima_origem, aceite_marketing) values ('h@agencia.test', 'H', 'kit', 'kit', true)$s$));
  perform pg_temp.registrar('versao do aceite fora do formato de data e barrada', '23514 cadastros_aceite_versao_em_data',
    pg_temp.direto($s$insert into public.cadastros_gratuitos (email, nome, primeira_origem, ultima_origem, aceite_marketing, aceite_versao, aceite_em) values ('i@agencia.test', 'I', 'kit', 'kit', true, 'v1', now())$s$));
  perform pg_temp.registrar('e-mail repetido e barrado', '23505 cadastros_email_unico',
    pg_temp.direto($s$insert into public.cadastros_gratuitos (email, nome, primeira_origem, ultima_origem) values ('ana@agencia.test', 'Outra Ana', 'kit', 'kit')$s$));
  perform pg_temp.registrar('a funcao tambem recusa origem fora do vocabulario', '23514',
    split_part(pg_temp.papel('service_role', format(reg, 'j@agencia.test', 'J', null, null, '{}', 'mockups', false, null)), ' ', 1));

  -- 3. Voltar a se cadastrar: a mesma linha.
  perform pg_temp.papel('service_role', format(reg, 'ana@agencia.test', 'Ana Souza', null, null, '{"marcas":"6-15"}', 'grids', false, null));
  perform pg_temp.registrar('voltar a se cadastrar nao cria outra linha', '1',
    (select count(*)::text from public.cadastros_gratuitos where email = 'ana@agencia.test'));
  perform pg_temp.registrar('os usos contam', '2', (select usos::text from public.cadastros_gratuitos where email = 'ana@agencia.test'));
  perform pg_temp.registrar('a ultima origem acompanha, a primeira fica', 'grids/kit',
    (select ultima_origem || '/' || primeira_origem from public.cadastros_gratuitos where email = 'ana@agencia.test'));
  perform pg_temp.registrar('agencia e cargo ja informados nao somem se a volta vem sem eles', 'Estúdio Z/designer',
    (select agencia || '/' || cargo from public.cadastros_gratuitos where email = 'ana@agencia.test'));
  perform pg_temp.registrar('as respostas se somam, sem perder as antigas', '2-5/6-15',
    (select (respostas->>'equipe') || '/' || (respostas->>'marcas') from public.cadastros_gratuitos where email = 'ana@agencia.test'));
  perform pg_temp.registrar('sem a caixa marcada, nao ha aceite', 'false',
    (select aceite_marketing::text from public.cadastros_gratuitos where email = 'ana@agencia.test'));

  -- Consentimento.
  perform pg_temp.papel('service_role', format(reg, 'ana@agencia.test', 'Ana Souza', null, null, '{}', 'cores', true, '2026-10-17'));
  perform pg_temp.registrar('marcar a caixa registra o aceite com versao e data', 'true/2026-10-17/true',
    (select aceite_marketing::text || '/' || aceite_versao || '/' || (aceite_em is not null)::text from public.cadastros_gratuitos where email = 'ana@agencia.test'));
  perform pg_temp.papel('service_role', format(reg, 'ana@agencia.test', 'Ana Souza', null, null, '{}', 'kit', false, null));
  perform pg_temp.registrar('voltar com a caixa desmarcada NAO retira o aceite dado', 'true/2026-10-17',
    (select aceite_marketing::text || '/' || aceite_versao from public.cadastros_gratuitos where email = 'ana@agencia.test'));

  -- 4. O link do e-mail.
  select token_de_saida into tok from public.cadastros_gratuitos where email = 'ana@agencia.test';
  perform pg_temp.registrar('descadastrar por token inexistente nao acha ninguem', 'false',
    pg_temp.valor_do_servidor('select public.descadastrar_cadastro(gen_random_uuid())'));
  perform pg_temp.registrar('descadastrar pelo token acha a pessoa', 'true',
    pg_temp.valor_do_servidor(format('select public.descadastrar_cadastro(%L)', tok)));
  perform pg_temp.registrar('descadastrada: sem aceite e com a data da saida', 'false/true',
    (select aceite_marketing::text || '/' || (descadastrado_em is not null)::text from public.cadastros_gratuitos where email = 'ana@agencia.test'));
  perform pg_temp.papel('service_role', format(reg, 'ana@agencia.test', 'Ana Souza', null, null, '{}', 'kit', false, null));
  perform pg_temp.registrar('voltar sem a caixa NAO reinscreve quem saiu', 'false/true',
    (select aceite_marketing::text || '/' || (descadastrado_em is not null)::text from public.cadastros_gratuitos where email = 'ana@agencia.test'));
  perform pg_temp.papel('service_role', format(reg, 'ana@agencia.test', 'Ana Souza', null, null, '{}', 'grids', true, '2026-10-20'));
  perform pg_temp.registrar('voltar COM a caixa renova o aceite e desfaz a saida', 'true/2026-10-20/false',
    (select aceite_marketing::text || '/' || aceite_versao || '/' || (descadastrado_em is not null)::text from public.cadastros_gratuitos where email = 'ana@agencia.test'));
  perform pg_temp.registrar('apagar por token inexistente nao apaga nada', 'false',
    pg_temp.valor_do_servidor('select public.apagar_cadastro(gen_random_uuid())'));
  perform pg_temp.registrar('apagar pelo token acha a pessoa', 'true',
    pg_temp.valor_do_servidor(format('select public.apagar_cadastro(%L)', tok)));
  perform pg_temp.registrar('apagada: a linha inteira saiu', '0',
    (select count(*)::text from public.cadastros_gratuitos where email = 'ana@agencia.test'));
end $$;

select ordem, caso, esperado, obtido, case when passou then 'ok' else 'FALHOU' end as resultado from resultado order by ordem;

do $$
begin
  if exists (select 1 from resultado where not passou) then
    raise exception 'PROVA FALHOU: % caso(s)', (select count(*) from resultado where not passou);
  end if;
  raise notice 'PROVA OK: % casos', (select count(*) from resultado);
end $$;

rollback;
