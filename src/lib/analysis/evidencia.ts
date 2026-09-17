import { createHash } from "node:crypto";

/**
 * A impressão digital da peça analisada, e a conferência dela.
 *
 * Módulo próprio e sem nenhuma dependência de alias (`@/`): a suíte de unidade
 * compila com um tsconfig que não resolve atalhos, e uma regra que só é
 * verificável rodando a aplicação inteira não é verificável.
 */
export function fingerprintImage(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * A evidência guardada ainda é a que foi analisada?
 *
 * O relatório de conformidade baixa o arquivo do Storage e o desenha no PDF. Se
 * os bytes tiverem mudado desde a análise, o relatório mostraria uma peça que
 * NÃO é a analisada, com o veredito da outra ao lado — e um documento de
 * conformidade que afirma isso é pior do que não existir. Achado 1 do Codex
 * Security (15/09/2026), segunda metade: as policies de mutação já foram
 * fechadas por marca, e esta é a conferência do lado de quem lê.
 *
 * `image_fingerprint` é gravado no momento da análise (`persistAnalysisRun`),
 * sobre os mesmos bytes que foram ao modelo. Comparar é recomputar e igualar.
 *
 * Linha antiga sem impressão digital devolve `sem-impressao`, e não "confere":
 * ausência de prova não é prova. Quem chama decide o que dizer — e o relatório
 * diz, em vez de esconder.
 */
export type ConferenciaDaEvidencia = "confere" | "diverge" | "sem-impressao";

export function conferirEvidencia(
  impressaoGravada: string | null | undefined,
  bytes: Buffer,
): ConferenciaDaEvidencia {
  if (!impressaoGravada) return "sem-impressao";
  return fingerprintImage(bytes) === impressaoGravada ? "confere" : "diverge";
}
