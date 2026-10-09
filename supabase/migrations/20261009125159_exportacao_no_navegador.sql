-- Exportação pelo navegador — 08/10/2026 (desenho aprovado pelo André no mesmo
-- dia: "pode seguir com a tabela da exportação").
--
-- A promessa (Termos, seção 13): "A exportação devolve os arquivos originais e
-- um índice do conteúdo, em até 15 dias depois do pedido." O pedido com entrega
-- à mão (`pedidos_de_exportacao`) fica como reserva; esta é a via principal: a
-- dona da conta clica em Exportar, e o NAVEGADOR dela busca os originais e
-- monta um ZIP por marca. Nada passa pela função da Vercel (o teto de ~4,5 MB
-- por resposta derrubaria qualquer acervo de verdade).
--
-- Três passos, todos funções com a sessão da dona:
--   1. `iniciar_exportacao`     registra a exportação e devolve o manifesto: as
--                               marcas, os arquivos (por CHAVE, nunca caminho),
--                               os complementos e os links de entrega (sem o
--                               endereço, que é senha);
--   2. `caminhos_da_exportacao` troca chaves por caminhos do Storage, em lotes,
--                               para a rota assinar endereços de curta duração.
--                               O caminho sai do banco e é conferido contra a
--                               conta da exportação — nunca vem do navegador;
--   3. `concluir_exportacao`    anota que o navegador disse que terminou. É
--                               informação do navegador, não prova: o que o
--                               servidor prova é o INÍCIO.
--
-- Decisões do André (08/10/2026): só a DONA exporta, com a conta ativa ou
-- cancelada (é a cancelada que mais precisa); exportar não encerra a conta, só
-- fica registrado. Entram os originais (manuais em PDF, inclusive os
-- substituídos; materiais, inclusive os descontinuados; imagens enviadas à
-- análise) e os complementos; ficam de fora miniaturas e imagens de página,
-- que o sistema deriva dos originais.
--
-- Dois tetos de saída de dados (a saída do Storage é cota do plano):
--   - 5 exportações por conta a cada 24 horas;
--   - por exportação, até 2× o número de arquivos (mais 50 de folga) em
--     endereços entregues — dá para tentar de novo o que falhou, não para
--     tirar o acervo cem vezes com a mesma exportação.
--
-- Revisão de segurança de 08/10/2026, aplicada antes do primeiro push: os dois
-- tetos acima; só os três buckets conhecidos e caminho sem `..`; a exclusão
-- conferida também na troca de chaves; a conta da exportação devolvida, para a
-- rota comparar com a da sessão; e o CSV protegido contra fórmula (no
-- navegador, `pacote-da-exportacao.ts`).
--
-- Reversibilidade: tabela e funções novas, aditivas. O registro sai com a conta
-- (a exclusão aos 12 meses leva a área inteira).

create table public.exportacoes_da_conta (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  iniciada_por      uuid references auth.users(id) on delete set null,
  iniciada_em       timestamptz not null default now(),
  marcas            integer not null,
  arquivos          integer not null,
  bytes             bigint not null,
  -- Quantos endereços assinados esta exportação já recebeu (o teto por exportação).
  chaves_entregues  integer not null default 0,
  concluida_em      timestamptz,
  constraint exportacoes_da_conta_contagens check (marcas >= 0 and arquivos >= 0 and bytes >= 0 and chaves_entregues >= 0),
  constraint exportacoes_da_conta_conclusao_depois_do_inicio check (concluida_em is null or concluida_em >= iniciada_em)
);

-- O limite diário e a tela leem as da conta, das mais novas.
create index exportacoes_da_conta_por_conta on public.exportacoes_da_conta (workspace_id, iniciada_em desc);
create index exportacoes_da_conta_iniciada_por on public.exportacoes_da_conta (iniciada_por);

