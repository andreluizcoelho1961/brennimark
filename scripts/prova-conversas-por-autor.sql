-- Prova das conversas por AUTOR — fatia 4d, 23/09/2026.
--
-- A primeira coisa do produto que nem o dono da conta lê. As policies são por
-- autor, e esta prova tranca o que isso quer dizer:
--
--   1. o autor lê e escreve as próprias conversas, na marca que alcança;
--   2. NINGUÉM mais lê — nem quem administra a conta, nem outro membro da
--      mesma marca, nem outra conta, nem anon;
--   3. ninguém escreve em nome de outro, nem mensagem em conversa alheia;
--   4. mensagem não se edita; conversa só muda título e data;
--   5. o autor APAGA de verdade, e as mensagens vão junto; ninguém mais apaga;
--   6. quem perde a marca deixa de ler, mas continua podendo apagar (LGPD);
--   7. apagar a marca leva as conversas sobre ela.
--
-- Mesmo método das outras: mundo próprio, papel `authenticated` (superusuário
-- passa por cima de RLS e provaria nada), NOME da constraint conferido onde
-- há erro esperado, preparação que falha REPROVA, `rollback` no fim.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (conta_a uuid, conta_b uuid, admin_a uuid, admin_b uuid, autora uuid, colega uuid,
                         a1 uuid, a2 uuid, b1 uuid, conversa uuid, conversa_colega uuid);
grant select on mundo to authenticated, anon;

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;

-- Roda como alguém; devolve o resultado, ou o SQLSTATE; com `nome`, o nome da
-- constraint que barrou.
create function pg_temp.como(p_quem uuid, p_sql text, p_papel text default 'authenticated',
                             out saida text, out nome text)
language plpgsql as $f$
begin
  nome := '';
  begin
    perform set_config('request.jwt.claims',
      case when p_quem is null then json_build_object('role', p_papel)::text
           else json_build_object('sub', p_quem, 'role', p_papel)::text end, true);
    execute format('set local role %I', p_papel);
    execute p_sql into saida;
    saida := coalesce(saida, 'OK');
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    get stacked diagnostics saida = returned_sqlstate, nome = constraint_name;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  end;
end $f$;

create function pg_temp.entrar(p_id uuid, p_email text) returns void
language plpgsql as $f$
begin
  insert into auth.users (id, email, aud, role) values (p_id, p_email, 'authenticated', 'authenticated');
  insert into public.profiles (id, email, full_name) values (p_id, p_email, split_part(p_email,'@',1));
end $f$;

