-- Cancelamento e arrependimento — 08/10/2026 (desenho aprovado pelo André no
-- mesmo dia: "pode seguir com as colunas e funções").
--
-- Os Termos (versão 2026-10-08, seção 13) prometem duas coisas que eram feitas
-- à mão:
--   * "Confirmamos o cancelamento na hora, por e-mail."
--   * "Quem cancelar em até 7 dias da primeira contratação recebe de volta o
--     valor pago, por inteiro [...] Pedimos o estorno ao Stripe imediatamente."
--
-- Decisões do André (08/10/2026):
--   * o arrependimento estorna e ENCERRA o acesso na hora (a conta fica só para
--     leitura, guardada como qualquer cancelada);
--   * vale só na PRIMEIRA assinatura de um e-mail — quem já assinou, cancelou e
--     volta não estorna sozinho (caso especial, o André estorna à mão);
--   * cancelamento por falta de pagamento não é arrependimento.
--
-- ─── Por que o banco guarda isto ─────────────────────────────────────────
--
-- O Stripe REPETE avisos, e um cancelamento gera vários (assinatura alterada,
-- depois apagada). Sem memória, o e-mail sairia três vezes e o estorno seria
-- tentado duas. A memória mora na assinatura, e cada passo tem dono:
--
--   cancelamento_pedido_em   o pedido foi percebido (o primeiro aviso vence)
--   arrependimento           decidido UMA vez, no pedido: tinha direito ao estorno?
--   estornada_em, id_externo_estorno
--                            o estorno que o Stripe fez (prova numa disputa)
--   cancelamento_avisado_em  o e-mail saiu (reservado antes de enviar)
--
-- As colunas são aditivas: nenhuma existente muda de sentido, e as assinaturas
-- antigas ficam com elas vazias.

alter table public.assinaturas
  add column cancelamento_pedido_em  timestamptz,
  add column arrependimento          boolean,
  add column estornada_em            timestamptz,
  add column id_externo_estorno      text,
  add column cancelamento_avisado_em timestamptz,
  -- O direito ao estorno é decidido junto com o pedido, e só existe com ele.
  add constraint assinaturas_arrependimento_coerente
    check ((cancelamento_pedido_em is null) = (arrependimento is null)),
  add constraint assinaturas_estorno_coerente
    check ((estornada_em is null) = (id_externo_estorno is null)),
  -- Estorno automático só no arrependimento. O estorno à mão do André fica no
  -- Stripe e não passa por aqui.
  add constraint assinaturas_estorno_so_no_arrependimento
    check (estornada_em is null or arrependimento),
  add constraint assinaturas_aviso_depois_do_pedido
    check (cancelamento_avisado_em is null or cancelamento_pedido_em is not null);

-- Um estorno do provedor é de uma assinatura só.
create unique index assinaturas_estorno_unico
  on public.assinaturas (provedor, id_externo_estorno) where id_externo_estorno is not null;

-- "Primeira assinatura deste e-mail": a consulta do arrependimento procura
-- outras assinaturas do mesmo titular.
create index assinaturas_titular_email on public.assinaturas (titular_email);

