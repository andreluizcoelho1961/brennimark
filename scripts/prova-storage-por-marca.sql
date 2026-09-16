-- Prova de que os ARQUIVOS são por marca — achados 1 e 2 do Codex Security, 15/09/2026.
--
-- Esta prova foi rodada PRIMEIRO contra as policies antigas, e reprovou: é a
-- reprodução do vazamento. Uma prova que só é vista verde não mostra que teria
-- visto o defeito.
--
-- Como a API do Storage decide: ela consulta `storage.objects` com a sessão da
-- pessoa, e a RLS dessa tabela é quem autoriza. A prova faz o mesmo. Para
-- apagar, a API liga `storage.allow_delete_query`, que desarma a trava contra
-- `delete` direto; a prova liga igual, e quem decide passa a ser a policy.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE conferido,
-- `rollback` no fim.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
grant select, insert on resultado to authenticated, anon;
grant usage, select on sequence resultado_ordem_seq to authenticated, anon;

do $$
declare
  u_dona  uuid := '88888888-8888-4888-8888-88888888aaaa';
  u_x     uuid := '88888888-8888-4888-8888-88888888bbbb';  -- consulta a marca UM
  u_y     uuid := '88888888-8888-4888-8888-88888888cccc';  -- edita a marca DOIS
  u_autor uuid := '88888888-8888-4888-8888-88888888dddd';  -- consulta UM e fez uma análise nela
  u_outro uuid := '88888888-8888-4888-8888-88888888eeee';  -- consulta UM, não é autor
  u_dono2 uuid := '88888888-8888-4888-8888-88888888ffff';  -- DONO da conta, mas só consulta a UM
  w uuid; um uuid; dois uuid; run_um uuid; run_dois uuid;
  imp_um uuid := gen_random_uuid(); imp_dois uuid := gen_random_uuid(); imp_sem uuid := gen_random_uuid();
  sha text := repeat('ab', 32);
