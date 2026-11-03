-- Prova da FONTE HOSPEDADA — ADR-0007 §3, 03/11/2026.
--
--   1. a fonte só entra com uma versão EXISTENTE do termo, tipo de licença no
--      item e formato de instalar (OTF, TTF, TTC) — cada recusa pela constraint
--      de NOME exato, não por "algum erro";
--   2. quem aceitou e quando vêm da SESSÃO: o pedido que mente é corrigido;
--   3. o aceite não se reescreve, e a retirada é de quem ADMINISTRA a marca;
--   4. a conta B e quem só consulta não enviam fonte para a marca A;
--   5. o texto do termo só se lê (ninguém escreve) e a impressão digital confere;
--   6. apagar o login não apaga o aceite, e não é bloqueado por ele.
--
-- Mesmo método das outras: mundo próprio, papel `authenticated`, SQLSTATE e
-- nome da constraint conferidos, `rollback` no fim.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (dona uuid, editora uuid, leitora uuid, estranha uuid, w1 uuid, w2 uuid,
                         marca_a uuid, marca_c uuid, fonte uuid, fonte_sem_licenca uuid, logo uuid, fonte_c uuid);
grant select on mundo to authenticated, anon;

create function pg_temp.tentar(p_quem uuid, p_sql text,
                               out estado text, out nome text, out linhas integer)
language plpgsql as $f$
begin
  begin
    perform set_config('request.jwt.claims',
      case when p_quem is null then json_build_object('role', 'anon')::text
           else json_build_object('sub', p_quem, 'role', 'authenticated')::text end, true);
    execute case when p_quem is null then 'set local role anon' else 'set local role authenticated' end;
    execute p_sql;
    get diagnostics linhas = row_count;
    estado := case when linhas > 0 then 'ACEITOU' else 'ACEITOU-SEM-LINHA' end; nome := '';
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, nome = constraint_name;
    linhas := 0;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  end;
end $f$;

create function pg_temp.contar(p_quem uuid, p_sql text) returns integer
language plpgsql as $f$
declare n integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute p_sql into n;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  return n;
end $f$;

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido, '(nulo)'), p_esperado = coalesce(p_obtido, '(nulo)'));
$f$;

-- Uma variante de fonte como comando. VALUES, e nunca `insert ... select`: quem
-- não enxerga a marca faria o select voltar vazio e o caso passaria sem tentar.
create function pg_temp.fonte(p_item uuid, p_marca uuid, p_arquivo text, p_mime text,
                              p_termo text, p_extra text default '')
returns text language plpgsql as $f$
declare m record; conta uuid;
begin
  select * into m from mundo;
  conta := case when p_marca = m.marca_c then m.w2 else m.w1 end;
  return format(
    'insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, '
    || 'file_name, mime_type, size_bytes, status, created_by, termo_versao%s) '
    || 'values (%L, %L, %L, %L, %L, %L, %L, 100, ''ready'', %L, %L%s)',
    case when p_extra = '' then '' else ', ' || split_part(p_extra, '=', 1) end,
    conta, p_marca, p_item, p_arquivo, 'f/' || gen_random_uuid()::text, p_arquivo, p_mime, m.dona, p_termo,
    case when p_extra = '' then '' else ', ' || quote_literal(split_part(p_extra, '=', 2)) end);
end $f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_dona uuid := '88888888-8888-4888-8888-88888888aaaa';
  u_edit uuid := '88888888-8888-4888-8888-88888888bbbb';
  u_le   uuid := '88888888-8888-4888-8888-88888888cccc';
  u_fora uuid := '88888888-8888-4888-8888-88888888dddd';
  w1 uuid; w2 uuid; a uuid; c uuid;
  todas text[] := array['consultar','editar','aprovar','administrar'];
  f uuid; fsl uuid; lg uuid; fc uuid;
