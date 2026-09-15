-- Prova do registro de download — item 18 do ADR-0007 §2.4.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE conferido, caso cuja
-- preparação falha é reprovado, `rollback` no fim.
--
-- O que ela precisa sustentar é a pergunta de uma foundry — a quem o arquivo
-- foi liberado. (Liberado, não entregue: o registro prova que o download foi
-- autorizado e iniciado, não que os bytes chegaram.) Por isso os casos centrais são os de FALSIFICAÇÃO — registrar em
-- nome de outra pessoa, atribuir o arquivo a outra marca, apagar o rastro — e o
-- de SOBREVIVÊNCIA: o registro continua dizendo o que foi baixado depois de o
-- arquivo ser apagado.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
grant select, insert on resultado to authenticated, anon;
grant usage, select on sequence resultado_ordem_seq to authenticated, anon;

do $$
declare
  u_dona uuid := '66666666-6666-4666-8666-66666666aaaa';
  u_le   uuid := '66666666-6666-4666-8666-66666666bbbb';
  u_fora uuid := '66666666-6666-4666-8666-66666666cccc';
  w uuid; m1 uuid; m2 uuid; a1 uuid; a2 uuid;
begin
  insert into auth.users (id, email, aud, role) values
    (u_dona, 'prova-dl-dona@local.test', 'authenticated', 'authenticated'),
    (u_le,   'prova-dl-le@local.test',   'authenticated', 'authenticated'),
    (u_fora, 'prova-dl-fora@local.test', 'authenticated', 'authenticated');

  insert into public.workspaces (name, slug) values ('Prova Download', 'prova-download') returning id into w;
  insert into public.workspace_members (workspace_id, user_id, role) values
    (w, u_dona, 'owner'), (w, u_le, 'member'), (w, u_fora, 'member');

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (w, 'dl-um', 'DL Um', 'U', 'um', 'pt-BR', '{}','{}','{}','{}','{}') returning id into m1;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (w, 'dl-dois', 'DL Dois', 'D', 'dois', 'pt-BR', '{}','{}','{}','{}','{}') returning id into m2;

  -- `le` consulta a marca um; `fora` só alcança a marca dois.
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades) values
    (m1, w, u_dona, array['consultar','editar','aprovar','administrar']),
    (m2, w, u_dona, array['consultar','editar','aprovar','administrar']),
    (m1, w, u_le,   array['consultar']),
    (m2, w, u_fora, array['consultar'])
  on conflict (brand_id, user_id) do update set capacidades = excluded.capacidades;

  insert into public.brand_assets (workspace_id, brand_id, label, description, category,
                                   storage_path, file_name, mime_type, size_bytes, status, created_by)
  values (w, m1, 'Fonte da Um', '', 'Fontes', w::text||'/'||m1::text||'/fonte.otf',
          'fonte-um.otf', 'font/otf', 100, 'ready', u_dona) returning id into a1;
  insert into public.brand_assets (workspace_id, brand_id, label, description, category,
                                   storage_path, file_name, mime_type, size_bytes, status, created_by)
  values (w, m2, 'Logo da Dois', '', 'Logotipos', w::text||'/'||m2::text||'/logo.svg',
          'logo-dois.svg', 'image/svg+xml', 100, 'ready', u_dona) returning id into a2;

  create temp table mundo as
  select u_dona as dona, u_le as le, u_fora as fora, w as conta,
         m1 as marca_um, m2 as marca_dois, a1 as fonte_um, a2 as logo_dois;
  grant select on mundo to authenticated, anon;
end $$;

-- ─── 1. O registro verdadeiro, preenchido pelo banco ───────────────────────
do $$
declare m record; r record;
begin
  select * into m from mundo;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', m.le, 'role', 'authenticated')::text, true);
  insert into public.brand_asset_downloads (asset_id, brand_id, workspace_id, pessoa_email, asset_label, file_name)
  values (m.fonte_um, m.marca_um, m.conta, 'qualquer', 'qualquer', 'qualquer');
  reset role;

  select pessoa, pessoa_email, asset_label, file_name, brand_id into r
    from public.brand_asset_downloads where asset_id = m.fonte_um order by created_at desc limit 1;

  insert into resultado (caso, esperado, obtido, passou) values
    ('quem baixou e quem esta na sessao', 'le', case when r.pessoa = m.le then 'le' else coalesce(r.pessoa::text,'(nulo)') end, r.pessoa = m.le),
    ('o e-mail vem do banco, nao do pedido', 'prova-dl-le@local.test', r.pessoa_email, r.pessoa_email = 'prova-dl-le@local.test'),
    ('o rotulo vem do asset, nao do pedido', 'Fonte da Um', r.asset_label, r.asset_label = 'Fonte da Um'),
    ('o nome do arquivo vem do asset', 'fonte-um.otf', r.file_name, r.file_name = 'fonte-um.otf');
end $$;

