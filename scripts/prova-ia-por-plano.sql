-- Prova da IA por plano (ADR-0009) — 07/11/2026.
--
-- Mundo próprio, SQLSTATE e NOME da constraint (ou a dica, `hint`), e
-- `rollback` no fim. Como PESSOA COMUM (papel `authenticated` com JWT), não
-- como superusuário: política que só funciona para superusuário passa
-- despercebida. Perguntas:
--   1. O modo da conta vem do plano; só a dona e o servidor o veem; conta sem
--      assinatura fica na plataforma; o `anon` não chama.
--   2. O termo: só a dona aceita, e só em conta de plano com IA própria.
--   3. Guardar chave: só a dona; só no modo `propria`; só depois do termo;
--      encaixe, provedor e cifra inválidos são barrados pelo NOME da constraint;
--      guardar duas vezes SUBSTITUI (um por encaixe).
--   4. Ninguém de navegador lê a tabela nem o texto cifrado; a lista da tela
--      não tem o campo cifrado; só o servidor recebe o cifrado, e só em conta
--      de IA própria. A conta A não vê nem usa a chave da C.
--   5. Apagar: só a dona; encaixe vazio avisa.
--   6. O registro: só a dona lê o da própria conta; ninguém edita nem apaga;
--      as formas inválidas são barradas pelo nome.
--   7. Trocar de plano `propria` -> `plataforma` apaga as chaves e registra;
--      `propria` -> `propria` mantém.
--   8. A conta sair leva as chaves e o registro.
--   9. O interruptor do Vini: só a dona liga e desliga; a pessoa precisa ter
--      acesso à conta (membro ou concedida a uma marca); a pessoa vê a própria
--      linha e a dona vê todas, mas a dona de outra conta não vê nada; vale
--      também em conta do modo plataforma.

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
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
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

-- Um papel de banco sem pessoa (a chave de serviço, o visitante).
create function pg_temp.papel(p_papel text, p_sql text) returns text
language plpgsql as $f$
declare estado text; n integer;
begin
  begin
    perform set_config('request.jwt.claims', '', true);
    execute format('set local role %I', p_papel);
    execute p_sql;
    get diagnostics n = row_count;
    execute 'reset role';
    return 'ACEITOU ' || n;
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
    execute 'reset role';
    return estado;
  end;
end $f$;

create function pg_temp.valor_do_papel(p_papel text, p_sql text) returns text
language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', '', true);
  execute format('set local role %I', p_papel);
  execute p_sql into v;
  execute 'reset role';
  return v;
end $f$;

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void
language sql as $f$
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, p_obtido, p_esperado is not distinct from p_obtido);
$f$;

-- Erro como a pessoa: SQLSTATE e a dica (`hint`) ou o nome da constraint.
create function pg_temp.dica(p_quem uuid, p_sql text) returns text
language plpgsql as $f$
declare estado text; d text; nome text;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute p_sql;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    return 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, d = pg_exception_hint, nome = constraint_name;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    return estado || ' ' || coalesce(nullif(d, ''), nome, '');
  end;
end $f$;

-- Erro como o dono do banco (as constraints e o gatilho do registro).
create function pg_temp.erro(p_sql text) returns text
language plpgsql as $f$
declare estado text; d text; nome text;
begin
  begin
    execute p_sql;
    return 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, d = pg_exception_hint, nome = constraint_name;
    return estado || ' ' || coalesce(nullif(d, ''), nome, '');
  end;
end $f$;

do $$
declare
  dona_a uuid := 'a0a0a0a0-0000-4000-8000-0000000f0001';
  membro_a uuid := 'a0a0a0a0-0000-4000-8000-0000000f0002';
  convidada_a uuid := 'a0a0a0a0-0000-4000-8000-0000000f0003';
  dona_b uuid := 'b0b0b0b0-0000-4000-8000-0000000f0004';
  dona_c uuid := 'c0c0c0c0-0000-4000-8000-0000000f0005';
  dona_d uuid := 'd0d0d0d0-0000-4000-8000-0000000f0006';
  a uuid; b uuid; c uuid; d uuid; marca_a uuid;
  cif text := 'ZmFrZS1jaXBoZXJ0ZXh0';   -- texto cifrado de mentira, só para a prova
  iv text := 'ZmFrZS1pdg==';