-- Privilégios explícitos (o hospedado dá escrita a `authenticated` por padrão
-- em tabela nova; o local não). Ninguém escreve pela sessão: só as funções.
revoke all on public.exportacoes_da_conta from public, anon, authenticated;
grant select on public.exportacoes_da_conta to authenticated;
grant select, insert, update on public.exportacoes_da_conta to service_role;
alter table public.exportacoes_da_conta enable row level security;

create policy "A dona da conta lê as exportações dela" on public.exportacoes_da_conta
  for select to authenticated
  using (workspace_id in (
    select wm.workspace_id from public.workspace_members wm
     where wm.user_id = (select auth.uid()) and wm.role = 'owner'));

-- ─── Os arquivos da conta, por chave ──────────────────────────────────────
--
-- Uma fonte só para o manifesto e para a troca de chave por caminho: o que o
-- manifesto promete é exatamente o que a troca entrega. Chave = tipo:id da
-- linha. O PDF de uma importação que também é documento-fonte aparece uma vez
-- só (pelo documento); importação sem documento-fonte, com marca, entra
-- sozinha. Só os três buckets conhecidos, e só caminho dentro da pasta da
-- conta e sem `..`: o que estiver fora disso não é assinado por ninguém.
create function private.arquivos_da_exportacao(p_workspace_id uuid)
returns table (chave text, brand_id uuid, bucket text, caminho text, tipo text, nome text, bytes bigint, detalhes jsonb)
language sql
stable
security definer
set search_path to ''
as $$
  select f.* from (
    select 'documento:' || d.id as chave, d.brand_id, d.bucket_id as bucket, d.storage_path as caminho, 'manual' as tipo,
           coalesce(nullif(btrim(d.titulo), ''), 'manual') || ' (v' || d.versao || ')' as nome, d.byte_size as bytes,
           jsonb_build_object('tipo_de_documento', d.tipo, 'idioma', d.idioma, 'paginas', d.page_count,
                              'situacao', d.status, 'enviado_em', d.created_at) as detalhes
      from public.brand_source_documents d
     where d.workspace_id = p_workspace_id
    union all
    select 'importacao:' || i.id, i.brand_id, 'brand-imports', i.storage_path, 'manual',
           'importacao ' || to_char(i.created_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24MI'), null,
           jsonb_build_object('paginas', i.page_count, 'enviado_em', i.created_at)
      from public.brand_imports i
     where i.workspace_id = p_workspace_id and i.brand_id is not null and i.storage_path is not null
       and not exists (select 1 from public.brand_source_documents d
                        where d.workspace_id = i.workspace_id and d.storage_path = i.storage_path)
    union all
    select 'material:' || a.id, a.brand_id, 'brand-assets', a.storage_path, 'material', a.file_name, a.size_bytes,
           jsonb_build_object('item', it.nome, 'tipo_do_item', it.tipo, 'status', a.status,
                              'hierarquia', a.hierarquia, 'lockup', a.lockup, 'cor', a.cor,
                              'polaridade', a.polaridade, 'espaco_de_cor', a.espaco_de_cor,
                              'descontinuado_em', a.descontinuado_em, 'enviado_em', a.created_at)
      from public.brand_assets a
      left join public.brand_asset_items it on it.id = a.item_id
     where a.workspace_id = p_workspace_id and a.brand_id is not null
    union all
    select 'analise:' || r.id, r.brand_id, 'analysis-evidence', r.image_path, 'analise',
           coalesce(nullif(btrim(r.file_name), ''), r.id::text), r.image_size_bytes,
           jsonb_build_object('pergunta', r.question, 'veredito', r.verdict, 'enviado_em', r.created_at)
      from public.analysis_runs r
     where r.workspace_id = p_workspace_id and r.brand_id is not null and r.image_path is not null
  ) f
  where f.bucket in ('brand-imports', 'brand-assets', 'analysis-evidence')
    and starts_with(f.caminho, p_workspace_id::text || '/')
    and f.caminho not like '%..%' and f.caminho not like '%//%';
$$;

revoke all on function private.arquivos_da_exportacao(uuid) from public, anon, authenticated;

-- ─── 1. Iniciar ───────────────────────────────────────────────────────────
create function public.iniciar_exportacao(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
  e public.exportacoes_da_conta%rowtype;
  n integer;
  total bigint;
  por_marca jsonb;
begin
  if quem is null then
    raise exception 'é preciso entrar' using errcode = '28000';
  end if;
  if not exists (select 1 from public.workspace_members m
                  where m.workspace_id = p_workspace_id and m.user_id = quem and m.role = 'owner') then
    raise exception 'só quem administra a conta exporta' using errcode = '42501';
  end if;
  -- Exclusão em andamento: os arquivos já estão na fila de remoção.
  if exists (select 1 from public.assinaturas a
              where a.workspace_id = p_workspace_id and a.exclusao_iniciada_em is not null) then
    raise exception 'a exclusão desta conta já começou'
      using errcode = 'P0001', hint = 'exportacao_exclusao_em_andamento';
  end if;

  -- Dois cliques ao mesmo tempo contam as duas: a trava serializa por conta.
  perform pg_advisory_xact_lock(hashtextextended('exportacao:' || p_workspace_id::text, 0));
  if (select count(*) from public.exportacoes_da_conta x
       where x.workspace_id = p_workspace_id and x.iniciada_em > now() - interval '24 hours') >= 5 then
    raise exception 'limite de 5 exportações por dia'
      using errcode = 'P0001', hint = 'exportacao_limite_diario';
  end if;

  -- Os arquivos da conta, lidos UMA vez e agrupados por marca.
  select coalesce(sum(g.qtd), 0)::integer, coalesce(sum(g.bytes_da_marca), 0)::bigint, jsonb_object_agg(g.brand_id::text, g.lista)
    into n, total, por_marca
    from (select f.brand_id, sum(coalesce(f.bytes, 0)) as bytes_da_marca, count(*) as qtd,
                 jsonb_agg(jsonb_build_object('chave', f.chave, 'tipo', f.tipo, 'nome', f.nome,
                                              'bytes', f.bytes, 'detalhes', f.detalhes) order by f.tipo, f.nome) as lista
            from private.arquivos_da_exportacao(p_workspace_id) f
           group by f.brand_id) g;

  insert into public.exportacoes_da_conta (workspace_id, iniciada_por, marcas, arquivos, bytes)
  values (p_workspace_id, quem, (select count(*) from public.brands b where b.workspace_id = p_workspace_id), n, total)
  returning * into e;

  return jsonb_build_object(
    'id', e.id, 'iniciada_em', e.iniciada_em, 'arquivos', e.arquivos, 'bytes', e.bytes,
    'conta', (select w.name from public.workspaces w where w.id = p_workspace_id),
    'marcas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'nome', b.name, 'chave', b.key,
        'arquivos', coalesce(por_marca -> b.id::text, '[]'::jsonb),
        -- A versão publicada em vigor de cada complemento (versão 0 é rascunho
        -- que nunca saiu; arquivado saiu de uso).
        'complementos', coalesce((select jsonb_agg(jsonb_build_object(
            'slug', c.slug, 'titulo', c.titulo, 'versao', c.versao, 'texto', c.texto, 'publicado_em', c.publicado_em)
            order by c.titulo)
          from public.complementos c
         where c.workspace_id = p_workspace_id and c.brand_id = b.id
           and c.versao > 0 and c.arquivado_em is null), '[]'::jsonb),
        'links', coalesce((select jsonb_agg(jsonb_build_object(
            'nome', l.nome, 'destinatario', l.destinatario, 'criado_em', l.created_at,
            'expira_em', l.expira_em, 'revogado_em', l.revogado_em) order by l.created_at)
          from public.links_de_entrega l
         where l.workspace_id = p_workspace_id and l.brand_id = b.id), '[]'::jsonb))
        order by b.name)
      from public.brands b where b.workspace_id = p_workspace_id), '[]'::jsonb)
  );
