-- CONTENÇÃO do item 7 — NÃO é o fechamento dele.
--
-- Esta migração reduz a superfície de uma falha; ela não corrige a causa. O
-- que fica aberto está descrito no fim deste comentário, e o item 7 só fecha
-- junto com o item 5.
--
-- ─── O que estava errado ─────────────────────────────────────────────────
--
-- `expirar_reservas_de_ia` é `security definer`, está concedida a
-- `authenticated`, e aceita `p_mais_velha_que` sem validar sinal nem mínimo.
-- O padrão de 15 minutos não protege nada: quem chama escolhe o intervalo.
-- Um owner chamando pela Data API com `'0 seconds'` — ou com um intervalo
-- negativo — libera TODA reserva do workspace, inclusive as que estão em voo
-- neste instante.
--
-- Liberar uma reserva em voo é pior do que parece. A execução continua
-- rodando no provedor e vai custar dinheiro de verdade; quando
-- `consolidar_execucao_de_ia_server` for gravar, vai encontrar `status <>
-- 'reserved'` e não fazer nada, por idempotência. O custo real dessa
-- execução some do razão, em silêncio.
--
-- ─── Por que a migração server-only anterior deixou esta função de fora ──
--
-- `20260903210000` fecha as três funções que movem dinheiro e diz,
-- textualmente, que `kill_switch_ativo` e `expirar_reservas_de_ia` "não
-- mudam: nenhuma das duas aceita valor financeiro do chamador".
--
-- Esse raciocínio estava incompleto. `p_mais_velha_que` **é** um controle
-- financeiro: não nomeia um valor, mas escolhe QUAIS reservas deixam de
-- contar. Escolher o que sai do razão move dinheiro tanto quanto escrever o
-- número — só que sem parecer que move.
--
-- ─── O que esta migração faz ─────────────────────────────────────────────
--
-- 1. Revoga `authenticated`. A função passa a ser server-only, como as três
--    que já movem dinheiro. Nenhuma rota do produto chama esta função hoje
--    (verificado: só o próprio arquivo de teste referencia o wrapper
--    `expirarReservasAntigas`), então a revogação não derruba caminho nenhum.
-- 2. Impõe a idade mínima NO BANCO. Quinze minutos, o mesmo valor que já era
--    o padrão — a diferença é que agora ele é piso, não sugestão.
--
-- Depois da revogação, `auth.uid()` chega sempre nulo (só `service_role`
-- alcança a função), então o ramo de owner nunca dispara. Ele fica onde
-- está, de propósito: é defesa em profundidade barata, e o dia em que
-- alguém reconceder `authenticated` por engano encontra a checagem no lugar.
--
-- ─── O que esta migração NÃO faz, e por que o item 7 continua aberto ─────
--
-- Passados os 15 minutos, o banco continua sem distinguir duas coisas que
-- não podem receber o mesmo tratamento:
--
--   (a) reserva criada e NUNCA despachada ao provedor — pode ser liberada,
--       porque não houve custo;
--   (b) chamada JÁ despachada cuja liquidação falhou — não pode virar zero,
--       porque o custo existe e alguém vai pagá-lo.
--
-- Hoje as duas parecem idênticas: `status = 'reserved'` e velhas. Fechar os
-- itens 7 e 5 exige um estado DURÁVEL de despacho no razão, expiração que
-- libere só o caso (a), e liquidação conservadora ou obrigação de
-- reconciliação para o caso (b). Isso é mudança de esquema e está proposto
-- em separado, aguardando decisão.

create or replace function public.expirar_reservas_de_ia(
  p_workspace_id uuid,
  p_mais_velha_que interval default '15 minutes'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  minimo constant interval := interval '15 minutes';
  linhas integer;
begin
  -- Piso de idade, imposto no banco.
  --
  -- No banco e não no TypeScript porque a função é `security definer` e
  -- alcançável pela Data API: uma guarda que só existisse no cliente estaria
  -- do lado errado da fronteira que ela pretende proteger. O TypeScript
  -- também valida, mas como conveniência de erro cedo — não como garantia.
  if p_mais_velha_que is null or p_mais_velha_que < minimo then
    raise exception
      'p_mais_velha_que must be at least %, got %', minimo, p_mais_velha_que
      using errcode = '22023';
  end if;

  -- Mantido mesmo com `authenticated` revogado: ver o cabeçalho.
  if actor is not null and not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = actor and m.role = 'owner'
  ) then
    raise exception 'only an owner can expire stale reservations' using errcode = '42501';
  end if;

  -- Idempotente: só toca linhas ainda em `reserved`. Reexecutar não desfaz
  -- nem duplica nada.
  update public.ai_ledger
     set status = 'released', released_at = now()
   where workspace_id = p_workspace_id
     and status = 'reserved'
     and created_at < now() - p_mais_velha_que;

  get diagnostics linhas = row_count;
  return linhas;
end;
$$;

-- Server-only, como as três funções que movem dinheiro.
revoke execute on function public.expirar_reservas_de_ia(uuid, interval) from public, anon, authenticated;
grant execute on function public.expirar_reservas_de_ia(uuid, interval) to service_role;

comment on function public.expirar_reservas_de_ia(uuid, interval) is
  'CONTENÇÃO do item 7: server-only e idade mínima de 15 minutos imposta no '
  'banco. NÃO distingue reserva não despachada de chamada despachada sem '
  'liquidação — enquanto essa distinção não existir, expirar uma reserva '
  'pode apagar custo real do razão. Ver itens 7 e 5.';
