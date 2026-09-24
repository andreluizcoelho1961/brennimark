-- Materiais da marca — fatia 5, 24/09/2026. Duas colunas, aprovadas pelo André.
--
-- ─── 1. A regra do item: páginas do manual ─────────────────────────────────
--
-- "Regra colada ao download" (plano da interface, fatia 5): quem baixa o logo
-- vê, no mesmo gesto, onde o manual diz como usá-lo. Até aqui nada ligava o
-- item à regra.
--
-- Quem EDITA a marca escolhe as páginas do manual que regem o item — até cinco
-- (área de proteção na 12, usos proibidos na 14…). A tela cita o título da
-- seção e o status (aprovada, rascunho), e o clique abre o PDF na página.
--
-- Descartado: o sistema adivinhar a regra pela busca. Citaria a página errada
-- diante do cliente com a mesma confiança da certa — o erro que a honestidade
-- editorial do projeto proíbe.
--
-- O banco confere forma (até cinco, positivas, uma dimensão). Que a página
-- EXISTA no manual é conferido pela rota, contra o total de páginas: o manual
-- é outra tabela, e trocar de edição do manual não pode invalidar o item.
--
-- ─── 2. A miniatura da variante ────────────────────────────────────────────
--
-- A prévia de um logo em SVG É o arquivo: mostrá-la entregaria o original sem
-- passar pelo registro de download (ADR-0007 §2.4). A miniatura é um PNG
-- pequeno, gerado no navegador de quem envia, guardado ao lado do original.
--
-- A policy de leitura do bucket (`storage_por_marca`) já deixa quem alcança a
-- marca ler o que está na pasta dela, EXCETO os originais da biblioteca. A
-- miniatura tem nome próprio (`miniatura-<uuid>.png`) e nunca é o caminho de
-- um original — então é legível por quem consulta, e o original continua só
-- pela rota que registra. A constraint abaixo tranca as duas coisas.

alter table public.brand_asset_items
  add column regra_paginas integer[] not null default '{}';

alter table public.brand_asset_items
  add constraint brand_asset_items_regra_paginas_check check (
    cardinality(regra_paginas) <= 5
    and coalesce(array_ndims(regra_paginas), 1) = 1
    and 0 < all (regra_paginas)
    and array_position(regra_paginas, null) is null
  );

alter table public.brand_assets
  add column miniatura_path text;

alter table public.brand_assets
  add constraint brand_assets_miniatura_da_marca_check check (
    miniatura_path is null
    or (
      miniatura_path ~ ('^' || workspace_id::text || '/' || brand_id::text || '/miniatura-[0-9a-f-]{36}\.png$')
      and miniatura_path <> storage_path
    )
  );

-- Duas variantes não dividem a mesma miniatura: apagar uma levaria a da outra.
create unique index brand_assets_miniatura_unica_idx
  on public.brand_assets (miniatura_path) where miniatura_path is not null;

-- ─── 3. A miniatura sai do Storage junto com a variante ────────────────────
--
-- As duas funções que apagam arquivo (`delete_asset_with_file`, uma variante;
-- `delete_brand_with_files`, a marca inteira) enfileiram só o ORIGINAL. Sem
-- isto, toda miniatura ficaria órfã no Storage, ocupando o espaço da conta
-- para sempre.
--
-- Um gatilho, e não as duas funções reescritas: ele cobre a variante apagada
-- sozinha E a apagada em cascata com a marca, e qualquer caminho de exclusão
-- que venha depois. Enfileira na MESMA transação do delete, como as funções.
-- `requested_by` é quem apagou; sem sessão (manutenção), quem criou a
-- variante — a coluna não aceita nulo, e inventar um usuário seria pior.

create function private.enfileirar_miniatura_apagada()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  /*
   * Conta sendo apagada inteira: não enfileira. A fila aponta para a CONTA, e
   * uma linha nova apontando para a conta que está sumindo derrubava a
   * exclusão dela inteira (23503 — medido na prova desta migration). O destino
   * dos arquivos de uma conta encerrada é o fluxo de encerramento, o mesmo que
   * já responde pelos originais.
   */
  if old.miniatura_path is not null
     and exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
    insert into public.brand_deletions (workspace_id, bucket_id, storage_path, requested_by)
    values (old.workspace_id, 'brand-assets', old.miniatura_path, coalesce((select auth.uid()), old.created_by))
    on conflict (workspace_id, bucket_id, storage_path) do nothing;
  end if;
  return old;
end;
$$;

revoke execute on function private.enfileirar_miniatura_apagada() from public, anon, authenticated;

create trigger brand_assets_miniatura_para_a_fila
  after delete on public.brand_assets
  for each row execute function private.enfileirar_miniatura_apagada();
