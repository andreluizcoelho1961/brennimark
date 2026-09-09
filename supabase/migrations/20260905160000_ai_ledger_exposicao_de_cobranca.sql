-- Fecha os itens 7 e 5: o razão passa a distinguir reserva não despachada de
-- chamada já exposta a cobrança.
--
-- ─── O que estava indistinguível ─────────────────────────────────────────
--
-- Passados os 15 minutos que a contenção impôs, duas linhas idênticas —
-- `status = 'reserved'`, velhas — significam coisas opostas:
--
--   (a) reserva criada e NUNCA despachada ao provedor. Pode ser liberada:
--       ninguém vai cobrar por ela.
--   (b) chamada JÁ despachada cuja liquidação falhou. NÃO pode virar zero: o
--       provedor vai cobrar, e o custo precisa aparecer no razão.
--
-- Liberar (b) apaga custo real. E era o desfecho provável, porque a expiração
-- não tinha como saber a diferença.
--
-- `charge_exposed_at` é o fato que faltava: o instante em que o pedido passou
-- a poder gerar cobrança. Gravado ANTES do despacho, não depois da resposta —
-- pela mesma razão que o executor já marca `attemptDespachado` antes de
-- `dispatch`: não há como saber se o pedido tocou a rede, e errar para o lado
-- conservador é a escolha segura.
--
-- ─── A corrida, que era pior do que "expirar × liquidar" ─────────────────
--
-- `consolidar_execucao_de_ia_server` e `liberar_reserva_de_ia_server` fazem
-- VERIFICAR-DEPOIS-AGIR: um `select` sem trava lê o status, e o `update`
-- seguinte não repete o predicado. Entre uma coisa e outra, outra transação
-- pode mudar a linha — e o `update` sobrescreve assim mesmo.
--
-- O efeito não é teórico: a idempotência que os comentários dessas funções
-- prometem ("a função do banco ignora silenciosamente a segunda chamada") NÃO
-- estava garantida. Duas liquidações concorrentes da mesma execução gravavam
-- as duas, a última vencendo, com números possivelmente diferentes.
--
-- A correção é a mínima que resolve: `for update` na leitura, para serializar
-- as transações na própria linha, e o predicado de status repetido no `update`
-- como cinto e suspensório. Nenhuma tabela nova, nenhum quarto estado no enum
-- — que confundiria "onde a linha está" com "o que aconteceu com ela".
--
-- ─── Sem backfill ────────────────────────────────────────────────────────
--
-- Preflight em 05/09: `select count(*) from public.ai_ledger` devolveu **0**.
-- Não há linha ambígua para tratar conservadoramente, então a coluna nasce
-- nula em todas — que são nenhuma. Se houvesse linhas `reserved` antigas, a
-- decisão registrada era tratá-las como expostas (conservador), e este
-- comentário estaria acompanhado do `update` correspondente.

-- ─── A coluna ────────────────────────────────────────────────────────────

alter table public.ai_ledger
  add column if not exists charge_exposed_at timestamptz;

comment on column public.ai_ledger.charge_exposed_at is
  'Instante em que o pedido passou a poder gerar cobrança no provedor. '
  'Gravado ANTES do despacho. Nulo significa que nada foi enviado — e é a '
  'ÚNICA condição sob a qual uma reserva pode ser liberada sem virar custo.';

-- A expiração varre por conta, status e idade. O índice parcial cobre
-- exatamente essa varredura e só indexa o que ela procura.
create index if not exists ai_ledger_reservadas_idx
  on public.ai_ledger (workspace_id, created_at)
  where status = 'reserved';

-- ─── Marcar a exposição, antes do despacho ───────────────────────────────

