-- Item e variante — ADR-0007 §2.2.
--
-- ─── O que muda ──────────────────────────────────────────────────────────
--
-- Até aqui cada linha de `brand_assets` era um arquivo solto, com uma
-- `category` em texto livre. O ADR pede o contrário: "item não é arquivo". Um
-- item ("Logo") reúne as variantes, e cada eixo da variante é um campo próprio
-- com vocabulário fechado — porque taxonomia em texto livre é o que um acervo
-- vira depois de dois anos e três pessoas cadastrando.
--
-- `brand_assets` continua sendo a tabela do ARQUIVO (ADR-0007 §7, "estender,
-- não substituir"). Ela ganha o vínculo com o item e os eixos. O item é tabela
-- nova, por cima.
--
-- ─── Por que agora ───────────────────────────────────────────────────────
--
-- Medido em produção em 17/09/2026: `brand_assets` tem ZERO linhas. Não há dado
-- a migrar, e por isso `item_id` nasce obrigatório e `category` sai sem
-- conversão. Depois do primeiro cliente, esta mesma mudança exigiria migrar
-- arquivo real (ADR-0007 §9). Decisão do André, 17/09.
--
-- ─── Versão ──────────────────────────────────────────────────────────────
--
-- Não há mecanismo novo de versão: o "substituir não apaga" que já existe
-- (`descontinuado_em`, `substituido_por`) é o histórico de cada variante. O que
-- esta migration acrescenta é que o substituto precisa ser do MESMO item — um
-- logo não é substituído por um ícone.

-- ─── O item ──────────────────────────────────────────────────────────────

create table public.brand_asset_items (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id     uuid not null,
  tipo         text not null,
  nome         text not null,
  descricao    text not null default '',
  ordem        integer not null default 0,
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint brand_asset_items_brand_workspace_fkey
    foreign key (brand_id, workspace_id) references public.brands(id, workspace_id) on delete cascade,
  -- Alvo da FK composta de `brand_assets`: a variante e o item são da mesma marca
  -- por construção, e não por uma conferência que alguém esquece de escrever.
  constraint brand_asset_items_id_brand_key unique (id, brand_id),
  -- `fonte` existe no vocabulário, mas não aceita arquivo — ver o gatilho
  -- abaixo. Nascer agora evita migrar o vocabulário quando o termo existir.
  constraint brand_asset_items_tipo_check
    check (tipo in ('logo', 'icone', 'paleta', 'fonte', 'gabarito', 'foto', 'ilustracao')),
  constraint brand_asset_items_nome_check
    check (char_length(btrim(nome)) between 1 and 120),
  constraint brand_asset_items_descricao_check
    check (char_length(descricao) <= 500)
);

create index brand_asset_items_marca_idx
  on public.brand_asset_items (brand_id, tipo, ordem);
create index brand_asset_items_brand_workspace_idx
  on public.brand_asset_items (brand_id, workspace_id);
create index brand_asset_items_created_by_idx
  on public.brand_asset_items (created_by);

alter table public.brand_asset_items enable row level security;

-- As mesmas capacidades que já governam `brand_assets`: quem consulta lê, quem
-- edita cadastra. Item e arquivo não podem ter regras diferentes — a tela
-- mostraria um item cujas variantes a pessoa não alcança.
create policy "Quem tem acesso à marca lê os itens" on public.brand_asset_items
  for select to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'consultar'));
create policy "Quem edita a marca cria item" on public.brand_asset_items
  for insert to authenticated
  with check (public.tem_capacidade_na_marca(brand_id, 'editar'));
create policy "Quem edita a marca altera item" on public.brand_asset_items
  for update to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'editar'))
  with check (public.tem_capacidade_na_marca(brand_id, 'editar'));
create policy "Quem edita a marca remove item" on public.brand_asset_items
  for delete to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'editar'));

-- GRANT e RLS são dois portões. Sem esta linha a tabela é inalcançável, e a
-- prova do acesso por marca já pegou esse defeito uma vez (13/09).
grant select, insert, update, delete on public.brand_asset_items to authenticated;

