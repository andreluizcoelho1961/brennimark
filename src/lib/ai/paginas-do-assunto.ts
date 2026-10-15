import type { Trecho } from "./recuperacao";

/**
 * As páginas do manual onde um ASSUNTO é tratado (15/10/2026) — para a IA
 * ler só elas (tipografia, grid, regras do logo).
 *
 * A versão anterior pegava as primeiras páginas que CITAVAM o termo. Num
 * manual com menu lateral repetido em toda página (o da Bradesco: "Logos ·
 * Versões · Tipografia · Grid…"), isso eram as páginas 1, 4, 5 e 6 — e a
 * tipografia de verdade, na 17, ficava de fora. A IA leu as páginas erradas e
 * respondeu, certa, que não havia tipografia ali.
 *
 * Agora cada página ganha nota:
 *   - o termo como TÍTULO (na seção, ou abrindo o texto da página) vale mais;
 *   - depois, quantas vezes o termo aparece.
 * Quando o termo aparece em mais da metade das páginas, ele é navegação, e a
 * página que só o cita uma vez, sem título, sai.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

/**
 * O termo é menu, não assunto, quando aparece em mais da metade das páginas e
 * em pelo menos seis delas (um manual de verdade; trecho solto não é menu).
 */
const FRACAO_DE_MENU = 0.5;
const PAGINAS_DE_MENU = 6;

export function paginasDoAssunto(trechos: readonly Trecho[], termos: RegExp, maximo: number): number[] {
  const unico = new RegExp(termos.source, termos.flags.replace("g", ""));
  const global = new RegExp(termos.source, `${unico.flags}g`);
  // O título da página vem no começo do texto extraído ("Tipografia A Marca…").
  const noComeco = new RegExp(`^(?:${termos.source})`, unico.flags);
  const doManual = trechos.filter((t) => t.pageStart !== null && t.origem !== "complemento");
  const todas = new Set(doManual.map((t) => t.pageStart!));
  const nota = new Map<number, { titulo: boolean; vezes: number }>();
  for (const t of doManual) {
    const vezes = (`${t.section ?? ""} ${t.content}`.match(global) ?? []).length;
    if (vezes === 0) continue;
    const titulo = unico.test(t.section ?? "") || noComeco.test(t.content.trimStart());
    const atual = nota.get(t.pageStart!) ?? { titulo: false, vezes: 0 };
    nota.set(t.pageStart!, { titulo: atual.titulo || titulo, vezes: atual.vezes + vezes });
  }
  const menu = nota.size >= PAGINAS_DE_MENU && nota.size / todas.size > FRACAO_DE_MENU;
  // Com menu, a página de título é a prova do assunto: havendo alguma, só elas
  // vão (no manual da Bradesco, quatro páginas citavam "fonte" duas vezes por
  // acaso e tomariam a vaga). Sem título, a que cita mais de uma vez.
  const temTitulo = [...nota.values()].some((n) => n.titulo);
  return [...nota.entries()]
    .filter(([, n]) => !menu || n.titulo || (!temTitulo && n.vezes >= 2))
    .sort(([pa, a], [pb, b]) => Number(b.titulo) - Number(a.titulo) || b.vezes - a.vezes || pa - pb)
    .slice(0, maximo)
    .map(([p]) => p)
    .sort((a, b) => a - b);
}
