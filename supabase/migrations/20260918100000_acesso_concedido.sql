-- A conta nasce da assinatura, e todo acesso é concedido — decisões de 17/09.
--
-- ─── O que muda, e por quê ───────────────────────────────────────────────
--
-- 1. ADMINISTRAR A CONTA PASSA A IMPLICAR ADMINISTRAR AS MARCAS DELA.
--
--    Até aqui `tem_capacidade_na_marca` olhava só `brand_members`, e o acesso do
--    administrador era uma CÓPIA por marca, semeada na criação. Com mais de um
--    administrador por conta (decisão de 17/09), a cópia quebra em dois lugares
--    medidos no código: a marca criada por um administrador só ficava visível
--    para ELE, e um administrador promovido depois não alcançaria nenhuma marca
--    existente.
--
--    A regra agora deriva. Ninguém precisa lembrar de copiar nada, e marca nova
--    nasce visível para quem administra a conta.
--
-- 2. QUEM NÃO ADMINISTRA SÓ ALCANÇA O QUE FOI CONCEDIDO, marca a marca — pode
--    ser uma, algumas ou todas. Isso é `brand_members`, que continua igual.
--
-- 3. ENTRAR DEIXA DE CRIAR CONTA. `handle_new_profile` criava uma conta nova e
--    punha o perfil como dono. Não existe mais cadastro que vira conta: a conta
--    nasce da assinatura, por ato explícito (`private.abrir_conta_de_assinatura`).
--
-- 4. CONCESSÃO PENDENTE POR E-MAIL. O administrador libera quem ainda não entrou;
--    a concessão vira acesso no primeiro login daquela pessoa.
--
-- ⚠️ Nada muda para quem já tem acesso hoje: as linhas de `brand_members` que
-- existem continuam valendo, e a regra nova só ACRESCENTA o caminho do
-- administrador da conta.

-- ─── 1. A capacidade deriva de administrar a conta ───────────────────────
--
-- ⚠️ DUAS ARMADILHAS MEDIDAS AO ESCREVER ESTA MIGRATION (17/09/2026).
--
-- A derivação precisa saber de QUAL CONTA é a marca, e isso é ler
-- `public.brands`. Com a função INVOKER, a leitura disparava a policy de
-- `brands`, que chama esta mesma função: "stack depth limit exceeded", e três
-- provas caíram de uma vez. A saída seguinte — um auxiliar em `private` —
-- esbarrou em `authenticated` não ter USAGE naquele esquema, e abrir o esquema
-- inteiro por causa de um auxiliar é preço alto demais.
--
-- O núcleo abaixo mora em `private` e é chamado só por funções DEFINER, que
-- rodam como dono e por isso alcançam o esquema. As portas públicas são
-- DEFINER — exceção deliberada à regra do CLAUDE.md, por duas razões:
--
--   1. QUEM CHAMA precisa de EXECUTE: a função é usada DENTRO de 23 policies, e
--      policy roda com o papel de quem consulta. Revogar derrubaria a leitura
--      inteira do produto.
--   2. NÃO HÁ O QUE EXTRAIR: elas respondem sobre QUEM PERGUNTA e devolvem um
--      booleano. Chamar com o id de outra marca só responde "não".