-- ─── 2. Falsificações ──────────────────────────────────────────────────────
do $$
declare m record; quem uuid; marca uuid; estado text;
begin
  select * into m from mundo;

  -- Em nome de outra pessoa: o banco troca pela sessão.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', m.le, 'role', 'authenticated')::text, true);
  insert into public.brand_asset_downloads (asset_id, brand_id, workspace_id, pessoa, pessoa_email, asset_label, file_name)
  values (m.fonte_um, m.marca_um, m.conta, m.dona, 'dona@finge', 'x', 'x');
  reset role;
  select pessoa into quem from public.brand_asset_downloads
   where asset_id = m.fonte_um order by created_at desc limit 1;

  -- Atribuir o arquivo à marca errada: o banco usa a marca do asset.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', m.le, 'role', 'authenticated')::text, true);
  insert into public.brand_asset_downloads (asset_id, brand_id, workspace_id, pessoa_email, asset_label, file_name)
  values (m.fonte_um, m.marca_dois, m.conta, 'x', 'x', 'x');
  reset role;
  select brand_id into marca from public.brand_asset_downloads
   where asset_id = m.fonte_um order by created_at desc limit 1;

  -- Baixar arquivo de marca que não alcança: `fora` só tem a marca dois.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', m.fora, 'role', 'authenticated')::text, true);
  begin
    insert into public.brand_asset_downloads (asset_id, brand_id, workspace_id, pessoa_email, asset_label, file_name)
    values (m.fonte_um, m.marca_dois, m.conta, 'x', 'x', 'x');
    estado := 'REGISTROU';
  exception when others then estado := sqlstate;
  end;
  reset role;

  insert into resultado (caso, esperado, obtido, passou) values
    ('ninguem registra em nome de outra pessoa', 'le', case when quem = m.le then 'le' when quem = m.dona then 'a dona (FORJADO)' else coalesce(quem::text,'(nulo)') end, quem = m.le),
    ('ninguem atribui o arquivo a outra marca', 'marca um', case when marca = m.marca_um then 'marca um' else 'outra' end, marca = m.marca_um),
    ('download de marca sem acesso e recusado', '42501', estado, estado = '42501');
end $$;

-- ─── 3. Quem lê, e ninguém apaga ───────────────────────────────────────────
do $$
declare m record; le_ve integer; dona_ve integer; apagar text; mudar text;
begin
  select * into m from mundo;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', m.le, 'role', 'authenticated')::text, true);
  select count(*) into le_ve from public.brand_asset_downloads;
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', m.dona, 'role', 'authenticated')::text, true);
  select count(*) into dona_ve from public.brand_asset_downloads where brand_id = m.marca_um;
  begin
    delete from public.brand_asset_downloads where brand_id = m.marca_um;
    apagar := 'APAGOU';
  exception when others then apagar := sqlstate;
  end;
  begin
    update public.brand_asset_downloads set pessoa_email = 'reescrito' where brand_id = m.marca_um;
    mudar := 'REESCREVEU';
  exception when others then mudar := sqlstate;
  end;
  reset role;

  insert into resultado (caso, esperado, obtido, passou) values
    ('quem so consulta NAO le o registro', '0', le_ve::text, le_ve = 0),
    ('quem administra a marca le o registro', '3', dona_ve::text, dona_ve = 3),
    ('nem quem administra apaga o registro', '42501', apagar, apagar = '42501'),
    ('nem quem administra reescreve o registro', '42501', mudar, mudar = '42501');
end $$;

-- ─── 4. O registro sobrevive ao arquivo ────────────────────────────────────
do $$
declare m record; sobrou integer; rotulo text; estado text;
begin
  select * into m from mundo;
  -- Apagamento definitivo do asset, como a manutenção faria.
  delete from public.brand_assets where id = m.fonte_um;

  select count(*), max(asset_label) into sobrou, rotulo
    from public.brand_asset_downloads where brand_id = m.marca_um and asset_id is null;

  -- Sem sessão não há de quem registrar.
  --
  -- A prova inteira é UMA transação, e `set_config(..., true)` vale até o fim
  -- dela: a sessão do caso anterior continuava ativa, e a primeira versão
  -- deste caso "registrou sem sessão" com a sessão da dona. Limpar é o que faz
  -- o caso testar o que diz testar — e a premissa abaixo reprova se não fez.
  perform set_config('request.jwt.claims', '', true);
  if (select auth.uid()) is not null then
    raise exception 'premissa falhou: ainda ha sessao no caso sem sessao';
  end if;
  begin
    insert into public.brand_asset_downloads (asset_id, brand_id, workspace_id, pessoa_email, asset_label, file_name)
    values (m.logo_dois, m.marca_dois, m.conta, 'x', 'x', 'x');
    estado := 'REGISTROU';
  exception when others then estado := sqlstate;
  end;

  insert into resultado (caso, esperado, obtido, passou) values
    ('apagar o arquivo NAO apaga quem o recebeu', '3', sobrou::text, sobrou = 3),
    ('e o registro ainda diz qual arquivo era', 'Fonte da Um', coalesce(rotulo,'(nada)'), rotulo = 'Fonte da Um'),
    ('download sem sessao nao e registravel', '42501', estado, estado = '42501');
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
