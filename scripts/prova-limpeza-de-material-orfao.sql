-- Prova da limpeza de material órfão — 24/09/2026.
--
-- `enfileirar_materiais_orfaos` põe em `brand_deletions` o objeto de
-- `brand-assets` que tem forma de material, nenhuma referência, mais de 24 h e
-- ainda não está na fila. Esta prova confere, caso a caso, que:
--
--   1. o órfão antigo (original e miniatura) ENTRA na fila, com a conta certa e
--      com quem o enviou — ou, sem esse login, quem administra a conta;
--   2. NÃO entra: órfão recente (pela criação ou pela alteração); original
--      registrado; miniatura registrada; imagem de página referenciada; objeto
--      de outro bucket; forma fora do padrão; conta inexistente; marca de
--      outra conta;
--   3. o já enfileirado não duplica, e rodar de novo não enfileira nada;
--   4. o limite por execução vale, e fora do intervalo é recusado (22023);
--   5. `authenticated` e `anon` NÃO executam a função (42501, pelo nome dela);
--      `service_role` executa.
--
-- Cada caso tem o PRÓPRIO objeto — nada compartilhado entre casos: dado
-- compartilhado foi o que produziu o falso positivo de uma prova anterior. Os
-- casos "NÃO entra" usam caminho com a forma EXATA de material, para que a
-- recusa venha da condição testada e não da forma.
--
-- Mundo próprio, preparação que falha REPROVA, `rollback` no fim.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (conta_a uuid, conta_b uuid, admin_a uuid, admin_b uuid, quem_enviou uuid,
                         a1 uuid, b1 uuid, item uuid, enfileirados_1 integer);
create temp table caso (nome text primary key, caminho text, bucket text);
grant select on mundo, caso to authenticated, anon, service_role;

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;

-- Roda como um papel; devolve o resultado, o SQLSTATE e a mensagem.
create function pg_temp.como_papel(p_papel text, p_quem uuid, p_sql text, out saida text, out mensagem text)
language plpgsql as $f$
begin
  mensagem := '';
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_quem, 'role', p_papel)::text, true);
    execute format('set local role %I', p_papel);
    execute p_sql into saida;
    saida := coalesce(saida, 'OK');
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    get stacked diagnostics saida = returned_sqlstate, mensagem = message_text;
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

/*
 * Um objeto no Storage, com idade. `criado` e `alterado` separados para o caso
 * do objeto antigo alterado há pouco. Registra o caso e devolve o caminho.
 */
create function pg_temp.objeto(p_caso text, p_bucket text, p_caminho text, p_criado interval,
                               p_alterado interval, p_dono text) returns text
language plpgsql as $f$
begin
  insert into storage.objects (bucket_id, name, owner_id, metadata, created_at, updated_at)
  values (p_bucket, p_caminho, p_dono, '{"size": 10}', now() - p_criado, now() - p_alterado);
  insert into caso values (p_caso, p_caminho, p_bucket);
  return p_caminho;
end $f$;

/** Caminho de ORIGINAL com a forma exata: `<conta>/<marca>/<uuid>-<nome>`. */
create function pg_temp.original(p_conta uuid, p_marca uuid, p_nome text) returns text
language sql as $f$ select p_conta::text || '/' || p_marca::text || '/' || gen_random_uuid()::text || '-' || p_nome $f$;

/** Caminho de MINIATURA com a forma exata: `<conta>/<marca>/miniatura-<uuid>.png`. */
create function pg_temp.miniatura(p_conta uuid, p_marca uuid) returns text
language sql as $f$ select p_conta::text || '/' || p_marca::text || '/miniatura-' || gen_random_uuid()::text || '.png' $f$;

/** Na fila? Devolve `bucket|conta|quem pediu`, ou nulo. */
create function pg_temp.na_fila(p_caso text) returns text
language sql as $f$
  select string_agg(d.bucket_id || '|' || d.workspace_id::text || '|' || d.requested_by::text, ' ; ')
    from public.brand_deletions d join caso c on c.caminho = d.storage_path
   where c.nome = p_caso
$f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_admin_a uuid := 'f0f0f0f0-0000-4000-8000-00000000000a';
  u_admin_b uuid := 'f0f0f0f0-0000-4000-8000-00000000000b';
  u_envio   uuid := 'f0f0f0f0-0000-4000-8000-0000000000e1';
  ca uuid; cb uuid; x1 uuid; y1 uuid; it uuid;
  dois_dias constant interval := interval '2 days';
  agora_mesmo constant interval := interval '0 seconds';
  orig text; mini text; pagina text;
