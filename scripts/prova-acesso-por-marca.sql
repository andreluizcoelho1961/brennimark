-- Prova de que o acesso resolve por MARCA, e não por conta.
--
-- ─── Por que esta prova existe ───────────────────────────────────────────
--
-- Até 13/09/2026 as 37 policies do esquema perguntavam "esta pessoa pertence à
-- conta?". Quem entrava para trabalhar numa marca alcançava todas as marcas
-- daquela conta. O ADR-0007 §5 condiciona a biblioteca de assets a fechar esse
-- furo, porque com o acervo no ar ele deixa de vazar NOME e passa a vazar
-- ARQUIVO — inclusive a fonte licenciada.
--
-- O projeto já exigia prova negativa entre CONTAS (condição 2 do ADR-0003).
-- Esta acrescenta a que faltava: **entre marcas da MESMA conta**.
--
-- Método, o de `prova-manifesto-por-pagina.sql`: mundo próprio, cada caso com
-- dado isolado, SQLSTATE conferido onde há erro esperado, e caso cuja
-- preparação falha é reprovado e não ignorado. Termina em `rollback`.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (
  ordem    serial,
  caso     text,
  esperado text,
  obtido   text,
  passou   boolean
);
grant select, insert on resultado to authenticated, anon;
grant usage, select on sequence resultado_ordem_seq to authenticated, anon;

-- ════════════════════════════════════════════════════════════════════════
-- O mundo: uma conta com DUAS marcas, e um fornecedor em cada
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  u_dona  uuid := '33333333-3333-4333-8333-33333333aaaa';
  u_x     uuid := '33333333-3333-4333-8333-33333333bbbb';
  u_y     uuid := '33333333-3333-4333-8333-33333333cccc';
  u_outra uuid := '44444444-4444-4444-8444-44444444aaaa';
  w_a uuid; w_b uuid; m1 uuid; m2 uuid; m3 uuid; sd uuid;
begin
  insert into auth.users (id, email, aud, role) values
    (u_dona,  'prova-marca-dona@local.test',  'authenticated', 'authenticated'),
    (u_x,     'prova-marca-x@local.test',     'authenticated', 'authenticated'),
    (u_y,     'prova-marca-y@local.test',     'authenticated', 'authenticated'),
    (u_outra, 'prova-marca-outra@local.test', 'authenticated', 'authenticated');

  insert into public.workspaces (name, slug) values ('Prova Marca A', 'prova-marca-a') returning id into w_a;
  insert into public.workspaces (name, slug) values ('Prova Marca B', 'prova-marca-b') returning id into w_b;

  -- Os três da conta A pertencem à MESMA conta. É esse o cenário: o furo
  -- antigo dava a todos eles as duas marcas.
  insert into public.workspace_members (workspace_id, user_id, role) values
    (w_a, u_dona, 'owner'), (w_a, u_x, 'member'), (w_a, u_y, 'member'),
    (w_b, u_outra, 'owner');

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (w_a, 'marca-um', 'Marca Um', 'Um', 'Primeira marca da conta A', 'pt-BR',
          '{}', '{}', '{}', '{}', '{}') returning id into m1;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (w_a, 'marca-dois', 'Marca Dois', 'Dois', 'Segunda marca da conta A', 'pt-BR',
          '{}', '{}', '{}', '{}', '{}') returning id into m2;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (w_b, 'marca-tres', 'Marca Tres', 'Tres', 'Marca de outra conta', 'pt-BR',
          '{}', '{}', '{}', '{}', '{}') returning id into m3;

  /*
   * O acesso, marca a marca — que é a decisão do André de 13/09: "escolher se
   * tem acesso a uma marca, a duas, a todas, e quais".
   *
   *   dona   as quatro capacidades nas duas marcas da conta
   *   x      SÓ consulta, SÓ na marca um
   *   y      consulta e edição, SÓ na marca dois
   */
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades) values
    (m1, w_a, u_dona, array['consultar','editar','aprovar','administrar']),
    (m2, w_a, u_dona, array['consultar','editar','aprovar','administrar']),
    (m1, w_a, u_x,    array['consultar']),
    (m2, w_a, u_y,    array['consultar','editar']),
    (m3, w_b, u_outra, array['consultar','editar','aprovar','administrar'])
  -- O gatilho já concedeu às donas das contas (marca criada sem sessão aqui).
  -- A prova DECLARA o acesso que quer, em vez de depender do que o gatilho fez.
  on conflict (brand_id, user_id) do update set capacidades = excluded.capacidades;

  -- Conteúdo nas duas marcas. O gatilho de auditoria exige quem edita AQUELA
  -- marca, então a dona precisa estar autenticada para gravar documento.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_dona, 'role', 'authenticated')::text, true);

  insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name, title, status, body, updated_by)
  values (w_a, m1, 'prova', 'cores-da-um', 'Manual', 'Cores da Um', 'ready', '[]', u_dona),
         (w_a, m2, 'prova', 'cores-da-dois', 'Manual', 'Cores da Dois', 'ready', '[]', u_dona);

  perform set_config('request.jwt.claims', null, true);

  insert into public.brand_assets (workspace_id, brand_id, label, description, category,
                                   storage_path, file_name, mime_type, size_bytes, status, created_by)
  values (w_a, m1, 'Logo da Um', '', 'logo', w_a::text || '/' || m1::text || '/logo-um.svg',
          'logo-um.svg', 'image/svg+xml', 100, 'ready', u_dona),
         (w_a, m2, 'Logo da Dois', '', 'logo', w_a::text || '/' || m2::text || '/logo-dois.svg',
          'logo-dois.svg', 'image/svg+xml', 100, 'ready', u_dona);

  insert into public.brand_source_documents (workspace_id, brand_id, storage_path, pdf_sha256,
                                             byte_size, page_count, created_by)
  values (w_a, m2, w_a::text || '/imp/' || lpad(to_hex(2), 64, '0') || '.pdf',
          lpad(to_hex(2), 64, '0'), 1000, 2, u_dona)
  returning id into sd;

  insert into public.brand_source_pages (workspace_id, brand_id, source_document_id, pagina,
                                         largura_pt, altura_pt, tem_texto, cobertura, motivo_da_cobertura)
  values (w_a, m2, sd, 1, 595, 842, true, 'sem-secao', 'prova');

  create temp table mundo as
  select u_dona as dona, u_x as x, u_y as y, u_outra as outra,
         w_a as conta_a, w_b as conta_b, m1 as marca_um, m2 as marca_dois, m3 as marca_tres;
  grant select on mundo to authenticated, anon;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 1. O furo que a migration fecha: mesma conta, marca de outro
