-- Prova de item e variante — ADR-0007 §2.2.
--
-- Mesmo método das outras provas do projeto: mundo próprio, SQLSTATE e NOME da
-- constraint conferidos onde há erro esperado, dado isolado por caso, e
-- `rollback` no fim. Caso cuja preparação falha reprova — ele não passa em
-- silêncio.
--
-- Duas perguntas:
--   1. Autorização: o item obedece às mesmas capacidades por marca que o
--      arquivo, e nem conta nem marca vizinha o alcançam.
--   2. Integridade: cada tipo aceita só os seus eixos, fonte não aceita arquivo,
--      e nenhum atalho (trocar o tipo, mudar de marca, substituir por outro
--      item) desfaz isso depois da entrada.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (
  ordem serial, caso text, esperado text, obtido text, passou boolean
);

create temp table mundo (
  dona uuid, editora uuid, leitora uuid, estranha uuid,
  w1 uuid, w2 uuid, marca_a uuid, marca_b uuid, marca_c uuid,
  logo_a uuid, paleta_a uuid, icone_a uuid, foto_a uuid, fonte_a uuid,
  vazio_a uuid, logo_b uuid, logo_c uuid, logo_a_v1 uuid, foto_a_v1 uuid
);

/*
 * Executa um comando COMO uma pessoa, e devolve o que aconteceu.
 *
 * O bloco com `exception` é uma subtransação: numa recusa, o papel e a sessão
 * falsa voltam ao estado anterior sozinhos. Num sucesso, o papel é devolvido à
 * mão. Sem isto, o caso seguinte rodaria com a sessão do anterior — o defeito
 * que a prova do Storage teve em 16/09.
 */
create function pg_temp.tentar(p_quem uuid, p_sql text,
                               out estado text, out nome text, out linhas integer)
language plpgsql as $f$
begin
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute p_sql;
    get diagnostics linhas = row_count;
    -- Aceitar sem gravar nada não é aceitar: o caso não chegou à regra.
    estado := case when linhas > 0 then 'ACEITOU' else 'ACEITOU-SEM-LINHA' end; nome := '';
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, nome = constraint_name;
    linhas := 0;
  end;
end $f$;

create function pg_temp.contar(p_quem uuid, p_sql text) returns integer
language plpgsql as $f$
declare n integer;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute p_sql into n;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  return n;
end $f$;

-- Uma variante como texto de comando, para cada caso levar o próprio arquivo.
--
-- VALUES, e nunca `insert ... select from brands`: quem não enxerga a marca
-- faria o select voltar vazio, o insert gravaria ZERO linhas sem erro, e o caso
-- "outra conta não pendura arquivo" passaria como aceito sem ter tentado nada.
-- Foi o que aconteceu na primeira rodada desta prova (17/09).
create function pg_temp.variante(p_item uuid, p_marca uuid, p_eixos text, p_arquivo text)
returns text language plpgsql as $f$
declare m record; conta uuid;
begin
  select * into m from mundo;
  conta := case when p_marca = m.marca_c then m.w2 else m.w1 end;
  return format(
    'insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, '
    || 'file_name, mime_type, size_bytes, status, created_by, hierarquia, lockup, cor, polaridade, espaco_de_cor) '
    || 'values (%L, %L, %L, %L, %L, %L, ''image/svg+xml'', 100, ''ready'', %L, %s)',
    conta, p_marca, p_item, p_arquivo, conta::text || '/' || p_marca::text || '/' || p_arquivo,
    p_arquivo, m.dona, p_eixos);
end $f$;

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, p_obtido, p_esperado = p_obtido);
$f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_dona uuid := '77777777-7777-4777-8777-77777777aaaa';
  u_edit uuid := '77777777-7777-4777-8777-77777777bbbb';
  u_le   uuid := '77777777-7777-4777-8777-77777777cccc';
  u_fora uuid := '77777777-7777-4777-8777-77777777dddd';
  w1 uuid; w2 uuid; a uuid; b uuid; c uuid;
  todas text[] := array['consultar','editar','aprovar','administrar'];
