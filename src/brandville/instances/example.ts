import type { BrandvilleInstance } from "../types";
import type { DocPageEntry } from "../../content/docs";

const exampleDocs = [
  {
    slug: "introducao",
    group: "Início",
    title: "Introdução",
    status: "ready",
    body: [
      "Esta é uma instância de demonstração da matriz Brandville. Ela prova que marca, conteúdo, navegação, tema e assistência podem mudar sem reescrever a interface.",
      "Em um projeto real, este conteúdo é substituído pelo material curado e aprovado da empresa contratante.",
    ],
  },
  {
    slug: "fundamentos/posicionamento",
    group: "Fundamentos",
    title: "Posicionamento",
    status: "draft",
    body: ["A Empresa X torna serviços complexos mais claros, próximos e utilizáveis."],
  },
  {
    slug: "identidade/cores",
    group: "Identidade",
    title: "Cores",
    status: "pending",
    body: [],
  },
] satisfies readonly DocPageEntry[];

export const exampleInstance = {
  key: "example",
  brand: {
    name: "Empresa X",
    shortName: "Empresa X",
    descriptor: "Instância demonstrativa",
  },
  metadata: {
    title: "Empresa X — Brandville",
    description: "Sistema vivo de diretrizes da Empresa X.",
    language: "pt-BR",
  },
  navigation: {
    groups: ["Início", "Fundamentos", "Identidade"],
    groupCodes: { Início: "IN", Fundamentos: "FU", Identidade: "ID" },
    defaultDocSlug: "introducao",
    utilityLinks: ["chat", "analysis", "history", "ai-settings"],
  },
  docs: exampleDocs,
  theme: {
    background: "#07131f",
    backgroundSecondary: "#0b1b2a",
    surface: "#102538",
    surfaceLight: "#17334a",
    foreground: "#f5f2ea",
    muted: "#9db0bf",
    accent: "#ffb000",
    accentSecondary: "#ff6b4a",
    border: "#294359",
    focus: "#ffd166",
    fontStack: "'Avenir Next', Inter, 'Helvetica Neue', Arial, sans-serif",
  },
  ai: {
    knowledgeMode: "docs",
    chatRole: "Você é o assistente oficial da Empresa X dentro do Brandville.",
    analysisRole: "Você analisa peças da Empresa X contra as diretrizes documentadas neste Brandville.",
  },
  legal: {
    footerNotice: "Demonstração interna da matriz Brandville.",
  },
} satisfies BrandvilleInstance;
