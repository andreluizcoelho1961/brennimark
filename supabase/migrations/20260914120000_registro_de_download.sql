-- O registro de download — item 18 do ADR-0007 §2.4.
--
-- ─── Por que vem antes do resto do Passo B ───────────────────────────────
--
-- Duas peças do ADR-0007 dependem dele. A fonte hospedada (§3): "o registro de
-- download é o que responde a uma foundry que pergunte quem recebeu o
-- arquivo". E o link com prazo (§2.5): "cada acesso registrado". Sem esta
-- tabela, as duas nasceriam sem a garantia que as justifica.
--
-- ─── O que estava errado no fluxo, e por que o registro exige mudá-lo ─────
--
-- Até aqui, abrir a biblioteca fazia o servidor assinar um endereço de 1 hora
-- para CADA arquivo da marca, de uma vez. O clique em "Baixar" ia direto ao
-- Storage. Duas consequências, decididas pelo André em 14/09/2026:
--
--   o servidor sabia quem abriu a página, e não quem baixou — registrar ali
--   seria gravar uma resposta falsa à pergunta que o registro existe para
--   responder;
--
--   quem abria a página levava links funcionais para o acervo inteiro por uma
--   hora, repassáveis — inclusive, quando existir, o da fonte licenciada.
--
-- Agora o download passa por uma rota que grava esta linha e só então
-- redireciona para um endereço de 60 segundos.
--
-- ─── O que esta tabela deliberadamente guarda em texto ────────────────────
--
-- `asset_id` vira nulo se o asset for apagado em definitivo; `pessoa` vira nulo
-- se a conta sair. O rótulo, o nome do arquivo e o e-mail ficam copiados. Um
-- registro que perde o sentido quando o arquivo ou a pessoa somem não responde
-- justamente a pergunta difícil — "quem recebeu aquela fonte que retiramos?".

create table public.brand_asset_downloads (
  id           uuid primary key default gen_random_uuid(),
  asset_id     uuid references public.brand_assets(id) on delete set null,
  brand_id     uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pessoa       uuid references auth.users(id) on delete set null,
  pessoa_email text not null,
  asset_label  text not null,
  file_name    text not null,
  -- `clock_timestamp()` pela mesma razão do registro de acesso: `now()` é o
  -- horário da transação e deixaria sem ordem os downloads gravados juntos.
  created_at   timestamptz not null default clock_timestamp()
);

-- "Quem baixou desta marca, do mais recente para trás" e "quem recebeu ESTE
-- arquivo" — as duas perguntas que o registro precisa responder depressa.
create index brand_asset_downloads_marca_idx
  on public.brand_asset_downloads (brand_id, created_at desc);
create index brand_asset_downloads_asset_idx
  on public.brand_asset_downloads (asset_id, created_at desc)
  where asset_id is not null;

alter table public.brand_asset_downloads enable row level security;

/*
 * Quem grava: quem pode ler a marca, e só em nome de si mesmo.
 *
 * O gatilho abaixo PREENCHE pessoa, e-mail, marca, conta, rótulo e nome do
 * arquivo a partir da sessão e do asset — o que o cliente mandar nesses campos
 * é descartado. A policy é avaliada DEPOIS do gatilho, sobre a linha já
 * corrigida. O resultado: ninguém registra download em nome de outra pessoa,
 * nem atribui a uma marca um arquivo que é de outra.
 *
 * O que continua possível é alguém registrar a si mesmo baixando algo que tem
 * direito de baixar sem ter baixado. É inofensivo, e fechar isso exigiria a
 * chave de serviço dentro da rota — uma credencial que ignora a RLS, para
 * proteger contra uma mentira que só incrimina quem a conta.
 */
create policy "Quem alcança a marca registra o próprio download"
  on public.brand_asset_downloads for insert to authenticated
  with check (
    pessoa = (select auth.uid())
    and public.tem_capacidade_na_marca(brand_id, 'consultar')
  );

/*
 * Quem lê: quem administra AQUELA marca.
 *
 * O registro diz quem mais trabalha na marca e com quais arquivos. É
 * informação de administração, como o registro de acesso.
 */
create policy "Quem administra a marca lê os downloads dela"
  on public.brand_asset_downloads for select to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'administrar'));

revoke all on public.brand_asset_downloads from anon;
revoke all on public.brand_asset_downloads from authenticated;
-- Sem `update` e sem `delete`: nem quem administra reescreve o registro.
grant select, insert on public.brand_asset_downloads to authenticated;

create function private.completar_registro_de_download()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
  asset record;
begin
  if quem is null then
    raise exception 'download sem sessão não é registrável'
      using errcode = '42501';
  end if;

  select a.brand_id, a.workspace_id, a.label, a.file_name
    into asset
    from public.brand_assets a
   where a.id = new.asset_id;

  if not found then
    raise exception 'o asset do download não existe'
      using errcode = 'foreign_key_violation';
  end if;

  -- Tudo o que identifica o evento vem do banco, e não do pedido.
  new.pessoa       := quem;
  new.pessoa_email := coalesce((select u.email from auth.users u where u.id = quem), '(sem e-mail)');
  new.brand_id     := asset.brand_id;
  new.workspace_id := asset.workspace_id;
  new.asset_label  := asset.label;
  new.file_name    := asset.file_name;
  return new;
end;
$$;

revoke execute on function private.completar_registro_de_download() from public, anon, authenticated;

create trigger brand_asset_downloads_completar
  before insert on public.brand_asset_downloads
  for each row execute function private.completar_registro_de_download();
