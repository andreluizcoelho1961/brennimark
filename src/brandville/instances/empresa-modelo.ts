import type { BrandvilleInstance } from "../types";

// Gerado pelo onboarding Brandville. Edite o manifesto e gere novamente.
export const brandvilleInstanceDefinition = {
  "key": "empresa-modelo",
  "brand": {
    "name": "Empresa Modelo",
    "shortName": "Empresa Modelo",
    "descriptor": "Servicos claros para negocios em movimento"
  },
  "metadata": {
    "title": "Empresa Modelo — Brandville",
    "description": "Diretrizes vivas de marca da Empresa Modelo.",
    "language": "pt-BR"
  },
  "navigation": {
    "groups": [
      "Inicio",
      "Fundamentos",
      "Identidade"
    ],
    "groupCodes": {
      "Inicio": "IN",
      "Fundamentos": "FU",
      "Identidade": "ID"
    },
    "defaultDocSlug": "introducao",
    "utilityLinks": [
      "chat",
      "analysis",
      "history",
      "ai-settings"
    ]
  },
  "docs": [
    {
      "slug": "introducao",
      "group": "Inicio",
      "title": "Introducao",
      "status": "ready",
      "body": [
        "Este e o sistema vivo de diretrizes da Empresa Modelo."
      ]
    },
    {
      "slug": "fundamentos/posicionamento",
      "group": "Fundamentos",
      "title": "Posicionamento",
      "status": "draft",
      "body": [
        "A Empresa Modelo torna servicos complexos mais claros, proximos e utilizaveis."
      ]
    },
    {
      "slug": "identidade/visao-geral",
      "group": "Identidade",
      "title": "Visao geral",
      "status": "pending",
      "body": []
    }
  ],
  "theme": {
    "background": "#07131f",
    "backgroundSecondary": "#0b1b2a",
    "surface": "#102538",
    "surfaceLight": "#17334a",
    "foreground": "#f5f2ea",
    "muted": "#9db0bf",
    "accent": "#ffb000",
    "accentSecondary": "#ff6b4a",
    "border": "#294359",
    "focus": "#ffd166",
    "fontStack": "Inter, 'Helvetica Neue', Arial, sans-serif"
  },
  "ai": {
    "knowledgeMode": "docs",
    "chatRole": "Voce e o assistente oficial da Empresa Modelo dentro do Brandville.",
    "analysisRole": "Voce analisa pecas da Empresa Modelo contra as diretrizes documentadas neste Brandville."
  },
  "legal": {
    "footerNotice": "Diretrizes oficiais da Empresa Modelo. Uso autorizado."
  }
} satisfies BrandvilleInstance;
