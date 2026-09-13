-- Prova de "substituir não apaga" — item 10 do ADR-0007 §2.4.
--
-- Mesmo método das outras provas do projeto: mundo próprio, cada caso com dado
-- isolado, SQLSTATE conferido onde há erro esperado, caso cuja preparação falha
-- é reprovado e não ignorado, e `rollback` no fim.
--
-- Exige a migration `acesso_por_marca` aplicada: a autorização dos assets é por
-- marca, e é isso que o substituto de outra marca precisa esbarrar.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (
  ordem serial, caso text, esperado text, obtido text, passou boolean
);
grant select, insert on resultado to authenticated, anon;
grant usage, select on sequence resultado_ordem_seq to authenticated, anon;

do $$
declare
  u_dona uuid := '55555555-5555-4555-8555-55555555aaaa';
  u_le   uuid := '55555555-5555-4555-8555-55555555bbbb';
  w uuid; m1 uuid; m2 uuid; a_velho uuid; a_novo uuid; a_outra uuid;
begin
  insert into auth.users (id, email, aud, role) values
    (u_dona, 'prova-asset-dona@local.test', 'authenticated', 'authenticated'),
    (u_le,   'prova-asset-le@local.test',   'authenticated', 'authenticated');

  insert into public.workspaces (name, slug) values ('Prova Asset', 'prova-asset') returning id into w;
  insert into public.workspace_members (workspace_id, user_id, role) values
    (w, u_dona, 'owner'), (w, u_le, 'member');

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (w, 'marca-a', 'Marca A', 'A', 'Primeira', 'pt-BR', '{}','{}','{}','{}','{}')
  returning id into m1;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (w, 'marca-b', 'Marca B', 'B', 'Segunda', 'pt-BR', '{}','{}','{}','{}','{}')
  returning id into m2;

  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades) values
    (m1, w, u_dona, array['consultar','editar','aprovar','administrar']),
    (m2, w, u_dona, array['consultar','editar','aprovar','administrar']),
    (m1, w, u_le,   array['consultar'])
  on conflict (brand_id, user_id) do update set capacidades = excluded.capacidades;

  insert into public.brand_assets (workspace_id, brand_id, label, description, category,
                                   storage_path, file_name, mime_type, size_bytes, status, created_by)
  values (w, m1, 'Logo v1', '', 'Logotipos', w::text||'/'||m1::text||'/logo-v1.svg',
          'logo-v1.svg', 'image/svg+xml', 100, 'ready', u_dona) returning id into a_velho;
  insert into public.brand_assets (workspace_id, brand_id, label, description, category,
                                   storage_path, file_name, mime_type, size_bytes, status, created_by)
  values (w, m1, 'Logo v2', '', 'Logotipos', w::text||'/'||m1::text||'/logo-v2.svg',
          'logo-v2.svg', 'image/svg+xml', 100, 'ready', u_dona) returning id into a_novo;
  insert into public.brand_assets (workspace_id, brand_id, label, description, category,
                                   storage_path, file_name, mime_type, size_bytes, status, created_by)
  values (w, m2, 'Logo da B', '', 'Logotipos', w::text||'/'||m2::text||'/logo-b.svg',
          'logo-b.svg', 'image/svg+xml', 100, 'ready', u_dona) returning id into a_outra;

  create temp table mundo as
  select u_dona as dona, u_le as le, w as conta, m1 as marca_a, m2 as marca_b,
         a_velho as velho, a_novo as novo, a_outra as da_outra_marca;
  grant select on mundo to authenticated, anon;
end $$;