-- ─── A variante ──────────────────────────────────────────────────────────

alter table public.brand_assets
  add column item_id       uuid not null,
  add column hierarquia    text,
  add column lockup        text,
  add column cor           text,
  add column polaridade    text,
  add column espaco_de_cor text,
  add constraint brand_assets_item_fkey
    foreign key (item_id, brand_id) references public.brand_asset_items(id, brand_id),
  add constraint brand_assets_hierarquia_check check (hierarquia in ('principal', 'secundario')),
  add constraint brand_assets_lockup_check     check (lockup in ('horizontal', 'vertical')),
  add constraint brand_assets_cor_check        check (cor in ('colorido', 'monocromatico')),
  add constraint brand_assets_polaridade_check check (polaridade in ('positivo', 'negativo')),
  -- Campo explícito, nunca deduzido do formato: `logo.eps` não diz se é RGB ou
  -- CMYK, e deduzir erraria no arquivo que a gráfica usa (ADR-0007 §2.2, 4).
  add constraint brand_assets_espaco_de_cor_check check (espaco_de_cor in ('rgb', 'cmyk'));

-- A FK para o item é NO ACTION, não RESTRICT, de propósito: apagar a marca
-- cascateia itens e arquivos no mesmo comando, e RESTRICT recusaria o item
-- antes de o arquivo sair. NO ACTION confere no fim do comando. Remover um
-- item que ainda tem variantes continua recusado.
create index brand_assets_item_idx on public.brand_assets (item_id, brand_id);

-- A taxonomia livre sai. Zero linhas em produção: nada se perde.
alter table public.brand_assets drop column category;

-- ─── Os eixos por tipo ───────────────────────────────────────────────────
--
-- `check` de linha não enxerga o tipo do item, que mora em outra tabela. A
-- regra vive num gatilho, e cada recusa leva o nome de uma constraint — a
-- prova confere o NOME, não "algum erro".
--
--   tipo          hierarquia  lockup  cor  polaridade  espaço de cor
--   logo          obrig.      obrig.  obrig. obrig.    obrig.
--   icone         —           —       obrig. obrig.    obrig.
--   paleta        —           —       —      —         obrig.
--   gabarito      —           —       —      —         obrig.
--   foto          —           —       —      —         opcional
--   ilustracao    —           —       —      —         opcional
--   fonte         não aceita arquivo
--
-- "—" é PROIBIDO, não opcional: paleta com polaridade é dado errado, e dado
-- errado aceito vira filtro que mente (ADR-0007 §2.2, 5).

create function private.conferir_eixos_da_variante()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  tipo_do_item text;
begin
  -- Quem não edita esta marca não chega à conferência: a RLS recusa a linha
  -- logo depois, com 42501. Sem este desvio, a função (que enxerga tudo)
  -- responderia "o item não existe nesta marca" a um estranho e outra coisa a
  -- quem acertasse um id — um oráculo de existência. A prova pegou em 17/09.
  --
  -- `auth.uid()` nulo é escrita de sistema (service role, migration): essa
  -- passa pela conferência inteira, senão o atalho viraria brecha de eixo.
  if (select auth.uid()) is not null
     and not public.tem_capacidade_na_marca(new.brand_id, 'editar') then
    return new;
  end if;

  select i.tipo into tipo_do_item
    from public.brand_asset_items i
   where i.id = new.item_id and i.brand_id = new.brand_id;

  -- A FK composta também recusaria; aqui a recusa sai com nome legível.
  if tipo_do_item is null then
    raise exception 'o item não existe nesta marca'
      using errcode = 'foreign_key_violation', constraint = 'brand_assets_item_fkey';
  end if;

  if tipo_do_item = 'fonte' then
    raise exception 'fonte só é aceita depois do termo de licença assinado (ADR-0007 §3)'
      using errcode = 'check_violation', constraint = 'brand_assets_fonte_exige_termo';
  end if;

  if tipo_do_item = 'logo' then
    if new.hierarquia is null or new.lockup is null or new.cor is null
       or new.polaridade is null or new.espaco_de_cor is null then
      raise exception 'logo exige hierarquia, lockup, cor, polaridade e espaço de cor'
        using errcode = 'check_violation', constraint = 'brand_assets_eixos_do_logo';
    end if;
    return new;
  end if;

  if new.hierarquia is not null or new.lockup is not null then
    raise exception 'hierarquia e lockup são eixos só do logo'
      using errcode = 'check_violation', constraint = 'brand_assets_eixos_fora_do_tipo';
  end if;

  if tipo_do_item = 'icone' then
    if new.cor is null or new.polaridade is null or new.espaco_de_cor is null then
      raise exception 'ícone exige cor, polaridade e espaço de cor'
        using errcode = 'check_violation', constraint = 'brand_assets_eixos_do_icone';
    end if;
    return new;
  end if;

  if new.cor is not null or new.polaridade is not null then
    raise exception 'cor e polaridade não se aplicam a %', tipo_do_item
      using errcode = 'check_violation', constraint = 'brand_assets_eixos_fora_do_tipo';
  end if;

  if tipo_do_item in ('paleta', 'gabarito') and new.espaco_de_cor is null then
    raise exception '% exige espaço de cor', tipo_do_item
      using errcode = 'check_violation', constraint = 'brand_assets_espaco_de_cor_obrigatorio';
  end if;

  return new;
