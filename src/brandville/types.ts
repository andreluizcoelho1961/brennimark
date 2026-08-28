import type { DocPageEntry, DocStatus } from "../content/docs";

export type BrandvilleUtilityKey = "chat" | "analysis" | "history" | "ai-settings";

export interface BrandvilleTheme {
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
}

export interface BrandvilleInstance {
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
    utilityLinks: readonly BrandvilleUtilityKey[];
  };
  docs: readonly DocPageEntry[];
  /** Vocabulário editorial próprio da instância. Ausente = rótulos do produto. */
  statusLabels?: Readonly<Record<DocStatus, string>>;
  theme: BrandvilleTheme;
  ai: {
    knowledgeMode: "full" | "docs";
    chatRole: string;
    analysisRole: string;
  };
  legal: {
    footerNotice: string;
  };
}
