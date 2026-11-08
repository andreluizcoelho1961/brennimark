-- ADR-0009 (08/11/2026): abrir ou trocar de plano não pode impor teto à conta da IA própria.
--
-- `private.aplicar_plano_na_conta` copia o `teto_mensal_do_vini_micros` do plano para a linha
-- mensal de `ai_budgets`, na abertura e na troca de plano. Nos planos "traga a sua IA" esse teto
-- do plano é 0 (a plataforma não paga o modelo), e 0 na linha mensal BLOQUEARIA o Vini da
-- agência. O teto dessas contas é da agência (`definir_teto_da_ia_propria`): quem entra no modo
-- próprio já teve o padrão zerado pelo gatilho `acertar_teto_no_modo_de_ia`, e uma troca entre
-- dois planos próprios preserva o que a agência definiu.
--
-- Mudança: para plano em modo `propria`, esta função não toca em `ai_budgets`. Plano da
-- plataforma segue exatamente como antes.
--
-- Reversibilidade: `create or replace` da versão de `20261001170535_cobranca` desfaz.

CREATE OR REPLACE FUNCTION private.aplicar_plano_na_conta(p_workspace_id uuid, p_plano text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  teto bigint := (select pl.teto_mensal_do_vini_micros from public.planos pl where pl.codigo = p_plano);
  modo text := (select pl.modo_de_ia from public.planos pl where pl.codigo = p_plano);
begin
  -- IA própria: o teto é da agência, não do plano.
  if modo = 'propria' then
    return;
  end if;
  /*
   * Atualizar e, se não houver, inserir — e não `on conflict`: a unicidade de
   * `ai_budgets` é (workspace_id, brand_id, period) sem NULLS NOT DISTINCT, e
   * com `brand_id` nulo o conflito nunca dispara. Um `on conflict` aqui
   * inseriria uma segunda linha mensal em silêncio.
   */
  update public.ai_budgets set limit_micros = teto, updated_at = now()
   where workspace_id = p_workspace_id and brand_id is null and period = 'monthly';
  if not found then
    insert into public.ai_budgets (workspace_id, brand_id, period, limit_micros, currency, kill_switch)
    values (p_workspace_id, null, 'monthly', teto, 'USD', false);
  end if;
end;
$function$;

revoke all on function private.aplicar_plano_na_conta(uuid, text) from public, anon, authenticated;
