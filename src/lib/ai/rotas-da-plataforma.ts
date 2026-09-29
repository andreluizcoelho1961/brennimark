import { modeloAutorizado } from "./catalogo";
import { chaveDaPlataforma } from "./chaves-da-plataforma";
import type { AIProvider, AIProviderConfig, AIRoutingFeature } from "./provider";

/**
 * As rotas de IA da PLATAFORMA — etapa 2 do Console, parte 2 (29/09/2026).
 *
 * Decisão do André (28/09): a IA é da Brennimark. O modelo de cada tarefa, a
 * ordem das reservas e a espera pelo primeiro trecho vêm do Console
 * (`rotas_de_ia_da_plataforma()`, só a chave de serviço lê); a chave de cada
 * provedor vem da Vercel (`chaves-da-plataforma.ts`). A tabela `ai_settings`,
 * de quando cada conta trazia a sua chave, não entra mais aqui.
 *
 * Esta é a parte pura: recebe as linhas do banco e o ambiente, devolve as
 * tentativas. Uma rota sem chave, ou com modelo fora do catálogo, é DESCARTADA
 * e dita (`descartadas`), para o log do servidor apontar o motivo — o Vini
 * segue pela próxima reserva, e sem nenhuma o chamador mostra a mensagem de
 * "indisponível" (`semProvedorConfigurado`).
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type LinhaDeRota = {
  tarefa: string;
  ordem: number;
  provider: string;
  model: string;
  espera_ms: number;
};

export type TentativaDaPlataforma = { config: AIProviderConfig; isDemo: false };

export type RotasDaPlataforma = {
  attempts: TentativaDaPlataforma[];
  timeoutMs: number;
  /** As reservas podem ser de outro provedor: é a Brennimark que escolhe e paga. */
  allowCrossProvider: true;
  descartadas: { provider: string; model: string; motivo: "sem-chave" | "fora-do-catalogo" }[];
};

/** Se o Console não disser, a espera que vigorava antes dele. */
export const ESPERA_PADRAO_MS: Record<AIRoutingFeature, number> = { chat: 20_000, analysis: 30_000 };

export function montarRotas(
  linhas: readonly LinhaDeRota[],
  tarefa: AIRoutingFeature,
  ambiente: Record<string, string | undefined> = process.env,
): RotasDaPlataforma {
  const daTarefa = linhas.filter((l) => l.tarefa === tarefa).sort((a, b) => a.ordem - b.ordem);
  const attempts: TentativaDaPlataforma[] = [];
  const descartadas: RotasDaPlataforma["descartadas"] = [];

  for (const { provider, model } of daTarefa) {
    // O catálogo é conferido NA HORA: um modelo descatalogado depois de
    // escolhido no Console não volta a ser usado por inércia.
    if (!modeloAutorizado(provider, model)) {
      descartadas.push({ provider, model, motivo: "fora-do-catalogo" });
      continue;
    }
    const apiKey = chaveDaPlataforma(provider as AIProvider, ambiente);
    if (!apiKey) {
      descartadas.push({ provider, model, motivo: "sem-chave" });
      continue;
    }
    attempts.push({ config: { provider: provider as AIProvider, model, apiKey }, isDemo: false });
  }

  return {
    attempts,
    timeoutMs: daTarefa[0]?.espera_ms ?? ESPERA_PADRAO_MS[tarefa],
    allowCrossProvider: true,
    descartadas,
  };
}