begin
  insert into auth.users (id, email, aud, role) values
    (u_dona,  'st-dona@local.test',  'authenticated', 'authenticated'),
    (u_x,     'st-x@local.test',     'authenticated', 'authenticated'),
    (u_y,     'st-y@local.test',     'authenticated', 'authenticated'),
    (u_autor, 'st-autor@local.test', 'authenticated', 'authenticated'),
    (u_outro, 'st-outro@local.test', 'authenticated', 'authenticated'),
    (u_dono2, 'st-dono2@local.test', 'authenticated', 'authenticated');

  insert into public.workspaces (name, slug) values ('Prova Storage', 'prova-storage') returning id into w;
  insert into public.workspace_members (workspace_id, user_id, role) values
    (w, u_dona, 'owner'), (w, u_x, 'member'), (w, u_y, 'member'),
    (w, u_autor, 'member'), (w, u_outro, 'member'), (w, u_dono2, 'owner');

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w, 'st-um', 'ST Um', 'U', 'um', 'pt-BR', '{}','{}','{}','{}','{}') returning id into um;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w, 'st-dois', 'ST Dois', 'D', 'dois', 'pt-BR', '{}','{}','{}','{}','{}') returning id into dois;

  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades) values
    (um,   w, u_dona,  array['consultar','editar','aprovar','administrar']),
    (dois, w, u_dona,  array['consultar','editar','aprovar','administrar']),
    (um,   w, u_x,     array['consultar']),
    (dois, w, u_y,     array['consultar','editar']),
    (um,   w, u_autor, array['consultar']),
    (um,   w, u_outro, array['consultar']),
    (um,   w, u_dono2, array['consultar'])
  on conflict (brand_id, user_id) do update set capacidades = excluded.capacidades;

  -- brand-assets: imagem de página em cada marca, e um arquivo DA BIBLIOTECA na UM.
  insert into storage.objects (bucket_id, name, owner_id) values
    ('brand-assets', w::text||'/'||um::text||'/pagina-1.png', u_dona::text),
    ('brand-assets', w::text||'/'||dois::text||'/pagina-1.png', u_dona::text),
    ('brand-assets', w::text||'/'||um::text||'/logo-oficial.svg', u_dona::text);
  insert into public.brand_assets (workspace_id, brand_id, label, description, category, storage_path, file_name, mime_type, size_bytes, status, created_by)
  values (w, um, 'Logo oficial', '', 'Logotipos', w::text||'/'||um::text||'/logo-oficial.svg', 'logo-oficial.svg', 'image/svg+xml', 100, 'ready', u_dona);

  -- brand-imports: PDF ligado à UM, ligado à DOIS, e um ainda sem marca.
  insert into storage.objects (bucket_id, name, owner_id) values
    ('brand-imports', w::text||'/'||imp_um::text||'/'||sha||'.pdf', u_dona::text),
    ('brand-imports', w::text||'/'||imp_dois::text||'/'||sha||'.pdf', u_dona::text),
    ('brand-imports', w::text||'/'||imp_sem::text||'/'||sha||'.pdf', u_dona::text);
  insert into public.brand_imports (import_id, workspace_id, brand_id, storage_path, pdf_sha256, page_count, document_count, created_by) values
    (imp_um,   w, um,   w::text||'/'||imp_um::text||'/'||sha||'.pdf',   sha, 2, 0, u_dona),
    (imp_dois, w, dois, w::text||'/'||imp_dois::text||'/'||sha||'.pdf', sha, 2, 0, u_dona),
    (imp_sem,  w, null, w::text||'/'||imp_sem::text||'/'||sha||'.pdf',  sha, 2, 0, u_dona);

  -- analysis-evidence: análise do autor na UM, e da dona na DOIS.
  insert into public.analysis_runs (workspace_id, brand_id, created_by, file_name, image_media_type, image_size_bytes, image_fingerprint, question, analysis, provider, model, elapsed_ms)
  values (w, um, u_autor, 'peca.png', 'image/png', 100, 'fp', 'q', '{}', 'p', 'm', 1) returning id into run_um;
  insert into public.analysis_runs (workspace_id, brand_id, created_by, file_name, image_media_type, image_size_bytes, image_fingerprint, question, analysis, provider, model, elapsed_ms)
  values (w, dois, u_dona, 'peca.png', 'image/png', 100, 'fp', 'q', '{}', 'p', 'm', 1) returning id into run_dois;
  insert into storage.objects (bucket_id, name, owner_id) values
    ('analysis-evidence', w::text||'/'||um::text||'/'||run_um::text||'-evidence.png', u_autor::text),
    ('analysis-evidence', w::text||'/'||dois::text||'/'||run_dois::text||'-evidence.png', u_dona::text);
  -- `image_path` preenchido como o produto faz: sem ele, `delete_brand_with_files`
  -- não enfileira a evidência, e o caso da seção 6 nunca chegaria à regra que
  -- diz testar. (A primeira versão desta prova esqueceu, e reprovou por isso.)
  update public.analysis_runs set image_path = w::text||'/'||um::text||'/'||run_um::text||'-evidence.png' where id = run_um;
  update public.analysis_runs set image_path = w::text||'/'||dois::text||'/'||run_dois::text||'-evidence.png' where id = run_dois;

  create temp table mundo as select
    u_dono2 as dono2,
    u_dona as dona, u_x as x, u_y as y, u_autor as autor, u_outro as outro,
    w as conta, um, dois, run_um, run_dois,
    w::text||'/'||um::text||'/pagina-1.png'   as pagina_um,
    w::text||'/'||dois::text||'/pagina-1.png' as pagina_dois,
    w::text||'/'||um::text||'/logo-oficial.svg' as biblioteca_um,
    w::text||'/'||imp_um::text||'/'||sha||'.pdf'   as pdf_um,
    w::text||'/'||imp_dois::text||'/'||sha||'.pdf' as pdf_dois,
    w::text||'/'||imp_sem::text||'/'||sha||'.pdf'  as pdf_sem,
    w::text||'/'||um::text||'/'||run_um::text||'-evidence.png'     as evidencia_um,
    w::text||'/'||dois::text||'/'||run_dois::text||'-evidence.png' as evidencia_dois;
  grant select on mundo to authenticated, anon;
end $$;

-- Quantos objetos a pessoa enxerga com aquele nome, naquele bucket.
create function pg_temp.ve(pessoa uuid, balde text, caminho text) returns integer
language plpgsql as $$
declare n integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pessoa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = balde and name = caminho;
  reset role;
  return n;
end $$;

