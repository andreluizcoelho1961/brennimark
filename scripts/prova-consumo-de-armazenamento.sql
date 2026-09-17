-- Prova do consumo de armazenamento — ADR-0007 §8.1.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE conferido, dado
-- isolado, `rollback` no fim. Duas perguntas:
--   1. A CONTA está certa? Cada byte vai para a conta e a marca donas dele —
--      inclusive o PDF, cujo caminho não diz a marca — e nada é inventado.
--   2. Quem VÊ e quem MEXE? Só o dono da conta lê; ninguém escreve pela API.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (
  ordem serial, caso text, esperado text, obtido text, passou boolean
);
create temp table mundo (
  dona uuid, membro uuid, estranha uuid, w uuid, w2 uuid, um uuid, dois uuid, tres uuid
);

-- Executa COMO uma pessoa (ou como anon, com p_papel). A subtransação desfaz o
-- papel numa recusa; num sucesso ele é devolvido à mão.
create function pg_temp.tentar(p_quem uuid, p_sql text, p_papel text default 'authenticated',
                               out estado text, out linhas integer)
language plpgsql as $f$
begin
  begin
    perform set_config('request.jwt.claims',
      case when p_quem is null then '' else json_build_object('sub', p_quem, 'role', p_papel)::text end, true);
    execute format('set local role %I', p_papel);
    execute p_sql;
    get diagnostics linhas = row_count;
    estado := 'ACEITOU';
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    estado := sqlstate; linhas := 0;
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

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido, '(nulo)'), p_esperado = coalesce(p_obtido, '(nulo)'));
$f$;

-- Bytes da fotografia de hoje, para uma conta/marca/bucket. `null` na marca
-- quer dizer "sem marca", e compara com `is not distinct from`.
create function pg_temp.bytes(p_conta uuid, p_marca uuid, p_bucket text) returns text
language sql as $f$
  select coalesce((select bytes::text from public.consumo_de_armazenamento
                    where dia = (now() at time zone 'utc')::date and workspace_id = p_conta
                      and brand_id is not distinct from p_marca and bucket_id = p_bucket), 'sem linha');
$f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_dona uuid := '88888888-8888-4888-8888-88888888aaaa';
  u_memb uuid := '88888888-8888-4888-8888-88888888bbbb';
  u_fora uuid := '88888888-8888-4888-8888-88888888cccc';
  w uuid; w2 uuid; um uuid; dois uuid; tres uuid;
  imp_um uuid := gen_random_uuid(); imp_sem uuid := gen_random_uuid();
  sha text := repeat('c', 64);
begin
  insert into auth.users (id, email, aud, role) values
    (u_dona, 'prova-consumo-dona@local.test',  'authenticated', 'authenticated'),
    (u_memb, 'prova-consumo-membro@local.test','authenticated', 'authenticated'),
    (u_fora, 'prova-consumo-fora@local.test',  'authenticated', 'authenticated');
  insert into public.workspaces (name, slug) values ('Prova Consumo', 'prova-consumo') returning id into w;
  insert into public.workspaces (name, slug) values ('Prova Consumo Dois', 'prova-consumo-dois') returning id into w2;
  insert into public.workspace_members (workspace_id, user_id, role) values
    (w, u_dona, 'owner'), (w, u_memb, 'member'), (w2, u_fora, 'owner');
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w, 'consumo-um', 'Um', 'Um', 'Primeira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into um;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w, 'consumo-dois', 'Dois', 'Dois', 'Segunda', 'pt-BR', '{}','{}','{}','{}','{}') returning id into dois;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w2, 'consumo-tres', 'Tres', 'Tres', 'Terceira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into tres;

  -- Tamanhos distintos por arquivo, para uma soma errada não bater por acaso.
  insert into storage.objects (bucket_id, name, owner_id, metadata) values
    ('brand-assets', w::text||'/'||um::text||'/pagina-1.png',   u_dona::text, '{"size": 1000}'),
    ('brand-assets', w::text||'/'||um::text||'/logo.svg',       u_dona::text, '{"size": 234}'),
    ('brand-assets', w::text||'/'||dois::text||'/pagina-1.png', u_dona::text, '{"size": 5000}'),
    ('analysis-evidence', w::text||'/'||um::text||'/run-evidence.png', u_dona::text, '{"size": 70}'),
    ('brand-imports', w::text||'/'||imp_um::text||'/'||sha||'.pdf',  u_dona::text, '{"size": 900000}'),
    ('brand-imports', w::text||'/'||imp_sem::text||'/'||sha||'.pdf', u_dona::text, '{"size": 40000}'),
    -- Caminho fora do padrão: não pode ser atribuído, nem derrubar a medição.
    ('brand-assets', 'lixo/nao-e-uuid/arquivo.png', u_dona::text, '{"size": 123456}'),
    ('brand-assets', w2::text||'/'||tres::text||'/pagina-1.png', u_fora::text, '{"size": 3}');
  insert into public.brand_imports (import_id, workspace_id, brand_id, storage_path, pdf_sha256, page_count, document_count, created_by)
  values (imp_um, w, um, w::text||'/'||imp_um::text||'/'||sha||'.pdf', sha, 2, 0, u_dona);

  insert into mundo values (u_dona, u_memb, u_fora, w, w2, um, dois, tres);
  perform private.fotografar_consumo_de_armazenamento();
end $$;

