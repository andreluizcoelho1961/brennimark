-- O registro de quem mexeu no acesso — passo A3.
--
-- ─── Por que existe ──────────────────────────────────────────────────────
--
-- A migration anterior (`acesso_por_marca`) tornou o acesso concedível marca a
-- marca. Concessão sem registro é a metade fácil: no dia em que alguém abrir um
-- arquivo que não devia, a pergunta não é "quem tinha acesso?" — o estado atual
-- responde isso — mas **"quem concedeu, e quando?"**, que nenhuma tabela de
-- estado responde.
--
-- Isso pesa mais depois do ADR-0007: a biblioteca de assets entrega arquivo, e
-- entre eles a fonte licenciada, cujo termo assinado obriga a plataforma a
-- saber a quem ela foi liberada.
--
-- ─── O desenho, e o que ele deliberadamente NÃO é ────────────────────────
--
-- Não é um log de atividade do produto. Registra UMA coisa: mudanças em
-- `brand_members`. Um log que registra tudo vira um log que ninguém lê.
--
-- O registro é gravado por gatilho `SECURITY DEFINER`, e não pelo aplicativo.
-- Registro que depende de a aplicação lembrar de escrever é registro que some
-- na primeira rota nova — a mesma razão de `capture_brand_document_version`
-- ser gatilho desde 29/08.
--
-- Ninguém escreve nesta tabela pela API: `authenticated` recebe só `select`.
-- Não há política de `update` nem de `delete`, então nem quem administra a
-- conta reescreve o próprio rastro.

create table public.brand_access_log (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- A quem o acesso se refere, e quem mexeu. Os dois são `set null` na saída
  -- da pessoa: perder o rastro junto com a conta apagaria justamente o que o
  -- registro existe para guardar.
  pessoa       uuid references auth.users(id) on delete set null,
  autor        uuid references auth.users(id) on delete set null,
  -- Os identificadores acima podem virar nulos; estes rótulos não. É o que
  -- mantém o registro legível depois de a conta sumir.
  pessoa_email text not null,
  autor_email  text not null,
  acao         text not null check (acao in ('concedido', 'alterado', 'revogado')),
  -- O antes e o depois, para a pergunta ser respondível sem reconstruir a
  -- história somando eventos.
  capacidades_antes text[],
  capacidades_depois text[],
  /*
   * `clock_timestamp()`, e não `now()`.
   *
   * `now()` devolve o horário de início da TRANSAÇÃO: conceder cinco marcas de
   * uma vez grava cinco eventos com o mesmo carimbo, e a ordem entre eles se
   * perde — num registro, a ordem é metade da informação. `clock_timestamp()`
   * lê o relógio a cada linha. A prova pegou isto: a última linha de uma
   * sequência conceder → alterar → revogar vinha 'alterado'.
   */
  created_at   timestamptz not null default clock_timestamp()
);

-- A consulta que este registro precisa responder é "o que aconteceu com esta
-- marca, do mais recente para trás".
create index brand_access_log_marca_idx
  on public.brand_access_log (brand_id, created_at desc);
create index brand_access_log_pessoa_idx
  on public.brand_access_log (pessoa, created_at desc);

alter table public.brand_access_log enable row level security;

/*
 * Quem lê o registro de uma marca: quem administra AQUELA marca.
 *
 * Não quem apenas consulta — o histórico de concessões diz quem mais trabalha
 * na marca, e isso é informação de administração, não de leitura do manual.
 */
create policy "Quem administra a marca lê o registro dela"
  on public.brand_access_log for select to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'administrar'));

revoke all on public.brand_access_log from anon;
revoke all on public.brand_access_log from authenticated;
grant select on public.brand_access_log to authenticated;

/*
 * O gatilho.
 *
 * `SECURITY DEFINER` porque grava numa tabela em que ninguém tem `insert` —
 * inclusive quem disparou a mudança. `search_path` vazio e nomes qualificados,
 * como o CLAUDE.md exige de toda função definer.
 *
 * O e-mail é resolvido aqui, na hora, e guardado como texto. Ler `auth.users`
 * depois exigiria privilégio que a interface não tem, e o identificador vira
 * nulo quando a pessoa sai.
 */
create function private.registrar_acesso_por_marca()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  alvo          uuid;
  acao_do_evento text;
  antes         text[];
  depois        text[];
begin
  if tg_op = 'DELETE' then
    alvo := old.user_id; acao_do_evento := 'revogado';
    antes := old.capacidades; depois := null;
  elsif tg_op = 'INSERT' then
    alvo := new.user_id; acao_do_evento := 'concedido';
    antes := null; depois := new.capacidades;
  else
    -- Alteração que não mexe nas capacidades não é evento de acesso. Sem esta
    -- guarda, qualquer `touch` na linha encheria o registro de ruído — e um
    -- registro ruidoso é um registro que ninguém abre.
    if new.capacidades is not distinct from old.capacidades then
      return new;
    end if;
    alvo := new.user_id; acao_do_evento := 'alterado';
    antes := old.capacidades; depois := new.capacidades;
  end if;

  insert into public.brand_access_log (
    brand_id, workspace_id, pessoa, autor, pessoa_email, autor_email,
    acao, capacidades_antes, capacidades_depois
  )
  values (
    coalesce(new.brand_id, old.brand_id),
    coalesce(new.workspace_id, old.workspace_id),
    alvo,
    (select auth.uid()),
    coalesce((select u.email from auth.users u where u.id = alvo), '(conta removida)'),
    -- Sem sessão o autor é o sistema: semeadura, chave de serviço, SQL de
    -- manutenção. Dizer "desconhecido" seria esconder que a causa é conhecida.
    coalesce((select u.email from auth.users u where u.id = (select auth.uid())), '(sistema)'),
    acao_do_evento, antes, depois
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke execute on function private.registrar_acesso_por_marca() from public, anon, authenticated;

create trigger brand_members_registrar_acesso
  after insert or update or delete on public.brand_members
  for each row execute function private.registrar_acesso_por_marca();