-- ─── 1. Leitura entre marcas: o vazamento do achado 2 ──────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  insert into resultado (caso, esperado, obtido, passou) values
    ('x le a imagem de pagina da marca dele', '1', pg_temp.ve(m.x,'brand-assets',m.pagina_um)::text, pg_temp.ve(m.x,'brand-assets',m.pagina_um) = 1),
    ('x NAO le a imagem de pagina da OUTRA marca', '0', pg_temp.ve(m.x,'brand-assets',m.pagina_dois)::text, pg_temp.ve(m.x,'brand-assets',m.pagina_dois) = 0),
    ('x le o PDF da marca dele', '1', pg_temp.ve(m.x,'brand-imports',m.pdf_um)::text, pg_temp.ve(m.x,'brand-imports',m.pdf_um) = 1),
    ('x NAO le o PDF da OUTRA marca', '0', pg_temp.ve(m.x,'brand-imports',m.pdf_dois)::text, pg_temp.ve(m.x,'brand-imports',m.pdf_dois) = 0),
    ('x NAO le PDF ainda sem marca', '0', pg_temp.ve(m.x,'brand-imports',m.pdf_sem)::text, pg_temp.ve(m.x,'brand-imports',m.pdf_sem) = 0),
    ('a dona le o PDF ainda sem marca', '1', pg_temp.ve(m.dona,'brand-imports',m.pdf_sem)::text, pg_temp.ve(m.dona,'brand-imports',m.pdf_sem) = 1),
    ('x le a evidencia da marca dele', '1', pg_temp.ve(m.x,'analysis-evidence',m.evidencia_um)::text, pg_temp.ve(m.x,'analysis-evidence',m.evidencia_um) = 1),
    ('x NAO le a evidencia da OUTRA marca', '0', pg_temp.ve(m.x,'analysis-evidence',m.evidencia_dois)::text, pg_temp.ve(m.x,'analysis-evidence',m.evidencia_dois) = 0);
end $$;

-- ─── 2. Arquivo da biblioteca: só pela rota, para ninguém ──────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  insert into resultado (caso, esperado, obtido, passou) values
    ('x NAO le direto o arquivo da biblioteca da marca dele', '0', pg_temp.ve(m.x,'brand-assets',m.biblioteca_um)::text, pg_temp.ve(m.x,'brand-assets',m.biblioteca_um) = 0),
    ('nem a dona le direto o arquivo da biblioteca', '0', pg_temp.ve(m.dona,'brand-assets',m.biblioteca_um)::text, pg_temp.ve(m.dona,'brand-assets',m.biblioteca_um) = 0);
end $$;

