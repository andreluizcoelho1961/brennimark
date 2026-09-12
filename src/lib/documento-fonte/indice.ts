/**
 * O índice do manual — qual fonte usar, e o que descartar de cada uma.
 *
 * ─── Medido antes de desenhar (12/09/2026, 30 manuais reais) ────────────────
 *
 * Só **7 dos 30** trazem marcadores. A premissa inicial da fatia era que o
 * sumário do PDF seria a fonte primária; na prática, em 3 de cada 4 manuais o
 * índice tem de vir de outro lugar. Por isso este módulo não escolhe "a"
 * fonte: ele recebe as duas e decide, com regra escrita, qual entregar.
 *
 * E "ter marcador" não é o mesmo que "ter índice bom". A amostra mostrou os
 * três defeitos que a regra abaixo existe para filtrar:
 *
 *   Shell     4 marcadores para 37 páginas, chamados "SECTION 1" e "SECTION 2"
 *             — pior que as seções extraídas, que ao menos citam o assunto
 *   Natura    117 marcadores, com o topo genérico "Seção Padrão"
 *   GE        592 marcadores em 7 níveis, e 5 deles com destino que NÃO resolve
 *
 * A regra é deliberadamente conservadora: na dúvida, prefere as seções
 * extraídas. Um índice ruim é pior que um índice modesto, porque ele parece
 * ser do estúdio e não é.
 */

export interface ItemDeIndice {
  titulo: string;
  /** Página de destino, 1-based. */
  pagina: number;
  /** 1 ou 2. Ver `PROFUNDIDADE_MAXIMA`. */
  nivel: 1 | 2;
}

/** Marcador já resolvido pelo chamador: o PDF.js resolve destino de forma
 *  assíncrona, e regra que exige `await` não se testa sem navegador. */
export interface MarcadorResolvido {
  titulo: string;
  /** `null` quando o destino não resolve — acontece de verdade (GE: 5 de 592). */
  pagina: number | null;
  nivel: number;
  }

/**
 * Dois níveis, e não os oito que a GE traz.
 *
 * A árvore de 7 níveis da GE, numa coluna de 224px, vira escada de indentação
 * ilegível; e o terceiro nível de um manual costuma ser a regra específica,
 * que é o que a busca resolve melhor que a navegação.
 */
export const PROFUNDIDADE_MAXIMA = 2;

/** Abaixo disto, o "índice" não orienta ninguém e as seções extraídas servem
 *  melhor. Shell tem 4 marcadores, mas todos genéricos — cai antes daqui. */
export const MINIMO_DE_ITENS = 3;

/**
 * Título que não diz nada sobre o conteúdo.
 *
 * Cada padrão veio de um manual real: "SECTION 1" (Shell), "Seção Padrão"
 * (Natura), numeração solta e "Página 12" — que é o mesmo defeito que a
 * heurística de extração comete quando não consegue nomear.
 */
const GENERICOS = [
  /^se[cç][ãa]o\s*(padr[ãa]o|\d+)?$/i,
  /^section\s*\d*$/i,
  /^p[áa]g(ina)?s?\.?\s*[\d–—-]+$/i,
  /^page\s*\d+$/i,
  /^cap[íi]tulo\s*\d*$/i,
  /^chapter\s*\d*$/i,
  /^[\d\s.,–—-]+$/,
  /^(sum[áa]rio|[ií]ndice|contents?|table of contents)$/i,
];

export function ehTituloGenerico(titulo: string): boolean {
  const limpo = titulo.replace(/\s+/g, " ").trim();
  if (limpo.length < 2) return true;
  return GENERICOS.some((padrao) => padrao.test(limpo));
}

/**
 * Limpa a árvore de marcadores e diz se ela serve.
 *
 * Descarta, nesta ordem: destino que não resolve, título genérico, e tudo
 * abaixo do segundo nível. O que sobra é o índice; se sobrar pouco, devolve
 * `null` e o chamador usa as seções extraídas.
 */
export function indiceDosMarcadores(
  marcadores: readonly MarcadorResolvido[],
): ItemDeIndice[] | null {
  const limpos = marcadores
    .filter((m) => m.pagina !== null && m.pagina > 0)
    .filter((m) => !ehTituloGenerico(m.titulo))
    .filter((m) => m.nivel <= PROFUNDIDADE_MAXIMA)
    .map((m) => ({
      titulo: m.titulo.replace(/\s+/g, " ").trim(),
      pagina: m.pagina as number,
      nivel: (m.nivel <= 1 ? 1 : 2) as 1 | 2,
    }));

  return limpos.length >= MINIMO_DE_ITENS ? limpos : null;
}

/** Uma seção extraída, como o importador a gravou. */
export interface SecaoExtraida {
  titulo: string;
  /** Primeira página da seção, 1-based. */
  pagina: number;
}

/**
 * O plano B, que na prática é o caminho de 3 em cada 4 manuais.
 *
 * As seções extraídas já vêm com faixa de páginas. O que este passo faz é
 * aplicar o MESMO filtro de título genérico dos marcadores: hoje a heurística
 * nomeia "Páginas 9–16" quando não consegue nomear, e esse rótulo na coluna
 * não ajuda ninguém a achar nada. Ele sai da navegação — a página continua
 * alcançável pelo próprio documento e pela busca.
 */
export function indiceDasSecoes(secoes: readonly SecaoExtraida[]): ItemDeIndice[] {
  return secoes
    .filter((s) => s.pagina > 0 && !ehTituloGenerico(s.titulo))
    .map((s) => ({ titulo: s.titulo.replace(/\s+/g, " ").trim(), pagina: s.pagina, nivel: 1 as const }));
}

export type FonteDoIndice = "marcadores" | "secoes" | "nenhuma";

/**
 * A decisão, num lugar só.
 *
 * Devolve também DE ONDE veio, porque a interface precisa poder dizer isso: um
 * índice do estúdio e um índice proposto pela máquina não merecem o mesmo
 * silêncio (ADR-0006 e a honestidade editorial do CLAUDE.md).
 */
export function montarIndice(
  marcadores: readonly MarcadorResolvido[],
  secoes: readonly SecaoExtraida[],
): { fonte: FonteDoIndice; itens: ItemDeIndice[] } {
  const dosMarcadores = indiceDosMarcadores(marcadores);
  if (dosMarcadores) return { fonte: "marcadores", itens: dosMarcadores };

  const dasSecoes = indiceDasSecoes(secoes);
  if (dasSecoes.length >= MINIMO_DE_ITENS) return { fonte: "secoes", itens: dasSecoes };

  return { fonte: "nenhuma", itens: [] };
}