begin
  insert into auth.users (id, email, aud, role) values
    (u_dona, 'prova-item-dona@local.test',    'authenticated', 'authenticated'),
    (u_edit, 'prova-item-editora@local.test', 'authenticated', 'authenticated'),
    (u_le,   'prova-item-leitora@local.test', 'authenticated', 'authenticated'),
    (u_fora, 'prova-item-fora@local.test',    'authenticated', 'authenticated');

  insert into public.workspaces (name, slug) values ('Prova Item Um', 'prova-item-um') returning id into w1;
  insert into public.workspaces (name, slug) values ('Prova Item Dois', 'prova-item-dois') returning id into w2;
  insert into public.workspace_members (workspace_id, user_id, role) values
    (w1, u_dona, 'owner'), (w1, u_edit, 'member'), (w1, u_le, 'member'), (w2, u_fora, 'owner');

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w1, 'item-a', 'Marca A', 'A', 'Primeira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into a;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w1, 'item-b', 'Marca B', 'B', 'Segunda', 'pt-BR', '{}','{}','{}','{}','{}') returning id into b;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w2, 'item-c', 'Marca C', 'C', 'Terceira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into c;

  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades) values
    (a, w1, u_dona, todas), (b, w1, u_dona, todas),
    (a, w1, u_edit, array['consultar','editar']),
    (a, w1, u_le,   array['consultar']),
    (c, w2, u_fora, todas)
  on conflict (brand_id, user_id) do update set capacidades = excluded.capacidades;

  insert into mundo (dona, editora, leitora, estranha, w1, w2, marca_a, marca_b, marca_c)
  values (u_dona, u_edit, u_le, u_fora, w1, w2, a, b, c);

  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by) values
    (w1, a, 'logo', 'Logo', u_dona), (w1, a, 'paleta', 'Paleta', u_dona),
    (w1, a, 'icone', 'Ícones', u_dona), (w1, a, 'foto', 'Fotos', u_dona),
    (w1, a, 'fonte', 'Fonte', u_dona), (w1, a, 'logo', 'Sem arquivo', u_dona),
    (w1, b, 'logo', 'Logo B', u_dona), (w2, c, 'logo', 'Logo C', u_fora);

  update mundo set
    logo_a   = (select id from public.brand_asset_items where brand_id = a and nome = 'Logo'),
    paleta_a = (select id from public.brand_asset_items where brand_id = a and nome = 'Paleta'),
    icone_a  = (select id from public.brand_asset_items where brand_id = a and nome = 'Ícones'),
    foto_a   = (select id from public.brand_asset_items where brand_id = a and nome = 'Fotos'),
    fonte_a  = (select id from public.brand_asset_items where brand_id = a and nome = 'Fonte'),
    vazio_a  = (select id from public.brand_asset_items where brand_id = a and nome = 'Sem arquivo'),
    logo_b   = (select id from public.brand_asset_items where brand_id = b),
    logo_c   = (select id from public.brand_asset_items where brand_id = c);
end $$;

-- As variantes de base, gravadas como superusuário: são o cenário, não o caso.
do $$
declare m record; r record;
begin
  select * into m from mundo;
  execute pg_temp.variante(m.logo_a, m.marca_a,
    $e$'principal','horizontal','colorido','positivo','rgb'$e$, 'logo-base.svg');
  execute pg_temp.variante(m.foto_a, m.marca_a, 'null,null,null,null,null', 'foto-base.svg');
  update mundo set
    logo_a_v1 = (select id from public.brand_assets where file_name = 'logo-base.svg'),
    foto_a_v1 = (select id from public.brand_assets where file_name = 'foto-base.svg');
  select * into m from mundo;
  if m.logo_a_v1 is null or m.foto_a_v1 is null then
    raise exception 'PREPARAÇÃO FALHOU: variantes de base não foram gravadas';
  end if;