begin
  insert into auth.users (id, email, aud, role) values
    (u_dona, 'prova-fonte-dona@local.test',    'authenticated', 'authenticated'),
    (u_edit, 'prova-fonte-editora@local.test', 'authenticated', 'authenticated'),
    (u_le,   'prova-fonte-leitora@local.test', 'authenticated', 'authenticated'),
    (u_fora, 'prova-fonte-fora@local.test',    'authenticated', 'authenticated');
  insert into public.workspaces (name, slug) values ('Prova Fonte Um', 'prova-fonte-um') returning id into w1;
  insert into public.workspaces (name, slug) values ('Prova Fonte Dois', 'prova-fonte-dois') returning id into w2;
  insert into public.workspace_members (workspace_id, user_id, role) values
    (w1, u_dona, 'owner'), (w1, u_edit, 'member'), (w1, u_le, 'member'), (w2, u_fora, 'owner');
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w1, 'fonte-a', 'Marca A', 'A', 'Primeira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into a;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w2, 'fonte-c', 'Marca C', 'C', 'Terceira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into c;
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades) values
    (a, w1, u_dona, todas), (a, w1, u_edit, array['consultar','editar']), (a, w1, u_le, array['consultar']),
    (c, w2, u_fora, todas)
  on conflict (brand_id, user_id) do update set capacidades = excluded.capacidades;

  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by, licenca_tipo, licenca_titular)
  values (w1, a, 'fonte', 'Fonte da marca', u_dona, 'comprada', 'Foundry X') returning id into f;
  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by)
  values (w1, a, 'fonte', 'Fonte sem licença', u_dona) returning id into fsl;
  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by)
  values (w1, a, 'logo', 'Logo', u_dona) returning id into lg;
  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by, licenca_tipo)
  values (w2, c, 'fonte', 'Fonte da C', u_fora, 'livre') returning id into fc;

  insert into mundo values (u_dona, u_edit, u_le, u_fora, w1, w2, a, c, f, fsl, lg, fc);
end $$;

-- ─── 1. A fonte só entra com termo, licença e formato de instalar ──────────
do $$
declare m record; t record; linha record;
begin
  select * into m from mundo;

  t := pg_temp.tentar(m.editora, pg_temp.fonte(m.fonte, m.marca_a, 'marca-regular.ttf', 'font/ttf', '1'));
  perform pg_temp.registrar('quem edita a marca envia fonte TTF com o termo v1', 'ACEITOU', t.estado);
  t := pg_temp.tentar(m.editora, pg_temp.fonte(m.fonte, m.marca_a, 'marca-bold.otf', 'font/otf', '1'));
  perform pg_temp.registrar('OTF também entra', 'ACEITOU', t.estado);
  t := pg_temp.tentar(m.editora, pg_temp.fonte(m.fonte, m.marca_a, 'marca-colecao.ttc', 'font/collection', '1'));
  perform pg_temp.registrar('TTC também entra', 'ACEITOU', t.estado);

  t := pg_temp.tentar(m.editora, pg_temp.fonte(m.fonte, m.marca_a, 'sem-termo.ttf', 'font/ttf', null));
  perform pg_temp.registrar('sem termo, 23514', '23514', t.estado);
  perform pg_temp.registrar('sem termo, pela constraint do termo', 'brand_assets_fonte_exige_termo', t.nome);
  t := pg_temp.tentar(m.editora, pg_temp.fonte(m.fonte, m.marca_a, 'versao-falsa.ttf', 'font/ttf', '99'));
  perform pg_temp.registrar('versão de termo que não existe, pela constraint do termo', 'brand_assets_fonte_exige_termo', t.nome);

  t := pg_temp.tentar(m.editora, pg_temp.fonte(m.fonte_sem_licenca, m.marca_a, 'sem-licenca.ttf', 'font/ttf', '1'));
  perform pg_temp.registrar('item sem tipo de licença, pela constraint da licença', 'brand_assets_fonte_exige_licenca', t.nome);

  t := pg_temp.tentar(m.editora, pg_temp.fonte(m.fonte, m.marca_a, 'web.woff2', 'font/woff2', '1'));
  perform pg_temp.registrar('webfont WOFF2 recusada pela constraint do formato', 'brand_assets_fonte_formato', t.nome);
  t := pg_temp.tentar(m.editora, pg_temp.fonte(m.fonte, m.marca_a, 'disfarce.ttf', 'font/woff2', '1'));
  perform pg_temp.registrar('extensão ttf com mime de webfont, pela constraint do formato', 'brand_assets_fonte_formato', t.nome);
  t := pg_temp.tentar(m.editora, pg_temp.fonte(m.fonte, m.marca_a, 'mentira.pdf', 'font/ttf', '1'));
  perform pg_temp.registrar('extensão que não é de fonte, pela constraint do formato', 'brand_assets_fonte_formato', t.nome);
  t := pg_temp.tentar(m.editora, pg_temp.fonte(m.fonte, m.marca_a, 'com-eixo.ttf', 'font/ttf', '1', 'cor=colorido'));
  perform pg_temp.registrar('fonte com eixo de cor, pela constraint de eixo fora do tipo', 'brand_assets_eixos_fora_do_tipo', t.nome);

  t := pg_temp.tentar(m.editora, pg_temp.fonte(m.logo, m.marca_a, 'logo.svg', 'image/svg+xml', '1'));
  perform pg_temp.registrar('logo com termo de fonte, pela constraint do termo fora do tipo', 'brand_assets_termo_fora_do_tipo', t.nome);
