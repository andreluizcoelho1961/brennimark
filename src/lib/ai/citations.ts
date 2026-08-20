export type BrandCitationStatus = "PRONTO" | "RASCUNHO" | "EM CONSTRUÇÃO" | "READY" | "DRAFT" | "IN PROGRESS";

export interface BrandCitation {
  type: "citation";
  raw: string;
  title: string;
  status: BrandCitationStatus;
  path: string;
}

export interface CitationText {
  type: "text";
  value: string;
}

export type CitationSegment = BrandCitation | CitationText;

const STATUS_PATTERN = "PRONTO|RASCUNHO|EM CONSTRUÇÃO|READY|DRAFT|IN PROGRESS";
const PATH_PATTERN = "\\/docs\\/[^\\]\\s]+";
const CITATION_PATTERN = new RegExp(
  `\\[(?:Fonte|Source):\\s*(.+?)\\s+—\\s+(?:(${STATUS_PATTERN})\\s+·\\s+(${PATH_PATTERN})|(${PATH_PATTERN})\\s+·\\s+(${STATUS_PATTERN}))\\]`,
  "g",
);

const SOURCE_TITLES: Record<string, string> = {
  "structured:positioning": "Posicionamento estruturado",
  "structured:colors": "Guia de Cores",
  "structured:typography": "Tipografia",
  "structured:logos": "Símbolos e Logotipos",
  "structured:voice": "Tom de Voz",
  "structured:photography": "Direção Fotográfica",
  "structured:motion": "Movimento",
  "structured:iconography": "Iconografia",
  "assets:official": "Catálogo de Assets Oficiais",
};

const SOURCE_TITLES_EN: Record<string, string> = {
  "structured:positioning": "Structured positioning",
  "structured:colors": "Color Guide",
  "structured:typography": "Typography",
  "structured:logos": "Symbols & Logos",
  "structured:voice": "Voice & Tone",
  "structured:photography": "Photography Direction",
  "structured:motion": "Motion",
  "structured:iconography": "Iconography",
  "assets:official": "Official Asset Catalog",
};

/** Converts only the assistant's documented internal citation format. */
export function parseBrandCitations(content: string, isEnglish = false): CitationSegment[] {
  const segments: CitationSegment[] = [];
  const titles = isEnglish ? SOURCE_TITLES_EN : SOURCE_TITLES;
  let cursor = 0;

  for (const match of content.matchAll(CITATION_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ type: "text", value: content.slice(cursor, index) });

    const sourceName = match[1].trim();
    segments.push({
      type: "citation",
      raw: match[0],
      title: titles[sourceName] ?? sourceName,
      status: (match[2] ?? match[5]) as BrandCitationStatus,
      path: match[3] ?? match[4],
    });
    cursor = index + match[0].length;
  }

  if (cursor < content.length) segments.push({ type: "text", value: content.slice(cursor) });
  return segments.length > 0 ? segments : [{ type: "text", value: content }];
}