-- ─── 3. Mutação da evidência: o achado 1 ───────────────────────────────────
do $$
declare m record; n integer; estado text;
begin
  select * into m from mundo;

  -- Quem não é autor não altera nem apaga a evidência da análise alheia.
  perform set_config('request.jwt.claims', json_build_object('sub', m.outro, 'role', 'authenticated')::text, true);
  perform set_config('storage.allow_delete_query', 'true', true);
  set local role authenticated;
  update storage.objects set metadata = '{"adulterado": true}' where bucket_id = 'analysis-evidence' and name = m.evidencia_um;
  get diagnostics n = row_count;
  insert into resultado (caso, esperado, obtido, passou) values ('quem NAO e autor NAO altera a evidencia', '0 linhas', n || ' linhas', n = 0);
  delete from storage.objects where bucket_id = 'analysis-evidence' and name = m.evidencia_um;
  get diagnostics n = row_count;
  insert into resultado (caso, esperado, obtido, passou) values ('quem NAO e autor NAO apaga a evidencia', '0 linhas', n || ' linhas', n = 0);

  -- Nem envia evidência para a análise de outra pessoa.
  begin
    insert into storage.objects (bucket_id, name, owner_id)
    values ('analysis-evidence', m.conta::text||'/'||m.um::text||'/'||m.run_um::text||'-forjada.png', m.outro::text);
    estado := 'ENVIOU';
  exception when others then estado := sqlstate;
  end;
  reset role;
  insert into resultado (caso, esperado, obtido, passou) values ('quem NAO e autor NAO envia evidencia da analise alheia', '42501', estado, estado = '42501');

  -- O autor apaga a própria.
  perform set_config('request.jwt.claims', json_build_object('sub', m.autor, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from storage.objects where bucket_id = 'analysis-evidence' and name = m.evidencia_um;
  get diagnostics n = row_count;
  reset role;
  insert into resultado (caso, esperado, obtido, passou) values ('o autor apaga a propria evidencia', '1 linha', n || ' linha', n = 1);
end $$;

-- ─── 4. Escrita no brand-assets por marca ──────────────────────────────────
do $$
declare m record; n integer; estado_fora text; estado_dentro text;
begin
  select * into m from mundo;
  perform set_config('request.jwt.claims', json_build_object('sub', m.y, 'role', 'authenticated')::text, true);
  perform set_config('storage.allow_delete_query', 'true', true);
  set local role authenticated;

  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('brand-assets', m.conta::text||'/'||m.um::text||'/intruso.png', m.y::text);
    estado_fora := 'ENVIOU';
  exception when others then estado_fora := sqlstate;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('brand-assets', m.conta::text||'/'||m.dois::text||'/novo.png', m.y::text);
    estado_dentro := 'ENVIOU';
  exception when others then estado_dentro := sqlstate;
  end;
  delete from storage.objects where bucket_id = 'brand-assets' and name = m.pagina_um;
  get diagnostics n = row_count;
  reset role;

  insert into resultado (caso, esperado, obtido, passou) values
    ('quem edita a DOIS NAO envia arquivo para a UM', '42501', estado_fora, estado_fora = '42501'),
    ('quem edita a DOIS envia arquivo para a DOIS', 'ENVIOU', estado_dentro, estado_dentro = 'ENVIOU'),
    ('quem edita a DOIS NAO apaga arquivo da UM', '0 linhas', n || ' linhas', n = 0);
end $$;

-- ─── 5. Caminho malformado não derruba a consulta ──────────────────────────
do $$
declare m record; n integer; estado text;
begin
  select * into m from mundo;
  insert into storage.objects (bucket_id, name, owner_id) values ('brand-assets', 'nao-e-conta/nao-e-uuid/x.png', m.dona::text);
  begin
    n := pg_temp.ve(m.x, 'brand-assets', 'nao-e-conta/nao-e-uuid/x.png');
    estado := n::text;
  exception when others then estado := sqlstate;
  end;
  insert into resultado (caso, esperado, obtido, passou) values
    ('segmento que nao e uuid nao levanta erro', '0', estado, estado = '0');
end $$;

-- ─── 6. Depois de apagar uma marca, os arquivos saem de fato ───────────────
--
-- Achado repassando os consumidores, não pela prova: a drenagem da fila roda
-- com a sessão de quem administra a conta DEPOIS de os acessos da marca
-- sumirem em cascata. Sem a regra de limpeza, a remoção não casava com policy
-- nenhuma e a pendência fechava como se o arquivo tivesse saído.
do $$
declare m record; n integer;
begin
  select * into m from mundo;

  -- A dona apaga a marca DOIS pelo caminho do produto.
  perform set_config('request.jwt.claims', json_build_object('sub', m.dona, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.delete_brand_with_files(m.dois);
  reset role;
  if not exists (select 1 from public.brand_deletions where bucket_id = 'analysis-evidence' and storage_path = m.evidencia_dois) then
    raise exception 'premissa falhou: a evidencia da marca apagada nao foi enfileirada';
  end if;

  -- A evidência da DOIS foi enfileirada pela própria função de exclusão.
  perform set_config('request.jwt.claims', json_build_object('sub', m.dona, 'role', 'authenticated')::text, true);
  perform set_config('storage.allow_delete_query', 'true', true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'analysis-evidence' and name = m.evidencia_dois;
  insert into resultado (caso, esperado, obtido, passou) values
    ('a dona ainda enxerga a evidencia enfileirada da marca apagada', '1', n::text, n = 1);
  delete from storage.objects where bucket_id = 'analysis-evidence' and name = m.evidencia_dois;
  get diagnostics n = row_count;
  reset role;
  insert into resultado (caso, esperado, obtido, passou) values
    ('a dona apaga de fato a evidencia da marca apagada', '1 linha', n || ' linha', n = 1);

  -- A porta de limpeza NÃO serve a marca viva: dono de conta com acesso restrito
  -- na UM enfileira a imagem de página dela e tenta apagar.
  insert into public.brand_deletions (workspace_id, bucket_id, storage_path, requested_by)
  values (m.conta, 'brand-assets', m.pagina_um, m.dono2);
  perform set_config('request.jwt.claims', json_build_object('sub', m.dono2, 'role', 'authenticated')::text, true);
  perform set_config('storage.allow_delete_query', 'true', true);
  set local role authenticated;
  delete from storage.objects where bucket_id = 'brand-assets' and name = m.pagina_um;
  get diagnostics n = row_count;
  reset role;
  insert into resultado (caso, esperado, obtido, passou) values
    ('dono restrito NAO apaga arquivo de marca VIVA pela fila', '0 linhas', n || ' linhas', n = 0);

  -- E quem não administra a conta não usa a porta nem para marca apagada.
  perform set_config('request.jwt.claims', json_build_object('sub', m.y, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'analysis-evidence' and name like m.conta::text || '/' || m.dois::text || '/%';
  reset role;
  insert into resultado (caso, esperado, obtido, passou) values
    ('quem nao administra a conta NAO ve arquivo de marca apagada', '0', n::text, n = 0);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 7. Apagar asset e apagar marca decidem por marca (16/09/2026)
-- ════════════════════════════════════════════════════════════════════════
--
-- `delete_asset_with_file` e `delete_brand_with_files` são INVOKER e pediam
-- `owner` da conta. Não vazavam — a RLS valia por baixo —, mas recusavam quem
-- tem a capacidade na marca, e na primeira havia algo pior: o dono de conta
-- sem capacidade passava na verificação, o arquivo ia para a FILA, e só depois
-- o `delete` esbarrava na RLS e apagava 0 linhas. O asset ficava na biblioteca
-- com o arquivo marcado para sumir.
do $$
declare m record; estado text; enfileirado_antes integer; enfileirado_depois integer;
        sobrou integer; enfileirados integer; marcas_depois integer;
begin
  select * into m from mundo;
  select count(*) into enfileirado_antes from public.brand_deletions
   where storage_path = m.biblioteca_um;

  -- Quem só consulta não apaga asset.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', m.x, 'role', 'authenticated')::text, true);
  begin
    perform public.delete_asset_with_file((select id from public.brand_assets where storage_path = m.biblioteca_um));
    estado := 'APAGOU';
  exception when others then estado := sqlstate;
  end;
  reset role;
  insert into resultado (caso, esperado, obtido, passou) values
    ('quem so consulta NAO apaga asset', '42501', estado, estado = '42501');

  -- Dono da CONTA sem capacidade na marca também não — e não enfileira.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', m.dono2, 'role', 'authenticated')::text, true);
  begin
    perform public.delete_asset_with_file((select id from public.brand_assets where storage_path = m.biblioteca_um));
    estado := 'APAGOU';
  exception when others then estado := sqlstate;
  end;
  reset role;
  select count(*) into enfileirado_depois from public.brand_deletions
   where storage_path = m.biblioteca_um;
  select count(*) into sobrou from public.brand_assets where storage_path = m.biblioteca_um;
  insert into resultado (caso, esperado, obtido, passou) values
    ('dono da conta restrito na marca NAO apaga asset', '42501', estado, estado = '42501'),
    ('e NAO enfileirou o arquivo para exclusao', enfileirado_antes::text,
     enfileirado_depois::text, enfileirado_depois = enfileirado_antes),
    ('e o asset continua na biblioteca', '1', sobrou::text, sobrou = 1);

  -- Quem edita a marca apaga, e o arquivo entra na fila.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', m.dona, 'role', 'authenticated')::text, true);
  begin
    perform public.delete_asset_with_file((select id from public.brand_assets where storage_path = m.biblioteca_um));
    estado := 'APAGOU';
  exception when others then estado := sqlstate;
  end;
  reset role;
  select count(*) into sobrou from public.brand_assets where storage_path = m.biblioteca_um;
  select count(*) into enfileirado_depois from public.brand_deletions where storage_path = m.biblioteca_um;
  insert into resultado (caso, esperado, obtido, passou) values
    ('quem edita a marca apaga o asset', 'APAGOU', estado, estado = 'APAGOU'),
    ('o asset saiu da biblioteca', '0', sobrou::text, sobrou = 0),
    ('e o arquivo foi enfileirado', '1', enfileirado_depois::text, enfileirado_depois = 1);

  -- Apagar a MARCA: `administrar` nela.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', m.dono2, 'role', 'authenticated')::text, true);
  begin
    perform public.delete_brand_with_files(m.um);
    estado := 'APAGOU';
  exception when others then estado := sqlstate;
  end;
  reset role;
  insert into resultado (caso, esperado, obtido, passou) values
    ('dono da conta restrito na marca NAO apaga a marca', '42501', estado, estado = '42501');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', m.dona, 'role', 'authenticated')::text, true);
  begin
    select public.delete_brand_with_files(m.um) into enfileirados;
    estado := 'APAGOU';
  exception when others then estado := sqlstate; enfileirados := -1;
  end;
  reset role;
  select count(*) into marcas_depois from public.brands where id = m.um;
  insert into resultado (caso, esperado, obtido, passou) values
    ('quem administra a marca apaga a marca', 'APAGOU', estado, estado = 'APAGOU'),
    ('e a marca sumiu', '0', marcas_depois::text, marcas_depois = 0);
end $$;

select case when passou then 'ok   ' else 'FALHA' end as st, caso, esperado, obtido from resultado order by ordem;

select case when count(*) filter (where not passou) = 0
            then 'PROVA COMPLETA: ' || count(*) || ' verificacoes, todas verdes'
            else 'PROVA FALHOU: ' || count(*) filter (where not passou) || ' de ' || count(*)
       end as veredito
from resultado;

do $$
declare n integer;
begin
  select count(*) filter (where not passou) into n from resultado;
  if n > 0 then raise exception 'PROVA FALHOU: % verificacao(oes)', n using errcode = 'P0001'; end if;
end $$;

rollback;