create or replace function public.marcar_exposicao_de_cobranca_server(
  p_user_id uuid,
  p_execution_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := p_user_id;
  linha public.ai_ledger%rowtype;
begin
  if actor is null then
    raise exception 'p_user_id is required' using errcode = '22004';
  end if;

  -- `for update`: a marcação corre contra a expiração. Sem a trava, a
  -- expiração poderia liberar a linha entre a leitura e a escrita, e o
  -- despacho seguiria sobre uma reserva que já não existe.
  select * into linha from public.ai_ledger
   where execution_id = p_execution_id
     for update;

  if linha.id is null then
    raise exception 'no reservation for this execution' using errcode = 'P0002';
  end if;
  if linha.user_id <> actor then
    raise exception 'not the owner of this execution' using errcode = '42501';
  end if;

  -- Já não está reservada: alguém liquidou ou liberou. Quem chamou precisa
  -- saber, porque despachar agora produziria custo sem reserva.
  if linha.status <> 'reserved' then
    return false;
  end if;

  -- Idempotente: repetir a marcação não move o instante. O primeiro é o que
  -- vale, e é o mais conservador dos dois.
  if linha.charge_exposed_at is not null then
    return true;
  end if;

  update public.ai_ledger
     set charge_exposed_at = now()
   where execution_id = p_execution_id
     and status = 'reserved';

  return true;
end;
$$;

revoke all on function public.marcar_exposicao_de_cobranca_server(uuid, uuid) from public, anon, authenticated;
grant execute on function public.marcar_exposicao_de_cobranca_server(uuid, uuid) to service_role;

comment on function public.marcar_exposicao_de_cobranca_server(uuid, uuid) is
  'SERVER-ONLY. Marca que o pedido vai ser despachado e portanto pode gerar '
  'cobrança. Devolve false quando a reserva já não está reservada — nesse '
  'caso o chamador NÃO deve despachar. Falha ao marcar aborta o despacho: '
  'preferimos derrubar a execução a produzir custo que o razão não conhece.';

-- ─── Liquidar: com trava, e sem sobrescrever quem já mudou ───────────────

create or replace function public.consolidar_execucao_de_ia_server(
  p_user_id uuid,
  p_execution_id uuid,
  p_settled_micros bigint,
  p_provider text,
  p_model text,
  p_usage_snapshot jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := p_user_id;
  linha public.ai_ledger%rowtype;
begin
  if actor is null then
    raise exception 'p_user_id is required' using errcode = '22004';
  end if;

  select * into linha from public.ai_ledger
   where execution_id = p_execution_id
     for update;

  if linha.id is null then
    raise exception 'no reservation for this execution' using errcode = 'P0002';
  end if;
  if linha.user_id <> actor then
    raise exception 'not the owner of this execution' using errcode = '42501';
  end if;
  if linha.status <> 'reserved' then
    return;
  end if;

  /*
   * A invariante recíproca: **não existe execução liquidada sem registro de
   * exposição ao provedor**.
   *
   * Liquidar sem `charge_exposed_at` significaria cobrar por um pedido que o
   * razão não sabe ter saído — o espelho exato do defeito que a coluna existe
   * para fechar. E é sintoma, não causa: se chegou aqui sem marcação, ou a
   * marcação foi pulada no executor, ou a linha foi manipulada fora do
   * caminho normal. Nos dois casos, o certo é interromper alto, não gravar.
   *
   * Erro e não `return`: um `return` silencioso perderia a liquidação e
   * deixaria a reserva aberta, trocando um defeito visível por um invisível.
   */
  if linha.charge_exposed_at is null then
    raise exception
      'cannot settle an execution with no recorded charge exposure (execution %)',
      p_execution_id
      using errcode = '23514';
  end if;

  update public.ai_ledger
     set status = 'settled', settled_micros = p_settled_micros,
         provider = p_provider, model = p_model, settled_at = now(),
         usage_snapshot = p_usage_snapshot
   where execution_id = p_execution_id
     and status = 'reserved';
end;
$$;

-- ─── Liberar: NUNCA libera o que já está exposto ─────────────────────────

create or replace function public.liberar_reserva_de_ia_server(
  p_user_id uuid,
  p_execution_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := p_user_id;
  linha public.ai_ledger%rowtype;
begin
  if actor is null then
    raise exception 'p_user_id is required' using errcode = '22004';
  end if;

  select * into linha from public.ai_ledger
   where execution_id = p_execution_id
     for update;

  if linha.id is null then
    raise exception 'no reservation for this execution' using errcode = 'P0002';
  end if;
  if linha.user_id <> actor then
    raise exception 'not the owner of this execution' using errcode = '42501';
  end if;
  if linha.status <> 'reserved' then
    return;
  end if;

  -- A invariante que a coluna existe para sustentar: **nada libera uma
  -- reserva exposta**. "Liberar" afirma que não houve custo; se o pedido já
  -- saiu, essa afirmação é falsa. A janela em que isso acontece é estreita —
  -- abortar entre a marcação e o despacho — e o desfecho conservador é
  -- liquidar pelo teto: paga-se por algo que talvez não tenha sido enviado, o
  -- que é o erro barato. O caro é o contrário.
  if linha.charge_exposed_at is not null then
    update public.ai_ledger
       set status = 'settled', settled_micros = linha.reserved_micros,
           settled_at = now(),
           usage_snapshot = jsonb_build_object('unknown', true, 'motivo', 'exposto_sem_uso_medido')
     where execution_id = p_execution_id
       and status = 'reserved';
    return;
  end if;

  update public.ai_ledger set status = 'released', released_at = now()
   where execution_id = p_execution_id
     and status = 'reserved';
end;
$$;

-- ─── Expirar: dois destinos, nunca um só ─────────────────────────────────
--
-- O retorno deixa de ser um inteiro. Uma expiração que libera algumas linhas
-- e liquida outras precisa DIZER isso: devolver só um número esconderia
-- exatamente a distinção que esta migração existe para criar.

drop function if exists public.expirar_reservas_de_ia(uuid, interval);

create function public.expirar_reservas_de_ia(
  p_workspace_id uuid,
  p_mais_velha_que interval default '15 minutes'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  minimo constant interval := interval '15 minutes';
  liberadas integer;
  liquidadas integer;
begin
  if p_mais_velha_que is null or p_mais_velha_que < minimo then
    raise exception
      'p_mais_velha_que must be at least %, got %', minimo, p_mais_velha_que
      using errcode = '22023';
  end if;

  if actor is not null and not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = actor and m.role = 'owner'
  ) then
    raise exception 'only an owner can expire stale reservations' using errcode = '42501';
  end if;

  -- (a) Nunca despachada: liberar. Ninguém vai cobrar por ela.
  update public.ai_ledger
     set status = 'released', released_at = now()
   where workspace_id = p_workspace_id
     and status = 'reserved'
     and charge_exposed_at is null
     and created_at < now() - p_mais_velha_que;
  get diagnostics liberadas = row_count;

  -- (b) Exposta e sem liquidação: liquidar pelo TETO. O provedor vai cobrar;
  -- o razão precisa saber. Pelo teto, e não por zero, porque o uso real é
  -- desconhecido — e desconhecido liquida conservador, a mesma regra que o
  -- executor aplica quando o provedor não relata uso.
  update public.ai_ledger
     set status = 'settled', settled_micros = reserved_micros, settled_at = now(),
         usage_snapshot = jsonb_build_object('unknown', true, 'motivo', 'expirada_apos_exposicao')
   where workspace_id = p_workspace_id
     and status = 'reserved'
     and charge_exposed_at is not null
     and created_at < now() - p_mais_velha_que;
  get diagnostics liquidadas = row_count;

  return jsonb_build_object(
    'liberadas', liberadas,
    'liquidadas_conservador', liquidadas
  );
end;
$$;

revoke execute on function public.expirar_reservas_de_ia(uuid, interval) from public, anon, authenticated;
grant execute on function public.expirar_reservas_de_ia(uuid, interval) to service_role;

comment on function public.expirar_reservas_de_ia(uuid, interval) is
  'Server-only, idade mínima de 15 minutos imposta no banco. Libera apenas '
  'reservas comprovadamente NÃO despachadas (charge_exposed_at nulo); as '
  'expostas são liquidadas pelo teto, porque o provedor vai cobrar e o razão '
  'precisa saber. Devolve jsonb com as duas contagens: uma expiração que '
  'liquida em silêncio esconderia a distinção que ela existe para fazer.';
