import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CATALOGO_VERSION, capacidadesDe, custoDeReservaMicros, modeloAutorizado, podeAnalisarImagem,
  type ModelCapabilities,
} from "./catalogo";
import {
  killSwitchAtivo, liberarReserva, mensagemDeOrcamento, reservarExecucao,
  type MotivoDeRecusa, type SnapshotDePreco,
} from "./orcamento";
import { LIMITES_DE_IA, type Trecho } from "./recuperacao";

/**
 * O contrato único que toda tarefa de IA atravessa, independente de provedor.
 *
 * Nomenclatura ajustada ao briefing do piloto — `AIExecutionRequest`,
 * `AIModelCapabilities` — sobre o que já existia: `ModelCapabilities` do
 * catálogo é reaproveitada como `AIModelCapabilities`, e `Trecho` da
 * recuperação (A1) como a forma de cada fonte. Duas formas para a mesma
 * coisa seriam duas chances de divergirem.
 *
 * Este módulo NÃO chama nenhum provedor. Ele decide SE uma execução pode
 * prosseguir — catálogo, visão, orçamento — e devolve a decisão. Quem chama
 * um adaptador de verdade é uma peça futura, de quando um perfil real
 * existir; hoje nenhum existe (P1, por decisão: nenhuma chave, nenhum
 * crédito, nenhuma conexão).
 */

export type AIModelCapabilities = ModelCapabilities;

export type AITaskType = "assist" | "analyse-image" | "prompt";

export interface AIImageInput {
  mediaType: string;
  sizeBytes: number;
}

export interface AIExecutionRequest {
  workspaceId: string;
  brandId: string;
  executionId: string;
  task: AITaskType;
  question: string;
  sources: readonly Trecho[];
  image?: AIImageInput;
}

export type MotivoDeBloqueio =
  | "modelo_nao_catalogado"
  | "preco_nao_verificado"
  | "imagem_sem_preco_verificado"
  | "imagem_maior_que_o_limite_do_modelo"
  | MotivoDeRecusa
  | "erro_de_consulta";

export type DecisaoDeExecucao =
  | { pode: true; executionId: string; capabilities: AIModelCapabilities }
  | { pode: false; motivo: MotivoDeBloqueio };

/**
 * Caracteres por token — conversão grosseira, a mesma premissa (e a mesma
 * ressalva) do parecer do P0: docs/plan/parecer-piloto-qwen-p0.md §3,
 * "número sem premissa não é estimativa, é chute".
 */
const CARACTERES_POR_TOKEN = 4;

/**
 * Teto de tokens de ENTRADA por tarefa — o PIOR CASO permitido pelos
 * limites do produto (`LIMITES_DE_IA`), não uma mediana. Uma reserva
 * subestimada é o erro que este produto não aceita; superestimar é seguro
 * porque a consolidação ajusta para o custo real depois.
 */
function tetoDeTokensDeEntrada(task: AITaskType): number {
  const PROMPT_DE_SISTEMA_CARACTERES = 1_500; // mesma estimativa do P0 §3
  const base = LIMITES_DE_IA.maxCaracteresDeContexto + PROMPT_DE_SISTEMA_CARACTERES;
  const comHistorico = task === "assist"
    ? LIMITES_DE_IA.maxCaracteresDaPergunta + LIMITES_DE_IA.maxMensagens * LIMITES_DE_IA.maxCaracteresPorMensagem
    : LIMITES_DE_IA.maxCaracteresDaPergunta;
  return Math.ceil((base + comHistorico) / CARACTERES_POR_TOKEN);
}

/**
 * Teto de tokens de SAÍDA por tarefa. Sem limite de caracteres de resposta
 * no produto hoje — estes números são um teto DELIBERADAMENTE generoso
 * (maior que a mediana usada no benchmark do P0), não uma medição.
 */
function tetoDeTokensDeSaida(task: AITaskType): number {
  return task === "analyse-image" ? 2_500 : 2_000;
}

/**
 * A checagem completa, ANTES de qualquer chamada de rede custar um centavo.
 *
 * A ordem importa, e é a ordem do menor para o maior custo de verificar:
 * catálogo é leitura em memória; visão é leitura em memória; preço
 * verificado é leitura em memória; orçamento é uma escrita transacional no
 * banco. Uma imagem que o modelo recusa, ou um modelo sem preço, não
 * deveria chegar a reservar orçamento nenhum.
 *
 * `reservedMicros` não é mais parâmetro: é CALCULADO aqui, do preço
 * verificado do catálogo — um único lugar que sabe fazer essa conta, em vez
 * de cada chamador ter que adivinhar (ou inventar) um número.
 */
