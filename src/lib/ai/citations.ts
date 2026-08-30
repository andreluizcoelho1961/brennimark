import { promptStatusLabels, statusKeyForLabel, type StatusLabels } from "../../components/docs/status";
import type { DocStatus } from "../../content/docs";

export interface BrandCitation {
  type: "citation";
  raw: string;
  title: string;
  /** O texto do status como o modelo o escreveu — o vocabulário da marca. */
  status: string;
  /** A qual dos três estados aquele texto corresponde, para estilo e ícone.
   *  Nulo quando o modelo escreveu algo fora do vocabulário. */
  statusKey: DocStatus | null;
  path: string;
}

export interface CitationText {
  type: "text";
  value: string;
}

export type CitationSegment = BrandCitation | CitationText;

const PATH_PATTERN = "\\/docs\\/[^\\]\\s]+";

function escapar(valor: string) {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * O padrão de citação é montado a partir do vocabulário DAQUELA marca.
 *
 * Ele já foi uma constante com os seis rótulos embutidos — PRONTO, RASCUNHO,
 * EM CONSTRUÇÃO e os equivalentes em inglês. Uma marca que chamasse o estado
 * de "Documentado" veria o assistente citar corretamente e a interface não
 * reconhecer a citação: o texto viraria parágrafo solto, sem link e sem selo.
 */
function padraoDeCitacao(labels: StatusLabels): RegExp {
  const caixaAlta = promptStatusLabels(labels);
  // Aceita as duas caixas: o prompt pede caixa alta, mas modelos normalizam.
  const vocabulario = [...new Set([
    ...Object.values(caixaAlta),
    ...Object.values(labels),
  ])].map(escapar).join("|");

  return new RegExp(
    `\\[(?:Fonte|Source):\\s*(.+?)\\s+—\\s+(?:(${vocabulario})\\s+·\\s+(${PATH_PATTERN})|(${PATH_PATTERN})\\s+·\\s+(${vocabulario}))\\]`,
    "g",
  );
}

/** Converte apenas o formato de citação interno e documentado do assistente. */
export function parseBrandCitations(
  content: string,
  labels: StatusLabels,
): CitationSegment[] {
  const segments: CitationSegment[] = [];
  const padrao = padraoDeCitacao(labels);
  let cursor = 0;

  for (const match of content.matchAll(padrao)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ type: "text", value: content.slice(cursor, index) });

    const status = match[2] ?? match[5];
    segments.push({
      type: "citation",
      raw: match[0],
      title: match[1].trim(),
      status,
      statusKey: statusKeyForLabel(labels, status),
      path: match[3] ?? match[4],
    });
    cursor = index + match[0].length;
  }

  if (cursor < content.length) segments.push({ type: "text", value: content.slice(cursor) });
  return segments.length > 0 ? segments : [{ type: "text", value: content }];
}
