-- Prova das imagens de leitura das páginas — 26/09/2026.
--
-- O Vini passa a VER as páginas (migration imagens_de_leitura_das_paginas).
-- Mesmo método das outras provas: mundo próprio, chamadas COMO USUÁRIO, e
-- `rollback` no fim. O que ela tranca:
--   • quem EDITA a marca registra a imagem de uma página, e só com o arquivo
--     no Storage, no caminho exato;
--   • quem só consulta, quem é de outra conta e anon NÃO registram;
--   • o banco recusa, pelo NOME do check, caminho fora da forma;
--   • quem consulta LÊ o caminho registrado (é assim que o Vini o acha).

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;

create function pg_temp.como(p_quem uuid, p_sql text, p_papel text default 'authenticated', out saida text)
language plpgsql as $f$
begin
  begin
    perform set_config('request.jwt.claims',
      case when p_quem is null then '' else json_build_object('sub', p_quem, 'role', p_papel)::text end, true);
    execute format('set local role %I', p_papel);
    execute p_sql into saida;
    saida := coalesce(saida, 'OK');
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    saida := sqlstate;
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
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (p_conta, p_key, p_key, p_key, 'marca da prova', 'pt-BR', '{}','{}','{}','{}','{}')
  returning id;
$f$;

create temp table mundo (conta uuid, outra uuid, admin uuid, consulta uuid, fora uuid, marca uuid, doc uuid);
grant select on mundo to authenticated;

do $$
declare
  u_admin uuid := 'eeeeeeee-0000-4000-8000-0000000000a1';
  u_consulta uuid := 'eeeeeeee-0000-4000-8000-0000000000a2';
  u_fora uuid := 'eeeeeeee-0000-4000-8000-0000000000a3';
  conta uuid; outra uuid; m uuid; d uuid;
begin
  perform pg_temp.entrar(u_admin, 'leitura-admin@local.test');
  perform pg_temp.entrar(u_consulta, 'leitura-consulta@local.test');
  perform pg_temp.entrar(u_fora, 'leitura-fora@local.test');
  conta := private.abrir_conta_de_assinatura('Conta da Leitura', 'leitura-admin@local.test', u_admin);
  outra := private.abrir_conta_de_assinatura('Outra Conta da Leitura', 'leitura-fora@local.test', u_fora);
  m := pg_temp.marca(conta, 'leitura-a');

  set local role service_role;
  select public.registrar_documento_fonte(
    conta, m, conta::text||'/i/'||repeat('c',64)||'.pdf', repeat('c',64), 1000, 2,
    'manual', 'pt-BR', 'Manual da prova',
    jsonb_build_array(
      jsonb_build_object('pagina',1,'largura_pt',842,'altura_pt',474,'tem_texto',true),
      jsonb_build_object('pagina',2,'largura_pt',842,'altura_pt',474,'tem_texto',true)),
    u_admin) into d;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform public.conceder_acesso(conta, 'leitura-consulta@local.test', 'consulta', array[m]);
  perform set_config('request.jwt.claims', '', true);

  -- O arquivo da página 1 "enviado": só a linha em storage.objects importa.
  insert into storage.objects (bucket_id, name, owner)
  values ('brand-assets', conta::text||'/'||m::text||'/pagina-'||d::text||'-1.jpg', u_admin);

  insert into mundo values (conta, outra, u_admin, u_consulta, u_fora, m, d);
  if d is null then raise exception 'premissa falhou: documento nao registrado'; end if;
end $$;

create function pg_temp.registrar_como(p_quem uuid, p_pagina int, p_papel text default 'authenticated')
returns text language sql as $f$
  select saida from pg_temp.como(p_quem, format(
    'select public.registrar_imagem_de_leitura(%L, %s)', (select doc from mundo), p_pagina), p_papel);
$f$;

-- ─── 1. Quem edita registra, com o arquivo no lugar ────────────────────────
do $$
declare m record; esperado text;
begin
  select * into m from mundo;
  esperado := m.conta::text||'/'||m.marca::text||'/pagina-'||m.doc::text||'-1.jpg';
  perform pg_temp.registrar('quem edita registra a pagina 1', esperado, pg_temp.registrar_como(m.admin, 1));
  perform pg_temp.registrar('o caminho ficou gravado na pagina', esperado,
    (select miniatura_path from public.brand_source_pages where source_document_id = m.doc and pagina = 1));
end $$;

-- ─── 2. Sem arquivo, sem página, sem direito: recusa ───────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('sem arquivo no Storage: recusa', 'P0002', pg_temp.registrar_como(m.admin, 2));
  perform pg_temp.registrar('pagina inexistente: recusa', 'P0002', pg_temp.registrar_como(m.admin, 99));
  perform pg_temp.registrar('quem so consulta NAO registra', 'P0002', pg_temp.registrar_como(m.consulta, 1));
  perform pg_temp.registrar('quem e de outra conta NAO registra', 'P0002', pg_temp.registrar_como(m.fora, 1));
  perform pg_temp.registrar('anon nao executa', '42501', pg_temp.registrar_como(null, 1, 'anon'));
end $$;

-- ─── 3. O banco recusa caminho fora da forma, pelo NOME do check ───────────
do $$
declare m record; msg text;
begin
  select * into m from mundo;
  begin
    update public.brand_source_pages
       set miniatura_path = m.conta::text||'/'||m.marca::text||'/pagina-'||m.doc::text||'-2.jpg'
     where source_document_id = m.doc and pagina = 1;
    msg := 'aceitou';
  exception when check_violation then
    get stacked diagnostics msg = constraint_name;
  end;
  perform pg_temp.registrar('caminho de OUTRA pagina: o check recusa', 'brand_source_pages_miniatura_na_forma', msg);
  begin
    update public.brand_source_pages set miniatura_path = 'qualquer/coisa.jpg'
     where source_document_id = m.doc and pagina = 2;
    msg := 'aceitou';
  exception when check_violation then
    get stacked diagnostics msg = constraint_name;
  end;
  perform pg_temp.registrar('caminho solto: o check recusa', 'brand_source_pages_miniatura_na_forma', msg);
end $$;

-- ─── 4. Quem consulta lê o caminho (é por ele que o Vini acha a imagem) ────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('quem consulta le o caminho registrado', 'true', (select saida from pg_temp.como(m.consulta, format(
    'select (miniatura_path is not null)::text from public.brand_source_pages where source_document_id = %L and pagina = 1', m.doc))));
  perform pg_temp.registrar('quem e de fora NAO le a pagina', 'OK', (select saida from pg_temp.como(m.fora, format(
    'select miniatura_path from public.brand_source_pages where source_document_id = %L and pagina = 1', m.doc))));
end $$;

-- ─── Veredito ──────────────────────────────────────────────────────────────
select ordem, case when passou then 'ok  ' else 'FALHOU' end as resultado, caso, esperado, obtido
from resultado order by ordem;

do $$
declare falhas int; total int;
begin
  select count(*) filter (where not passou), count(*) into falhas, total from resultado;
  if falhas > 0 then
    raise exception 'PROVA REPROVADA: % de % casos falharam', falhas, total;
  end if;
  raise notice 'PROVA APROVADA: % casos', total;
end $$;

rollback;
