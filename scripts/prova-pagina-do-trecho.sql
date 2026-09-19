-- Prova da página do trecho — 19/09/2026.
--
-- O importador grava `{"de", "ate"}`; a função dos trechos lia `{"start",
-- "end"}` e deixava a página vazia em todos os trechos. A citação do Vini leva
-- o PDF à página do trecho — sem página, abria o manual no começo. Ver a
-- migration 20260919143250_pagina_do_trecho.
--
-- Mesmo método das outras: mundo próprio, preparação que falha REPROVA, e
-- `rollback` no fim. A busca é chamada como a pessoa (authenticated), porque é
-- por ela que a página chega ao servidor do chat.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (conta uuid, admin uuid, marca uuid);
grant select on mundo to authenticated;

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;

-- Um documento com a faixa dada; o gatilho constrói os trechos.
create function pg_temp.secao(p_slug text, p_faixa jsonb, p_corpo text default 'Palette and colour rules.')
returns void language plpgsql as $f$
declare m record;
begin
  select * into m from mundo;
  perform set_config('request.jwt.claims', json_build_object('sub', m.admin, 'role', 'authenticated')::text, true);
  insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name,
    title, status, body, blocks, source_pages, sort_order, updated_by)
  values (m.conta, m.marca, 'prova-pagina', p_slug, 'Manual', initcap(p_slug), 'draft',
    to_jsonb(array[p_corpo]),
    jsonb_build_array(jsonb_build_object('kind', 'text', 'title', 'Bloco', 'text', 'Block about colour.')),
    p_faixa, 0, m.admin);
  perform set_config('request.jwt.claims', '', true);
end $f$;

-- As faixas dos trechos de um documento: "início-fim" de cada um, distintas.
create function pg_temp.faixas(p_slug text) returns text language sql as $f$
  select coalesce(string_agg(distinct coalesce(page_start::text,'∅') || '-' || coalesce(page_end::text,'∅'), ','), 'sem trechos')
  from public.brand_chunks c join mundo m on m.marca = c.brand_id where c.slug = p_slug;
$f$;

do $$
declare
  u uuid := 'cdcdcdcd-0000-4000-8000-00000000000a';
  conta uuid; marca uuid;
begin
  insert into auth.users (id, email, aud, role) values (u, 'pp-admin@local.test', 'authenticated', 'authenticated');
  insert into public.profiles (id, email, full_name) values (u, 'pp-admin@local.test', 'PP');
  conta := private.abrir_conta_de_assinatura('Conta da Página', 'pp-admin@local.test', u);
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (conta, 'pp-marca', 'PP', 'PP', 'x', 'en', '{}','{}','{}','{}','{}') returning id into marca;
  insert into mundo values (conta, u, marca);
end $$;

-- ─── 1. O formato do importador ────────────────────────────────────────────
do $$
begin
  perform pg_temp.secao('colours', '[{"de": 12, "ate": 14}]');
  perform pg_temp.registrar('faixa de/ate chega ao trecho do corpo E ao do bloco', '12-14', pg_temp.faixas('colours'));

  perform pg_temp.secao('logo', '[{"de": 5, "ate": 5}, {"de": 9, "ate": 10}]');
  perform pg_temp.registrar('varias faixas: da primeira pagina a ultima', '5-10', pg_temp.faixas('logo'));
end $$;

-- ─── 2. O formato antigo continua valendo ─────────────────────────────────
do $$
begin
  perform pg_temp.secao('antigo', '[{"start": 3, "end": 4}]');
  perform pg_temp.registrar('faixa start/end, das ferramentas de medicao', '3-4', pg_temp.faixas('antigo'));
end $$;

-- ─── 3. Sem página, ou página estranha: sem página, e sem quebrar ─────────
do $$
begin
  perform pg_temp.secao('sem-faixa', '[]');
  perform pg_temp.registrar('documento sem faixa: trecho sem pagina', '∅-∅', pg_temp.faixas('sem-faixa'));

  perform pg_temp.secao('estranha', '[{"de": "doze", "ate": -1}, "x", {"de": 0}]');
  perform pg_temp.registrar('faixa estranha nao derruba a gravacao nem inventa pagina', '∅-∅', pg_temp.faixas('estranha'));

  perform pg_temp.secao('meio-estranha', '[{"de": "doze"}, {"de": 7, "ate": 8}]');
  perform pg_temp.registrar('o que presta na faixa e aproveitado', '7-8', pg_temp.faixas('meio-estranha'));
end $$;

-- ─── 4. Regravar o documento mantém a página ──────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform set_config('request.jwt.claims', json_build_object('sub', m.admin, 'role', 'authenticated')::text, true);
  update public.brand_documents set body = to_jsonb(array['Updated colour rules.'])
   where brand_id = m.marca and slug = 'colours';
  perform set_config('request.jwt.claims', '', true);
  perform pg_temp.registrar('editar o documento reindexa com a mesma pagina', '12-14', pg_temp.faixas('colours'));
end $$;

-- ─── 5. A página chega a quem busca — é o que o chat usa ──────────────────
do $$
declare m record; r text;
begin
  select * into m from mundo;
  perform set_config('request.jwt.claims', json_build_object('sub', m.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select string_agg(distinct document_slug || ':' || page_start, ',' order by document_slug || ':' || page_start)
    into r from public.buscar_trechos(m.marca, 'colour', 20) where page_start is not null;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform pg_temp.registrar('a busca devolve a pagina de cada trecho',
    'antigo:3,colours:12,logo:5,meio-estranha:7', r);
end $$;

-- ─── 6. Ninguém com sessão reconstrói trechos ─────────────────────────────
do $$
declare m record; estado text;
begin
  select * into m from mundo;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', m.admin, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform public.reconstruir_trechos((select id from public.brand_documents where brand_id = m.marca limit 1));
    estado := 'ACEITOU';
  exception when others then
    estado := sqlstate;
  end;
  reset role;
  perform pg_temp.registrar('reconstruir e funcao de sistema', '42501', estado);
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