end $$;

-- ─── 1. Autorização ─────────────────────────────────────────────────────────
do $$
declare m record; t record; n integer;
begin
  select * into m from mundo;

  n := pg_temp.contar(m.leitora, format('select count(*) from public.brand_asset_items where brand_id = %L', m.marca_a));
  perform pg_temp.registrar('quem consulta A LE os itens de A', '6', n::text);

  n := pg_temp.contar(m.leitora, format('select count(*) from public.brand_asset_items where brand_id = %L', m.marca_b));
  perform pg_temp.registrar('quem consulta A NAO le itens da marca B, mesma conta', '0', n::text);

  n := pg_temp.contar(m.estranha, format('select count(*) from public.brand_asset_items where brand_id in (%L, %L)', m.marca_a, m.marca_b));
  perform pg_temp.registrar('outra conta NAO le itens desta conta', '0', n::text);

  n := pg_temp.contar(m.leitora, format('select count(*) from public.brand_assets where brand_id = %L', m.marca_a));
  perform pg_temp.registrar('quem consulta A le as variantes de A', '2', n::text);

  t := pg_temp.tentar(m.leitora, format(
    'insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by) values (%L, %L, ''logo'', ''x'', %L)',
    m.w1, m.marca_a, m.leitora));
  perform pg_temp.registrar('quem so consulta NAO cria item', '42501', t.estado);

  t := pg_temp.tentar(m.editora, format(
    'insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by) values (%L, %L, ''logo'', ''x'', %L)',
    m.w1, m.marca_a, m.editora));
  perform pg_temp.registrar('quem edita A cria item em A', 'ACEITOU', t.estado);

  t := pg_temp.tentar(m.editora, format(
    'insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by) values (%L, %L, ''logo'', ''x'', %L)',
    m.w1, m.marca_b, m.editora));
  perform pg_temp.registrar('quem edita A NAO cria item na marca B', '42501', t.estado);

  t := pg_temp.tentar(m.editora, format('update public.brand_asset_items set nome = ''mexido'' where id = %L', m.logo_b));
  perform pg_temp.registrar('quem edita A NAO altera item de B', '0 linhas', t.linhas || ' linhas');

  t := pg_temp.tentar(m.leitora, format('update public.brand_asset_items set nome = ''mexido'' where id = %L', m.logo_a));
  perform pg_temp.registrar('quem so consulta NAO altera item', '0 linhas', t.linhas || ' linhas');

  t := pg_temp.tentar(m.leitora, format('delete from public.brand_asset_items where id = %L', m.vazio_a));
  perform pg_temp.registrar('quem so consulta NAO remove item', '0 linhas', t.linhas || ' linhas');

  -- A dona alcança as duas marcas, então a RLS deixa passar; quem barra é o
  -- vínculo composto item↔marca.
  t := pg_temp.tentar(m.dona, pg_temp.variante(m.logo_b, m.marca_a,
    $e$'principal','horizontal','colorido','positivo','rgb'$e$, 'cruzado.svg'));
  perform pg_temp.registrar('variante de A NAO aponta para item de B', '23503', t.estado);
  perform pg_temp.registrar('e a trava e o vinculo item-marca', 'brand_assets_item_fkey', t.nome);

  t := pg_temp.tentar(m.estranha, pg_temp.variante(m.logo_a, m.marca_a,
    $e$'principal','horizontal','colorido','positivo','rgb'$e$, 'outra-conta.svg'));
  perform pg_temp.registrar('outra conta NAO pendura arquivo em marca alheia', '42501', t.estado);

  -- Sem oráculo: item existente e item inexistente dão a MESMA recusa a quem é
  -- de fora. Antes da correção, o primeiro dizia 42501 e o segundo 23503.
  t := pg_temp.tentar(m.estranha, pg_temp.variante(m.logo_c, m.marca_a,
    $e$'principal','horizontal','colorido','positivo','rgb'$e$, 'sonda.svg'));
  perform pg_temp.registrar('estranho nao distingue item que existe do que nao existe', '42501', t.estado);

  t := pg_temp.tentar(m.leitora, pg_temp.variante(m.logo_a, m.marca_a,
    $e$'principal','horizontal','colorido','positivo','rgb'$e$, 'leitora.svg'));
  perform pg_temp.registrar('quem so consulta NAO sobe arquivo', '42501', t.estado);