-- ─── 1. O pedido de cancelamento ──────────────────────────────────────────
--
-- Chamada a cada aviso de uma assinatura que tem conta:
--   p_pedido = true   a assinatura está cancelada ou marcada para cancelar no
--                     fim do período. Registra o pedido, se ainda não estava,
--                     e decide o arrependimento. Devolve o estado.
--   p_pedido = false  não há (mais) pedido. Quem desistiu de cancelar no
--                     Portal tem o pedido esquecido — se cancelar de novo,
--                     recebe outro e-mail. Pedido já estornado ou assinatura
--                     já cancelada não se esquece. Devolve null.
--
-- p_pedido_em é a hora do pedido segundo o provedor (`canceled_at`): o prazo
-- de 7 dias conta do pedido, não de quando o aviso chegou — um aviso que o
-- Stripe repete no dia seguinte não tira o direito de ninguém.
create function public.cobranca_pedido_de_cancelamento(
  p_provedor text,
  p_id_externo_assinatura text,
  p_pedido boolean,
  p_por_falta_de_pagamento boolean,
  p_pedido_em timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  a public.assinaturas%rowtype;
  quando timestamptz := coalesce(p_pedido_em, now());
begin
  -- A mesma trava de `cobranca_sincronizar_assinatura`: dois avisos da mesma
  -- assinatura ao mesmo tempo decidem um depois do outro.
  perform pg_advisory_xact_lock(hashtextextended('cobranca:' || p_provedor || ':' || p_id_externo_assinatura, 0));

  select * into a from public.assinaturas
   where provedor = p_provedor and id_externo_assinatura = p_id_externo_assinatura
   for update;
  if not found then
    return null;
  end if;

  if not coalesce(p_pedido, false) then
    if a.cancelamento_pedido_em is not null and a.estornada_em is null and a.situacao <> 'cancelada' then
      update public.assinaturas
         set cancelamento_pedido_em = null, arrependimento = null, cancelamento_avisado_em = null, updated_at = now()
       where id = a.id;
    end if;
    return null;
  end if;

  if a.cancelamento_pedido_em is null then
    update public.assinaturas set
      cancelamento_pedido_em = quando,
      arrependimento = not coalesce(p_por_falta_de_pagamento, false)
        and quando <= a.created_at + interval '7 days'
        and not exists (
          select 1 from public.assinaturas o
           where o.titular_email = a.titular_email and o.id <> a.id and o.created_at < a.created_at
        ),
      updated_at = now()
     where id = a.id
    returning * into a;
  end if;

  return jsonb_build_object(
    'conta', a.workspace_id,
    'nome_da_conta', (select w.name from public.workspaces w where w.id = a.workspace_id),
    'titular_email', a.titular_email,
    'situacao', a.situacao,
    'periodo_pago_ate', a.periodo_pago_ate,
    'arrependimento', a.arrependimento,
    'estornada', a.estornada_em is not null,
    'avisado', a.cancelamento_avisado_em is not null
  );
end;
$$;

-- ─── 2. O estorno feito ───────────────────────────────────────────────────
--
-- O servidor pede o estorno ao provedor e registra aqui o identificador. Só
-- assinatura com arrependimento; repetir com o MESMO estorno não é erro (o
-- aviso pode ser processado de novo depois de uma falha no meio).
create function public.cobranca_registrar_estorno(
  p_provedor text,
  p_id_externo_assinatura text,
  p_id_externo_estorno text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  a public.assinaturas%rowtype;
begin
  if btrim(coalesce(p_id_externo_estorno, '')) = '' then
    raise exception 'falta o identificador do estorno' using errcode = '22004', hint = 'cobranca_estorno_sem_id';
  end if;

  select * into a from public.assinaturas
   where provedor = p_provedor and id_externo_assinatura = p_id_externo_assinatura
   for update;
  if not found then
    raise exception 'assinatura desconhecida' using errcode = 'P0002', hint = 'cobranca_assinatura_desconhecida';
  end if;
  if a.arrependimento is not true then
    raise exception 'assinatura sem arrependimento' using errcode = '22023', hint = 'cobranca_estorno_sem_arrependimento';
  end if;
  if a.estornada_em is not null then
    if a.id_externo_estorno = btrim(p_id_externo_estorno) then
      return;
    end if;
    raise exception 'assinatura já estornada por outro estorno' using errcode = '23505', hint = 'cobranca_estorno_repetido';
  end if;

  update public.assinaturas
     set estornada_em = now(), id_externo_estorno = btrim(p_id_externo_estorno), updated_at = now()
   where id = a.id;
end;
$$;

-- ─── 3. O e-mail de cancelamento ──────────────────────────────────────────
--
-- p_reservar = true   reserva o envio: devolve true para UM chamador só (o
--                     primeiro), e false para os outros e para quem já foi
--                     avisado. Reservar ANTES de enviar é o que impede dois
--                     e-mails quando dois avisos chegam juntos.
-- p_reservar = false  devolve a reserva, quando o envio falhou — o próximo
--                     aviso tenta de novo.
create function public.cobranca_aviso_de_cancelamento(
  p_provedor text,
  p_id_externo_assinatura text,
  p_reservar boolean
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  n integer;
begin
  if coalesce(p_reservar, false) then
    update public.assinaturas
       set cancelamento_avisado_em = now(), updated_at = now()
     where provedor = p_provedor and id_externo_assinatura = p_id_externo_assinatura
       and cancelamento_pedido_em is not null and cancelamento_avisado_em is null;
  else
    update public.assinaturas
       set cancelamento_avisado_em = null, updated_at = now()
     where provedor = p_provedor and id_externo_assinatura = p_id_externo_assinatura
       and cancelamento_avisado_em is not null;
  end if;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- Só o servidor (a chave de serviço do webhook) chama. Ninguém pela sessão.
revoke all on function public.cobranca_pedido_de_cancelamento(text, text, boolean, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.cobranca_registrar_estorno(text, text, text) from public, anon, authenticated;
revoke all on function public.cobranca_aviso_de_cancelamento(text, text, boolean) from public, anon, authenticated;
grant execute on function public.cobranca_pedido_de_cancelamento(text, text, boolean, boolean, timestamptz) to service_role;
grant execute on function public.cobranca_registrar_estorno(text, text, text) to service_role;
grant execute on function public.cobranca_aviso_de_cancelamento(text, text, boolean) to service_role;