-- ─── 1. Substituir mantém o arquivo antigo, identificado ────────────────────
do $$
declare m record; sobrevive integer; aponta uuid; quando timestamptz; quem uuid; em_uso integer;
begin
  select * into m from mundo;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.dona, 'role', 'authenticated')::text, true);
  update public.brand_assets
     set descontinuado_em = now(), descontinuado_por = m.dona, substituido_por = m.novo
   where id = m.velho;
  select count(*) into sobrevive from public.brand_assets where id = m.velho;
  select substituido_por, descontinuado_em, descontinuado_por into aponta, quando, quem
    from public.brand_assets where id = m.velho;
  select count(*) into em_uso from public.brand_assets
   where brand_id = m.marca_a and descontinuado_em is null;
  reset role;

  insert into resultado (caso, esperado, obtido, passou) values
    ('o arquivo antigo NAO some', '1', sobrevive::text, sobrevive = 1),
    ('ele diz qual arquivo o substituiu', 'o novo',
     case when aponta = m.novo then 'o novo' else coalesce(aponta::text,'(nenhum)') end, aponta = m.novo),
    ('ele diz quando foi descontinuado', 'preenchido',
     case when quando is null then 'nulo' else 'preenchido' end, quando is not null),
    ('ele diz quem descontinuou', 'a dona',
     case when quem = m.dona then 'a dona' else coalesce(quem::text,'(ninguem)') end, quem = m.dona),
    ('a listagem em uso mostra so o novo', '1', em_uso::text, em_uso = 1);
end $$;

-- ─── 2. Estados impossíveis são impossíveis, e o nome da trava importa ──────
do $$
declare m record; estado text; nome text;
begin
  select * into m from mundo;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.dona, 'role', 'authenticated')::text, true);

  -- Substituto sem descontinuação: "foi trocado e continua em uso".
  begin
    update public.brand_assets set substituido_por = m.velho, descontinuado_em = null
     where id = m.novo;
    estado := 'ACEITOU'; nome := '';
  exception when check_violation then
    estado := sqlstate;
    get stacked diagnostics nome = constraint_name;
  when others then
    estado := sqlstate; nome := '(outro erro)';
  end;
  insert into resultado (caso, esperado, obtido, passou) values
    ('substituto sem descontinuacao e recusado', '23514', estado, estado = '23514'),
    ('e a trava e a nomeada, nao outra qualquer',
     'brand_assets_substituto_exige_descontinuacao', nome,
     nome = 'brand_assets_substituto_exige_descontinuacao');

  -- Substituir-se a si mesmo.
  begin
    update public.brand_assets set descontinuado_em = now(), substituido_por = m.novo
     where id = m.novo;
    estado := 'ACEITOU'; nome := '';
  exception when check_violation then
    estado := sqlstate;
    get stacked diagnostics nome = constraint_name;
  when others then
    estado := sqlstate; nome := '(outro erro)';
  end;
  insert into resultado (caso, esperado, obtido, passou) values
    ('asset nao substitui a si mesmo', '23514', estado, estado = '23514'),
    ('e a trava e a nomeada', 'brand_assets_nao_substitui_a_si_mesmo', nome,
     nome = 'brand_assets_nao_substitui_a_si_mesmo');
  reset role;
end $$;

-- ─── 3. O substituto não atravessa a fronteira da marca ─────────────────────
do $$
declare m record; estado text;
begin
  select * into m from mundo;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.dona, 'role', 'authenticated')::text, true);
  -- A dona tem acesso às DUAS marcas, então a RLS deixa passar. Quem barra é o
  -- gatilho: o acervo de uma marca apontando para o arquivo de outra é
  -- exatamente o vazamento que o passo A fechou.
  begin
    update public.brand_assets
       set descontinuado_em = now(), substituido_por = m.da_outra_marca
     where id = m.novo;
    estado := 'ACEITOU';
  exception when others then
    estado := sqlstate;
  end;
  reset role;
  insert into resultado (caso, esperado, obtido, passou) values
    ('substituto de OUTRA marca e recusado', '23514', estado, estado = '23514');
end $$;

-- ─── 4. Quem só consulta não descontinua ────────────────────────────────────
do $$
declare m record; mexeu integer; ve_descontinuado integer;
begin
  select * into m from mundo;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.le, 'role', 'authenticated')::text, true);
  update public.brand_assets set descontinuado_em = null where id = m.velho;
  get diagnostics mexeu = row_count;
  -- Mas continua vendo: descontinuado é visível, não escondido (item 10).
  select count(*) into ve_descontinuado from public.brand_assets
   where id = m.velho and descontinuado_em is not null;
  reset role;

  insert into resultado (caso, esperado, obtido, passou) values
    ('quem so consulta NAO reativa asset', '0 linhas', mexeu::text || ' linhas', mexeu = 0),
    ('mas continua VENDO o descontinuado', '1', ve_descontinuado::text, ve_descontinuado = 1);
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