end $$;

-- ─── 2. Os eixos por tipo ───────────────────────────────────────────────────
do $$
declare m record; t record;
begin
  select * into m from mundo;

  t := pg_temp.tentar(m.dona, pg_temp.variante(m.logo_a, m.marca_a,
    $e$'principal','vertical','monocromatico','negativo','cmyk'$e$, 'logo-completo.eps'));
  perform pg_temp.registrar('logo com os cinco eixos entra', 'ACEITOU', t.estado);

  t := pg_temp.tentar(m.dona, pg_temp.variante(m.logo_a, m.marca_a,
    $e$'principal','vertical','colorido',null,'rgb'$e$, 'logo-sem-polaridade.svg'));
  perform pg_temp.registrar('logo sem polaridade e recusado', '23514', t.estado);
  perform pg_temp.registrar('pela trava dos eixos do logo', 'brand_assets_eixos_do_logo', t.nome);

  t := pg_temp.tentar(m.dona, pg_temp.variante(m.paleta_a, m.marca_a,
    $e$null,'horizontal',null,null,'rgb'$e$, 'paleta-lockup.ase'));
  perform pg_temp.registrar('paleta com lockup e recusada', 'brand_assets_eixos_fora_do_tipo', t.nome);

  t := pg_temp.tentar(m.dona, pg_temp.variante(m.paleta_a, m.marca_a,
    $e$null,null,null,'negativo','rgb'$e$, 'paleta-polaridade.ase'));
  perform pg_temp.registrar('paleta com polaridade e recusada', 'brand_assets_eixos_fora_do_tipo', t.nome);

  t := pg_temp.tentar(m.dona, pg_temp.variante(m.paleta_a, m.marca_a,
    'null,null,null,null,null', 'paleta-sem-espaco.ase'));
  perform pg_temp.registrar('paleta sem espaco de cor e recusada', 'brand_assets_espaco_de_cor_obrigatorio', t.nome);

  t := pg_temp.tentar(m.dona, pg_temp.variante(m.paleta_a, m.marca_a,
    $e$null,null,null,null,'cmyk'$e$, 'paleta-certa.ase'));
  perform pg_temp.registrar('paleta so com espaco de cor entra', 'ACEITOU', t.estado);

  t := pg_temp.tentar(m.dona, pg_temp.variante(m.icone_a, m.marca_a,
    $e$null,null,null,'positivo','rgb'$e$, 'icone-sem-cor.svg'));
  perform pg_temp.registrar('icone sem cor e recusado', 'brand_assets_eixos_do_icone', t.nome);

  t := pg_temp.tentar(m.dona, pg_temp.variante(m.icone_a, m.marca_a,
    $e$'principal',null,'colorido','positivo','rgb'$e$, 'icone-hierarquia.svg'));
  perform pg_temp.registrar('icone com hierarquia e recusado', 'brand_assets_eixos_fora_do_tipo', t.nome);

  t := pg_temp.tentar(m.dona, pg_temp.variante(m.icone_a, m.marca_a,
    $e$null,null,'colorido','negativo','rgb'$e$, 'icone-certo.svg'));
  perform pg_temp.registrar('icone com cor, polaridade e espaco entra', 'ACEITOU', t.estado);

  t := pg_temp.tentar(m.dona, pg_temp.variante(m.foto_a, m.marca_a,
    'null,null,null,null,null', 'foto-sem-eixo.svg'));
  perform pg_temp.registrar('foto sem eixo nenhum entra', 'ACEITOU', t.estado);

  t := pg_temp.tentar(m.dona, pg_temp.variante(m.foto_a, m.marca_a,
    $e$null,null,'colorido',null,null$e$, 'foto-com-cor.svg'));
  perform pg_temp.registrar('foto com eixo de cor e recusada', 'brand_assets_eixos_fora_do_tipo', t.nome);

  t := pg_temp.tentar(m.dona, pg_temp.variante(m.fonte_a, m.marca_a,
    'null,null,null,null,null', 'fonte.otf'));
  perform pg_temp.registrar('fonte NAO aceita arquivo antes do termo', '23514', t.estado);
  perform pg_temp.registrar('pela trava do termo de licenca', 'brand_assets_fonte_exige_termo', t.nome);

  t := pg_temp.tentar(m.dona, pg_temp.variante(m.logo_a, m.marca_a,
    $e$'principal','diagonal','colorido','positivo','rgb'$e$, 'logo-diagonal.svg'));
  perform pg_temp.registrar('valor fora do vocabulario e recusado', 'brand_assets_lockup_check', t.nome);

  -- A entrada não é o único caminho: alterar depois passa pelo mesmo gatilho.
  t := pg_temp.tentar(m.dona, format('update public.brand_assets set polaridade = null where id = %L', m.logo_a_v1));
  perform pg_temp.registrar('alterar o logo para tirar um eixo e recusado', 'brand_assets_eixos_do_logo', t.nome);
