-- Mede a recuperação com um manual do tamanho de um manual de verdade.
--
-- Dados SINTÉTICOS com a forma do GE_ID000 (743 páginas, 152 seções) medida no
-- aceite. Nenhum conteúdo do manual real é usado, e a marca real não é
-- publicada — só as duas contagens vieram de lá.
--
-- Ele semeia, mede e REMOVE tudo. Rodar só contra banco de teste ou contra um
-- projeto que se saiba vazio: a limpeza apaga o workspace que ele criou, e
-- nada mais, mas medir sob dados reais mistura o que se está medindo.
--
-- Uso: cole no SQL editor, ou psql -f. O relatório sai como exceção, que é
-- também o que reverte a semeadura em caso de erro no meio.
--
-- Ver docs/medicoes/escala-da-recuperacao-2026-09-02.md para o resultado
-- registrado e para o achado sobre o índice GIN.

create schema if not exists escala_temp;
create table escala_temp.marcador(ws uuid, marca uuid);

do $$
declare
  conta uuid; usuario uuid; ma uuid; mb uuid; nova uuid; teto uuid;
  k integer; i integer; j integer; corpo text; inicio integer := 1; fim integer;
  vocabulario text[] := array['cor','tipografia','logotipo','assinatura','grid','fotografia',
    'ilustracao','tom de voz','aplicacao','papelaria','sinalizacao','embalagem','digital',
    'video','governanca','marca','simbolo','paleta','contraste','margem','reducao','area',
    'proporcao','versao','monocromatica','positiva','negativa','fundo','superficie','textura'];
begin
  select id into usuario from auth.users limit 1;
  insert into public.workspaces (name) values ('Escala') returning id into conta;
  insert into public.workspace_members (workspace_id, user_id, role) values (conta, usuario, 'owner');
  perform set_config('request.jwt.claims',
    json_build_object('sub', usuario, 'role','authenticated')::text, true);

  -- A marca medida, e uma VIZINHA com o mesmo vocabulário. Sem a vizinha, o
  -- teste provaria que a busca não acha o que não existe — não que o filtro
  -- por brand_id é o que separa.
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, theme, ai)
    values (conta,'grande','Grande','Grande','manual de escala','pt-BR','{}','{}') returning id into ma;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, theme, ai)
    values (conta,'vizinha','Vizinha','Vizinha','outra marca','pt-BR','{}','{}') returning id into mb;
  insert into escala_temp.marcador values (conta, ma);

  for i in 1..152 loop
    -- 743 páginas em 152 seções: média 4,9, distribuição irregular como a de
    -- um manual real, em vez de blocos idênticos.
    fim := least(inicio + (1 + (i * 7) % 9) - 1, 743);
    corpo := '';
    for j in 1..30 loop
      corpo := corpo || 'A regra de ' || vocabulario[1 + (i * j) % 30] ||
        ' define ' || vocabulario[1 + (i + j) % 30] || ' com ' ||
        vocabulario[1 + (i * 3 + j) % 30] || ' em aplicacao de ' ||
        vocabulario[1 + (j * 5) % 30] || '. ';
    end loop;
    insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name,
      title, status, body, blocks, source_pages, sort_order, updated_by)
    values (conta, ma, 'grande', 'secao-' || i, 'Manual', 'Secao ' || i,
      case when i % 3 = 0 then 'draft' else 'ready' end, to_jsonb(array[corpo]),
      jsonb_build_array(jsonb_build_object('kind','swatches','title','Paleta ' || i,
        'items', jsonb_build_array(jsonb_build_object('name','Cor ' || i,'hex','#abcdef')))),
      jsonb_build_array(jsonb_build_object('start', inicio, 'end', fim)), i, usuario);
    if i % 2 = 0 then
      insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name,
        title, status, body, blocks, source_pages, sort_order, updated_by)
      values (conta, mb, 'vizinha', 'secao-' || i, 'Manual', 'Secao ' || i, 'ready',
        to_jsonb(array[corpo]), '[]'::jsonb,
        jsonb_build_array(jsonb_build_object('start', inicio, 'end', fim)), i, usuario);
    end if;
    inicio := fim + 1;
    if inicio > 743 then inicio := 1; end if;
  end loop;

  -- Quarenta clientes: o tamanho de um estúdio, e o que faz o planejador
  -- deixar de escolher Seq Scan.
  for k in 1..40 loop
    insert into public.brands (workspace_id, key, name, short_name, descriptor, language, theme, ai)
      values (conta, 'cliente-' || k, 'Cliente ' || k, 'C' || k, 'manual', 'pt-BR','{}','{}')
      returning id into nova;
    for i in 1..152 loop
      corpo := '';
      for j in 1..30 loop
        corpo := corpo || 'A regra de ' || vocabulario[1 + (i * j + k) % 30] ||
          ' define ' || vocabulario[1 + (i + j) % 30] || ' com ' ||
          vocabulario[1 + (i * 3 + j + k) % 30] || ' em aplicacao de ' ||
          vocabulario[1 + (j * 5) % 30] || '. ';
      end loop;
      insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name,
        title, status, body, blocks, source_pages, sort_order, updated_by)
      values (conta, nova, 'cliente-' || k, 'secao-' || i, 'Manual', 'Secao ' || i, 'ready',
        to_jsonb(array[corpo]), '[]'::jsonb,
        jsonb_build_array(jsonb_build_object('start', i, 'end', i + 3)), i, usuario);
    end loop;
  end loop;

  -- O teto do produto: 500 seções, que o importador recusa ultrapassar.
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, theme, ai)
    values (conta, 'no-teto', 'No teto', 'Teto', 'manual no limite', 'pt-BR','{}','{}')
    returning id into teto;
  for i in 1..500 loop
    corpo := '';
    for j in 1..30 loop
      corpo := corpo || 'A regra de ' || vocabulario[1 + (i * j) % 30] ||
        ' define ' || vocabulario[1 + (i + j) % 30] || ' com ' ||
        vocabulario[1 + (i * 3 + j) % 30] || ' em aplicacao de ' ||
        vocabulario[1 + (j * 5) % 30] || '. ';
    end loop;
    insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name,
      title, status, body, blocks, source_pages, sort_order, updated_by)
    values (conta, teto, 'no-teto', 'secao-' || i, 'Manual', 'Secao ' || i, 'ready',
      to_jsonb(array[corpo]),
      jsonb_build_array(jsonb_build_object('kind','swatches','title','Paleta ' || i,
        'items', jsonb_build_array(jsonb_build_object('name','Cor ' || i,'hex','#abcdef')))),
      jsonb_build_array(jsonb_build_object('start', i, 'end', i + 1)), i, usuario);
  end loop;
