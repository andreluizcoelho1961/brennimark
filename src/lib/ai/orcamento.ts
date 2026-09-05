import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModelPricing } from "./catalogo";

/**
 * O preço vigente NO MOMENTO da reserva, gravado uma vez e nunca reescrito —
 * ver a migração do ledger (`price_snapshot`) para o porquê. `ModelPricing`
 * já é o preço verificado do catálogo; aqui só soma provider/model/versão,
 * que o catálogo não carrega junto (são do PAR escolhido, não do preço em
 * si) — reaproveitar o tipo evita duas formas do mesmo preço divergirem.
 */
export type SnapshotDePreco = ModelPricing & { catalogVersion: string; provider: string; model: string };

/**
 * Tokens/unidades REALMENTE medidos pelo provedor, gravados na
 * consolidação. `unknown: true` é o caso conservador: o despacho
 * aconteceu, mas nenhum uso confiável ficou disponível (cancelamento,
 * queda de streaming, falha depois do despacho) — `settledMicros` nesse
 * caso é o TETO reservado, não uma medição, e a linha fica marcada para
 * reconciliação manual se o provedor publicar uso tardio. Nunca convive
 * com os campos de token: ou o uso é conhecido, ou é `unknown`.
 */
export type SnapshotDeUso =
  | { inputTokens?: number; cachedInputTokens?: number; outputTokens?: number; imageTokens?: number; unknown?: false }
  | { unknown: true };

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
 *
 * Achado da revisão de segurança pós-P2A (P0-2): as três mutações
 * FINANCEIRAS — `reservarExecucao`, `consolidarExecucao`, `liberarReserva`
 * — não recebem mais o `supabase` da SESSÃO DO USUÁRIO. Antes, `security
 * definer` + `grant ... to authenticated` significava que qualquer membro
 * do workspace podia chamar a RPC direto pela Data API, escolhendo
 * `reserved_micros`/preço/moeda por conta própria — nada validava esses
 * números contra o catálogo antes de aceitar.
 *
 * Agora o primeiro parâmetro das três é `serviceClient` — um cliente
 * criado por `createServiceClient()` (`src/lib/supabase/service.ts`, chave
 * secreta `sb_secret_...`, nunca a legacy `service_role`), que só as
 * ROTAS constroem (o módulo é `import "server-only"`, e não pode ser
 * importado por este arquivo sem quebrar o runner de teste — ver o
 * comentário no topo de `service.ts`). `userId` é o segundo parâmetro,
 * resolvido pelo CHAMADOR a partir de uma sessão já validada
 * (`supabase.auth.getUser()`), nunca do corpo da requisição — as RPCs
 * `_server` do banco confiam nesse valor porque só quem tem a chave de
 * serviço consegue chamá-las.
 *
 * `killSwitchAtivo`/`expirarReservasAntigas` continuam com o `supabase` DA
 * SESSÃO do usuário, sem mudança — nenhuma das duas aceita valor
 * financeiro do chamador, e a checagem de participação nelas já vem da
 * RLS normal.
 */

export type MotivoDeRecusa =
  | "kill_switch_workspace"
  | "kill_switch_marca"
  | "sem_orcamento_configurado"
  | "orcamento_do_workspace_esgotado"
  | "orcamento_da_marca_esgotado";

/** O estado do LEDGER para esta execução — não confundir com o resultado da chamada. */
export type StatusDaExecucao = "reserved" | "settled" | "released";

export type ResultadoDaReserva =
  | { ok: true; executionId: string; jaExistia: boolean; status: StatusDaExecucao }
  | { ok: false; motivo: MotivoDeRecusa | "erro_de_consulta" };