end $$;

-- ─── 3. Atalhos depois da entrada ───────────────────────────────────────────
do $$
declare m record; t record;
begin
  select * into m from mundo;

  t := pg_temp.tentar(m.dona, format('update public.brand_asset_items set tipo = ''paleta'' where id = %L', m.logo_a));
  perform pg_temp.registrar('item com arquivos NAO troca de tipo', 'brand_asset_items_tipo_imutavel', t.nome);

  t := pg_temp.tentar(m.dona, format('update public.brand_asset_items set tipo = ''icone'' where id = %L', m.vazio_a));
  perform pg_temp.registrar('item sem arquivo pode trocar de tipo', 'ACEITOU', t.estado);

  t := pg_temp.tentar(m.dona, format('update public.brand_asset_items set brand_id = %L where id = %L', m.marca_b, m.vazio_a));
  perform pg_temp.registrar('item NAO muda de marca', 'brand_asset_items_marca_imutavel', t.nome);

  t := pg_temp.tentar(m.dona, format(
    'update public.brand_assets set descontinuado_em = now(), substituido_por = %L where id = %L',
    m.foto_a_v1, m.logo_a_v1));
  perform pg_temp.registrar('logo NAO e substituido por arquivo de outro item', 'brand_assets_substituto_do_mesmo_item', t.nome);

  t := pg_temp.tentar(m.dona, format('delete from public.brand_asset_items where id = %L', m.logo_a));
  perform pg_temp.registrar('item com arquivos NAO e removido', '23503', t.estado);
end $$;

-- ─── 4. Apagar a marca leva itens e arquivos juntos ─────────────────────────
-- A FK variante→item é NO ACTION justamente para isto: com RESTRICT, a cascata
-- da marca esbarraria no item antes de o arquivo sair.
do $$
declare m record; itens integer; arquivos integer; estado text;
begin
  select * into m from mundo;
  begin
    delete from public.brands where id = m.marca_a;
    estado := 'ACEITOU';
  exception when others then
    estado := sqlstate;
  end;
  select count(*) into itens from public.brand_asset_items where brand_id = m.marca_a;
  select count(*) into arquivos from public.brand_assets where brand_id = m.marca_a;
  perform pg_temp.registrar('apagar a marca nao esbarra nos itens', 'ACEITOU', estado);
  perform pg_temp.registrar('e nao sobra item nem arquivo', '0 e 0', itens || ' e ' || arquivos);
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
