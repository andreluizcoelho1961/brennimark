import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A ponte entre uma execução de IA e o orçamento — reserva, consolida, libera.
 *
 * Cada função aqui chama UMA função do banco (`reservar_execucao_de_ia`,
 * `consolidar_execucao_de_ia`, `liberar_reserva_de_ia`), e a atomicidade vive
 * lá, não aqui: duas reservas concorrentes do mesmo workspace são resolvidas
 * pelo `for update` da função, não por nenhuma lógica deste arquivo. Este
 * módulo só traduz o resultado em tipos que o resto do produto lê.
 *
 * `security invoker` não seria suficiente para a soma que a reserva faz — ela
 * precisa somar o consumo do workspace inteiro, e `member` não tem SELECT
 * direto em `ai_ledger`. Por isso as funções do banco são `security definer`
 * com a checagem de participação DENTRO delas, no lugar da RLS que contornam.
 */

export type MotivoDeRecusa =
  | "kill_switch_workspace"
  | "kill_switch_marca"
  | "sem_orcamento_configurado"
  | "orcamento_do_workspace_esgotado"
  | "orcamento_da_marca_esgotado";

export type ResultadoDaReserva =
  | { ok: true; executionId: string; jaExistia: boolean }
  | { ok: false; motivo: MotivoDeRecusa | "erro_de_consulta" };

/**
 * Reserva o custo estimado ANTES de chamar o provedor.
 *
 * `executionId` é gerado por quem chama (o cliente da execução, não o
 * usuário do navegador) e precisa ser o MESMO em qualquer nova tentativa da
 * mesma pergunta — é isso que torna um retry seguro: reenviar não reserva
 * duas vezes, `reservado` e `ja_reservado` levam à mesma resposta adiante.
 *
 * `reservedMicros` é o TETO estimado, não o custo real — superestimar aqui é
 * seguro (reserva de mais, libera a diferença na consolidação); subestimar
 * não é, porque a chamada pode sair mais cara do que o orçamento permitia.
 */
export async function reservarExecucao(
  supabase: SupabaseClient,
  params: {
    workspaceId: string;
    brandId: string | null;
    executionId: string;
    task: "assist" | "analyse-image" | "prompt";
    reservedMicros: number;
    currency: string;
  },
): Promise<ResultadoDaReserva> {
  const { data, error } = await supabase.rpc("reservar_execucao_de_ia", {
    p_workspace_id: params.workspaceId,
    p_brand_id: params.brandId,
    p_execution_id: params.executionId,
    p_task: params.task,
    p_reserved_micros: params.reservedMicros,
    p_currency: params.currency,
  });

  if (error) {
    // Falha ao CONSULTAR orçamento não é a mesma coisa que "sem orçamento": é
    // "não sei". A regra do briefing é fechar nos dois casos — nenhuma chamada
    // paga acontece quando o orçamento não pôde ser confirmado.
    console.error(JSON.stringify({ level: "error", msg: "reserva_de_orcamento_falhou", code: error.code }));
    return { ok: false, motivo: "erro_de_consulta" };
  }

  const linha = data?.[0];
  if (!linha?.ok) return { ok: false, motivo: (linha?.motivo ?? "erro_de_consulta") as MotivoDeRecusa };
  return { ok: true, executionId: linha.execution_id, jaExistia: linha.motivo === "ja_reservado" };
}

/**
 * Ajusta a reserva para o custo REAL, depois que o provedor responde.
 *
 * O valor estimado na reserva quase nunca bate: o consumo de tokens só se
 * sabe depois da resposta. Chamar duas vezes para a mesma execução é
 * inofensivo — a função do banco ignora silenciosamente a segunda chamada,
 * porque um retry de rede depois de já ter consolidado não deveria derrubar
 * uma resposta que a pessoa já recebeu.
 */
export async function consolidarExecucao(
  supabase: SupabaseClient,
  params: { executionId: string; settledMicros: number; provider: string; model: string },
): Promise<void> {
  const { error } = await supabase.rpc("consolidar_execucao_de_ia", {
    p_execution_id: params.executionId,
    p_settled_micros: params.settledMicros,
    p_provider: params.provider,
    p_model: params.model,
  });
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "consolidacao_de_orcamento_falhou", code: error.code }));
  }
}

/**
 * Libera a reserva quando a execução NÃO produziu uso cobrável — timeout,
 * erro do provedor, cancelamento.
 *
 * Sem isto, toda falha continuaria contando contra o orçamento como se
 * tivesse sido bem-sucedida, e uma sequência de falhas esgotaria o teto sem
 * ninguém ter recebido resposta nenhuma.
 */
export async function liberarReserva(
  supabase: SupabaseClient,
  executionId: string,
): Promise<void> {
  const { error } = await supabase.rpc("liberar_reserva_de_ia", { p_execution_id: executionId });
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "liberacao_de_reserva_falhou", code: error.code }));
  }
}

/**
 * A mensagem de PRODUTO para cada motivo de recusa — nunca o código cru na
 * tela. "Erro_de_consulta" e "sem_orcamento_configurado" recebem a MESMA
 * frase de propósito: a diferença entre "não configurado" e "não consultável"
 * não ajuda quem lê, e as duas pedem a mesma ação — falar com quem administra.
 */
export function mensagemDeOrcamento(
  motivo: MotivoDeRecusa | "erro_de_consulta",
  ingles: boolean,
): string {
  if (motivo === "kill_switch_workspace" || motivo === "kill_switch_marca") {
    return ingles
      ? "AI usage for this account is currently paused. Ask whoever administers the account."
      : "O uso de IA desta conta está pausado no momento. Peça a quem administra a conta.";
  }
  return ingles
    ? "This account's AI usage isn't configured or doesn't have demonstration budget available. Ask whoever administers the account to check the settings."
    : "A IA desta conta ainda não está configurada ou não possui saldo de demonstração disponível. Peça a quem administra a conta para verificar as configurações.";
}
