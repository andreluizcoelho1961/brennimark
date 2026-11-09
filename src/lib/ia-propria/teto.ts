/**
 * O teto de gasto da IA própria (ADR-0009, 08/11/2026). Dólares na tela, micros no banco
 * (1 dólar = 1.000.000 micros, a mesma unidade do razão).
 */

const MICROS_POR_DOLAR = 1_000_000;
const MAXIMO_EM_DOLARES = 1_000_000;

/**
 * Converte o que a tela mandou. Vazio, nulo ou texto em branco = SEM TETO (nulo). Número
 * positivo até um milhão de dólares vira micros inteiros. Qualquer outra coisa é inválida:
 * negativo, zero, texto, NaN, infinito.
 */
export function dolaresParaMicros(valor: unknown): number | null | "invalido" {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "string") {
    const limpo = valor.trim().replace(",", ".");
    if (limpo === "") return null;
    return dolaresParaMicros(Number(limpo));
  }
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "invalido";
  if (valor <= 0 || valor > MAXIMO_EM_DOLARES) return "invalido";
  return Math.round(valor * MICROS_POR_DOLAR);
}

export function microsParaDolares(micros: number | null): number | null {
  return micros === null ? null : micros / MICROS_POR_DOLAR;
}

/**
 * Quantas perguntas cabem num valor, pela média do que a conta já gastou. Com menos de cinco
 * perguntas no mês a média não diz nada e usa-se a estimativa medida em 08/11/2026 (Haiku 4.5
 * lendo um manual de 40 mil tokens: cerca de US$ 0,02 por pergunta). `estimativa` avisa a tela.
 */
export function perguntasQueCabem(valorEmDolares: number, gastoNoMesEmDolares: number, perguntasNoMes: number): { quantas: number; estimativa: boolean } {
  const usaMedia = perguntasNoMes >= 5 && gastoNoMesEmDolares > 0;
  const porPergunta = usaMedia ? gastoNoMesEmDolares / perguntasNoMes : 0.02;
  return { quantas: Math.max(0, Math.floor(valorEmDolares / porPergunta)), estimativa: !usaMedia };
}