begin
  perform pg_temp.entrar(u_admin_a, 'lo-admin-a@local.test');
  perform pg_temp.entrar(u_admin_b, 'lo-admin-b@local.test');
  perform pg_temp.entrar(u_envio, 'lo-envio@local.test');
  ca := private.abrir_conta_de_assinatura('Conta A da limpeza', 'lo-admin-a@local.test', u_admin_a);
  cb := private.abrir_conta_de_assinatura('Conta B da limpeza', 'lo-admin-b@local.test', u_admin_b);
  x1 := pg_temp.marca(ca, 'lo-a1');
  y1 := pg_temp.marca(cb, 'lo-b1');

  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by)
  values (ca, x1, 'logo', 'Logotipo', u_admin_a) returning id into it;

  -- ENTRA ────────────────────────────────────────────────────────────────
  perform pg_temp.objeto('órfão antigo (original), enviado por quem ainda tem login',
    'brand-assets', pg_temp.original(ca, x1, 'logo.eps'), dois_dias, dois_dias, u_envio::text);
  perform pg_temp.objeto('órfão antigo (miniatura), sem dono no objeto',
    'brand-assets', pg_temp.miniatura(ca, x1), dois_dias, dois_dias, null);
  perform pg_temp.objeto('órfão antigo cujo login de envio já não existe',
    'brand-assets', pg_temp.original(ca, x1, 'antigo.svg'), dois_dias, dois_dias,
    'f0f0f0f0-0000-4000-8000-0000000000ff');
  perform pg_temp.objeto('órfão antigo da conta B',
    'brand-assets', pg_temp.original(cb, y1, 'logo-b.pdf'), dois_dias, dois_dias, u_admin_b::text);

  -- NÃO ENTRA ────────────────────────────────────────────────────────────
  perform pg_temp.objeto('órfão RECENTE (1 h)',
    'brand-assets', pg_temp.original(ca, x1, 'recente.eps'), interval '1 hour', interval '1 hour', u_envio::text);
  perform pg_temp.objeto('órfão com 23 h — ainda dentro da folga',
    'brand-assets', pg_temp.original(ca, x1, 'quase.eps'), interval '23 hours', interval '23 hours', u_envio::text);
  perform pg_temp.objeto('criado há dois dias, ALTERADO agora',
    'brand-assets', pg_temp.original(ca, x1, 'alterado.eps'), dois_dias, agora_mesmo, u_envio::text);
  -- O inverso, com relógio torto: `updated_at` antigo não envelhece um objeto
  -- criado há uma hora. Sem este caso, tirar a condição de `created_at` da
  -- função passava despercebido (achado da checagem de mutação).
  perform pg_temp.objeto('criado há 1 h com updated_at antigo (relógio torto)',
    'brand-assets', pg_temp.original(ca, x1, 'torto.eps'), interval '1 hour', dois_dias, u_envio::text);

  orig := pg_temp.objeto('original REGISTRADO em brand_assets',
    'brand-assets', pg_temp.original(ca, x1, 'registrado.svg'), dois_dias, dois_dias, u_admin_a::text);
  mini := pg_temp.objeto('miniatura REGISTRADA em brand_assets',
    'brand-assets', pg_temp.miniatura(ca, x1), dois_dias, dois_dias, u_admin_a::text);
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type,
    size_bytes, status, created_by, hierarquia, lockup, cor, polaridade, espaco_de_cor, miniatura_path)
  values (ca, x1, it, 'Logo', orig, 'registrado.svg', 'image/svg+xml', 10, 'ready', u_admin_a,
    'principal', 'horizontal', 'colorido', 'positivo', 'rgb', mini);

  -- Imagem de página com a forma EXATA de original: só a referência a salva.
  pagina := pg_temp.objeto('imagem de página REFERENCIADA em brand_documents.images',
    'brand-assets', pg_temp.original(ca, x1, 'pagina-3.png'), dois_dias, dois_dias, u_admin_a::text);
  -- O gatilho de versão editorial exige a sessão de quem edita a marca.
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name, title, status,
    images, updated_by)
  values (ca, x1, 'lo-a1', 'capa', 'Marca', 'Capa', 'draft',
    jsonb_build_array(jsonb_build_object('src', pagina, 'alt', 'página 3')), u_admin_a);
  perform set_config('request.jwt.claims', '', true);

  perform pg_temp.objeto('mesma forma, OUTRO bucket (analysis-evidence)',
    'analysis-evidence', pg_temp.original(ca, x1, 'peca.png'), dois_dias, dois_dias, u_admin_a::text);
  perform pg_temp.objeto('forma fora do padrão (sem uuid no nome)',
    'brand-assets', ca::text || '/' || x1::text || '/logo.eps', dois_dias, dois_dias, u_admin_a::text);
  perform pg_temp.objeto('forma fora do padrão (subpasta a mais)',
    'brand-assets', ca::text || '/' || x1::text || '/extra/' || gen_random_uuid()::text || '-a.eps',
    dois_dias, dois_dias, u_admin_a::text);
  perform pg_temp.objeto('forma fora do padrão (uuid em maiúsculas)',
    'brand-assets', ca::text || '/' || x1::text || '/' || upper(gen_random_uuid()::text) || '-a.eps',
    dois_dias, dois_dias, u_admin_a::text);
  perform pg_temp.objeto('pasta de conta que NÃO existe',
    'brand-assets', pg_temp.original(gen_random_uuid(), gen_random_uuid(), 'x.eps'), dois_dias, dois_dias, null);
  perform pg_temp.objeto('pasta da conta A com marca da conta B',
    'brand-assets', pg_temp.original(ca, y1, 'cruzado.eps'), dois_dias, dois_dias, u_admin_a::text);

  -- JÁ NA FILA ───────────────────────────────────────────────────────────
  -- O MAIS ANTIGO do mundo, de propósito: se a função não o filtrasse antes
  -- do limite, ele ocuparia a única vaga do caso 4b e o `on conflict` a
  -- descartaria — "limite 1 devolve 1" reprovaria.
  orig := pg_temp.objeto('órfão antigo JÁ enfileirado',
    'brand-assets', pg_temp.original(ca, x1, 'ja-na-fila.eps'), interval '3 days', interval '3 days', u_envio::text);
  insert into public.brand_deletions (workspace_id, bucket_id, storage_path, requested_by)
  values (ca, 'brand-assets', orig, u_admin_a);

  insert into mundo values (ca, cb, u_admin_a, u_admin_b, u_envio, x1, y1, it, null);
