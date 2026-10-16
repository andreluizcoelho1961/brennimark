-- Vários grids por marca — a variante e o segmento — 16/10/2026.
--
-- ─── Por quê ────────────────────────────────────────────────────────────────
--
-- Teste do André com o manual da Bradesco (16/10/2026): o manual tem dez páginas
-- de grid (28 a 37) com VÁRIOS grids — "Estrutura 3X3" e "Estrutura 5X5", e as
-- mesmas variações para Institucional/Varejo/Negócios Digitais e para
-- Wealth/Atacado. A tabela guardava UMA regra por marca × formato: a segunda
-- estrutura caía, e a leitura da IA gravava só a primeira.
--
-- Decisão do André (16/10/2026, "aprovo, com o segmento como campo"): cada
-- regra ganha uma VARIANTE (o nome da estrutura: "Estrutura 3X3") e um
-- SEGMENTO opcional ("Institucional", "Wealth"), como já é na tipografia. Uma
-- marca passa a ter vários grids para o mesmo formato; a tela do Grids oferece
-- a escolha, e cada um se aprova à parte.
--
-- A mudança é ADITIVA: as duas colunas nascem vazias (`''`) e as regras que já
-- existem continuam valendo, com a mesma identidade de antes. Só a regra de
-- unicidade cresce: (marca, formato) → (marca, formato, segmento, variante).
--
-- ⚖️ Tradeoff: a identidade de uma regra passa a ter quatro partes, e a leitura
-- da IA precisa nomear a estrutura que lê. Reversível enquanto não houver duas
-- regras no mesmo formato; depois disso, desfazer apagaria as extras.

alter table public.regras_de_grid
  add column variante text not null default '',
  add column segmento text not null default '';

alter table public.regras_de_grid
  add constraint regras_de_grid_variante_check check (char_length(variante) <= 60 and variante = btrim(variante)),
  add constraint regras_de_grid_segmento_check check (char_length(segmento) <= 60 and segmento = btrim(segmento));

alter table public.regras_de_grid drop constraint regras_de_grid_uma_por_formato;
-- Uma regra por marca × formato × segmento × variante (e uma regra geral por segmento e variante).
alter table public.regras_de_grid
  add constraint regras_de_grid_uma_por_variante unique (brand_id, formato, segmento, variante);

-- ─── O gatilho: segmento e variante são identidade, como o formato ─────────
create or replace function private.governar_regras_de_grid()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
  conteudo_mudou boolean;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'a regra nasce como rascunho; a aprovação é um passo à parte'
        using errcode = 'check_violation', constraint = 'regras_de_grid_nasce_rascunho';
    end if;
    if quem is not null then new.origem := 'pessoa'; end if;
    new.aprovado_por := null;
    new.aprovado_em  := null;
    new.created_by   := coalesce(quem, new.created_by);
    new.updated_by   := coalesce(quem, new.updated_by);
    new.created_at   := now();
    new.updated_at   := now();
    return new;
  end if;

  if new.brand_id <> old.brand_id or new.workspace_id <> old.workspace_id or new.formato <> old.formato
     or new.segmento <> old.segmento or new.variante <> old.variante then
    raise exception 'a regra não muda de marca, de formato, de segmento nem de variante'
      using errcode = 'check_violation', constraint = 'regras_de_grid_fixa';
  end if;

  conteudo_mudou := (new.tipo, new.unidade, new.colunas, new.linhas, new.medianiz, new.margem_sup, new.margem_inf,
                     new.margem_esq, new.margem_dir, new.linha_de_base, new.zonas, new.descricao, new.pagina)
    is distinct from (old.tipo, old.unidade, old.colunas, old.linhas, old.medianiz, old.margem_sup, old.margem_inf,
                      old.margem_esq, old.margem_dir, old.linha_de_base, old.zonas, old.descricao, old.pagina);
  -- Quem corrige passa a responder; sem corrigir, ninguém troca a origem
  -- pela sessão (nem forja "lida pela IA").
  if quem is not null then
    new.origem := case when conteudo_mudou then 'pessoa' else old.origem end;
  end if;

  if new.status = 'ready' and old.status = 'draft' then
    if quem is not null and not public.tem_capacidade_na_marca(new.brand_id, 'aprovar') then
      raise exception 'só quem aprova esta marca aprova a regra'
        using errcode = 'insufficient_privilege', constraint = 'regras_de_grid_aprovar_exige_capacidade';
    end if;
    if conteudo_mudou then
      raise exception 'aprove o grid que está na tela: alterar e aprovar são passos separados'
        using errcode = 'check_violation', constraint = 'regras_de_grid_aprova_sem_alterar';
    end if;
    new.aprovado_por := quem;
    new.aprovado_em  := now();
  elsif new.status = 'ready' and conteudo_mudou then
    new.status       := 'draft';
    new.aprovado_por := null;
    new.aprovado_em  := null;
  elsif new.status = 'ready' then
    if quem is not null then
      new.aprovado_por := old.aprovado_por;
      new.aprovado_em  := old.aprovado_em;
    end if;
  else
    new.aprovado_por := null;
    new.aprovado_em  := null;
  end if;

  if quem is not null then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := coalesce(quem, new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.governar_regras_de_grid() from public, anon, authenticated;

-- ─── A leitura da IA entra só onde não há regra daquela variante ───────────
create or replace function public.registrar_leitura_das_regras_de_grid(p_workspace_id uuid, p_brand_id uuid, p_regra jsonb)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  criadas integer;
  zonas numeric[];
begin
  if jsonb_typeof(p_regra -> 'zonas') = 'array' then
    select array_agg(z::numeric order by ord) into zonas
      from jsonb_array_elements_text(p_regra -> 'zonas') with ordinality as t(z, ord);
  end if;
  insert into public.regras_de_grid (
    workspace_id, brand_id, formato, variante, segmento, tipo, unidade, colunas, linhas, medianiz,
    margem_sup, margem_inf, margem_esq, margem_dir, linha_de_base, zonas, descricao, pagina, origem
  ) values (
    p_workspace_id, p_brand_id, p_regra ->> 'formato',
    btrim(coalesce(p_regra ->> 'variante', '')), btrim(coalesce(p_regra ->> 'segmento', '')),
    p_regra ->> 'tipo', p_regra ->> 'unidade',
    (p_regra ->> 'colunas')::smallint, (p_regra ->> 'linhas')::smallint, (p_regra ->> 'medianiz')::numeric,
    (p_regra ->> 'margem_sup')::numeric, (p_regra ->> 'margem_inf')::numeric,
    (p_regra ->> 'margem_esq')::numeric, (p_regra ->> 'margem_dir')::numeric,
    (p_regra ->> 'linha_de_base')::numeric, zonas,
    left(coalesce(p_regra ->> 'descricao', ''), 300), (p_regra ->> 'pagina')::integer, 'ia'
  )
  on conflict (brand_id, formato, segmento, variante) do nothing;
  get diagnostics criadas = row_count;
  return criadas > 0;
end;
$$;

revoke all on function public.registrar_leitura_das_regras_de_grid(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_leitura_das_regras_de_grid(uuid, uuid, jsonb) to service_role;