end $$;

analyze public.brand_chunks;

-- A medição. Cem buscas, dez consultas em rodízio, depois de aquecer.
do $$
declare
  u uuid; alvo uuid; n integer; fontes integer; total integer := 0;
  consultas text[] := array[
    'contraste de cor em papelaria','tipografia e grid','logotipo em fundo escuro',
    'reducao minima do simbolo','tom de voz digital','area de respiro da assinatura',
    'paleta monocromatica','aplicacao em embalagem','governanca da marca','fotografia e textura'];
  t0 timestamptz; ms numeric; ms_pior numeric := 0; ms_total numeric;
  r text := '';
  rotulo text; chave text;
begin
  select id into u from auth.users limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', u, 'role','authenticated')::text, true);

  foreach chave in array array['grande','no-teto'] loop
    select id into alvo from public.brands where key = chave;
    rotulo := case chave when 'grande' then '152 secoes' else '500 secoes (teto)' end;

    perform count(*) from public.buscar_trechos(alvo, consultas[1], 8);
    total := 0; ms_pior := 0;
    t0 := clock_timestamp();
    for n in 1..100 loop
      declare t1 timestamptz := clock_timestamp();
      begin
        select count(*) into fontes from public.buscar_trechos(alvo, consultas[1 + n % 10], 8);
        total := total + fontes;
        ms := extract(epoch from (clock_timestamp() - t1)) * 1000;
        if ms > ms_pior then ms_pior := ms; end if;
      end;
    end loop;
    ms_total := extract(epoch from (clock_timestamp() - t0)) * 1000;
    r := r || format(E'\n  %-20s  media %s ms   pior %s ms   fontes/busca %s',
      rotulo, round(ms_total/100,2), round(ms_pior,2), round(total::numeric/100,1));
  end loop;

  r := r || format(E'\n  trechos na tabela: %s',
    (select count(*) from public.brand_chunks));
  raise notice 'ESCALA %', r;
end $$;

-- Limpeza. A cascata leva marcas, documentos, trechos e versões.
delete from public.workspaces where id in (select ws from escala_temp.marcador);
drop schema escala_temp cascade;
