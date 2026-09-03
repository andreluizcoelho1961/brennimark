import type { SupabaseClient } from "@supabase/supabase-js";
import { capacidadesDe, modeloAutorizado, podeAnalisarImagem, type ModelCapabilities } from "./catalogo";
import { killSwitchAtivo, liberarReserva, reservarExecucao, type MotivoDeRecusa } from "./orcamento";
import type { Trecho } from "./recuperacao";

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
  | "imagem_sem_preco_verificado"
  | "imagem_maior_que_o_limite_do_modelo"
  | MotivoDeRecusa
  | "erro_de_consulta";

export type DecisaoDeExecucao =
  | { pode: true; executionId: string; capabilities: AIModelCapabilities }
  | { pode: false; motivo: MotivoDeBloqueio };

/**
 * A checagem completa, ANTES de qualquer chamada de rede custar um centavo.
 *
 * A ordem importa, e é a ordem do menor para o maior custo de verificar:
 * catálogo é leitura em memória; visão é leitura em memória; orçamento é uma
 * escrita transacional no banco. Uma imagem que o modelo recusa não deveria
 * chegar a reservar orçamento nenhum.
 */
export async function decidirExecucao(
  supabase: SupabaseClient,
  request: AIExecutionRequest,
  perfil: { provider: string; model: string },
  reservedMicros: number,
  currency: string,
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

  const reserva = await reservarExecucao(supabase, {
    workspaceId: request.workspaceId,
    brandId: request.brandId,
    executionId: request.executionId,
    task: request.task,
    reservedMicros,
    currency,
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