end $$;

-- ─── 2. Quem aceitou e quando vêm da sessão ─────────────────────────────────
do $$
declare m record; t record; linha record;
begin
  select * into m from mundo;
  -- O pedido MENTE: diz que quem aceitou foi a dona.
  t := pg_temp.tentar(m.editora, pg_temp.fonte(m.fonte, m.marca_a, 'mentira-de-autor.ttf', 'font/ttf', '1',
                      'termo_aceito_por=' || m.dona::text));
  perform pg_temp.registrar('o envio com autor mentido é aceito, mas corrigido pelo banco', 'ACEITOU', t.estado);
  select * into linha from public.brand_assets where file_name = 'mentira-de-autor.ttf';
  perform pg_temp.registrar('quem aceitou é quem estava na sessão (editora), não a dona', m.editora::text, linha.termo_aceito_por::text);
  perform pg_temp.registrar('a versão aceita fica gravada', '1', linha.termo_versao);
  perform pg_temp.registrar('a data do aceite existe', 'sim', case when linha.termo_aceito_em is not null then 'sim' else 'não' end);
end $$;

-- ─── 3. O aceite não se reescreve; a retirada é de quem administra ─────────
do $$
declare m record; t record; alvo uuid;
begin
  select * into m from mundo;
  select id into alvo from public.brand_assets where file_name = 'marca-regular.ttf';

  t := pg_temp.tentar(m.editora, format('update public.brand_assets set termo_aceito_em = now() where id = %L', alvo));
  perform pg_temp.registrar('quem edita NÃO reescreve a data do aceite', 'brand_assets_aceite_imutavel', t.nome);
  t := pg_temp.tentar(m.dona, format('update public.brand_assets set termo_aceito_por = %L where id = %L', m.dona, alvo));
  perform pg_temp.registrar('nem quem administra troca quem aceitou', 'brand_assets_aceite_imutavel', t.nome);

  t := pg_temp.tentar(m.editora, format('update public.brand_assets set retirada_em = now() where id = %L', alvo));
  perform pg_temp.registrar('quem só edita NÃO retira a fonte', 'brand_assets_retirada_so_admin', t.nome);
  t := pg_temp.tentar(m.dona, format('update public.brand_assets set retirada_em = now(), retirada_motivo = ''pedido da foundry'' where id = %L', alvo));
  perform pg_temp.registrar('quem administra retira a fonte', 'ACEITOU', t.estado);
  t := pg_temp.tentar(m.dona, format('update public.brand_assets set retirada_motivo = ''x'' where id = %L',
    (select id from public.brand_assets where file_name = 'marca-bold.otf')));
  perform pg_temp.registrar('motivo sem retirada é recusado pela constraint certa', 'brand_assets_retirada_motivo_check', t.nome);
end $$;