-- ════════════════════════════════════════════════════════════════════════
do $$
declare m record; ve_um integer; ve_dois integer; doc_um integer; doc_dois integer;
        asset_um integer; asset_dois integer; manifesto integer; fonte integer;
begin
  select * into m from mundo;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.x, 'role', 'authenticated')::text, true);

  select count(*) into ve_um   from public.brands where id = m.marca_um;
  select count(*) into ve_dois from public.brands where id = m.marca_dois;
  select count(*) into doc_um   from public.brand_documents where brand_id = m.marca_um;
  select count(*) into doc_dois from public.brand_documents where brand_id = m.marca_dois;
  select count(*) into asset_um   from public.brand_assets where brand_id = m.marca_um;
  select count(*) into asset_dois from public.brand_assets where brand_id = m.marca_dois;
  select count(*) into manifesto from public.brand_source_pages where brand_id = m.marca_dois;
  select count(*) into fonte from public.brand_source_documents where brand_id = m.marca_dois;
  reset role;

  insert into resultado (caso, esperado, obtido, passou) values
    ('x ve a marca em que tem acesso', '1', ve_um::text, ve_um = 1),
    ('x NAO ve a outra marca DA MESMA CONTA', '0', ve_dois::text, ve_dois = 0),
    ('x le o documento da marca dele', '1', doc_um::text, doc_um = 1),
    ('x NAO le o documento da outra marca', '0', doc_dois::text, doc_dois = 0),
    ('x le o asset da marca dele', '1', asset_um::text, asset_um = 1),
    ('x NAO le o asset da outra marca', '0', asset_dois::text, asset_dois = 0),
    ('x NAO le o manifesto da outra marca', '0', manifesto::text, manifesto = 0),
    ('x NAO le o documento-fonte da outra marca', '0', fonte::text, fonte = 0);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Capacidade separa o que se lê do que se escreve
