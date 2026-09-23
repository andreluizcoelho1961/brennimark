/**
 * As conversas do Vini, sem banco e sem rede — fatia 4d.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export const MAX_TITULO = 120;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O título da conversa: a primeira pergunta, numa linha, com teto. */
export function tituloDaConversa(primeiraPergunta: string): string {
  const linha = primeiraPergunta.replace(/\s+/g, " ").trim();
  if (!linha) return "Conversa";
  return linha.length <= MAX_TITULO ? linha : `${linha.slice(0, MAX_TITULO - 1).trimEnd()}…`;
}

/** Identificador vindo do navegador: só vale se tem a forma de um uuid. */
export function idDeConversa(valor: unknown): string | null {
  return typeof valor === "string" && UUID.test(valor) ? valor.toLowerCase() : null;
}

/** O teto do conteúdo guardado (o banco recusa acima de 40 000). */
export function limitarConteudo(texto: string): string {
  return texto.length <= 40_000 ? texto : `${texto.slice(0, 39_999)}…`;
}
