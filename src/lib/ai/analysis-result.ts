export type StructuredAnalysis = {
  verdict: string;
  evidence: string[];
  rules: string[];
  problems: string[];
  impact: string;
  correction: string;
  confidence: string;
  sources: string[];
  raw: string;
};

export type AnalysisVerdict = "aligned" | "partially_aligned" | "misaligned" | "unknown";

export function normalizeAnalysisVerdict(value: string): AnalysisVerdict {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/\b(parcial|parcialmente|partial|partially)\b/.test(normalized)) return "partially_aligned";
  if (/\b(desalinhad|nao alinhad|reprovad|incompativel|misaligned|not aligned|non-compliant)/.test(normalized)) return "misaligned";
  if (/\b(alinhad|aprovad|compativel|aligned|approved|compliant)/.test(normalized)) return "aligned";
  return "unknown";
}

type SectionKey = Exclude<keyof StructuredAnalysis, "sources" | "raw">;

const HEADINGS: Array<{ key: SectionKey; pattern: RegExp }> = [
  { key: "verdict", pattern: /^(veredito|verdict)\s*:\s*/i },
  { key: "evidence", pattern: /^(evid[eê]ncias?(?:\s+observadas?)?|observed evidence|evidence)\s*:\s*/i },
  { key: "rules", pattern: /^(regras?(?:\s+aplic[aá]veis?)?|applicable rules|rules)\s*:\s*/i },
  { key: "problems", pattern: /^(problemas?|issues(?:\s+identified)?)\s*:\s*/i },
  { key: "impact", pattern: /^(impacto|impact)\s*:\s*/i },
  { key: "correction", pattern: /^(corre[cç][aã]o(?:\s+m[ií]nima)?(?:\s+recomendada)?|minimum recommended fix|recommended fix)\s*:\s*/i },
  { key: "confidence", pattern: /^(confian[cç]a|confidence)\s*:\s*/i },
];

function cleanLine(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*•]\s+/, "")
    .replace(/\*\*/g, "")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

export function sanitizeStructuredAnalysis(result: StructuredAnalysis): StructuredAnalysis {
  const text = (value: string) => value.split(/\r?\n/).map(cleanLine).filter(Boolean).join("\n");
  const list = (values: string[]) => values.map(text).filter(Boolean);
  return {
    ...result,
    verdict: text(result.verdict),
    evidence: list(result.evidence),
    rules: list(result.rules),
    problems: list(result.problems),
    impact: text(result.impact),
    correction: text(result.correction),
    confidence: text(result.confidence),
    sources: list(result.sources),
  };
}

function findHeading(line: string) {
  const cleaned = cleanLine(line).replace(/\*\*/g, "");
  for (const heading of HEADINGS) {
    if (heading.pattern.test(cleaned)) {
      return { key: heading.key, value: cleaned.replace(heading.pattern, "").trim() };
    }
  }
  return null;
}

function compact(values: string[]): string[] {
  return values.map(cleanLine).filter(Boolean);
}

export function parseAnalysisText(raw: string): StructuredAnalysis {
  const sections: Record<SectionKey, string[]> = {
    verdict: [],
    evidence: [],
    rules: [],
    problems: [],
    impact: [],
    correction: [],
    confidence: [],
  };
  let active: SectionKey | null = null;

  for (const line of raw.split(/\r?\n/)) {
    const heading = findHeading(line);
    if (heading) {
      active = heading.key;
      if (heading.value) sections[active].push(heading.value);
      continue;
    }
    if (active && cleanLine(line)) sections[active].push(line);
  }

  const sourceMatches = raw.match(/\[(?:Fonte|Source):\s*[^\]]+\]/gi) ?? [];
  const sources = [...new Set(sourceMatches.map((source) => source.replace(/^\[|\]$/g, "")))];
  const asText = (key: SectionKey) => compact(sections[key]).join("\n");

  return {
    verdict: asText("verdict"),
    evidence: compact(sections.evidence),
    rules: compact(sections.rules),
    problems: compact(sections.problems),
    impact: asText("impact"),
    correction: asText("correction"),
    confidence: asText("confidence"),
    sources,
    raw,
  };
}