-- ════════════════════════════════════════════════════════════════════════
do $$
declare m record; estado text; apagadas integer;
begin
  select * into m from mundo;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.x, 'role', 'authenticated')::text, true);
  begin
    insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name, title, status, body, updated_by)
    values (m.conta_a, m.marca_um, 'prova', 'intruso', 'Manual', 'Intruso', 'ready', '[]', m.x);
    estado := 'INSERIU';
  exception when others then
    estado := sqlstate;
  end;
  reset role;
  insert into resultado (caso, esperado, obtido, passou) values
    ('so consultar NAO cria documento', '42501', estado, estado = '42501');

  -- y tem `editar` na marca dois: a mesma escrita precisa passar.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.y, 'role', 'authenticated')::text, true);
  begin
    insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name, title, status, body, updated_by)
    values (m.conta_a, m.marca_dois, 'prova', 'da-y', 'Manual', 'Escrito por y', 'ready', '[]', m.y);
    estado := 'INSERIU';
  exception when others then
    estado := sqlstate || ': ' || sqlerrm;
  end;

  -- ...e `editar` NÃO é `administrar`: apagar a marca continua fora de alcance.
  delete from public.brands where id = m.marca_dois;
  get diagnostics apagadas = row_count;
  reset role;

  insert into resultado (caso, esperado, obtido, passou) values
    ('quem edita a marca cria documento nela', 'INSERIU', estado, estado = 'INSERIU'),
    ('editar NAO apaga a marca', '0 linhas', apagadas::text || ' linhas', apagadas = 0);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. A dona da conta, a conta vizinha, e a lista de acesso
-- ════════════════════════════════════════════════════════════════════════
do $$
declare m record; da_dona integer; da_outra integer; lista_x integer; lista_dona integer;
begin
  select * into m from mundo;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.dona, 'role', 'authenticated')::text, true);
  select count(*) into da_dona from public.brands where workspace_id = m.conta_a;
  select count(*) into lista_dona from public.brand_members where workspace_id = m.conta_a;
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.outra, 'role', 'authenticated')::text, true);
  select count(*) into da_outra from public.brands where workspace_id = m.conta_a;
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.x, 'role', 'authenticated')::text, true);
  select count(*) into lista_x from public.brand_members;
  reset role;

  insert into resultado (caso, esperado, obtido, passou) values
    ('a dona ve as duas marcas da conta', '2', da_dona::text, da_dona = 2),
    ('conta vizinha NAO ve marca alheia', '0', da_outra::text, da_outra = 0),
    ('x ve so o proprio acesso', '1', lista_x::text, lista_x = 1),
    ('quem administra a conta ve o acesso dela', '4', lista_dona::text, lista_dona = 4);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 4. Marca nova: quem cria não fica de fora, e sem sessão não quebra
-- ════════════════════════════════════════════════════════════════════════
do $$
declare m record; nova uuid; acesso integer; sem_sessao uuid; estado text;
begin
  select * into m from mundo;

  perform set_config('request.jwt.claims',
    json_build_object('sub', m.dona, 'role', 'authenticated')::text, true);
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (m.conta_a, 'marca-nova', 'Marca Nova', 'Nova', 'Criada na prova', 'pt-BR',
          '{}', '{}', '{}', '{}', '{}') returning id into nova;
  select count(*) into acesso from public.brand_members
   where brand_id = nova and user_id = m.dona and 'administrar' = any (capacidades);
  perform set_config('request.jwt.claims', null, true);

  -- Sem sessão (chave de serviço, SQL de manutenção): a criação não pode falhar.
  begin
    insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                               metadata, navigation, theme, ai, legal)
    values (m.conta_a, 'marca-sem-sessao', 'Sem sessao', 'SS', 'Criada sem auth.uid()', 'pt-BR',
            '{}', '{}', '{}', '{}', '{}') returning id into sem_sessao;
    estado := 'CRIOU';
  exception when others then
    estado := sqlstate || ': ' || sqlerrm;
  end;

  insert into resultado (caso, esperado, obtido, passou) values
    ('quem cria a marca recebe acesso a ela', '1', acesso::text, acesso = 1),
    ('criar marca sem sessao nao quebra', 'CRIOU', estado, estado = 'CRIOU');

  -- Marca criada por manutenção não pode ficar órfã: sem ninguém no
  -- `brand_members` dela, ela existe e pessoa alguma a enxerga.
  select count(*) into acesso from public.brand_members
   where brand_id = sem_sessao and user_id = m.dona and 'administrar' = any (capacidades);
  insert into resultado (caso, esperado, obtido, passou) values
    ('marca sem sessao vai para quem administra a conta', '1', acesso::text, acesso = 1);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 5. O seletor da moldura — a consulta que lista o que a pessoa alcança
