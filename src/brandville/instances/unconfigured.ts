import type { BrandvilleInstance } from "../types";

/**
 * A ausência de marca, como estado explícito.
 *
 * Não é marca de demonstração nem conteúdo de exemplo: é o que o aplicativo é
 * antes do primeiro manual entrar. Zero páginas, tema neutro da plataforma.
 *
 * Existe para que `brandvilleInstance` continue resolvendo enquanto a leitura
 * ainda não vem do banco. Sai na migração 1, PR 2 — quando a marca ativa passar
 * a ser uma linha de `brands` e a ausência dela puder ser simplesmente nula.
 */
export const brandvilleInstanceDefinition: BrandvilleInstance = {
  key: "unconfigured",
  brand: {
    name: "",
    shortName: "",
    descriptor: "",
  },
  metadata: {
    title: "Brennimark",
    description: "Nenhuma marca configurada ainda.",
    language: "pt-BR",
  },
  navigation: {
    groups: [],
    groupCodes: {},
    defaultDocSlug: "",
    utilityLinks: [],
  },
  docs: [],
  // Neutro de propósito: sem marca, o canvas não tem o que vestir e herda a
  // moldura. Nenhum valor aqui é identidade de ninguém.
  theme: {
    background: "#14161a",
    backgroundSecondary: "#14161a",
    surface: "#1b1e24",
    surfaceLight: "#242830",
    foreground: "#f4f5f7",
    muted: "#9099a8",
    accent: "#f4f5f7",
    accentSecondary: "#9099a8",
    border: "#2b3038",
    focus: "#ffffff",
    fontStack: "var(--font-ui)",
  },
  ai: {
    knowledgeMode: "docs",
    chatRole: "",
    analysisRole: "",
  },
  legal: {
    footerNotice: "",
  },
};
