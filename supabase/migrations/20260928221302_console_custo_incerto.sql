-- O Console separa o custo MEDIDO do INCERTO — 28/09/2026.
--
-- ─── Por quê ────────────────────────────────────────────────────────────────
--
-- O primeiro olhar do André no Console mostrou 12 de 47 execuções liquidadas
-- pelo TETO da reserva — US$ 1,60 de US$ 1,79 no mês — porque o provedor não
-- informou tokens. Duas causas, corrigidas no código na mesma data:
--   - recusa do provedor sem processar (503, 429…) passa a custar ZERO,
--     medido, com o status registrado (`recusadoPeloProvedor`);
--   - fluxo que termina sem motivo do provedor passa a valer o teto, com a
--     razão registrada (`fluxoSemFim`), em vez de aceitar um uso parcial.
--
-- O que sobra de incerto continua pelo teto — é a regra de dinheiro: nunca
-- contar a menos. Mas a contabilidade precisa VER a diferença: custo medido
-- é fato; custo incerto é teto, a conciliar com a fatura do provedor.
--
-- O histórico não se reescreve: as 12 execuções antigas continuam como foram
-- liquidadas, e aparecem como incertas.
--
-- A assinatura da função muda (colunas novas), e `create or replace` não troca
-- o tipo de retorno — daí o `drop`. Permissões refeitas iguais às de antes.

drop function public.console_custos_de_ia(timestamptz, timestamptz);

create function public.console_custos_de_ia(p_inicio timestamptz, p_fim timestamptz)
returns table (
  workspace_id uuid, conta text, brand_id uuid, marca text,
  provider text, model text, currency text,
  execucoes integer, tokens_entrada bigint, tokens_saida bigint,
  custo_micros bigint, sem_uso_medido integer,
  custo_incerto_micros bigint, recusadas integer
)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  return query
    select l.workspace_id, w.name, l.brand_id, b.name,
           l.provider, l.model, l.currency,
           count(*)::integer,
           coalesce(sum((l.usage_snapshot->>'inputTokens')::bigint), 0)::bigint,
           coalesce(sum((l.usage_snapshot->>'outputTokens')::bigint), 0)::bigint,
           coalesce(sum(l.settled_micros), 0)::bigint,
           count(*) filter (where l.usage_snapshot ? 'unknown' or not (l.usage_snapshot ? 'inputTokens'))::integer,
           coalesce(sum(l.settled_micros) filter (where l.usage_snapshot ? 'unknown' or not (l.usage_snapshot ? 'inputTokens')), 0)::bigint,
           count(*) filter (where l.usage_snapshot ? 'recusadoPeloProvedor')::integer
      from public.ai_ledger l
      join public.workspaces w on w.id = l.workspace_id
      left join public.brands b on b.id = l.brand_id
     where l.status = 'settled'
       and l.created_at >= p_inicio and l.created_at < p_fim
     group by l.workspace_id, w.name, l.brand_id, b.name, l.provider, l.model, l.currency;
end;
$$;

revoke all on function public.console_custos_de_ia(timestamptz, timestamptz) from public, anon;
grant execute on function public.console_custos_de_ia(timestamptz, timestamptz) to authenticated;
