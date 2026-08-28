import { flattenBlocksToFacts } from "../../content/doc-blocks";
import type { DocPageEntry, DocStatus } from "../../content/docs";

export type SearchKind = "guideline" | "destination";

export interface SearchEntry {
  kind: SearchKind;
  href: string;
  title: string;
  group?: string;
  status?: DocStatus;
  /** Linhas pesquisáveis, na ordem em que devem ser oferecidas como trecho. */
  lines: string[];
}

export interface SearchResult extends SearchEntry {
  /** O trecho que casou. É ele que responde "por que isto apareceu". */
  excerpt: string;
  score: number;
}

/** Acento e caixa não podem separar quem digita de quem escreveu. */
function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function buildSearchIndex({
  docs,
  destinations,
}: {
  docs: readonly DocPageEntry[];
  destinations: readonly { href: string; label: string }[];
}): SearchEntry[] {
  const guidelines: SearchEntry[] = docs.map((doc) => ({
    kind: "guideline",
    href: `/docs/${doc.slug}`,
    title: doc.title,
    group: doc.group,
    status: doc.status,
    // O corpo e os blocos entram no índice. É o que permite achar um hex, uma
    // cota ou uma regra sem saber em qual página ela foi escrita — a busca da
    // V1 só olhava título e grupo, e por isso não respondia a pergunta real.
    lines: [...(doc.body ?? []), ...flattenBlocksToFacts(doc.blocks ?? [])],
  }));

  const places: SearchEntry[] = destinations.map((d) => ({
    kind: "destination",
    href: d.href,
    title: d.label,
    lines: [],
  }));

  return [...guidelines, ...places];
}

/**
 * Ranking deliberadamente simples e explicável.
 *
 * Título vale mais que grupo, que vale mais que corpo — porque quem digita
 * "cores" quase sempre quer a página de cores, não toda página que menciona
 * cor. Início de palavra vale mais que meio, para que "tip" ache "Tipografia"
 * antes de "múltiplos".
 *
 * Sem correspondência, devolve vazio. A busca não sugere nada que não esteja
 * no material: numa ferramenta de marca, inventar é pior que não achar.
 */
export function searchIndex(index: readonly SearchEntry[], query: string): SearchResult[] {
  const q = fold(query.trim());
  if (!q) return [];

  const results: SearchResult[] = [];

  for (const entry of index) {
    const title = fold(entry.title);
    const group = entry.group ? fold(entry.group) : "";

    let score = 0;
    let excerpt = entry.group ?? "";

    if (title.startsWith(q)) score = 100;
    else if (title.includes(q)) score = 80;
    else if (group.includes(q)) score = 50;

    if (score === 0) {
      const hit = entry.lines.find((line) => fold(line).includes(q));
      if (hit) {
        score = 30;
        excerpt = hit;
      }
    }

    if (score > 0) {
      // Desempate estável: título curto primeiro, depois ordem do índice.
      results.push({ ...entry, excerpt, score: score - Math.min(entry.title.length, 20) / 100 });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