-- ════════════════════════════════════════════════════════════════════════
--
-- Réplica do que `listarDisponiveis` faz em src/lib/brandville/server.ts:
-- parte de `workspace_members` e traz as marcas por dentro. Se a RLS de
-- `brands` não valesse nessa junção, o seletor listaria a marca que a pessoa
-- não alcança — e o nome de um cliente apareceria para outro fornecedor,
-- mesmo com o conteúdo protegido.
do $$
declare m record; contas integer; marcas_de_x integer; nomes text; marcas_da_dona integer;
begin
  select * into m from mundo;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.x, 'role', 'authenticated')::text, true);
  select count(distinct w.id), count(b.id), coalesce(string_agg(b.key, ',' order by b.key), '')
    into contas, marcas_de_x, nomes
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    left join public.brands b on b.workspace_id = w.id
   where wm.user_id = m.x;
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.dona, 'role', 'authenticated')::text, true);
  select count(b.id) into marcas_da_dona
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    left join public.brands b on b.workspace_id = w.id
   where wm.user_id = m.dona;
  reset role;

  insert into resultado (caso, esperado, obtido, passou) values
    ('o seletor de x mostra a conta', '1', contas::text, contas = 1),
    ('o seletor de x mostra 1 marca, nao 2', '1', marcas_de_x::text, marcas_de_x = 1),
    ('e a marca listada e a dele', 'marca-um', nomes, nomes = 'marca-um'),
    ('o seletor da dona mostra as marcas dela', '4', marcas_da_dona::text, marcas_da_dona = 4);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 6. O registro de acesso — quem concedeu, quando, e o que ninguém apaga
-- ════════════════════════════════════════════════════════════════════════
do $$
declare m record; eventos integer; ultima text; autor text; apagado text;
        estado text; le_x integer; le_dona integer;
begin
  select * into m from mundo;

  -- Uma concessão de verdade, feita por quem administra a conta.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.dona, 'role', 'authenticated')::text, true);
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades, created_by)
  values (m.marca_dois, m.conta_a, m.x, array['consultar'], m.dona);
  update public.brand_members set capacidades = array['consultar','editar']
   where brand_id = m.marca_dois and user_id = m.x;
  -- Alteração que não mexe nas capacidades não pode virar evento.
  update public.brand_members set created_by = m.dona
   where brand_id = m.marca_dois and user_id = m.x;
  delete from public.brand_members where brand_id = m.marca_dois and user_id = m.x;
  reset role;

  select count(*) into eventos from public.brand_access_log
   where brand_id = m.marca_dois and pessoa = m.x;
  select acao, autor_email into ultima, autor from public.brand_access_log
   where brand_id = m.marca_dois and pessoa = m.x order by created_at desc limit 1;

  insert into resultado (caso, esperado, obtido, passou) values
    ('conceder, alterar e revogar deixam 3 eventos', '3', eventos::text, eventos = 3),
    ('o toque que nao muda capacidade nao vira evento', '3', eventos::text, eventos = 3),
    ('o ultimo evento e a revogacao', 'revogado', coalesce(ultima,'(nenhum)'), ultima = 'revogado'),
    ('o registro guarda quem concedeu', 'prova-marca-dona@local.test',
     coalesce(autor,'(nenhum)'), autor = 'prova-marca-dona@local.test');

  -- Ninguém reescreve o próprio rastro: não há policy de update nem de delete.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.dona, 'role', 'authenticated')::text, true);
  -- Barrado no GRANT, antes mesmo da RLS: `authenticated` só recebeu `select`.
  -- É uma trava mais forte do que "a policy não encontra linha".
  begin
    delete from public.brand_access_log where brand_id = m.marca_dois;
    apagado := 'APAGOU';
  exception when others then
    apagado := sqlstate;
  end;
  begin
    insert into public.brand_access_log (brand_id, workspace_id, pessoa_email, autor_email, acao)
    values (m.marca_dois, m.conta_a, 'forjado@local.test', 'forjado@local.test', 'concedido');
    estado := 'INSERIU';
  exception when others then
    estado := sqlstate;
  end;
  -- Quem administra a marca lê; quem só consulta, não.
  select count(*) into le_dona from public.brand_access_log where brand_id = m.marca_dois;
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.x, 'role', 'authenticated')::text, true);
  select count(*) into le_x from public.brand_access_log where brand_id = m.marca_dois;
  reset role;

  insert into resultado (caso, esperado, obtido, passou) values
    ('nem quem administra apaga o registro', '42501', apagado, apagado = '42501'),
    ('ninguem forja evento pela API', '42501', estado, estado = '42501'),
    -- Cinco, e não três: a semeadura do mundo também passou pelo gatilho, o
    -- que é o comportamento correto — acesso concedido é acesso registrado.
    ('quem administra a marca le o registro', '5', le_dona::text, le_dona = 5),
    ('quem so consulta NAO le o registro', '0', le_x::text, le_x = 0);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- Relatório
-- ════════════════════════════════════════════════════════════════════════
select case when passou then 'ok   ' else 'FALHA' end as st,
       caso, esperado, obtido
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