end $$;

-- ─── 5. Quem executa ───────────────────────────────────────────────────────
-- Antes da execução de verdade: se `authenticated` conseguisse, enfileiraria.
do $$
declare m record; r record;
begin
  select * into m from mundo;
  r := pg_temp.como_papel('authenticated', m.admin_a, 'select public.enfileirar_materiais_orfaos(1000)::text');
  perform pg_temp.registrar('authenticated NÃO executa (SQLSTATE)', '42501', r.saida);
  perform pg_temp.registrar('authenticated NÃO executa (mensagem)',
    'permission denied for function enfileirar_materiais_orfaos', r.mensagem);
  r := pg_temp.como_papel('anon', null, 'select public.enfileirar_materiais_orfaos(1000)::text');
  perform pg_temp.registrar('anon NÃO executa (SQLSTATE)', '42501', r.saida);
  perform pg_temp.registrar('anon NÃO executa (mensagem)',
    'permission denied for function enfileirar_materiais_orfaos', r.mensagem);
  perform pg_temp.registrar('e nada entrou na fila por eles', '1',
    (select count(*)::text from public.brand_deletions d join caso c on c.caminho = d.storage_path));
end $$;

-- ─── 4a. Limite fora do intervalo ──────────────────────────────────────────
do $$
declare r record;
begin
  r := pg_temp.como_papel('service_role', null, 'select public.enfileirar_materiais_orfaos(0)::text');
  perform pg_temp.registrar('limite 0 é recusado', '22023', r.saida);
  r := pg_temp.como_papel('service_role', null, 'select public.enfileirar_materiais_orfaos(1001)::text');
  perform pg_temp.registrar('limite 1001 é recusado', '22023', r.saida);
  r := pg_temp.como_papel('service_role', null, 'select public.enfileirar_materiais_orfaos(null)::text');
  perform pg_temp.registrar('limite nulo é recusado', '22023', r.saida);
end $$;