begin
  insert into public.workspaces (name) values ('Prova IA A (propria)') returning id into a;
  insert into public.workspaces (name) values ('Prova IA B (plataforma)') returning id into b;
  insert into public.workspaces (name) values ('Prova IA C (propria)') returning id into c;
  insert into public.workspaces (name) values ('Prova IA D (sem assinatura)') returning id into d;
  insert into auth.users (id, email, aud, role) values
    (dona_a, 'prova-ia-dona-a@local.test', 'authenticated', 'authenticated'),
    (membro_a, 'prova-ia-membro-a@local.test', 'authenticated', 'authenticated'),
    (convidada_a, 'prova-ia-convidada-a@local.test', 'authenticated', 'authenticated'),
    (dona_b, 'prova-ia-dona-b@local.test', 'authenticated', 'authenticated'),
    (dona_c, 'prova-ia-dona-c@local.test', 'authenticated', 'authenticated'),
    (dona_d, 'prova-ia-dona-d@local.test', 'authenticated', 'authenticated');
  insert into public.workspace_members (workspace_id, user_id, role) values
    (a, dona_a, 'owner'), (a, membro_a, 'member'), (b, dona_b, 'owner'), (c, dona_c, 'owner'), (d, dona_d, 'owner');

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (a, 'prova-ia-a', 'Marca A', 'A', 'a', 'pt-BR', '{}', '{}', '{}', '{}', '{}') returning id into marca_a;
  -- A convidada não é da conta A: só tem uma concessão à marca A.
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades)
  values (marca_a, a, convidada_a, array['consultar']);

  -- Dois planos de IA própria e o Básico (plataforma).
  insert into public.planos (codigo, nome, maximo_de_marcas, teto_mensal_do_vini_micros, a_venda, ordem, modo_de_ia) values
    ('prova-propria', 'Prova própria', 5, 0, false, 90, 'propria'),
    ('prova-propria-2', 'Prova própria 2', 5, 0, false, 91, 'propria');

  insert into public.assinaturas (workspace_id, plano, provedor, id_externo_cliente, id_externo_assinatura, situacao, titular_email)
  values (a, 'prova-propria', 'stripe', 'cus_iap_a', 'sub_iap_a', 'ativa', 'prova-ia-dona-a@local.test'),
         (b, 'basico', 'stripe', 'cus_iap_b', 'sub_iap_b', 'ativa', 'prova-ia-dona-b@local.test'),
         (c, 'prova-propria', 'stripe', 'cus_iap_c', 'sub_iap_c', 'ativa', 'prova-ia-dona-c@local.test');

  -- ─── 1. O modo ────────────────────────────────────────────────────────
  perform pg_temp.registrar('a coluna so aceita plataforma|propria', '23514 planos_modo_de_ia_valido',
    pg_temp.erro($s$insert into public.planos (codigo, nome, teto_mensal_do_vini_micros, modo_de_ia) values ('prova-x', 'X', 0, 'qualquer')$s$));
  perform pg_temp.registrar('a dona de A le o modo da propria conta', 'propria',
    pg_temp.valor(dona_a, format('select public.modo_de_ia_da_conta(%L)', a)));
  perform pg_temp.registrar('o membro de A NAO le o modo (nada)', '',
    coalesce(pg_temp.valor(membro_a, format('select public.modo_de_ia_da_conta(%L)', a)), ''));
  perform pg_temp.registrar('a dona de B NAO le o modo de A (nada)', '',
    coalesce(pg_temp.valor(dona_b, format('select public.modo_de_ia_da_conta(%L)', a)), ''));
  perform pg_temp.registrar('o servidor le A: propria', 'propria',
    pg_temp.valor_do_papel('service_role', format('select public.modo_de_ia_da_conta(%L)', a)));
  perform pg_temp.registrar('o servidor le B: plataforma', 'plataforma',
    pg_temp.valor_do_papel('service_role', format('select public.modo_de_ia_da_conta(%L)', b)));
  perform pg_temp.registrar('conta sem assinatura: plataforma', 'plataforma',
    pg_temp.valor_do_papel('service_role', format('select public.modo_de_ia_da_conta(%L)', d)));
  perform pg_temp.registrar('o visitante (anon) NAO chama o modo', '42501',
    pg_temp.papel('anon', format('select public.modo_de_ia_da_conta(%L)', a)));
  perform pg_temp.registrar('o navegador le o modo do plano publico', 'ACEITOU 1',
    pg_temp.como(dona_b, $s$select modo_de_ia from public.planos where codigo = 'basico'$s$));
  perform pg_temp.registrar('so a equipe troca o modo do plano', '42501',
    pg_temp.como(dona_a, $s$select public.console_definir_modo_de_ia_do_plano('basico', 'propria', 'tentativa')$s$));

  -- ─── 2. O termo ───────────────────────────────────────────────────────
  perform pg_temp.registrar('o membro de A NAO aceita o termo', '42501 ia_so_a_dona',
    pg_temp.dica(membro_a, format($s$select public.aceitar_termo_de_ia_propria(%L, '2026-11-07')$s$, a)));
  perform pg_temp.registrar('a dona de B NAO aceita o termo de A', '42501 ia_so_a_dona',
    pg_temp.dica(dona_b, format($s$select public.aceitar_termo_de_ia_propria(%L, '2026-11-07')$s$, a)));
  perform pg_temp.registrar('conta no modo plataforma NAO aceita termo de IA propria', 'P0001 ia_conta_no_modo_da_plataforma',
    pg_temp.dica(dona_b, format($s$select public.aceitar_termo_de_ia_propria(%L, '2026-11-07')$s$, b)));
  perform pg_temp.registrar('o visitante (anon) NAO aceita termo', '42501',
    pg_temp.papel('anon', format($s$select public.aceitar_termo_de_ia_propria(%L, '2026-11-07')$s$, a)));

  -- ─── 3. Guardar chave ─────────────────────────────────────────────────
  perform pg_temp.registrar('sem o termo aceito, a dona de C NAO guarda', 'P0001 ia_sem_termo_aceito',
    pg_temp.dica(dona_c, format($s$select public.guardar_chave_de_ia(%L, 'texto', 'openai', 'gpt-x', %L, %L, '1234', 1::smallint)$s$, c, cif, iv)));
  perform pg_temp.registrar('a dona de A aceita o termo', 'ACEITOU 1',
    pg_temp.como(dona_a, format($s$select public.aceitar_termo_de_ia_propria(%L, '2026-11-07')$s$, a)));
  perform pg_temp.registrar('a dona de C aceita o termo', 'ACEITOU 1',
    pg_temp.como(dona_c, format($s$select public.aceitar_termo_de_ia_propria(%L, '2026-11-07')$s$, c)));
  perform pg_temp.registrar('o membro de A NAO guarda chave', '42501 ia_so_a_dona',
    pg_temp.dica(membro_a, format($s$select public.guardar_chave_de_ia(%L, 'texto', 'openai', 'gpt-x', %L, %L, '1234', 1::smallint)$s$, a, cif, iv)));
  perform pg_temp.registrar('a dona de B NAO guarda chave na conta A', '42501 ia_so_a_dona',
    pg_temp.dica(dona_b, format($s$select public.guardar_chave_de_ia(%L, 'texto', 'openai', 'gpt-x', %L, %L, '1234', 1::smallint)$s$, a, cif, iv)));
  perform pg_temp.registrar('a dona de B NAO guarda chave na PROPRIA conta (plataforma)', 'P0001 ia_conta_no_modo_da_plataforma',
    pg_temp.dica(dona_b, format($s$select public.guardar_chave_de_ia(%L, 'texto', 'openai', 'gpt-x', %L, %L, '1234', 1::smallint)$s$, b, cif, iv)));
  perform pg_temp.registrar('o visitante (anon) NAO guarda chave', '42501',
    pg_temp.papel('anon', format($s$select public.guardar_chave_de_ia(%L, 'texto', 'openai', 'gpt-x', %L, %L, '1234', 1::smallint)$s$, a, cif, iv)));
  perform pg_temp.registrar('encaixe invalido e barrado pelo nome', '23514 chaves_de_ia_encaixe_valido',
    pg_temp.dica(dona_a, format($s$select public.guardar_chave_de_ia(%L, 'outro', 'openai', 'gpt-x', %L, %L, '1234', 1::smallint)$s$, a, cif, iv)));
  perform pg_temp.registrar('provedor invalido e barrado pelo nome', '23514 chaves_de_ia_provedor_valido',
    pg_temp.dica(dona_a, format($s$select public.guardar_chave_de_ia(%L, 'texto', 'ollama', 'gpt-x', %L, %L, '1234', 1::smallint)$s$, a, cif, iv)));
  perform pg_temp.registrar('cifra vazia e barrada pelo nome', '23514 chaves_de_ia_cifra_valida',
    pg_temp.dica(dona_a, format($s$select public.guardar_chave_de_ia(%L, 'texto', 'openai', 'gpt-x', '', %L, '1234', 1::smallint)$s$, a, iv)));
  perform pg_temp.registrar('modelo vazio e barrado pelo nome', '23514 chaves_de_ia_modelo_valido',
    pg_temp.dica(dona_a, format($s$select public.guardar_chave_de_ia(%L, 'texto', 'openai', '   ', %L, %L, '1234', 1::smallint)$s$, a, cif, iv)));
  perform pg_temp.registrar('a dona de A guarda o encaixe de texto', 'ACEITOU 1',
    pg_temp.como(dona_a, format($s$select public.guardar_chave_de_ia(%L, 'texto', 'anthropic', 'claude-x', %L, %L, '1111', 1::smallint)$s$, a, cif, iv)));
  perform pg_temp.registrar('a dona de A guarda o encaixe de imagem', 'ACEITOU 1',
    pg_temp.como(dona_a, format($s$select public.guardar_chave_de_ia(%L, 'imagem', 'google', 'gemini-x', %L, %L, '2222', 1::smallint)$s$, a, cif, iv)));
  perform pg_temp.registrar('a dona de A guarda o encaixe de reserva', 'ACEITOU 1',
    pg_temp.como(dona_a, format($s$select public.guardar_chave_de_ia(%L, 'reserva', 'openai', 'gpt-x', %L, %L, '3333', 1::smallint)$s$, a, cif, iv)));
  perform pg_temp.registrar('a dona de C guarda uma chave de texto', 'ACEITOU 1',
    pg_temp.como(dona_c, format($s$select public.guardar_chave_de_ia(%L, 'texto', 'openai', 'gpt-c', %L, %L, '9999', 1::smallint)$s$, c, cif, iv)));
  -- Substituir: mesma conta e encaixe, chave nova.
  perform pg_temp.registrar('guardar de novo o texto SUBSTITUI (continua 3 linhas)', 'ACEITOU 1',
    pg_temp.como(dona_a, format($s$select public.guardar_chave_de_ia(%L, 'texto', 'anthropic', 'claude-novo', %L, %L, '4444', 2::smallint)$s$, a, cif, iv)));
  perform pg_temp.registrar('A tem 3 linhas, uma por encaixe', '3',
    (select count(*)::text from public.chaves_de_ia_da_conta where workspace_id = a));
  perform pg_temp.registrar('a substituta guardou o novo modelo e o novo final', 'claude-novo 4444 2',
    (select modelo || ' ' || chave_final || ' ' || versao_da_chave_mestra from public.chaves_de_ia_da_conta where workspace_id = a and encaixe = 'texto'));
  perform pg_temp.registrar('dois no mesmo encaixe e barrado pelo nome (fora da funcao)', '23505 chaves_de_ia_um_por_encaixe',
    pg_temp.erro(format($s$insert into public.chaves_de_ia_da_conta (workspace_id, encaixe, provedor, modelo, chave_cifrada, chave_iv, chave_final) values (%L, 'texto', 'openai', 'x', 'c', 'i', '1')$s$, a)));

  -- ─── 4. Ninguém de navegador lê o cifrado ─────────────────────────────
  perform pg_temp.registrar('a dona de A NAO le a tabela direto', '42501',
    pg_temp.como(dona_a, 'select * from public.chaves_de_ia_da_conta'));
  perform pg_temp.registrar('a dona de A NAO le nem a coluna cifrada', '42501',
    pg_temp.como(dona_a, 'select chave_cifrada from public.chaves_de_ia_da_conta'));
  perform pg_temp.registrar('o membro de A NAO le a tabela', '42501',
    pg_temp.como(membro_a, 'select * from public.chaves_de_ia_da_conta'));
  perform pg_temp.registrar('o visitante NAO le a tabela', '42501',
    pg_temp.papel('anon', 'select * from public.chaves_de_ia_da_conta'));
  perform pg_temp.registrar('nem o servidor le a tabela direto (so pela funcao)', '42501',
    pg_temp.papel('service_role', 'select * from public.chaves_de_ia_da_conta'));
  perform pg_temp.registrar('ninguem de navegador grava na tabela', '42501',
    pg_temp.como(dona_a, format($s$insert into public.chaves_de_ia_da_conta (workspace_id, encaixe, provedor, modelo, chave_cifrada, chave_iv, chave_final) values (%L, 'texto', 'openai', 'x', 'c', 'i', '1')$s$, a)));
  perform pg_temp.registrar('a lista da tela NAO tem o campo cifrado', 'false',
    (select (pg_get_function_result('public.listar_chaves_de_ia(uuid)'::regprocedure) ~ 'cifrad|chave_iv')::text));
  perform pg_temp.registrar('a dona de A lista 3 encaixes', '3',
    pg_temp.valor(dona_a, format('select count(*) from public.listar_chaves_de_ia(%L)', a)));
  perform pg_temp.registrar('a lista traz so o final da chave', '4444',
    pg_temp.valor(dona_a, format($s$select chave_final from public.listar_chaves_de_ia(%L) where encaixe = 'texto'$s$, a)));
  perform pg_temp.registrar('o membro de A NAO lista as chaves', '42501',
    pg_temp.como(membro_a, format('select * from public.listar_chaves_de_ia(%L)', a)));
  perform pg_temp.registrar('a dona de A NAO lista as chaves de C', '42501',
    pg_temp.como(dona_a, format('select * from public.listar_chaves_de_ia(%L)', c)));
  perform pg_temp.registrar('a dona de C lista so a sua (1)', '1',
    pg_temp.valor(dona_c, format('select count(*) from public.listar_chaves_de_ia(%L)', c)));
  perform pg_temp.registrar('a dona de A NAO recebe o cifrado para uso', '42501',
    pg_temp.como(dona_a, format($s$select * from public.chave_de_ia_para_uso(%L, 'texto')$s$, a)));
  perform pg_temp.registrar('o visitante NAO recebe o cifrado para uso', '42501',
    pg_temp.papel('anon', format($s$select * from public.chave_de_ia_para_uso(%L, 'texto')$s$, a)));
  perform pg_temp.registrar('o servidor recebe o cifrado do texto de A', '1',
    pg_temp.valor_do_papel('service_role', format($s$select count(*) from public.chave_de_ia_para_uso(%L, 'texto')$s$, a)));
  perform pg_temp.registrar('o servidor recebe a chave certa da conta A (modelo novo)', 'claude-novo',
    pg_temp.valor_do_papel('service_role', format($s$select modelo from public.chave_de_ia_para_uso(%L, 'texto')$s$, a)));
  perform pg_temp.registrar('o servidor recebe a chave de C, nao a de A, ao pedir C', 'gpt-c',
    pg_temp.valor_do_papel('service_role', format($s$select modelo from public.chave_de_ia_para_uso(%L, 'texto')$s$, c)));
  perform pg_temp.registrar('encaixe vazio: o servidor nao recebe nada', '0',
    pg_temp.valor_do_papel('service_role', format($s$select count(*) from public.chave_de_ia_para_uso(%L, 'reserva')$s$, c)));
  -- Defesa em profundidade: chave que sobrou numa conta do modo plataforma.
  insert into public.chaves_de_ia_da_conta (workspace_id, encaixe, provedor, modelo, chave_cifrada, chave_iv, chave_final)
  values (b, 'texto', 'openai', 'sobrou', 'c', 'i', '0000');
  perform pg_temp.registrar('conta da plataforma NUNCA recebe chave, mesmo se sobrou uma', '0',
    pg_temp.valor_do_papel('service_role', format($s$select count(*) from public.chave_de_ia_para_uso(%L, 'texto')$s$, b)));
  delete from public.chaves_de_ia_da_conta where workspace_id = b;
  perform pg_temp.registrar('so o servidor anota o teste de conexao', '42501',
    pg_temp.como(dona_a, format($s$select public.registrar_teste_de_chave_de_ia(%L, 'texto', true)$s$, a)));
  perform pg_temp.registrar('o servidor anota o teste de conexao', 'ACEITOU 1',
    pg_temp.papel('service_role', format($s$select public.registrar_teste_de_chave_de_ia(%L, 'texto', true)$s$, a)));
  perform pg_temp.registrar('o teste anotado aparece na lista da dona', 'true',
    pg_temp.valor(dona_a, format($s$select teste_ok from public.listar_chaves_de_ia(%L) where encaixe = 'texto'$s$, a)));

  -- ─── 5. Apagar ────────────────────────────────────────────────────────
  perform pg_temp.registrar('o membro de A NAO apaga chave', '42501 ia_so_a_dona',
    pg_temp.dica(membro_a, format($s$select public.apagar_chave_de_ia(%L, 'reserva')$s$, a)));
  perform pg_temp.registrar('a dona de B NAO apaga chave de A', '42501 ia_so_a_dona',
    pg_temp.dica(dona_b, format($s$select public.apagar_chave_de_ia(%L, 'reserva')$s$, a)));
  perform pg_temp.registrar('a dona de A apaga a reserva', 'ACEITOU 1',
    pg_temp.como(dona_a, format($s$select public.apagar_chave_de_ia(%L, 'reserva')$s$, a)));
  perform pg_temp.registrar('apagar encaixe vazio avisa', 'P0002 ia_encaixe_vazio',
    pg_temp.dica(dona_a, format($s$select public.apagar_chave_de_ia(%L, 'reserva')$s$, a)));
  perform pg_temp.registrar('A fica com 2 linhas', '2',
    (select count(*)::text from public.chaves_de_ia_da_conta where workspace_id = a));
  perform pg_temp.registrar('a chave de C segue la', '1',
    (select count(*)::text from public.chaves_de_ia_da_conta where workspace_id = c));

  -- ─── 6. O registro ────────────────────────────────────────────────────
  perform pg_temp.registrar('registro de A: termo 1, cadastros 3, substituicao 1, apagar 1', '1 3 1 1',
    (select count(*) filter (where acao = 'aceitar-termo') || ' ' || count(*) filter (where acao = 'cadastrar') || ' '
         || count(*) filter (where acao = 'substituir') || ' ' || count(*) filter (where acao = 'apagar')
       from public.registros_da_ia_propria where workspace_id = a));
  perform pg_temp.registrar('o registro nunca guarda a chave (so o final)', '0',
    (select count(*)::text from public.registros_da_ia_propria r where r.chave_final is not null and char_length(r.chave_final) > 8));
  perform pg_temp.registrar('a dona de A le o registro da conta (6 linhas)', '6',
    pg_temp.valor(dona_a, format('select count(*) from public.registros_da_ia_propria where workspace_id = %L', a)));
  perform pg_temp.registrar('a dona de A NAO enxerga o registro de C', '0',
    pg_temp.valor(dona_a, format('select count(*) from public.registros_da_ia_propria where workspace_id = %L', c)));
  perform pg_temp.registrar('o membro de A NAO le o registro', '0',
    pg_temp.valor(membro_a, format('select count(*) from public.registros_da_ia_propria where workspace_id = %L', a)));
  perform pg_temp.registrar('a dona de B NAO le o registro de A', '0',
    pg_temp.valor(dona_b, format('select count(*) from public.registros_da_ia_propria where workspace_id = %L', a)));
  perform pg_temp.registrar('o visitante NAO le o registro', '42501',
    pg_temp.papel('anon', 'select * from public.registros_da_ia_propria'));
  perform pg_temp.registrar('ninguem de navegador escreve no registro', '42501',
    pg_temp.como(dona_a, format($s$insert into public.registros_da_ia_propria (workspace_id, acao, versao_termo) values (%L, 'aceitar-termo', '2026-11-07')$s$, a)));
  perform pg_temp.registrar('o registro nao se edita', '42501 ia_registro_so_acrescenta',
    pg_temp.erro(format($s$update public.registros_da_ia_propria set modelo = 'x' where workspace_id = %L$s$, a)));
  perform pg_temp.registrar('o registro nao se apaga (conta existe)', '42501 ia_registro_so_acrescenta',
    pg_temp.erro(format($s$delete from public.registros_da_ia_propria where workspace_id = %L$s$, a)));
  perform pg_temp.registrar('acao desconhecida e barrada pelo nome', '23514 registros_ia_propria_acao_valida',
    pg_temp.erro(format($s$insert into public.registros_da_ia_propria (workspace_id, acao, encaixe) values (%L, 'ver', 'texto')$s$, a)));
  perform pg_temp.registrar('termo sem versao e barrado pelo nome', '23514 registros_ia_propria_forma',
    pg_temp.erro(format($s$insert into public.registros_da_ia_propria (workspace_id, acao) values (%L, 'aceitar-termo')$s$, a)));
  perform pg_temp.registrar('cadastro sem encaixe e barrado pelo nome', '23514 registros_ia_propria_forma',
    pg_temp.erro(format($s$insert into public.registros_da_ia_propria (workspace_id, acao) values (%L, 'cadastrar')$s$, a)));
  perform pg_temp.registrar('versao do termo fora de data e barrada pelo nome', '23514 registros_ia_propria_versao_em_data',
    pg_temp.erro(format($s$insert into public.registros_da_ia_propria (workspace_id, acao, versao_termo) values (%L, 'aceitar-termo', 'v1')$s$, a)));

  -- ─── 7. Trocar de plano ───────────────────────────────────────────────
  update public.assinaturas set plano = 'prova-propria-2' where workspace_id = c;
  perform pg_temp.registrar('propria -> propria: a chave de C FICA', '1',
    (select count(*)::text from public.chaves_de_ia_da_conta where workspace_id = c));
  update public.assinaturas set plano = 'basico' where workspace_id = a;
  perform pg_temp.registrar('propria -> plataforma: as chaves de A saem', '0',
    (select count(*)::text from public.chaves_de_ia_da_conta where workspace_id = a));
  perform pg_temp.registrar('o registro anota as duas apagadas pela troca', '2',
    (select count(*)::text from public.registros_da_ia_propria where workspace_id = a and acao = 'apagar-por-troca-de-plano' and autor is null));
  perform pg_temp.registrar('depois da troca o modo de A e plataforma', 'plataforma',
    pg_temp.valor_do_papel('service_role', format('select public.modo_de_ia_da_conta(%L)', a)));
  perform pg_temp.registrar('depois da troca, o servidor nao recebe chave de A', '0',
    pg_temp.valor_do_papel('service_role', format($s$select count(*) from public.chave_de_ia_para_uso(%L, 'texto')$s$, a)));
  perform pg_temp.registrar('depois da troca a dona de A NAO guarda chave', 'P0001 ia_conta_no_modo_da_plataforma',
    pg_temp.dica(dona_a, format($s$select public.guardar_chave_de_ia(%L, 'texto', 'openai', 'gpt-x', %L, %L, '1234', 1::smallint)$s$, a, cif, iv)));
  update public.assinaturas set plano = 'prova-propria' where workspace_id = a;
  perform pg_temp.registrar('plataforma -> propria nao traz chave de volta', '0',
    (select count(*)::text from public.chaves_de_ia_da_conta where workspace_id = a));

  -- ─── 9. O interruptor do Vini ─────────────────────────────────────────
  perform pg_temp.registrar('por padrao o membro usa o Vini', 'true',
    pg_temp.valor(membro_a, format('select public.posso_usar_o_vini(%L)', a)));
  perform pg_temp.registrar('o membro de A NAO desliga o Vini de ninguem', '42501 vini_so_a_dona',
    pg_temp.dica(membro_a, format('select public.definir_vini_da_pessoa(%L, %L, false)', a, dona_a)));
  perform pg_temp.registrar('a dona de B NAO mexe no Vini de A', '42501 vini_so_a_dona',
    pg_temp.dica(dona_b, format('select public.definir_vini_da_pessoa(%L, %L, false)', a, membro_a)));
  perform pg_temp.registrar('o visitante NAO mexe no Vini', '42501',
    pg_temp.papel('anon', format('select public.definir_vini_da_pessoa(%L, %L, false)', a, membro_a)));
  perform pg_temp.registrar('pessoa sem acesso a conta A nao entra no interruptor', 'P0002 vini_pessoa_sem_acesso',
    pg_temp.dica(dona_a, format('select public.definir_vini_da_pessoa(%L, %L, false)', a, dona_b)));
  perform pg_temp.registrar('a dona de A desliga o Vini do membro', 'ACEITOU 1',
    pg_temp.como(dona_a, format('select public.definir_vini_da_pessoa(%L, %L, false)', a, membro_a)));
  perform pg_temp.registrar('ligar e desligar de novo e idempotente', 'ACEITOU 1',
    pg_temp.como(dona_a, format('select public.definir_vini_da_pessoa(%L, %L, false)', a, membro_a)));
  perform pg_temp.registrar('a dona de A desliga o Vini da convidada (so de marca)', 'ACEITOU 1',
    pg_temp.como(dona_a, format('select public.definir_vini_da_pessoa(%L, %L, false)', a, convidada_a)));
  perform pg_temp.registrar('o membro desligado NAO pode usar o Vini', 'false',
    pg_temp.valor(membro_a, format('select public.posso_usar_o_vini(%L)', a)));
  perform pg_temp.registrar('a convidada desligada NAO pode usar o Vini', 'false',
    pg_temp.valor(convidada_a, format('select public.posso_usar_o_vini(%L)', a)));
  perform pg_temp.registrar('a dona de A segue podendo', 'true',
    pg_temp.valor(dona_a, format('select public.posso_usar_o_vini(%L)', a)));
  perform pg_temp.registrar('o desligado em A segue podendo em OUTRA conta (B)', 'true',
    pg_temp.valor(membro_a, format('select public.posso_usar_o_vini(%L)', b)));
  perform pg_temp.registrar('o servidor ve o membro desligado', 'false',
    pg_temp.valor_do_papel('service_role', format('select public.pessoa_pode_usar_o_vini(%L, %L)', a, membro_a)));
  perform pg_temp.registrar('o servidor ve a dona ligada', 'true',
    pg_temp.valor_do_papel('service_role', format('select public.pessoa_pode_usar_o_vini(%L, %L)', a, dona_a)));
  perform pg_temp.registrar('a pergunta do servidor NAO e do navegador', '42501',
    pg_temp.como(dona_a, format('select public.pessoa_pode_usar_o_vini(%L, %L)', a, membro_a)));
  perform pg_temp.registrar('o membro desligado ve a propria linha (1)', '1',
    pg_temp.valor(membro_a, format('select count(*) from public.vini_desligado_para where workspace_id = %L', a)));
  perform pg_temp.registrar('a dona de A ve as duas linhas', '2',
    pg_temp.valor(dona_a, format('select count(*) from public.vini_desligado_para where workspace_id = %L', a)));
  perform pg_temp.registrar('a dona de B NAO ve as linhas de A', '0',
    pg_temp.valor(dona_b, format('select count(*) from public.vini_desligado_para where workspace_id = %L', a)));
  perform pg_temp.registrar('a convidada ve so a propria linha (1)', '1',
    pg_temp.valor(convidada_a, format('select count(*) from public.vini_desligado_para where workspace_id = %L', a)));
  perform pg_temp.registrar('ninguem de navegador escreve no interruptor', '42501',
    pg_temp.como(dona_a, format($s$insert into public.vini_desligado_para (workspace_id, user_id) values (%L, %L)$s$, a, dona_a)));
  perform pg_temp.registrar('a dona de A religa o Vini do membro', 'ACEITOU 1',
    pg_temp.como(dona_a, format('select public.definir_vini_da_pessoa(%L, %L, true)', a, membro_a)));
  perform pg_temp.registrar('o membro religado volta a poder', 'true',
    pg_temp.valor(membro_a, format('select public.posso_usar_o_vini(%L)', a)));
  perform pg_temp.registrar('o interruptor vale tambem em conta do modo plataforma (B)', 'ACEITOU 1',
    pg_temp.como(dona_b, format('select public.definir_vini_da_pessoa(%L, %L, false)', b, dona_b)));
  perform pg_temp.registrar('... e a propria dona de B fica sem Vini', 'false',
    pg_temp.valor(dona_b, format('select public.posso_usar_o_vini(%L)', b)));

  -- ─── 8. A conta sair leva tudo ────────────────────────────────────────
  delete from public.assinaturas where workspace_id = c;
  delete from public.workspaces where id = c;
  perform pg_temp.registrar('a conta C sair leva as chaves', '0',
    (select count(*)::text from public.chaves_de_ia_da_conta where workspace_id = c));
  perform pg_temp.registrar('a conta C sair leva o registro (o gatilho deixa passar)', '0',
    (select count(*)::text from public.registros_da_ia_propria where workspace_id = c));
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