-- ─── 1. A conta ─────────────────────────────────────────────────────────────
do $$
declare m record; total text;
begin
  select * into m from mundo;
  perform pg_temp.registrar('imagens da marca Um somam os dois arquivos dela', '1234', pg_temp.bytes(m.w, m.um, 'brand-assets'));
  perform pg_temp.registrar('a marca Dois conta so o dela', '5000', pg_temp.bytes(m.w, m.dois, 'brand-assets'));
  perform pg_temp.registrar('evidencia de analise vai para a marca', '70', pg_temp.bytes(m.w, m.um, 'analysis-evidence'));
  perform pg_temp.registrar('PDF importado encontra a marca pela importacao', '900000', pg_temp.bytes(m.w, m.um, 'brand-imports'));
  perform pg_temp.registrar('PDF sem importacao conta para a conta, sem marca', '40000', pg_temp.bytes(m.w, null, 'brand-imports'));
  perform pg_temp.registrar('outra conta nao se mistura', '3', pg_temp.bytes(m.w2, m.tres, 'brand-assets'));

  select sum(bytes)::text into total from public.consumo_de_armazenamento
   where dia = (now() at time zone 'utc')::date and workspace_id = m.w;
  perform pg_temp.registrar('o total da conta e a soma exata, sem o arquivo sem dono', '946304', total);
  perform pg_temp.registrar('caminho fora do padrao nao vira linha', '0',
    (select count(*)::text from public.consumo_de_armazenamento
      where dia = (now() at time zone 'utc')::date and bytes = 123456));
end $$;

-- ─── 2. Repetir a fotografia substitui, não soma ────────────────────────────
do $$
declare m record; antes integer; depois integer;
begin
  select * into m from mundo;
  select count(*) into antes from public.consumo_de_armazenamento where workspace_id = m.w;
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('brand-assets', m.w::text||'/'||m.dois::text||'/pagina-2.png', m.dona::text, '{"size": 5}');
  -- A trava `storage.protect_delete` exige a marca que a API do Storage põe na
  -- sessão; aqui ela é posta à mão, só para simular a remoção.
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where name = m.w::text||'/'||m.um::text||'/run-evidence.png';
  perform set_config('storage.allow_delete_query', 'false', true);
  perform private.fotografar_consumo_de_armazenamento();
  perform private.fotografar_consumo_de_armazenamento();
  select count(*) into depois from public.consumo_de_armazenamento where workspace_id = m.w;

  perform pg_temp.registrar('repetir no mesmo dia nao duplica linhas', (antes - 1)::text, depois::text);
  perform pg_temp.registrar('o arquivo novo entra na fotografia refeita', '5005', pg_temp.bytes(m.w, m.dois, 'brand-assets'));
  perform pg_temp.registrar('o arquivo que saiu sai da fotografia refeita', 'sem linha', pg_temp.bytes(m.w, m.um, 'analysis-evidence'));
end $$;

-- ─── 3. Quem vê e quem mexe ─────────────────────────────────────────────────
do $$
declare m record; t record; n integer;
begin
  select * into m from mundo;

  n := pg_temp.contar(m.dona, format('select count(*) from public.consumo_de_armazenamento where workspace_id = %L', m.w));
  perform pg_temp.registrar('a dona da conta le o consumo da conta', 'mais de 0', case when n > 0 then 'mais de 0' else n::text end);

  n := pg_temp.contar(m.membro, 'select count(*) from public.consumo_de_armazenamento');
  perform pg_temp.registrar('membro que nao e dono NAO le o consumo', '0', n::text);

  n := pg_temp.contar(m.estranha, format('select count(*) from public.consumo_de_armazenamento where workspace_id = %L', m.w));
  perform pg_temp.registrar('dona de outra conta NAO le este consumo', '0', n::text);

  t := pg_temp.tentar(m.dona, format(
    'insert into public.consumo_de_armazenamento (dia, workspace_id, bucket_id, objetos, bytes) values (current_date - 1, %L, ''brand-assets'', 1, 1)', m.w));
  perform pg_temp.registrar('a dona NAO grava consumo pela API', '42501', t.estado);

  t := pg_temp.tentar(m.dona, format('update public.consumo_de_armazenamento set bytes = 0 where workspace_id = %L', m.w));
  perform pg_temp.registrar('a dona NAO corrige o consumo', '42501', t.estado);

  t := pg_temp.tentar(m.dona, format('delete from public.consumo_de_armazenamento where workspace_id = %L', m.w));
  perform pg_temp.registrar('a dona NAO apaga o historico', '42501', t.estado);

  t := pg_temp.tentar(m.dona, 'select private.fotografar_consumo_de_armazenamento()');
  perform pg_temp.registrar('quem tem sessao NAO dispara a fotografia', '42501', t.estado);

  t := pg_temp.tentar(m.dona, 'select * from private.medir_consumo_de_armazenamento()');
  perform pg_temp.registrar('quem tem sessao NAO le a medicao de todas as contas', '42501', t.estado);

  t := pg_temp.tentar(null, 'select count(*) from public.consumo_de_armazenamento', 'anon');
  perform pg_temp.registrar('anonimo NAO le nada', '42501', t.estado);
end $$;

-- ─── 4. O histórico sobrevive à marca, e o agendamento existe ───────────────
do $$
declare m record; sobrou integer;
begin
  select * into m from mundo;
  delete from public.brands where id = m.dois;
  select count(*) into sobrou from public.consumo_de_armazenamento where brand_id = m.dois;
  perform pg_temp.registrar('apagar a marca NAO apaga o que ela consumiu', 'mais de 0', case when sobrou > 0 then 'mais de 0' else sobrou::text end);
  perform pg_temp.registrar('a fotografia diaria esta agendada',
    '17 3 * * *', (select schedule from cron.job where jobname = 'fotografar-consumo-de-armazenamento'));
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