/**
 * Reserva o custo estimado ANTES de chamar o provedor.
 *
 * `executionId` é gerado por quem chama (o cliente da execução, não o
 * usuário do navegador) e precisa ser o MESMO em qualquer nova tentativa da
 * mesma pergunta — é isso que torna um retry seguro de CONSULTAR de novo.
 *
 * Reenviar não reserva duas vezes — mas `jaExistia: true` NÃO é autorização
 * para despachar de novo: é quem chama (`decidirExecucao`) que decide o que
 * fazer com um `execution_id` repetido, olhando o `status` devolvido. Uma
 * reserva que já existe pode estar em voo (`reserved` — outra tentativa
 * pode estar despachando agora) ou já ter terminado (`settled`/`released`)
 * — nos dois casos, despachar de NOVO seria uma segunda chamada paga sem
 * reserva nova cobrindo ela. Esta função só traduz o que o banco devolveu;
 * não decide se é seguro prosseguir.
 *
 * `reservedMicros` é o TETO estimado, não o custo real — superestimar aqui é
 * seguro (reserva de mais, libera a diferença na consolidação); subestimar
 * não é, porque a chamada pode sair mais cara do que o orçamento permitia.
 */
export async function reservarExecucao(
  /** O cliente de serviço (`createServiceClient()`) — nunca a sessão do usuário. */
  serviceClient: SupabaseClient,
  userId: string,
  params: {
    workspaceId: string;
    brandId: string | null;
    executionId: string;
    task: "assist" | "analyse-image" | "prompt";
    reservedMicros: number;
    currency: string;
    priceSnapshot: SnapshotDePreco;
  },
): Promise<ResultadoDaReserva> {
  const { data, error } = await serviceClient.rpc("reservar_execucao_de_ia_server", {
    p_user_id: userId,
    p_workspace_id: params.workspaceId,
    p_brand_id: params.brandId,
    p_execution_id: params.executionId,
    p_task: params.task,
    p_reserved_micros: params.reservedMicros,
    p_currency: params.currency,
    p_price_snapshot: params.priceSnapshot,
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
  return {
    ok: true, executionId: linha.execution_id, jaExistia: linha.motivo === "ja_reservado",
    status: linha.status as StatusDaExecucao,
  };
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
  serviceClient: SupabaseClient,
  userId: string,
  params: {
    executionId: string; settledMicros: number; provider: string; model: string;
    usageSnapshot?: SnapshotDeUso;
  },
): Promise<void> {
  const { error } = await serviceClient.rpc("consolidar_execucao_de_ia_server", {
    p_user_id: userId,
    p_execution_id: params.executionId,
    p_settled_micros: params.settledMicros,
    p_provider: params.provider,
    p_model: params.model,
    p_usage_snapshot: params.usageSnapshot ?? null,
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
  serviceClient: SupabaseClient,
  userId: string,
  executionId: string,
): Promise<void> {
  const { error } = await serviceClient.rpc("liberar_reserva_de_ia_server", {
    p_user_id: userId,
    p_execution_id: executionId,
  });
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
/**
 * Lê o kill switch sem precisar de SELECT direto em `ai_budgets` (RLS ali é
 * owner-only) — `kill_switch_ativo` é `security definer` e devolve só os
 * dois booleanos, nada mais da linha de orçamento.
 *
 * Existe para o recheck de `decidirExecucao` IMEDIATAMENTE antes de liberar
 * a execução: a reserva já checou o kill switch no início da mesma chamada,
 * mas nada impede que ele seja ligado no instante entre a reserva e o
 * retorno de `decidirExecucao`. A janela não fecha de vez — só encolhe ao
 * mínimo que este processo consegue garantir sem uma trava distribuída.
 */
export async function killSwitchAtivo(
  supabase: SupabaseClient,
  params: { workspaceId: string; brandId: string | null },
): Promise<{ workspace: boolean; marca: boolean } | { erro: true }> {
  const { data, error } = await supabase.rpc("kill_switch_ativo", {
    p_workspace_id: params.workspaceId,
    p_brand_id: params.brandId,
  });
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "kill_switch_ativo_falhou", code: error.code }));
    return { erro: true };
  }
  const linha = data?.[0];
  return { workspace: Boolean(linha?.workspace), marca: Boolean(linha?.marca) };
}

/**
 * O piso do limiar de expiração, em minutos.
 *
 * Espelha `expirar_reservas_de_ia` na migração de contenção. A garantia é do
 * BANCO: a função é `security definer` e alcançável pela Data API, então uma
 * guarda que só existisse aqui estaria do lado errado da fronteira que ela
 * pretende proteger. Este valor existe para falhar cedo e com mensagem
 * legível, e para que afrouxar o limiar exija mexer nos dois lugares.
 */
/**
 * Marca que o pedido vai ser despachado e portanto pode gerar cobrança.
 *
 * Chamada ANTES do despacho, e o resultado decide se ele acontece. Falhar aqui
 * aborta a execução de propósito: produzir custo que o razão não conhece é
 * pior do que derrubar uma resposta. É a mesma escolha conservadora que o
 * executor já faz em toda decisão de dinheiro.
 *
 * `false` significa que a reserva já não está reservada — alguém liquidou ou
 * liberou — e nesse caso despachar geraria custo sem reserva.
 */
export async function marcarExposicaoDeCobranca(
  serviceClient: SupabaseClient,
  params: { userId: string; executionId: string },
): Promise<{ exposta: boolean } | { erro: true }> {
  const { data, error } = await serviceClient.rpc("marcar_exposicao_de_cobranca_server", {
    p_user_id: params.userId,
    p_execution_id: params.executionId,
  });
  if (error) {
    console.error(JSON.stringify({
      level: "error", msg: "marcar_exposicao_de_cobranca_falhou", code: error.code,
    }));
    return { erro: true };
  }
  return { exposta: data === true };
}

export const MINIMO_DE_EXPIRACAO_EM_MINUTOS = 15;

/**
 * Libera reservas abandonadas (mais velhas que o limiar) de um workspace —
 * ver `expirar_reservas_de_ia` na migração para o porquê do limiar e o risco
 * aceito de uma consolidação tardia virar no-op.
 *
 * **Contenção, não fechamento.** Passados os 15 minutos, o razão continua sem
 * distinguir reserva nunca despachada (que pode ser liberada) de chamada
 * despachada cuja liquidação falhou (que não pode virar zero). Enquanto essa
 * distinção não existir, expirar pode apagar custo real — ver itens 7 e 5.
 */
export async function expirarReservasAntigas(
  supabase: SupabaseClient,
  params: { workspaceId: string; maisVelhaQueMinutos?: number },
): Promise<{ liberadas: number; liquidadasConservador: number } | { erro: true }> {
  const minutos = params.maisVelhaQueMinutos ?? MINIMO_DE_EXPIRACAO_EM_MINUTOS;
  if (!Number.isFinite(minutos) || minutos < MINIMO_DE_EXPIRACAO_EM_MINUTOS) {
    console.error(JSON.stringify({
      level: "error", msg: "expirar_reservas_limiar_abaixo_do_minimo",
      minimo: MINIMO_DE_EXPIRACAO_EM_MINUTOS, recebido: minutos,
    }));
    return { erro: true };
  }
  const { data, error } = await supabase.rpc("expirar_reservas_de_ia", {
    p_workspace_id: params.workspaceId,
    p_mais_velha_que: `${minutos} minutes`,
  });
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "expirar_reservas_falhou", code: error.code }));
    return { erro: true };
  }
  /*
   * O banco devolve as DUAS contagens porque uma expiração que libera algumas
   * linhas e liquida outras precisa dizer isso. Somá-las aqui — ou ler só a
   * primeira — reconstruiria exatamente a cegueira que a coluna
   * `charge_exposed_at` existe para acabar.
   */
  const resultado = (data ?? {}) as { liberadas?: number; liquidadas_conservador?: number };
  return {
    liberadas: resultado.liberadas ?? 0,
    liquidadasConservador: resultado.liquidadas_conservador ?? 0,
  };
}

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