create function pg_temp.marca(p_conta uuid, p_key text) returns uuid
language sql as $f$
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (p_conta, p_key, p_key, p_key, 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id;
$f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_admin_a uuid := 'c0c0c0c0-0000-4000-8000-00000000000a';
  u_admin_b uuid := 'c0c0c0c0-0000-4000-8000-00000000000b';
  u_autora  uuid := 'c0c0c0c0-0000-4000-8000-0000000000f1';
  u_colega  uuid := 'c0c0c0c0-0000-4000-8000-0000000000f2';
  ca uuid; cb uuid; x1 uuid; x2 uuid; y1 uuid;
begin
  perform pg_temp.entrar(u_admin_a, 'cv-admin-a@local.test');
  perform pg_temp.entrar(u_admin_b, 'cv-admin-b@local.test');
  perform pg_temp.entrar(u_autora, 'cv-autora@local.test');
  perform pg_temp.entrar(u_colega, 'cv-colega@local.test');
  ca := private.abrir_conta_de_assinatura('Conta A das Conversas', 'cv-admin-a@local.test', u_admin_a);
  cb := private.abrir_conta_de_assinatura('Conta B das Conversas', 'cv-admin-b@local.test', u_admin_b);
  x1 := pg_temp.marca(ca, 'cv-a1');
  x2 := pg_temp.marca(ca, 'cv-a2');
  y1 := pg_temp.marca(cb, 'cv-b1');

  -- A autora consulta só a1; a colega consulta a1 também — mesma marca.
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  perform public.conceder_acesso(ca, 'cv-autora@local.test', 'consulta', array[x1]);
  perform public.conceder_acesso(ca, 'cv-colega@local.test', 'consulta', array[x1]);
  perform set_config('request.jwt.claims', '', true);

  insert into mundo (conta_a, conta_b, admin_a, admin_b, autora, colega, a1, a2, b1)
  values (ca, cb, u_admin_a, u_admin_b, u_autora, u_colega, x1, x2, y1);
end $$;

-- ─── 1. O autor escreve e lê a própria conversa ────────────────────────────
do $$
declare m record; r record; id_conversa uuid; id_colega uuid;
begin
  select * into m from mundo;

  r := pg_temp.como(m.autora, format(
    'insert into public.conversas (workspace_id, brand_id, autor, titulo) values (%L, %L, %L, ''qual é a cor primária?'') returning id::text',
    m.conta_a, m.a1, m.autora));
  perform pg_temp.registrar('a autora abre conversa na marca que consulta', 'uuid', case when r.saida ~ '^[0-9a-f-]{36}$' then 'uuid' else r.saida end);
  if r.saida !~ '^[0-9a-f-]{36}$' then raise exception 'premissa falhou: conversa nao criada (%)', r.saida; end if;
  id_conversa := r.saida::uuid;

  r := pg_temp.como(m.autora, format(
    'insert into public.mensagens_da_conversa (conversa_id, autor, brand_id, papel, tipo, conteudo) values '
    || '(%L, %L, %L, ''user'', ''pergunta'', ''qual é a cor primária?''), '
    || '(%L, %L, %L, ''assistant'', ''resposta'', ''O preto VAIO. [Fonte: Cores — RASCUNHO · /docs/cores]'') returning ''GRAVOU''',
    id_conversa, m.autora, m.a1, id_conversa, m.autora, m.a1));
  perform pg_temp.registrar('e grava pergunta e resposta', 'GRAVOU', r.saida);

  perform pg_temp.registrar('a autora lê a conversa',
    '1', (pg_temp.como(m.autora, format('select count(*)::text from public.conversas where id = %L', id_conversa))).saida);
  perform pg_temp.registrar('e as duas mensagens',
    '2', (pg_temp.como(m.autora, format('select count(*)::text from public.mensagens_da_conversa where conversa_id = %L', id_conversa))).saida);

  -- A colega também conversa, na mesma marca: isca para os casos abaixo.
  r := pg_temp.como(m.colega, format(
    'insert into public.conversas (workspace_id, brand_id, autor, titulo) values (%L, %L, %L, ''da colega'') returning id::text',
    m.conta_a, m.a1, m.colega));
  if r.saida !~ '^[0-9a-f-]{36}$' then raise exception 'premissa falhou: conversa da colega (%)', r.saida; end if;
  id_colega := r.saida::uuid;

  update mundo set conversa = id_conversa, conversa_colega = id_colega;
end $$;

-- ─── 2. Ninguém mais lê ────────────────────────────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('quem ADMINISTRA a conta NÃO lê a conversa da autora',
    '0', (pg_temp.como(m.admin_a, format('select count(*)::text from public.conversas where id = %L', m.conversa))).saida);
  perform pg_temp.registrar('nem as mensagens dela',
    '0', (pg_temp.como(m.admin_a, format('select count(*)::text from public.mensagens_da_conversa where conversa_id = %L', m.conversa))).saida);
  perform pg_temp.registrar('a colega da mesma marca NÃO lê',
    '0', (pg_temp.como(m.colega, format('select count(*)::text from public.conversas where id = %L', m.conversa))).saida);
  perform pg_temp.registrar('e vê só a própria na marca',
    '1', (pg_temp.como(m.colega, format('select count(*)::text from public.conversas where brand_id = %L', m.a1))).saida);
  perform pg_temp.registrar('outra conta NÃO lê',
    '0', (pg_temp.como(m.admin_b, 'select count(*)::text from public.conversas')).saida);
  perform pg_temp.registrar('anon NÃO lê',
    '42501', (pg_temp.como(null, 'select count(*)::text from public.conversas', 'anon')).saida);
  perform pg_temp.registrar('anon NÃO lê mensagens',
    '42501', (pg_temp.como(null, 'select count(*)::text from public.mensagens_da_conversa', 'anon')).saida);
end $$;

-- ─── 3. Ninguém escreve em nome de outro ───────────────────────────────────
do $$
declare m record; r record;
begin
  select * into m from mundo;

  r := pg_temp.como(m.autora, format(
    'insert into public.conversas (workspace_id, brand_id, autor, titulo) values (%L, %L, %L, ''x'') returning ''CRIOU''',
    m.conta_a, m.a2, m.autora));
  perform pg_temp.registrar('a autora NÃO abre conversa em marca que não consulta', '42501', r.saida);

  r := pg_temp.como(m.autora, format(
    'insert into public.conversas (workspace_id, brand_id, autor, titulo) values (%L, %L, %L, ''x'') returning ''CRIOU''',
    m.conta_a, m.a1, m.colega));
  perform pg_temp.registrar('nem abre conversa em nome da colega', '42501', r.saida);

  -- Mensagem na conversa da colega, assinada pela autora: a chave composta
  -- não acha conversa (colega, a1) com autora como autor.
  r := pg_temp.como(m.autora, format(
    'insert into public.mensagens_da_conversa (conversa_id, autor, brand_id, papel, tipo, conteudo) values (%L, %L, %L, ''user'', ''pergunta'', ''intrusa'') returning ''GRAVOU''',
    m.conversa_colega, m.autora, m.a1));
  perform pg_temp.registrar('mensagem na conversa alheia esbarra na chave composta', 'mensagens_da_conversa_conversa_fkey', r.nome);

  r := pg_temp.como(m.autora, format(
    'insert into public.mensagens_da_conversa (conversa_id, autor, brand_id, papel, tipo, conteudo) values (%L, %L, %L, ''user'', ''pergunta'', ''intrusa'') returning ''GRAVOU''',
    m.conversa_colega, m.colega, m.a1));
  perform pg_temp.registrar('e assinando como a colega, esbarra na policy', '42501', r.saida);

  r := pg_temp.como(m.admin_a, format(
    'insert into public.mensagens_da_conversa (conversa_id, autor, brand_id, papel, tipo, conteudo) values (%L, %L, %L, ''assistant'', ''resposta'', ''plantada'') returning ''GRAVOU''',
    m.conversa, m.autora, m.a1));
  perform pg_temp.registrar('nem quem administra planta mensagem na conversa da autora', '42501', r.saida);
end $$;

-- ─── 4. O que foi dito fica como foi dito ──────────────────────────────────
do $$
declare m record; r record;
begin
  select * into m from mundo;
  r := pg_temp.como(m.autora, format('update public.mensagens_da_conversa set conteudo = ''editada'' where conversa_id = %L returning ''MUDOU''', m.conversa));
  perform pg_temp.registrar('mensagem não se edita, nem pela autora', '42501', r.saida);
  r := pg_temp.como(m.autora, format('update public.conversas set titulo = ''cores da VAIO'' where id = %L returning titulo', m.conversa));
  perform pg_temp.registrar('o título da conversa muda', 'cores da VAIO', r.saida);
  r := pg_temp.como(m.autora, format('update public.conversas set autor = %L where id = %L returning ''MUDOU''', m.colega, m.conversa));
  perform pg_temp.registrar('o autor da conversa não muda', '42501', r.saida);
  r := pg_temp.como(m.autora, format('update public.conversas set brand_id = %L where id = %L returning ''MUDOU''', m.a2, m.conversa));
  perform pg_temp.registrar('nem a marca', '42501', r.saida);
end $$;

-- ─── 5. Vocabulário e tamanho ──────────────────────────────────────────────
do $$
declare m record; r record;
begin
  select * into m from mundo;
  r := pg_temp.como(m.autora, format(
    'insert into public.mensagens_da_conversa (conversa_id, autor, brand_id, papel, tipo, conteudo) values (%L, %L, %L, ''user'', ''prompt'', ''x'') returning ''GRAVOU''',
    m.conversa, m.autora, m.a1));
  perform pg_temp.registrar('pergunta não é prompt: papel e tipo casam', 'mensagens_da_conversa_tipo_check', r.nome);
  r := pg_temp.como(m.autora, format(
    'insert into public.conversas (workspace_id, brand_id, autor, titulo) values (%L, %L, %L, %L) returning ''CRIOU''',
    m.conta_a, m.a1, m.autora, repeat('x', 121)));
  perform pg_temp.registrar('título tem teto', 'conversas_titulo_check', r.nome);
  r := pg_temp.como(m.autora, format(
    'insert into public.mensagens_da_conversa (conversa_id, autor, brand_id, papel, tipo, conteudo, regras) values (%L, %L, %L, ''assistant'', ''prompt'', ''Studio photo…'', %L::jsonb) returning ''GRAVOU''',
    m.conversa, m.autora, m.a1, '[{"slug":"cores","titulo":"Cores","status":"draft","pagina":8}]'));
  perform pg_temp.registrar('o prompt gerado entra com as regras que usou', 'GRAVOU', r.saida);
end $$;

-- ─── 6. Apagar: só o autor, e de verdade ───────────────────────────────────
do $$
declare m record; r record; n int;
begin
  select * into m from mundo;
  r := pg_temp.como(m.admin_a, format('with d as (delete from public.conversas where id = %L returning 1) select count(*)::text from d', m.conversa));
  perform pg_temp.registrar('quem administra NÃO apaga a conversa da autora', '0', r.saida);

  r := pg_temp.como(m.autora, format('with d as (delete from public.mensagens_da_conversa where conversa_id = %L returning 1) select count(*)::text from d', m.conversa));
  perform pg_temp.registrar('mensagem não se apaga sozinha (vai com a conversa)', '42501', r.saida);

  -- Perdeu a marca: não lê mais, mas ainda apaga.
  perform set_config('request.jwt.claims', json_build_object('sub', m.admin_a, 'role', 'authenticated')::text, true);
  perform public.revogar_acesso(m.conta_a, 'cv-autora@local.test', m.a1);
  perform set_config('request.jwt.claims', '', true);
  perform pg_temp.registrar('sem a marca, a autora deixa de ler a própria conversa',
    '0', (pg_temp.como(m.autora, format('select count(*)::text from public.conversas where id = %L', m.conversa))).saida);
  -- A policy de delete sozinha devolve 0 aqui (a linha precisa estar visível
  -- ao select); o caminho do produto é `apagar_conversa`, que só confere o autor.
  r := pg_temp.como(m.admin_a, format('select public.apagar_conversa(%L)::text', m.conversa));
  perform pg_temp.registrar('a função não apaga conversa alheia, nem para quem administra', '0', r.saida);
  r := pg_temp.como(m.colega, format('select public.apagar_conversa(%L)::text', m.conversa));
  perform pg_temp.registrar('nem para a colega da marca', '0', r.saida);
  r := pg_temp.como(null, format('select public.apagar_conversa(%L)::text', m.conversa), 'anon');
  perform pg_temp.registrar('anon não chama a função', '42501', r.saida);
  r := pg_temp.como(m.autora, format('select public.apagar_conversa(%L)::text', m.conversa));
  perform pg_temp.registrar('mas a autora continua podendo apagá-la (LGPD)', '1', r.saida);

  select count(*) into n from public.mensagens_da_conversa where conversa_id = m.conversa;
  perform pg_temp.registrar('e as mensagens foram junto, de verdade', '0', n::text);
  select count(*) into n from public.conversas where id = m.conversa;
  perform pg_temp.registrar('a conversa não existe mais no banco', '0', n::text);
end $$;

-- ─── 7. A marca sai: as conversas vão junto ────────────────────────────────
--
-- ⚠️ Achado desta prova (23/09): APAGAR O LOGIN de quem já recebeu acesso
-- falha hoje, por duas tabelas de histórico — `concessoes_de_acesso`
-- (`convertida_para`, sem regra de exclusão) e `brand_access_log` (o gatilho
-- tenta registrar a saída de quem já não existe). É lacuna à parte — o pedido
-- de exclusão de conta da LGPD —, e mexe em histórico, que não se reescreve
-- em silêncio. Registrada no plano. A conversa já nasce certa para ela:
-- `autor … on delete cascade`.
do $$
declare m record; n int;
begin
  select * into m from mundo;
  insert into public.conversas (workspace_id, brand_id, autor, titulo) values (m.conta_b, m.b1, m.admin_b, 'da marca b1');
  select count(*) into n from public.conversas where brand_id = m.b1;
  if n <> 1 then raise exception 'premissa falhou: conversa da marca b1 nao entrou'; end if;
  delete from public.brands where id = m.b1;
  select count(*) into n from public.conversas where brand_id = m.b1;
  perform pg_temp.registrar('apagar a marca apaga as conversas sobre ela', '0', n::text);
end $$;

select case when passou then 'ok   ' else 'FALHA' end as st, caso, esperado, obtido
from resultado order by ordem;

select case when count(*) filter (where not passou) = 0
            then 'PROVA COMPLETA: ' || count(*) || ' verificacoes, todas verdes'
            else 'PROVA FALHOU: ' || count(*) filter (where not passou) || ' de ' || count(*)
       end as veredito
from resultado;

do $$
declare n integer;
begin
  select count(*) filter (where not passou) into n from resultado;
  if n > 0 then
    raise exception 'PROVA FALHOU: % verificacao(oes)', n using errcode = 'P0001';
  end if;
end $$;

rollback;
