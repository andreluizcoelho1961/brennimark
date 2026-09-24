-- Prova de Materiais — fatia 5, 24/09/2026: as páginas da regra no item e a
-- miniatura da variante.
--
--   1. quem edita a marca liga o item a até cinco páginas do manual; a forma
--      errada é recusada pelo NOME da constraint;
--   2. quem só consulta não altera a regra, nem a outra conta;
--   3. a miniatura é da própria marca, tem nome próprio e nunca é o original;
--      duas variantes não dividem a mesma;
--   4. no Storage, quem consulta LÊ a miniatura e NÃO lê o original — a prévia
--      não abre o caminho que o registro de download fecha; a outra conta não
--      lê nenhuma das duas.
--
-- Mundo próprio, papel `authenticated`, preparação que falha REPROVA,
-- `rollback` no fim.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (conta_a uuid, conta_b uuid, admin_a uuid, admin_b uuid, consultor uuid,
                         a1 uuid, b1 uuid, item uuid, variante uuid, original text, miniatura text);
grant select on mundo to authenticated, anon;

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;

-- Roda como alguém; devolve o resultado, o SQLSTATE, e o nome da constraint.
create function pg_temp.como(p_quem uuid, p_sql text, out saida text, out nome text)
language plpgsql as $f$
begin
  nome := '';
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
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
  u_admin_a  uuid := 'e0e0e0e0-0000-4000-8000-00000000000a';
  u_admin_b  uuid := 'e0e0e0e0-0000-4000-8000-00000000000b';
  u_consulta uuid := 'e0e0e0e0-0000-4000-8000-0000000000c1';
  ca uuid; cb uuid; x1 uuid; y1 uuid; it uuid; va uuid; orig text; mini text;
begin
  perform pg_temp.entrar(u_admin_a, 'mt-admin-a@local.test');
  perform pg_temp.entrar(u_admin_b, 'mt-admin-b@local.test');
  perform pg_temp.entrar(u_consulta, 'mt-consulta@local.test');
  ca := private.abrir_conta_de_assinatura('Conta A dos Materiais', 'mt-admin-a@local.test', u_admin_a);
  cb := private.abrir_conta_de_assinatura('Conta B dos Materiais', 'mt-admin-b@local.test', u_admin_b);
  x1 := pg_temp.marca(ca, 'mt-a1');
  y1 := pg_temp.marca(cb, 'mt-b1');

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  perform public.conceder_acesso(ca, 'mt-consulta@local.test', 'consulta', array[x1]);
  perform set_config('request.jwt.claims', '', true);

  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by)
  values (ca, x1, 'logo', 'Logotipo', u_admin_a) returning id into it;

  orig := ca::text || '/' || x1::text || '/' || gen_random_uuid()::text || '-logo.svg';
  mini := ca::text || '/' || x1::text || '/miniatura-' || gen_random_uuid()::text || '.png';
  insert into storage.objects (bucket_id, name, owner_id, metadata) values
    ('brand-assets', orig, u_admin_a::text, '{"size": 100}'),
    ('brand-assets', mini, u_admin_a::text, '{"size": 10}');
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type,
    size_bytes, status, created_by, hierarquia, lockup, cor, polaridade, espaco_de_cor, miniatura_path)
  values (ca, x1, it, 'Logo', orig, 'logo.svg', 'image/svg+xml', 100, 'ready', u_admin_a,
    'principal', 'horizontal', 'colorido', 'positivo', 'rgb', mini)
  returning id into va;

  insert into mundo values (ca, cb, u_admin_a, u_admin_b, u_consulta, x1, y1, it, va, orig, mini);
end $$;