end;
$$;

-- ─── 2. Trocar chaves por caminhos ────────────────────────────────────────
--
-- Só a dona da conta da exportação, até 6 horas depois do início, até 50
-- chaves por vez, sem exclusão em andamento, e dentro do teto de endereços
-- da exportação. Chave que não é desta conta não volta — sem erro, para não
-- ensinar o que existe nas outras. Devolve a conta, para a rota conferir que
-- é a mesma da sessão.
create function public.caminhos_da_exportacao(p_exportacao uuid, p_chaves text[])
returns table (chave text, bucket text, caminho text, conta uuid)
language plpgsql
security definer
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
  e public.exportacoes_da_conta%rowtype;
  chaves text[]; buckets text[]; caminhos text[];
  achados integer;
begin
  select * into e from public.exportacoes_da_conta x where x.id = p_exportacao;
  if quem is null or not found or not exists (
       select 1 from public.workspace_members m
        where m.workspace_id = e.workspace_id and m.user_id = quem and m.role = 'owner') then
    raise exception 'exportação não encontrada' using errcode = '42501';
  end if;
  if e.iniciada_em < now() - interval '6 hours' then
    raise exception 'esta exportação expirou; comece outra'
      using errcode = 'P0001', hint = 'exportacao_expirada';
  end if;
  if coalesce(array_length(p_chaves, 1), 0) > 50 then
    raise exception 'até 50 arquivos por vez' using errcode = '22023';
  end if;
  if exists (select 1 from public.assinaturas a
              where a.workspace_id = e.workspace_id and a.exclusao_iniciada_em is not null) then
    raise exception 'a exclusão desta conta já começou'
      using errcode = 'P0001', hint = 'exportacao_exclusao_em_andamento';
  end if;

  select array_agg(f.chave), array_agg(f.bucket), array_agg(f.caminho) into chaves, buckets, caminhos
    from private.arquivos_da_exportacao(e.workspace_id) f
   where f.chave = any(p_chaves);
  achados := coalesce(array_length(chaves, 1), 0);

  -- O teto: condição no próprio UPDATE, para dois lotes simultâneos não
  -- passarem juntos.
  update public.exportacoes_da_conta x
     set chaves_entregues = x.chaves_entregues + achados
   where x.id = e.id and x.chaves_entregues + achados <= 2 * x.arquivos + 50;
  if not found then
    raise exception 'esta exportação já entregou o que podia; comece outra'
      using errcode = 'P0001', hint = 'exportacao_limite_de_arquivos';
  end if;

  return query select u.k, u.b, u.c, e.workspace_id from unnest(chaves, buckets, caminhos) as u(k, b, c);
end;
$$;

-- ─── 3. Concluir ──────────────────────────────────────────────────────────
create function public.concluir_exportacao(p_exportacao uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
  conta uuid;
begin
  select x.workspace_id into conta from public.exportacoes_da_conta x where x.id = p_exportacao;
  if quem is null or conta is null or not exists (
       select 1 from public.workspace_members m
        where m.workspace_id = conta and m.user_id = quem and m.role = 'owner') then
    raise exception 'exportação não encontrada' using errcode = '42501';
  end if;
  -- A primeira conclusão vale; repetir não muda a data.
  update public.exportacoes_da_conta set concluida_em = now()
   where id = p_exportacao and concluida_em is null;
end;
$$;

revoke all on function public.iniciar_exportacao(uuid) from public, anon;
revoke all on function public.caminhos_da_exportacao(uuid, text[]) from public, anon;
revoke all on function public.concluir_exportacao(uuid) from public, anon;
grant execute on function public.iniciar_exportacao(uuid) to authenticated;
grant execute on function public.caminhos_da_exportacao(uuid, text[]) to authenticated;
grant execute on function public.concluir_exportacao(uuid) to authenticated;
