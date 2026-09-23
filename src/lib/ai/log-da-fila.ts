import { classifyAIError } from "./errors";

/**
 * O que a fila de IAs deixa no log quando troca de IA — sem o texto, que é
 * conversa de cliente. É a medida que diz se a reserva está servindo: quantas
 * vezes a principal falhou, por quê, e se a reserva foi recusada antes de
 * tentar (orçamento, pausa, modelo sem preço).
 */
type Tentativa = { config: { provider: string; model: string } };

export function registrarFalhaNaFila(rota: string, executionId: string) {
  return (attempt: Tentativa, indice: number, erro: unknown) => {
    const raiz = erro instanceof AggregateError ? (erro.errors.at(-1) ?? erro) : erro;
    console.warn(JSON.stringify({
      level: "warn", msg: "ai_tentativa_falhou", rota, indice,
      provider: attempt.config.provider, model: attempt.config.model,
      code: classifyAIError(raiz).code, executionId,
    }));
  };
}

export function registrarReservaRecusada(rota: string, executionId: string) {
  return (attempt: Tentativa, indice: number, motivo: string) => {
    console.warn(JSON.stringify({
      level: "warn", msg: "ai_reserva_recusada", rota, indice,
      provider: attempt.config.provider, model: attempt.config.model, motivo, executionId,
    }));
  };
}