export async function decidirExecucao(
  supabase: SupabaseClient,
  request: AIExecutionRequest,
  perfil: { provider: string; model: string },
): Promise<DecisaoDeExecucao> {
  if (!modeloAutorizado(perfil.provider, perfil.model)) {
    return { pode: false, motivo: "modelo_nao_catalogado" };
  }

  const capabilities = capacidadesDe(perfil.provider, perfil.model);
  if (!capabilities) {
    return { pode: false, motivo: "modelo_nao_catalogado" };
  }

  if (request.image) {
    if (!podeAnalisarImagem(capabilities)) {
      return { pode: false, motivo: "imagem_sem_preco_verificado" };
    }
    if (capabilities.maxImageBytes !== undefined && request.image.sizeBytes > capabilities.maxImageBytes) {
      return { pode: false, motivo: "imagem_maior_que_o_limite_do_modelo" };
    }
  }

  if (!capabilities.pricing) {
    // Sem imagem, o portão de visão nunca roda — este é o único lugar que
    // bloqueia um modelo de TEXTO sem preço verificado.
    return { pode: false, motivo: "preco_nao_verificado" };
  }
  const pricing = capabilities.pricing;

  const priceSnapshot: SnapshotDePreco = {
    ...pricing, catalogVersion: CATALOGO_VERSION, provider: perfil.provider, model: perfil.model,
  };
  const reservedMicros = custoDeReservaMicros(pricing, {
    entrada: tetoDeTokensDeEntrada(request.task),
    saida: tetoDeTokensDeSaida(request.task),
    imagem: request.image ? pricing.maxImageTokens : undefined,
  });

  const reserva = await reservarExecucao(supabase, {
    workspaceId: request.workspaceId,
    brandId: request.brandId,
    executionId: request.executionId,
    task: request.task,
    reservedMicros,
    currency: pricing.currency,
    priceSnapshot,
  });

  if (!reserva.ok) return { pode: false, motivo: reserva.motivo };

  /*
   * Recheck final, o mais perto possível do despacho.
   *
   * A reserva acima já checou o kill switch — mas ele pode ser ligado no
   * instante entre aquela checagem e este retorno. Sem este recheck, uma
   * execução em voo nesse instante ainda seria autorizada a chamar o
   * provedor, mesmo com o botão de pausa já acionado. Se este recheck
   * bloquear, a reserva já feita é liberada: sem isso, ela ficaria presa
   * como 'reserved' até expirar por timeout, ocupando teto sem executar.
   */
  const killSwitch = await killSwitchAtivo(supabase, {
    workspaceId: request.workspaceId,
    brandId: request.brandId,
  });
  if ("erro" in killSwitch) {
    await liberarReserva(supabase, reserva.executionId);
    return { pode: false, motivo: "erro_de_consulta" };
  }
  if (killSwitch.workspace || killSwitch.marca) {
    await liberarReserva(supabase, reserva.executionId);
    return { pode: false, motivo: killSwitch.workspace ? "kill_switch_workspace" : "kill_switch_marca" };
  }

  return { pode: true, executionId: reserva.executionId, capabilities };
}

/**
 * A mensagem de PRODUTO para qualquer motivo de bloqueio — nunca o código
 * cru na tela. Os motivos de orçamento (`MotivoDeRecusa`/`erro_de_consulta`)
 * já têm mensagem própria em `mensagemDeOrcamento`; os quatro daqui são os
 * que só `decidirExecucao` produz, antes de chegar ao orçamento.
 */
export function mensagemDeBloqueio(motivo: MotivoDeBloqueio, ingles: boolean): string {
  switch (motivo) {
    case "modelo_nao_catalogado":
      return ingles
        ? "The configured model is no longer authorized. Ask whoever administers the account to choose another one in Settings."
        : "O modelo configurado não está mais autorizado. Peça a quem administra a conta para escolher outro em Configurações.";
    case "preco_nao_verificado":
      return ingles
        ? "The configured model doesn't have a confirmed price for paid use yet. Ask whoever administers the account to choose a model with verified pricing."
        : "O modelo configurado ainda não tem preço confirmado para uso pago. Peça a quem administra a conta para escolher um modelo com preço verificado.";
    case "imagem_sem_preco_verificado":
      return ingles
        ? "This model doesn't have confirmed image pricing yet. Choose a model with verified image support, or send text only."
        : "Este modelo ainda não tem custo de imagem confirmado. Escolha um modelo com suporte a imagem verificado, ou envie apenas texto.";
    case "imagem_maior_que_o_limite_do_modelo":
      return ingles
        ? "The image is larger than this model's limit."
        : "A imagem é maior que o limite deste modelo.";
    default:
      return mensagemDeOrcamento(motivo, ingles);
  }
}
