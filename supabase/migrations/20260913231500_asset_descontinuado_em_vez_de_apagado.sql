-- Substituir não apaga — item 10 do ADR-0007 §2.4.
--
-- ─── O que está errado hoje ──────────────────────────────────────────────
--
-- A biblioteca já está no ar, e o botão dela é "Remover": chama
-- `delete_asset_with_file`, a linha some e o arquivo entra na fila de
-- exclusão. Não há volta, não há rastro, e quem baixou aquele logo ontem não
-- tem como saber que ele foi trocado.
--
-- Isso contradiz uma regra que o CLAUDE.md declara não-negociável — "nunca
-- apagar, reescrever ou normalizar silenciosamente dados, histórico ou
-- assets" — e contradiz o que o produto vende. Uma plataforma de governança
-- de marca que perde a versão anterior do logo não governa: ela esquece.
--
-- ─── O que muda ──────────────────────────────────────────────────────────
--
-- O asset ganha um estado a mais: **descontinuado**. Ele continua existindo,
-- continua visível, continua baixável, e passa a dizer QUEM o descontinuou,
-- QUANDO, e — quando for o caso — QUAL arquivo o substituiu.
--
-- Substituir deixa de ser "apagar e subir outro" e vira um vínculo entre dois
-- assets. É essa a diferença entre um acervo e uma pasta.
--
-- O apagamento definitivo NÃO desaparece: um arquivo subido por engano, ou o
-- material de um cliente que encerrou contrato, precisa ter saída. Ele deixa
-- de ser o primeiro clique e passa a exigir dois passos deliberados —
-- descontinuar e só então remover. É a diferença entre apagar em silêncio e
-- apagar de propósito.

alter table public.brand_assets
  add column descontinuado_em  timestamptz,
  add column descontinuado_por uuid references auth.users(id) on delete set null,
  -- Para onde olhar quando este arquivo não serve mais. Nulo é legítimo: nem
  -- toda descontinuação é substituição — um asset pode simplesmente sair de
  -- uso sem nada ocupar o lugar dele.
  add column substituido_por   uuid references public.brand_assets(id) on delete set null;

-- Estado impossível não deve depender de a aplicação lembrar. Um substituto
-- sem descontinuação diria "este arquivo foi trocado e continua em uso", que
-- não quer dizer nada.
alter table public.brand_assets
  add constraint brand_assets_substituto_exige_descontinuacao
    check (substituido_por is null or descontinuado_em is not null),
  add constraint brand_assets_nao_substitui_a_si_mesmo
    check (substituido_por is null or substituido_por <> id);

-- A listagem comum pede os assets EM USO de uma marca. Índice parcial: o
-- acervo cresce com o histórico, e a consulta do dia a dia não deve crescer
-- junto.
create index brand_assets_em_uso_idx
  on public.brand_assets (brand_id, created_at desc)
  where descontinuado_em is null;

create index brand_assets_substituido_por_idx
  on public.brand_assets (substituido_por)
  where substituido_por is not null;

/*
 * Descontinuar é uma escrita de EDIÇÃO, e a policy de update de
 * `brand_assets` já exige `editar` na marca (migration `acesso_por_marca`).
 * Não há função nova aqui de propósito: o menor mecanismo que resolve.
 *
 * O que a policy não consegue exprimir é a integridade entre DUAS linhas — o
 * substituto precisa ser da mesma marca, senão o acervo de uma marca passaria
 * a apontar para o arquivo de outra, que é exatamente o vazamento que o passo
 * A fechou. Isso é gatilho.
 */
create function private.conferir_substituto_do_asset()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  marca_do_substituto uuid;
begin
  if new.substituido_por is null then
    return new;
  end if;

  select brand_id into marca_do_substituto
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

  return new;
end;
$$;

revoke execute on function private.conferir_substituto_do_asset() from public, anon, authenticated;

create trigger brand_assets_conferir_substituto
  before insert or update of substituido_por on public.brand_assets
  for each row execute function private.conferir_substituto_do_asset();