create function private.capacidade_de(p_user_id uuid, p_brand_id uuid, p_capacidade text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select p_user_id is not null and (exists (
    -- Concedido NESTA marca, com esta capacidade.
    select 1 from public.brand_members
     where brand_members.brand_id = p_brand_id
       and brand_members.user_id = p_user_id
       and p_capacidade = any (brand_members.capacidades)
  ) or exists (
    -- Ou administra a CONTA dona da marca: quem administra a conta administra
    -- todas as marcas dela, inclusive as que nascerem depois. Nada é copiado,
    -- então nada fica para trás quando uma marca nova aparece.
    select 1
      from public.brands b
      join public.workspace_members wm on wm.workspace_id = b.workspace_id
     where b.id = p_brand_id
       and wm.user_id = p_user_id
       and wm.role = 'owner'
  ));
$$;

revoke execute on function private.capacidade_de(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.tem_capacidade_na_marca(p_brand_id uuid, p_capacidade text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.capacidade_de((select auth.uid()), p_brand_id, p_capacidade);
$$;

/*
 * A mesma pergunta, feita a partir de um CAMINHO do Storage.
 *
 * As policies de `storage.objects` só têm texto: `conta/marca/arquivo`. Elas
 * repetiam a regra à mão, e com a derivação passariam a recusar justamente quem
 * administra a conta — aceito no banco, recusado no arquivo.
 *
 * O `::uuid` só acontece depois do formato conferido. Um segmento que não é
 * uuid faria o cast LEVANTAR ERRO dentro da policy, e a lição já custou uma
 * sessão: caminho fora do padrão precisa responder "não", não explodir.
 */
create function public.tem_capacidade_no_caminho(p_conta text, p_marca text, p_capacidade text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when p_conta ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and p_marca ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then exists (
      select 1 from public.brands b
       where b.id = p_marca::uuid
         and b.workspace_id = p_conta::uuid
         and private.capacidade_de((select auth.uid()), b.id, p_capacidade))
    else false
  end;
$$;

/*
 * "A marca deste caminho ainda existe?"
 *
 * As duas policies de limpeza usavam "não há ninguém em `brand_members` desta
 * marca" como sinal de marca apagada. Com a derivação isso vira FALSO POSITIVO
 * perigoso: uma marca viva, cujo acesso é só o do administrador, não tem linha
 * nenhuma em `brand_members` — e o dono da conta poderia apagar arquivo de
 * marca viva pela regra de limpeza. O sinal passa a ser o fato direto.
 */
create function public.marca_do_caminho_existe(p_marca text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when p_marca ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then exists (select 1 from public.brands b where b.id = p_marca::uuid)
    else false
  end;
$$;

revoke execute on function public.tem_capacidade_no_caminho(text, text, text) from public, anon;
revoke execute on function public.marca_do_caminho_existe(text) from public, anon;
grant execute on function public.tem_capacidade_no_caminho(text, text, text) to authenticated;
grant execute on function public.marca_do_caminho_existe(text) to authenticated;

-- ─── 1.1. Os lugares que repetiam a regra ────────────────────────────────
--
-- Três funções e seis policies do Storage decidiam por conta própria, lendo
-- `brand_members` direto. Com a derivação, elas passariam a divergir do resto —
-- o administrador seria aceito numa porta e recusado na outra. Todas passam a
-- chamar a mesma regra.

create or replace function private.capture_brand_document_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  source_row public.brand_documents%rowtype;
  event_action text;
  actor_id uuid := (select auth.uid());
  resolved_actor_label text;
begin
  if tg_op = 'DELETE' then
    source_row := old;
    event_action := 'deleted';
  else
    source_row := new;
    -- Recuperação é uma escrita como outra qualquer; o que a distingue é a
    -- origem declarada. Só conta quando o valor MUDA: salvar de novo depois de
    -- recuperar volta a ser publicação.
    if new.restored_from_version_id is not null
      and (tg_op = 'INSERT'
           or new.restored_from_version_id is distinct from old.restored_from_version_id) then
      event_action := 'restored_from_version';
    else
      event_action := 'published';
    end if;
  end if;

  -- A marca sumiu antes do documento: isto é cascata, não edição. Ver o
  -- patch 0.1.
  if tg_op = 'DELETE'
    and source_row.brand_id is not null
    and not exists (select 1 from public.brands where brands.id = source_row.brand_id) then
    return old;
  end if;

  if tg_op = 'UPDATE'
    and new.group_name is not distinct from old.group_name
    and new.title is not distinct from old.title
    and new.status is not distinct from old.status
    and new.body is not distinct from old.body
    and new.images is not distinct from old.images
    and new.blocks is not distinct from old.blocks
    and new.brand_id is not distinct from old.brand_id
    and new.restored_from_version_id is not distinct from old.restored_from_version_id
    and new.sort_order is not distinct from old.sort_order then
    return new;
  end if;

  /*
   * Quem pode editar passou a ser decidido POR MARCA (20260913185141).
   *
   * Antes, esta checagem exigia `owner` da conta — e, com o acesso por marca,
   * ela recusaria justamente quem recebeu `editar` naquela marca: a RLS
   * deixaria passar e o gatilho barraria, com 42501 e sem explicação útil.
   *
   * Linha sem marca (anterior à coluna `brand_id`) continua exigindo quem
   * administra a CONTA: não há marca a que atribuir a permissão.
   */
  if actor_id is null or not (
    case when source_row.brand_id is null
         then exists (
           select 1 from public.workspace_members
           where workspace_members.workspace_id = source_row.workspace_id
             and workspace_members.user_id = actor_id
             and workspace_members.role = 'owner')
         -- Desde 17/09/2026 a guarda chama a MESMA regra do resto do produto
         -- (que inclui quem administra a conta). Antes lia `brand_members` à
         -- mão, e recusaria o administrador sem linha nesta marca.
         else private.capacidade_de(actor_id, source_row.brand_id, 'editar')
    end
  ) then
    raise exception 'Only editors of this brand can create editorial audit entries'
      using errcode = '42501';
  end if;

  select coalesce(nullif(profiles.full_name, ''), nullif(profiles.email, ''), 'Proprietário')
    into resolved_actor_label
  from public.profiles
  where profiles.id = actor_id;

  insert into public.brand_document_versions (
    workspace_id, brand_id, instance_key, slug, source_document_id,
    action, snapshot, changed_by, actor_label
  ) values (
    source_row.workspace_id,
    source_row.brand_id,
    source_row.instance_key,
    source_row.slug,
    source_row.id,
    event_action,
    jsonb_build_object(
      'slug', source_row.slug,
      'group', source_row.group_name,
      'title', source_row.title,
      'status', source_row.status,
      'body', source_row.body,
      'images', source_row.images,
      'blocks', source_row.blocks,
      'brandId', source_row.brand_id,
      'restoredFromVersionId', source_row.restored_from_version_id,
      'sortOrder', source_row.sort_order,
      'updatedAt', source_row.updated_at
    ),
    actor_id,
    coalesce(resolved_actor_label, 'Proprietário')
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

create or replace function public.registrar_documento_fonte(p_workspace_id uuid, p_brand_id uuid, p_storage_path text, p_pdf_sha256 text, p_byte_size bigint, p_page_count integer, p_tipo text, p_idioma text, p_titulo text, p_paginas jsonb, p_created_by uuid, p_import_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  novo_id uuid;
  quantas integer;
  distintas integer;
  proxima_versao integer;
  menor integer;
  maior integer;
begin
  if p_created_by is null then
    raise exception 'autor é obrigatório' using errcode = '22004';
  end if;
  /*
   * Quem publica precisa ADMINISTRAR A MARCA (16/09/2026).
   *
   * Antes: `owner` da conta. A função é definer e contorna a RLS, então esta
   * verificação é a única que resta — e a antiga deixava passar quem
   * administra a conta com acesso restrito à marca.
   *
   * O par (marca, conta) é conferido junto: uma marca de OUTRA conta não
   * satisfaz a linha de acesso desta, e a inserção nem chega às FKs compostas.
   */
  -- Desde 17/09/2026 pela MESMA regra do resto (inclui quem administra a
  -- conta). O par (marca, conta) continua conferido: uma marca de outra conta
  -- não satisfaz esta chamada.
  if not exists (
    select 1 from public.brands b
    where b.id = p_brand_id and b.workspace_id = p_workspace_id
      and private.capacidade_de(p_created_by, p_brand_id, 'administrar')
  ) then
    raise exception 'só quem administra esta marca registra documento-fonte'
      using errcode = '42501';
  end if;

  if coalesce(jsonb_typeof(p_paginas), 'null') <> 'array' then
    raise exception 'páginas devem vir num array' using errcode = '22023';
  end if;

  /*
   * A verificação de completude, e ela é o motivo desta função existir.
   *
   * Três perguntas sobre o CONJUNTO, que nenhum `check` de linha responde:
   * quantas vieram, quantas são distintas, e qual a faixa. As três precisam
   * fechar em 1..page_count para a gravação acontecer.
   */
  select count(*), count(distinct (pagina->>'pagina')::integer),
         min((pagina->>'pagina')::integer), max((pagina->>'pagina')::integer)
    into quantas, distintas, menor, maior
  from jsonb_array_elements(p_paginas) as pagina;

  if quantas <> p_page_count then
    raise exception 'manifesto incompleto: % páginas para um PDF de %',
      quantas, p_page_count using errcode = '22023';
  end if;
  if distintas <> quantas then
    raise exception 'manifesto com página repetida: % linhas, % números distintos',
      quantas, distintas using errcode = '22023';
  end if;
  -- Com contagem certa e sem repetição, min=1 e max=N implicam 1..N sem furo.
  if menor <> 1 or maior <> p_page_count then
    raise exception 'manifesto com furo: faixa % a %, esperada 1 a %',
      menor, maior, p_page_count using errcode = '22023';
  end if;

  /*
   * ─── IDEMPOTÊNCIA: mesma marca, mesmo tipo, mesmo arquivo ──────────────
   *
   * A publicação acontece em dois passos que NÃO são atômicos entre si: o
   * navegador publica marca e seções, e depois uma rota de servidor registra o
   * documento-fonte e o manifesto. Se a resposta do segundo passo se perder na
   * rede, a interface precisa poder repetir — e repetir não pode criar um
   * segundo documento nem duplicar 743 linhas de manifesto.
   *
   * A chave natural é o `sha256`: mesmo arquivo, mesma marca, mesmo tipo é o
   * mesmo documento. Encontrado, devolve o id existente e não toca no
   * manifesto.
   *
   * Isto NÃO afrouxa a regra de "uma ativa por tipo": um arquivo DIFERENTE do
   * mesmo tipo continua barrado pelo índice, porque substituir é ato
   * explícito. O que passa a ser tolerado é a repetição do mesmo ato.
   */
  select id into novo_id
  from public.brand_source_documents
  where brand_id = p_brand_id
    and workspace_id = p_workspace_id
    and tipo = coalesce(nullif(p_tipo, ''), 'manual')
    and pdf_sha256 = p_pdf_sha256;

  if novo_id is not null then
    -- Repetir precisa fechar o vínculo, e não só devolver o id: a tentativa
    -- anterior pode ter gravado o documento e sido interrompida antes disto.
    perform private.vincular_importacao_ao_documento(
      p_import_id, novo_id, p_brand_id, p_workspace_id, p_pdf_sha256);
    return novo_id;
  end if;

  /*
   * A próxima versão DENTRO DO TIPO.
   *
   * Registrar um segundo manual não substitui o primeiro em silêncio: a versão
   * avança, e o índice de "uma ativa por tipo" recusa a inserção enquanto a
   * anterior estiver ativa. Substituir é ato explícito, não efeito colateral
   * de importar de novo — perder o manual vigente por reimportação seria a
   * pior forma de descobrir essa regra.
   */
  select coalesce(max(versao), 0) + 1 into proxima_versao
  from public.brand_source_documents
  where brand_id = p_brand_id
    and workspace_id = p_workspace_id
    and tipo = coalesce(nullif(p_tipo, ''), 'manual');

  insert into public.brand_source_documents (
    workspace_id, brand_id, storage_path, pdf_sha256, byte_size, page_count,
    tipo, idioma, titulo, estado_de_processamento, versao, created_by)
  values (
    p_workspace_id, p_brand_id, p_storage_path, p_pdf_sha256, p_byte_size, p_page_count,
    coalesce(nullif(p_tipo, ''), 'manual'), nullif(p_idioma, ''), coalesce(p_titulo, ''),
    'concluido', proxima_versao, p_created_by)
  returning id into novo_id;

  insert into public.brand_source_pages (
    workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt,
    rotacao, tem_texto, caracteres, miniatura_path, document_id,
    cobertura, motivo_da_cobertura, classificacao, confianca)
  select
    p_workspace_id, p_brand_id, novo_id,
    (p->>'pagina')::integer,
    (p->>'largura_pt')::numeric,
    (p->>'altura_pt')::numeric,
    coalesce((p->>'rotacao')::integer, 0),
    coalesce((p->>'tem_texto')::boolean, false),
    coalesce((p->>'caracteres')::integer, 0),
    nullif(p->>'miniatura_path', ''),
    nullif(p->>'document_id', '')::uuid,
    case when nullif(p->>'document_id', '') is null then 'sem-secao' else 'secao' end,
    coalesce(nullif(p->>'motivo_da_cobertura', ''),
             case when nullif(p->>'document_id', '') is null
                  then 'sem seção atribuída na importação' else '' end),
    nullif(p->>'classificacao', ''),
    nullif(p->>'confianca', '')::numeric
  from jsonb_array_elements(p_paginas) as p;

  perform private.vincular_importacao_ao_documento(
    p_import_id, novo_id, p_brand_id, p_workspace_id, p_pdf_sha256);

  return novo_id;
end;
$function$;

create or replace function public.editar_documento_fonte(p_id uuid, p_titulo text, p_idioma text, p_estado text, p_ator uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  conta uuid;
  marca uuid;
begin
  select workspace_id, brand_id into conta, marca
    from public.brand_source_documents where id = p_id;
  if conta is null then
    raise exception 'documento-fonte não encontrado' using errcode = 'P0002';
  end if;
  -- Editar título, idioma e estado é trabalho editorial: `editar` NA MARCA, o
  -- mesmo que `brand_documents` exige. Antes pedia dona da CONTA (16/09/2026).
  -- Desde 17/09/2026 pela MESMA regra do resto (inclui quem administra a conta).
  if not private.capacidade_de(p_ator, marca, 'editar') then
    raise exception 'só quem edita esta marca edita o documento-fonte'
      using errcode = '42501';
  end if;

  update public.brand_source_documents
  set titulo = coalesce(p_titulo, titulo),
      idioma = coalesce(p_idioma, idioma),
      estado_de_processamento = coalesce(nullif(p_estado, ''), estado_de_processamento),
      updated_at = now()
  where id = p_id;
end;
$function$;

-- ─── 1.2. As regras do Storage ───────────────────────────────────────────
--
-- As seis liam `brand_members` à mão, com o caminho em texto. Passam a chamar
-- `public.tem_capacidade_no_caminho`, que confere o formato ANTES do `::uuid`.
--
-- As duas de limpeza trocam o sinal: "não há ninguém nesta marca" vira "esta
-- marca não existe mais". Sem a troca, uma marca VIVA cujo único acesso é o do
-- administrador pareceria apagada, e o dono da conta apagaria arquivo em uso.

drop policy "Quem alcança a marca lê as imagens de página dela" on storage.objects;
create policy "Quem alcança a marca lê as imagens de página dela" on storage.objects
  for select to authenticated
  using (bucket_id = 'brand-assets'
    and public.tem_capacidade_no_caminho(
      (storage.foldername(objects.name))[1], (storage.foldername(objects.name))[2], 'consultar')
    and not exists (select 1 from public.brand_assets a where a.storage_path = objects.name));

drop policy "Quem edita a marca envia arquivo dela" on storage.objects;
create policy "Quem edita a marca envia arquivo dela" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'brand-assets'
    and public.tem_capacidade_no_caminho(
      (storage.foldername(objects.name))[1], (storage.foldername(objects.name))[2], 'editar'));

drop policy "Quem edita a marca altera arquivo dela" on storage.objects;
create policy "Quem edita a marca altera arquivo dela" on storage.objects
  for update to authenticated
  using (bucket_id = 'brand-assets'
    and public.tem_capacidade_no_caminho(
      (storage.foldername(objects.name))[1], (storage.foldername(objects.name))[2], 'editar'))
  with check (bucket_id = 'brand-assets'
    and public.tem_capacidade_no_caminho(
      (storage.foldername(objects.name))[1], (storage.foldername(objects.name))[2], 'editar'));

drop policy "Quem edita a marca apaga arquivo dela" on storage.objects;
create policy "Quem edita a marca apaga arquivo dela" on storage.objects
  for delete to authenticated
  using (bucket_id = 'brand-assets'
    and public.tem_capacidade_no_caminho(
      (storage.foldername(objects.name))[1], (storage.foldername(objects.name))[2], 'editar'));

drop policy "Dono da conta vê arquivo enfileirado de marca apagada" on storage.objects;
create policy "Dono da conta vê arquivo enfileirado de marca apagada" on storage.objects
  for select to authenticated
  using (bucket_id in ('brand-assets', 'analysis-evidence')
    and (storage.foldername(objects.name))[1] in (
      select wm.workspace_id::text from public.workspace_members wm
       where wm.user_id = (select auth.uid()) and wm.role = 'owner')
    and exists (select 1 from public.brand_deletions d
                 where d.workspace_id::text = (storage.foldername(objects.name))[1]
                   and d.bucket_id = objects.bucket_id and d.storage_path = objects.name)
    and not public.marca_do_caminho_existe((storage.foldername(objects.name))[2]));

drop policy "Dono da conta apaga arquivo enfileirado de marca apagada" on storage.objects;
create policy "Dono da conta apaga arquivo enfileirado de marca apagada" on storage.objects
  for delete to authenticated
  using (bucket_id in ('brand-assets', 'analysis-evidence')
    and (storage.foldername(objects.name))[1] in (
      select wm.workspace_id::text from public.workspace_members wm
       where wm.user_id = (select auth.uid()) and wm.role = 'owner')
    and exists (select 1 from public.brand_deletions d
                 where d.workspace_id::text = (storage.foldername(objects.name))[1]
                   and d.bucket_id = objects.bucket_id and d.storage_path = objects.name)
    and not public.marca_do_caminho_existe((storage.foldername(objects.name))[2]));

-- ─── 2. A concessão pendente ─────────────────────────────────────────────

create table public.concessoes_de_acesso (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  -- Nula quando a concessão é de ADMINISTRADOR: ele não recebe marca a marca.
  brand_id       uuid,
  email          text not null,
  papel          text not null,
  concedida_por  uuid not null references auth.users(id),
  concedida_em   timestamptz not null default now(),
  convertida_em  timestamptz,
  convertida_para uuid references auth.users(id),

  constraint concessoes_de_acesso_brand_fkey
    foreign key (brand_id, workspace_id) references public.brands(id, workspace_id) on delete cascade,
  constraint concessoes_de_acesso_papel_check check (papel in ('administrador', 'consulta')),
  -- O e-mail entra normalizado, sempre. Sem isto, "Maria@x.com" e "maria@x.com"
  -- seriam duas concessões, e a pessoa converteria só uma delas.
  constraint concessoes_de_acesso_email_check
    check (email = lower(btrim(email)) and position('@' in email) > 1 and char_length(email) <= 320),
  -- Administrador é da conta inteira; consulta é sempre de uma marca. A forma
  -- errada não é aceita, em vez de ser ignorada na leitura.
  constraint concessoes_de_acesso_alcance_check
    check ((papel = 'administrador' and brand_id is null)
        or (papel = 'consulta' and brand_id is not null)),
  constraint concessoes_de_acesso_conversao_check
    check ((convertida_em is null) = (convertida_para is null))
);

-- Uma concessão PENDENTE por e-mail e alcance. Convertidas ficam como histórico
-- e não disputam: por isso o índice é parcial.
create unique index concessoes_de_acesso_pendente_idx
  on public.concessoes_de_acesso (workspace_id, email, coalesce(brand_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where convertida_em is null;
create index concessoes_de_acesso_email_idx
  on public.concessoes_de_acesso (email) where convertida_em is null;
create index concessoes_de_acesso_conta_idx on public.concessoes_de_acesso (workspace_id, concedida_em desc);
create index concessoes_de_acesso_marca_idx on public.concessoes_de_acesso (brand_id) where brand_id is not null;
create index concessoes_de_acesso_concedida_por_idx on public.concessoes_de_acesso (concedida_por);

alter table public.concessoes_de_acesso enable row level security;

-- Quem concede é quem administra a CONTA. Não é capacidade por marca: dar acesso
-- a uma marca é decisão de quem responde pela conta, não de quem edita uma marca.
create policy "Quem administra a conta lê as concessões" on public.concessoes_de_acesso
  for select to authenticated
  using (workspace_id in (
    select wm.workspace_id from public.workspace_members wm
    where wm.user_id = (select auth.uid()) and wm.role = 'owner'));
create policy "Quem administra a conta concede" on public.concessoes_de_acesso
  for insert to authenticated
  with check (workspace_id in (
    select wm.workspace_id from public.workspace_members wm
    where wm.user_id = (select auth.uid()) and wm.role = 'owner'));
create policy "Quem administra a conta revoga o que ainda não virou acesso" on public.concessoes_de_acesso
  for delete to authenticated
  using (convertida_em is null and workspace_id in (
    select wm.workspace_id from public.workspace_members wm
    where wm.user_id = (select auth.uid()) and wm.role = 'owner'));

-- Sem UPDATE de propósito: mudar o papel de uma concessão pendente é revogar e
-- conceder de novo, e assim o registro diz o que aconteceu. Quem converte é a
-- função de sistema, que não passa por estas policies.
--
-- `revoke all` explícito antes do grant: no Supabase hospedado, toda tabela nova
-- do `public` nasce com INSERT/UPDATE/DELETE para `authenticated` por privilégio
-- padrão — medido em 17/09/2026, e o banco local não faz isso.
revoke all on public.concessoes_de_acesso from anon, authenticated;
grant select, insert, delete on public.concessoes_de_acesso to authenticated;

-- ─── 3. A conversão no primeiro login ────────────────────────────────────

create function private.converter_concessoes(p_user_id uuid, p_email text)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  c record;
  convertidas integer := 0;
begin
  if p_user_id is null or coalesce(btrim(p_email), '') = '' then
    return 0;
  end if;

  for c in
    select * from public.concessoes_de_acesso
     where email = lower(btrim(p_email)) and convertida_em is null
     order by concedida_em
  loop
    if c.papel = 'administrador' then
      -- Administrador entra na CONTA. As marcas vêm por derivação
      -- (`tem_capacidade_na_marca`), inclusive as futuras — nada é copiado.
      insert into public.workspace_members (workspace_id, user_id, role)
      values (c.workspace_id, p_user_id, 'owner')
      on conflict (workspace_id, user_id) do update set role = 'owner';
    else
      -- Quem consulta precisa pertencer à conta para alcançar a marca, mas como
      -- `member`: pertencer não concede marca nenhuma por si só.
      insert into public.workspace_members (workspace_id, user_id, role)
      values (c.workspace_id, p_user_id, 'member')
      on conflict (workspace_id, user_id) do nothing;

      insert into public.brand_members (brand_id, workspace_id, user_id, capacidades, created_by)
      values (c.brand_id, c.workspace_id, p_user_id, array['consultar']::text[], c.concedida_por)
      on conflict (brand_id, user_id) do nothing;
    end if;

    update public.concessoes_de_acesso
       set convertida_em = now(), convertida_para = p_user_id
     where id = c.id;
    convertidas := convertidas + 1;
  end loop;

  return convertidas;
end;
$$;

revoke execute on function private.converter_concessoes(uuid, text) from public, anon, authenticated;

-- ─── 4. Entrar não cria conta ────────────────────────────────────────────

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  /*
   * Até 17/09/2026 esta função criava uma conta NOVA e punha o perfil como
   * `owner` dela. Isso era o cadastro público virando conta: quem entrasse
   * virava administrador de uma conta própria dentro do produto.
   *
   * A conta agora nasce da assinatura (`private.abrir_conta_de_assinatura`), e
   * o que o primeiro login faz é COLHER o que já foi concedido ao e-mail dele.
   * Quem entra sem concessão nenhuma não ganha conta: fica sem acesso, e a
   * interface manda falar com o administrador.
   */
  perform private.converter_concessoes(new.id, new.email);
  return new;
end;
$$;

-- ─── 5. Abrir conta é ato explícito e nomeado ────────────────────────────

create function private.abrir_conta_de_assinatura(p_nome text, p_email_do_administrador text,
                                                  p_concedida_por uuid default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  nova_conta uuid;
  email_do_admin text := lower(btrim(p_email_do_administrador));
  autor uuid := coalesce(p_concedida_por, (select auth.uid()));
  ja_existe uuid;
begin
  if coalesce(btrim(p_nome), '') = '' then
    raise exception 'a conta precisa de nome' using errcode = '22004';
  end if;
  if position('@' in email_do_admin) < 2 then
    raise exception 'e-mail do administrador inválido' using errcode = '22023';
  end if;

  /*
   * O autor da concessão é obrigatório e é uma PESSOA. Enquanto a compra não
   * existe, é quem roda o comando; quando existir, é o titular da assinatura.
   * Sem autor, o registro de quem deu acesso a quem começaria vazio.
   */
  if autor is null then
    select id into autor from auth.users order by created_at limit 1;
    if autor is null then
      raise exception 'não há usuário para registrar como autor da concessão'
        using errcode = '22004';
    end if;
  end if;

  insert into public.workspaces (name) values (btrim(p_nome)) returning id into nova_conta;

  insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por)
  values (nova_conta, null, email_do_admin, 'administrador', autor);

  -- Se a pessoa JÁ tem login, não faz sentido esperar um "primeiro login" que
  -- não vai acontecer: a concessão é colhida na hora.
  select u.id into ja_existe from auth.users u where lower(u.email) = email_do_admin limit 1;
  if ja_existe is not null then
    perform private.converter_concessoes(ja_existe, email_do_admin);
  end if;

  return nova_conta;
end;
$$;

revoke execute on function private.abrir_conta_de_assinatura(text, text, uuid) from public, anon, authenticated;

-- ─── 6. A semeadura na criação da marca ──────────────────────────────────

create or replace function public.brand_members_semear_criadora()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  criadora uuid := (select auth.uid());
begin
  /*
   * Quem administra a conta NÃO é semeado aqui desde 17/09/2026: a capacidade
   * dele deriva de `tem_capacidade_na_marca`, e copiar linha por marca foi
   * justamente o que deixava a marca nova invisível para o outro administrador.
   *
   * O que sobra é o caso de quem cria uma marca SEM administrar a conta. Hoje
   * isso não acontece pelo produto (criar marca é ato de administrador), mas a
   * linha explícita evita que uma mudança futura produza marca órfã — o estado
   * que `scripts/prova-acesso-por-marca.sh` recusa.
   */
  if criadora is null then
    return new;
  end if;

  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades, created_by)
  select new.id, new.workspace_id, criadora,
         array['consultar', 'editar', 'aprovar', 'administrar']::text[], criadora
   where not exists (
     select 1 from public.workspace_members wm
      where wm.workspace_id = new.workspace_id and wm.user_id = criadora and wm.role = 'owner')
  on conflict (brand_id, user_id) do nothing;

  return new;
end;
$$;
