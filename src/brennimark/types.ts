import type { DocPageEntry, DocStatus } from "../content/docs";

/**
 * As funcionalidades que uma marca pode oferecer. `ai-settings` (a tela
 * "Provedores de IA") saiu em 29/09/2026 — a IA é da plataforma (ADR-0008).
 * Marcas importadas antes ainda podem ter o valor gravado na lista; ele é
 * ignorado, e o dado não é regravado.
 */
export type BrennimarkUtilityKey = "chat" | "analysis" | "history";

export interface BrennimarkTheme {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceLight: string;
  foreground: string;
  muted: string;
  accent: string;
  accentSecondary: string;
  border: string;
  focus: string;
  fontStack: string;
  /** Fonte de título/logo, quando a marca declara uma distinta da de corpo. Ausente = herda `fontStack`. */
  fontStackDisplay?: string;
}

export interface BrennimarkInstance {
  key: string;
  brand: {
    name: string;
    shortName: string;
    descriptor: string;
  };
  metadata: {
    title: string;
    description: string;
    language: string;
  };
  navigation: {
    groups: readonly string[];
    groupCodes: Readonly<Record<string, string>>;
    defaultDocSlug: string;
    utilityLinks: readonly BrennimarkUtilityKey[];
  };
  docs: readonly DocPageEntry[];
  /** Vocabulário editorial próprio da instância. Ausente = rótulos do produto. */
  statusLabels?: Readonly<Record<DocStatus, string>>;
  theme: BrennimarkTheme;
  ai: {
    knowledgeMode: "full" | "docs";
    chatRole: string;
    analysisRole: string;
  };
  legal: {
    footerNotice: string;
  };
}