-- ─── 1. As páginas da regra ────────────────────────────────────────────────
do $$
declare m record; r record;
begin
  select * into m from mundo;
  r := pg_temp.como(m.admin_a, format(
    'update public.brand_asset_items set regra_paginas = ''{12,14}'' where id = %L returning array_to_string(regra_paginas, '','')', m.item));
  perform pg_temp.registrar('quem edita a marca liga o item às páginas 12 e 14', '12,14', r.saida);

  r := pg_temp.como(m.admin_a, format('update public.brand_asset_items set regra_paginas = ''{1,2,3,4,5,6}'' where id = %L returning 1', m.item));
  perform pg_temp.registrar('seis páginas é demais', 'brand_asset_items_regra_paginas_check', r.nome);
  r := pg_temp.como(m.admin_a, format('update public.brand_asset_items set regra_paginas = ''{0}'' where id = %L returning 1', m.item));
  perform pg_temp.registrar('página zero não existe', 'brand_asset_items_regra_paginas_check', r.nome);
  r := pg_temp.como(m.admin_a, format('update public.brand_asset_items set regra_paginas = ''{-3}'' where id = %L returning 1', m.item));
  perform pg_temp.registrar('página negativa não existe', 'brand_asset_items_regra_paginas_check', r.nome);
  r := pg_temp.como(m.admin_a, format('update public.brand_asset_items set regra_paginas = ''{{1,2},{3,4}}'' where id = %L returning 1', m.item));
  perform pg_temp.registrar('matriz de páginas não é lista', 'brand_asset_items_regra_paginas_check', r.nome);
  r := pg_temp.como(m.admin_a, format('update public.brand_asset_items set regra_paginas = array[3, null]::integer[] where id = %L returning 1', m.item));
  perform pg_temp.registrar('página nula não entra', 'brand_asset_items_regra_paginas_check', r.nome);
  r := pg_temp.como(m.admin_a, format('update public.brand_asset_items set regra_paginas = ''{}'' where id = %L returning cardinality(regra_paginas)::text', m.item));
  perform pg_temp.registrar('e desligar a regra é lista vazia', '0', r.saida);
  update public.brand_asset_items set regra_paginas = '{12,14}' where id = m.item;
end $$;

-- ─── 2. Quem não edita não altera ──────────────────────────────────────────
do $$
declare m record; atual text;
begin
  select * into m from mundo;
  perform pg_temp.registrar('quem só consulta NÃO altera a regra (nenhuma linha)', 'OK',
    (pg_temp.como(m.consultor, format('update public.brand_asset_items set regra_paginas = ''{1}'' where id = %L returning 1', m.item))).saida);
  perform pg_temp.registrar('quem administra OUTRA conta NÃO altera a regra', 'OK',
    (pg_temp.como(m.admin_b, format('update public.brand_asset_items set regra_paginas = ''{1}'' where id = %L returning 1', m.item))).saida);
  select array_to_string(regra_paginas, ',') into atual from public.brand_asset_items where id = m.item;
  perform pg_temp.registrar('e a regra continua 12,14', '12,14', atual);
  perform pg_temp.registrar('quem só consulta LÊ a regra', '12,14',
    (pg_temp.como(m.consultor, format('select array_to_string(regra_paginas, '','') from public.brand_asset_items where id = %L', m.item))).saida);
end $$;

