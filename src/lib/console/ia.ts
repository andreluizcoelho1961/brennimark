import { CATALOGO, type ModeloDoCatalogo } from "../ai/catalogo";
import type { AIProvider } from "../ai/provider";

/**
 * A IA da plataforma no Console — regras puras (29/09/2026).
 *
 * O Console só oferece e só aceita modelos do CATÁLOGO com PREÇO VERIFICADO:
 * sem preço, o razão não saberia quanto cada execução custou, e o "controle
 * financeiro absoluto" deixaria de valer. Para a análise de peça, o modelo
 * ainda precisa ENXERGAR imagem.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type Tarefa = "chat" | "analysis";
export type Rota = { provider: AIProvider; model: string };

export const ESPERA_MINIMA_MS = 1_000;
export const ESPERA_MAXIMA_MS = 120_000;

export function modelosOferecidos(tarefa: Tarefa, catalogo: readonly ModeloDoCatalogo[] = CATALOGO): ModeloDoCatalogo[] {
  return catalogo.filter((m) => m.capabilities.pricing !== undefined && (tarefa === "chat" || m.capabilities.vision));
}

export type RotasLidas = { ok: true; rotas: Rota[]; esperaMs: number } | { ok: false; motivo: string };

/** Confere o pedido do Console antes de chegar ao banco. */
export function lerRotas(tarefa: unknown, rotas: unknown, esperaMs: unknown, catalogo: readonly ModeloDoCatalogo[] = CATALOGO): RotasLidas {
  if (tarefa !== "chat" && tarefa !== "analysis") return { ok: false, motivo: "Tarefa desconhecida." };
  if (!Array.isArray(rotas) || rotas.length < 1 || rotas.length > 3) return { ok: false, motivo: "Escolha de 1 a 3 modelos, em ordem." };
  const oferecidos = modelosOferecidos(tarefa, catalogo);
  const lidas: Rota[] = [];
  for (const r of rotas as { provider?: unknown; model?: unknown }[]) {
    const achado = oferecidos.find((m) => m.provider === r?.provider && m.model === r?.model);
    if (!achado) {
      return {
        ok: false,
        motivo: tarefa === "analysis"
          ? `"${String(r?.model)}" não serve à análise: precisa estar no catálogo, com preço verificado e visão.`
          : `"${String(r?.model)}" não está no catálogo com preço verificado.`,
      };
    }
    if (lidas.some((x) => x.provider === achado.provider && x.model === achado.model)) return { ok: false, motivo: "O mesmo modelo aparece duas vezes." };
    lidas.push({ provider: achado.provider, model: achado.model });
  }
  const espera = Number(esperaMs);
  if (!Number.isInteger(espera) || espera < ESPERA_MINIMA_MS || espera > ESPERA_MAXIMA_MS) {
    return { ok: false, motivo: `A espera vai de ${ESPERA_MINIMA_MS / 1000} a ${ESPERA_MAXIMA_MS / 1000} segundos.` };
  }
  return { ok: true, rotas: lidas, esperaMs: espera };
}

/** "5", "5,00", "US$ 5.5" → micros de dólar; torto → null. Teto de US$ 100.000. */
export function dolaresEmMicros(valor: unknown): number | null {
  const texto = String(valor ?? "").replace(/US\$|\s/gi, "").replace(",", ".");
  if (!/^\d+(\.\d{1,4})?$/.test(texto)) return null;
  const micros = Math.round(Number(texto) * 1_000_000);
  return micros <= 100_000 * 1_000_000 ? micros : null;
}

/** O motivo de uma mudança no Console: obrigatório, de 3 a 500 caracteres. */
export function lerMotivo(valor: unknown): string | null {
  const texto = typeof valor === "string" ? valor.trim().replace(/\s+/g, " ") : "";
  return texto.length >= 3 && texto.length <= 500 ? texto : null;
}