-- ─── 4b. O limite vale: com 1, entra só o mais antigo dos candidatos ───────
-- O limite 1 escolhe entre os quatro órfãos do mundo. O que se confere é a
-- CONTAGEM, e a linha é desfeita logo em seguida para não contaminar os casos
-- abaixo. O já enfileirado é o mais antigo de todos: é aqui que se vê se ele
-- é filtrado antes do limite.
do $$
declare r record; antes integer; depois integer;
begin
  select count(*) into antes from public.brand_deletions;
  r := pg_temp.como_papel('service_role', null, 'select public.enfileirar_materiais_orfaos(1)::text');
  select count(*) into depois from public.brand_deletions;
  perform pg_temp.registrar('limite 1 devolve 1', '1', r.saida);
  perform pg_temp.registrar('limite 1 enfileira exatamente 1', '1', (depois - antes)::text);
  delete from public.brand_deletions d using caso c
   where c.caminho = d.storage_path and c.nome <> 'órfão antigo JÁ enfileirado';
end $$;

-- ─── A execução de verdade, como service_role ──────────────────────────────
do $$
declare r record;
begin
  r := pg_temp.como_papel('service_role', null, 'select public.enfileirar_materiais_orfaos(1000)::text');
  update mundo set enfileirados_1 = nullif(r.saida, '')::integer;
  perform pg_temp.registrar('service_role executa e devolve quantos enfileirou', '4', r.saida);
end $$;

-- ─── 1. Entra ──────────────────────────────────────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('órfão antigo (original) entra, pedido por quem enviou',
    'brand-assets|' || m.conta_a || '|' || m.quem_enviou,
    pg_temp.na_fila('órfão antigo (original), enviado por quem ainda tem login'));
  perform pg_temp.registrar('órfão antigo (miniatura) entra, pedido por quem administra a conta',
    'brand-assets|' || m.conta_a || '|' || m.admin_a,
    pg_temp.na_fila('órfão antigo (miniatura), sem dono no objeto'));
  perform pg_temp.registrar('login de envio apagado: pede quem administra a conta',
    'brand-assets|' || m.conta_a || '|' || m.admin_a,
    pg_temp.na_fila('órfão antigo cujo login de envio já não existe'));
  perform pg_temp.registrar('órfão da conta B entra NA CONTA B',
    'brand-assets|' || m.conta_b || '|' || m.admin_b,
    pg_temp.na_fila('órfão antigo da conta B'));
end $$;

-- ─── 2. Não entra ──────────────────────────────────────────────────────────
do $$
declare nome text;
begin
  foreach nome in array array[
    'órfão RECENTE (1 h)',
    'órfão com 23 h — ainda dentro da folga',
    'criado há dois dias, ALTERADO agora',
    'criado há 1 h com updated_at antigo (relógio torto)',
    'original REGISTRADO em brand_assets',
    'miniatura REGISTRADA em brand_assets',
    'imagem de página REFERENCIADA em brand_documents.images',
    'mesma forma, OUTRO bucket (analysis-evidence)',
    'forma fora do padrão (sem uuid no nome)',
    'forma fora do padrão (subpasta a mais)',
    'forma fora do padrão (uuid em maiúsculas)',
    'pasta de conta que NÃO existe',
    'pasta da conta A com marca da conta B'
  ] loop
    perform pg_temp.registrar(nome || ' — NÃO entra', '(nulo)', pg_temp.na_fila(nome));
  end loop;
end $$;

-- ─── 3. Já na fila não duplica; de novo, nada ──────────────────────────────
do $$
declare m record; r record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('o já enfileirado continua UMA linha, a original',
    'brand-assets|' || m.conta_a || '|' || m.admin_a,
    pg_temp.na_fila('órfão antigo JÁ enfileirado'));
  r := pg_temp.como_papel('service_role', null, 'select public.enfileirar_materiais_orfaos(1000)::text');
  perform pg_temp.registrar('rodar de novo não enfileira nada', '0', r.saida);
  perform pg_temp.registrar('e a fila do mundo continua com 5 linhas', '5',
    (select count(*)::text from public.brand_deletions d join caso c on c.caminho = d.storage_path));
end $$;

-- ─── A função não apaga nada ───────────────────────────────────────────────
do $$
begin
  perform pg_temp.registrar('nenhum objeto saiu do Storage', (select count(*)::text from caso),
    (select count(*)::text from storage.objects o join caso c on c.caminho = o.name and c.bucket = o.bucket_id));
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