-- ─── 3. A forma da miniatura ───────────────────────────────────────────────
do $$
declare m record; r record; outra text;
begin
  select * into m from mundo;
  outra := m.conta_b::text || '/' || m.b1::text || '/miniatura-' || gen_random_uuid()::text || '.png';
  r := pg_temp.como(m.admin_a, format('update public.brand_assets set miniatura_path = %L where id = %L returning 1', outra, m.variante));
  perform pg_temp.registrar('miniatura na pasta de OUTRA marca é recusada', 'brand_assets_miniatura_da_marca_check', r.nome);
  r := pg_temp.como(m.admin_a, format('update public.brand_assets set miniatura_path = storage_path where id = %L returning 1', m.variante));
  perform pg_temp.registrar('a miniatura nunca é o próprio original', 'brand_assets_miniatura_da_marca_check', r.nome);
  r := pg_temp.como(m.admin_a, format('update public.brand_assets set miniatura_path = %L where id = %L returning 1',
    m.conta_a::text || '/' || m.a1::text || '/miniatura-' || gen_random_uuid()::text || '.svg', m.variante));
  perform pg_temp.registrar('miniatura que não é PNG é recusada', 'brand_assets_miniatura_da_marca_check', r.nome);
  r := pg_temp.como(m.admin_a, format('update public.brand_assets set miniatura_path = %L where id = %L returning 1',
    m.conta_a::text || '/' || m.a1::text || '/sub/miniatura-' || gen_random_uuid()::text || '.png', m.variante));
  perform pg_temp.registrar('miniatura em subpasta é recusada', 'brand_assets_miniatura_da_marca_check', r.nome);

  -- Uma segunda variante tentando a MESMA miniatura.
  r := pg_temp.como(m.admin_a, format(
    'insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status, created_by, '
    || 'hierarquia, lockup, cor, polaridade, espaco_de_cor, miniatura_path) values (%L, %L, %L, ''Outra'', %L, ''outra.svg'', ''image/svg+xml'', 1, ''ready'', %L, '
    || '''principal'', ''vertical'', ''colorido'', ''positivo'', ''rgb'', %L) returning 1',
    m.conta_a, m.a1, m.item, m.conta_a::text || '/' || m.a1::text || '/' || gen_random_uuid()::text || '-outra.svg', m.admin_a, m.miniatura));
  perform pg_temp.registrar('duas variantes não dividem a mesma miniatura', 'brand_assets_miniatura_unica_idx', r.nome);
end $$;

-- ─── 4. No Storage: a miniatura se lê, o original não ──────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('quem consulta LÊ a miniatura no Storage', '1',
    (pg_temp.como(m.consultor, format('select count(*)::text from storage.objects where bucket_id = ''brand-assets'' and name = %L', m.miniatura))).saida);
  perform pg_temp.registrar('quem consulta NÃO lê o original — só pela rota que registra', '0',
    (pg_temp.como(m.consultor, format('select count(*)::text from storage.objects where bucket_id = ''brand-assets'' and name = %L', m.original))).saida);
  perform pg_temp.registrar('nem quem administra lê o original direto', '0',
    (pg_temp.como(m.admin_a, format('select count(*)::text from storage.objects where bucket_id = ''brand-assets'' and name = %L', m.original))).saida);
  perform pg_temp.registrar('a OUTRA conta não lê a miniatura', '0',
    (pg_temp.como(m.admin_b, format('select count(*)::text from storage.objects where bucket_id = ''brand-assets'' and name = %L', m.miniatura))).saida);
end $$;

-- ─── 5. A miniatura vai para a fila junto com a variante ───────────────────
do $$
declare m record; n int; mini2 text; va2 uuid; x2 uuid;
begin
  select * into m from mundo;

  -- Variante apagada sozinha, pela função do produto, como quem edita.
  perform pg_temp.como(m.admin_a, format('select public.delete_asset_with_file(%L)', m.variante));
  select count(*) into n from public.brand_deletions where storage_path = m.miniatura;
  perform pg_temp.registrar('apagar a variante enfileira a miniatura', '1', n::text);
  select count(*) into n from public.brand_deletions where storage_path = m.original;
  perform pg_temp.registrar('e o original, como sempre', '1', n::text);

  -- A marca inteira, em cascata.
  x2 := pg_temp.marca(m.conta_a, 'mt-a2');
  mini2 := m.conta_a::text || '/' || x2::text || '/miniatura-' || gen_random_uuid()::text || '.png';
  insert into public.brand_asset_items (id, workspace_id, brand_id, tipo, nome, created_by)
  values (gen_random_uuid(), m.conta_a, x2, 'icone', 'Ícones', m.admin_a);
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type,
    size_bytes, status, created_by, cor, polaridade, espaco_de_cor, miniatura_path)
  select m.conta_a, x2, i.id, 'Ícone', m.conta_a::text || '/' || x2::text || '/' || gen_random_uuid()::text || '-i.svg',
    'i.svg', 'image/svg+xml', 1, 'ready', m.admin_a, 'colorido', 'positivo', 'rgb', mini2
  from public.brand_asset_items i where i.brand_id = x2;
  delete from public.brands where id = x2;
  select count(*) into n from public.brand_deletions where storage_path = mini2;
  perform pg_temp.registrar('apagar a MARCA enfileira as miniaturas dela', '1', n::text);
end $$;

-- A conta inteira: o gatilho não pode travar a exclusão (a fila aponta para a
-- conta que está sumindo). Caso isolado, com conta própria.
do $$
declare ca uuid; x uuid; it uuid; ok text := 'apagou';
  dono uuid := 'e0e0e0e0-0000-4000-8000-0000000000d9';
begin
  perform pg_temp.entrar(dono, 'mt-dono-c@local.test');
  ca := private.abrir_conta_de_assinatura('Conta C dos Materiais', 'mt-dono-c@local.test', dono);
  x := pg_temp.marca(ca, 'mt-c1');
  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by)
  values (ca, x, 'logo', 'Logo', dono) returning id into it;
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type,
    size_bytes, status, created_by, hierarquia, lockup, cor, polaridade, espaco_de_cor, miniatura_path)
  values (ca, x, it, 'Logo', ca::text || '/' || x::text || '/' || gen_random_uuid()::text || '-l.svg', 'l.svg',
    'image/svg+xml', 1, 'ready', dono, 'principal', 'horizontal', 'colorido', 'positivo', 'rgb',
    ca::text || '/' || x::text || '/miniatura-' || gen_random_uuid()::text || '.png');
  begin
    delete from public.workspaces where id = ca;
  exception when others then
    ok := 'travou: ' || sqlstate;
  end;
  perform pg_temp.registrar('apagar a CONTA inteira não é travado pelo gatilho', 'apagou', ok);
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