end;
$$;

revoke execute on function private.conferir_eixos_da_variante() from public, anon, authenticated;

create trigger brand_assets_conferir_eixos
  before insert or update of item_id, hierarquia, lockup, cor, polaridade, espaco_de_cor
  on public.brand_assets
  for each row execute function private.conferir_eixos_da_variante();

-- O tipo do item não muda depois de ter variantes: os eixos já gravados foram
-- conferidos contra o tipo antigo, e trocar o tipo por baixo deixaria um logo
-- "paleta" com lockup — exatamente o que o gatilho acima recusa na entrada.
create function private.tipo_do_item_imutavel_com_variantes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.tipo is distinct from old.tipo
     and exists (select 1 from public.brand_assets a where a.item_id = old.id) then
    raise exception 'o tipo do item não muda depois de ter arquivos'
      using errcode = 'check_violation', constraint = 'brand_asset_items_tipo_imutavel';
  end if;
  if new.brand_id is distinct from old.brand_id or new.workspace_id is distinct from old.workspace_id then
    raise exception 'o item não muda de marca'
      using errcode = 'check_violation', constraint = 'brand_asset_items_marca_imutavel';
  end if;
  return new;
end;
$$;

revoke execute on function private.tipo_do_item_imutavel_com_variantes() from public, anon, authenticated;

create trigger brand_asset_items_tipo_imutavel
  before update on public.brand_asset_items
  for each row execute function private.tipo_do_item_imutavel_com_variantes();

-- ─── O substituto é do mesmo item ────────────────────────────────────────
--
-- A função já conferia a marca (13/09). Passa a conferir o item: substituir o
-- logo horizontal por um ícone apagaria o logo da matriz com a aparência de
-- uma troca de versão.

create or replace function private.conferir_substituto_do_asset()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  marca_do_substituto uuid;
  item_do_substituto uuid;
begin
  if new.substituido_por is null then
    return new;
  end if;

  select brand_id, item_id into marca_do_substituto, item_do_substituto
    from public.brand_assets
   where id = new.substituido_por;

  if marca_do_substituto is null then
    raise exception 'o asset substituto não existe'
      using errcode = 'foreign_key_violation';
  end if;

  if marca_do_substituto <> new.brand_id then
    raise exception 'o substituto precisa ser da mesma marca'
      using errcode = 'check_violation';
  end if;

  if item_do_substituto <> new.item_id then
    raise exception 'o substituto precisa ser do mesmo item'
      using errcode = 'check_violation', constraint = 'brand_assets_substituto_do_mesmo_item';
  end if;

  return new;
end;
$$;

revoke execute on function private.conferir_substituto_do_asset() from public, anon, authenticated;
