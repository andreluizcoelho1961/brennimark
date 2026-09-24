/**
 * As páginas do manual que regem um item de Materiais — fatia 5.
 *
 * Quem edita a marca escolhe; a tela cita título, status e página, e o clique
 * abre o PDF ali. O banco confere a forma (até cinco, positivas); aqui se
 * confere também que a página EXISTE no manual — o que o banco não alcança,
 * porque o manual é outra tabela.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export const MAXIMO_DE_PAGINAS_DA_REGRA = 5;

export type PaginasDaRegra = { ok: true; paginas: number[] } | { ok: false; motivo: "formato" | "demais" | "fora-do-manual" };

export function normalizarPaginasDaRegra(bruto: unknown, totalDoManual: number | null): PaginasDaRegra {
  if (!Array.isArray(bruto)) return { ok: false, motivo: "formato" };
  const paginas = new Set<number>();
  for (const valor of bruto) {
    const n = typeof valor === "string" && valor.trim() !== "" ? Number(valor) : valor;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1) return { ok: false, motivo: "formato" };
    paginas.add(n);
  }
  if (paginas.size > MAXIMO_DE_PAGINAS_DA_REGRA) return { ok: false, motivo: "demais" };
  const ordenadas = [...paginas].sort((a, b) => a - b);
  // Sem manual não há página que exista — a não ser nenhuma.
  if (ordenadas.length > 0 && (totalDoManual === null || ordenadas.at(-1)! > totalDoManual)) {
    return { ok: false, motivo: "fora-do-manual" };
  }
  return { ok: true, paginas: ordenadas };
}

/** "12, 14" → [12, 14]; lixo vira lista vazia, e a validação recusa depois. */
export function lerPaginasDigitadas(texto: string): string[] {
  return texto.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
}

export type StatusDaRegra = "ready" | "draft" | "pending" | "sem-secao";

export type CitacaoDaRegra = { pagina: number; titulo: string | null; status: StatusDaRegra };