-- ─── 4. Quem não alcança a marca, ou só consulta, não envia ─────────────────
do $$
declare m record; antes int; depois int; t record;
begin
  select * into m from mundo;
  select count(*) into antes from public.brand_assets where mime_type like 'font/%';
  t := pg_temp.tentar(m.leitora, pg_temp.fonte(m.fonte, m.marca_a, 'leitora.ttf', 'font/ttf', '1'));
  perform pg_temp.registrar('quem só consulta NÃO envia fonte', '42501', t.estado);
  t := pg_temp.tentar(m.estranha, pg_temp.fonte(m.fonte, m.marca_a, 'estranha.ttf', 'font/ttf', '1'));
  perform pg_temp.registrar('a conta B NÃO envia fonte para a marca A', '42501', t.estado);
  t := pg_temp.tentar(null, pg_temp.fonte(m.fonte, m.marca_a, 'anon.ttf', 'font/ttf', '1'));
  perform pg_temp.registrar('anon NÃO envia fonte', '42501', t.estado);
  select count(*) into depois from public.brand_assets where mime_type like 'font/%';
  perform pg_temp.registrar('nenhuma recusa deixou linha', antes::text, depois::text);
  -- A leitora e a estranha não leem fonte alheia.
  perform pg_temp.registrar('a conta B não lê as fontes da A', '0',
    pg_temp.contar(m.estranha, format('select count(*) from public.brand_assets where brand_id = %L', m.marca_a))::text);
end $$;

-- ─── 5. O texto do termo só se lê, e a impressão digital confere ───────────
do $$
declare m record; t record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('quem entrou lê a versão 1 do termo', '1',
    pg_temp.contar(m.leitora, 'select count(*) from public.versoes_do_termo_de_fonte where versao = ''1''')::text);
  perform pg_temp.registrar('a impressão digital é a do texto em português', 'confere',
    (select case when sha256 = encode(sha256(convert_to(texto_pt, 'UTF8')), 'hex') then 'confere' else 'diverge' end
       from public.versoes_do_termo_de_fonte where versao = '1'));
  t := pg_temp.tentar(null, 'select count(*) from public.versoes_do_termo_de_fonte');
  perform pg_temp.registrar('anon NÃO lê o termo', '42501', t.estado);
  t := pg_temp.tentar(m.dona, 'update public.versoes_do_termo_de_fonte set texto_pt = ''outro''');
  perform pg_temp.registrar('nem quem administra reescreve o termo', '42501', t.estado);
  t := pg_temp.tentar(m.dona, 'delete from public.versoes_do_termo_de_fonte');
  perform pg_temp.registrar('nem apaga', '42501', t.estado);
  t := pg_temp.tentar(m.dona, 'insert into public.versoes_do_termo_de_fonte (versao, texto_pt, texto_en, sha256) values (''2'', ''x'', ''y'', ''z'')');
  perform pg_temp.registrar('nem cria uma versão nova: só migration', '42501', t.estado);
end $$;

-- ─── 6. A licença do item: vocabulário fechado ─────────────────────────────
do $$
declare m record; t record;
begin
  select * into m from mundo;
  t := pg_temp.tentar(m.editora, format('update public.brand_asset_items set licenca_tipo = ''qualquer'' where id = %L', m.fonte));
  perform pg_temp.registrar('tipo de licença fora da lista, pela constraint certa', 'brand_asset_items_licenca_tipo_check', t.nome);
  t := pg_temp.tentar(m.editora, format('update public.brand_asset_items set licenca_tipo = ''livre'' where id = %L', m.fonte));
  perform pg_temp.registrar('quem edita informa a licença do item', 'ACEITOU', t.estado);
end $$;

-- ─── 7. Apagar o login não apaga o aceite, e não é bloqueado por ele ───────
do $$
declare m record; linha record; restante int;
begin
  select * into m from mundo;
  delete from auth.users where id = m.editora;
  select * into linha from public.brand_assets where file_name = 'marca-bold.otf';
  perform pg_temp.registrar('apagar o login mantém o aceite (versão e data)', 'mantido',
    case when linha.id is null then 'sumiu' when linha.termo_versao = '1' and linha.termo_aceito_em is not null then 'mantido' else 'perdido' end);
  perform pg_temp.registrar('e a pessoa some do aceite (chave on delete set null)', '(nulo)', linha.termo_aceito_por::text);
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
