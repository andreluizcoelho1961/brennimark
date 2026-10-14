/**
 * Os formatos do Brennimark Grids (13/10/2026) — a tabela APROVADA pelo André
 * em `ESPEC-GRIDS-NUMEROS.md`, com a conferência de fontes do mesmo dia.
 *
 * Princípios (§1 da tabela): tudo é múltiplo de uma unidade `u` — nos
 * impressos, a entrelinha do texto (pt); nos digitais, 12 px. Medianiz = 1u no
 * impresso e 2u no digital. Margens dadas em u (ou em mm, quando a regra é de
 * área segura de corte, como no cartão de visita).
 *
 * Área segura só entra quando há FONTE OFICIAL: guia inventada é pior que
 * nenhuma (Facebook e X ficam sem). A fonte de cada medida vai para a tela.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type Unidade = "mm" | "px";
export type TipoDeGrid = "manuscrito" | "colunas" | "modular" | "hierarquico";
export type Grupo = "impressos" | "redes" | "digital" | "apresentacao";

export type Formato = {
  id: string;
  grupo: Grupo;
  nome: string;
  /** Largura e altura na unidade do formato (mm ou px). */
  largura: number;
  altura: number;
  unidade: Unidade;
  /** Sangria em mm (só impressos). */
  sangria: number;
  /** A unidade do grid: pt nos impressos (a entrelinha), px nos digitais. */
  u: number;
  /** Corpo/entrelinha do texto, só para mostrar. */
  corpo?: string;
  /** Margens em múltiplos de u… */
  margensU?: { sup: number; inf: number; lat: number };
  /** …ou em mm (área segura de corte). */
  margensMm?: number;
  colunas: number;
  medianizU: number;
  /** Linhas do modular (0 = calcular). */
  linhas: number;
  tipoPadrao: TipoDeGrid;
  /** Divisão das zonas do hierárquico (proporções ao longo do lado maior). */
  zonas?: number[];
  /** Área segura da plataforma, em fração (0–1) de cada borda… */
  seguraFracao?: { sup: number; inf: number; esq: number; dir: number };
  /** …ou um retângulo central fixo (largura × altura, na unidade do formato). */
  seguraCentral?: { largura: number; altura: number };
  /** O que a área segura quer dizer, em palavras. */
  seguraNota?: string;
  fonte: string;
  /** Capa de livro: o documento cresce com lombada e orelhas informadas. */
  livro?: true;
};

const KIT = "a mesma tabela do Brennimark Kit";
const LINKEDIN = "LinkedIn, central de ajuda a563309 (conferido em 13/10/2026)";
const MERCADO = "medida usual de mercado — a plataforma não publica especificação";
const IAB = "IAB, padrão de formatos de mídia digital";
const MOLDE_IMPRESSO = { sangria: 3 } as const;

export const FORMATOS: readonly Formato[] = [
  // ─── Impressos ───────────────────────────────────────────────────────────
  { id: "a4", grupo: "impressos", nome: "A4", largura: 210, altura: 297, unidade: "mm", ...MOLDE_IMPRESSO, u: 12, corpo: "9,5 / 12 pt", margensU: { sup: 4, inf: 5, lat: 4 }, colunas: 12, medianizU: 1, linhas: 16, tipoPadrao: "colunas", fonte: "ISO 216" },
  { id: "a3", grupo: "impressos", nome: "A3", largura: 297, altura: 420, unidade: "mm", ...MOLDE_IMPRESSO, u: 14, corpo: "11 / 14 pt", margensU: { sup: 4, inf: 5, lat: 4 }, colunas: 12, medianizU: 1, linhas: 18, tipoPadrao: "colunas", fonte: "ISO 216" },
  { id: "a5", grupo: "impressos", nome: "A5 (flyer)", largura: 148, altura: 210, unidade: "mm", ...MOLDE_IMPRESSO, u: 11, corpo: "8,5 / 11 pt", margensU: { sup: 3, inf: 4, lat: 3 }, colunas: 6, medianizU: 1, linhas: 9, tipoPadrao: "colunas", fonte: "ISO 216" },
  { id: "carta", grupo: "impressos", nome: "Carta (EUA)", largura: 215.9, altura: 279.4, unidade: "mm", ...MOLDE_IMPRESSO, u: 12, corpo: "9,5 / 12 pt", margensU: { sup: 4, inf: 5, lat: 4 }, colunas: 12, medianizU: 1, linhas: 15, tipoPadrao: "colunas", fonte: "ANSI Letter" },
  { id: "cartaz-50x70", grupo: "impressos", nome: "Cartaz 50 × 70 cm", largura: 500, altura: 700, unidade: "mm", ...MOLDE_IMPRESSO, u: 30, corpo: "22 / 30 pt", margensU: { sup: 4, inf: 5, lat: 4 }, colunas: 12, medianizU: 1, linhas: 17, tipoPadrao: "modular", fonte: "formato de gráfica (sangria: conferir com a gráfica)" },
  { id: "cartao-br", grupo: "impressos", nome: "Cartão de visita 90 × 50", largura: 90, altura: 50, unidade: "mm", ...MOLDE_IMPRESSO, u: 9, corpo: "7 / 9 pt", margensMm: 5, colunas: 6, medianizU: 1, linhas: 3, tipoPadrao: "hierarquico", zonas: [1, 2], fonte: "padrão brasileiro" },
  { id: "cartao-int", grupo: "impressos", nome: "Cartão de visita 85 × 55", largura: 85, altura: 55, unidade: "mm", ...MOLDE_IMPRESSO, u: 9, corpo: "7 / 9 pt", margensMm: 5, colunas: 6, medianizU: 1, linhas: 4, tipoPadrao: "hierarquico", zonas: [1, 2], fonte: "padrão internacional" },
  { id: "livro-14x21", grupo: "impressos", nome: "Capa de livro 14 × 21", largura: 140, altura: 210, unidade: "mm", ...MOLDE_IMPRESSO, u: 14, margensMm: 10, colunas: 6, medianizU: 1, linhas: 0, tipoPadrao: "colunas", livro: true, fonte: "miolo 14 × 21; lombada e orelhas informadas (sangria: conferir com a gráfica)" },
  { id: "livro-16x23", grupo: "impressos", nome: "Capa de livro 16 × 23", largura: 160, altura: 230, unidade: "mm", ...MOLDE_IMPRESSO, u: 14, margensMm: 10, colunas: 6, medianizU: 1, linhas: 0, tipoPadrao: "colunas", livro: true, fonte: "miolo 16 × 23; lombada e orelhas informadas (sangria: conferir com a gráfica)" },

  // ─── Redes, endomarketing e employer branding ────────────────────────────
  { id: "post-4x5", grupo: "redes", nome: "Post 4:5 (Instagram, LinkedIn)", largura: 1080, altura: 1350, unidade: "px", sangria: 0, u: 12, corpo: "título 96/108 · texto 32/36", margensU: { sup: 6, inf: 6, lat: 6 }, colunas: 6, medianizU: 2, linhas: 8, tipoPadrao: "modular", fonte: KIT },
  { id: "post-1x1", grupo: "redes", nome: "Post 1:1", largura: 1080, altura: 1080, unidade: "px", sangria: 0, u: 12, corpo: "título 96/108 · texto 32/36", margensU: { sup: 6, inf: 6, lat: 6 }, colunas: 6, medianizU: 2, linhas: 6, tipoPadrao: "modular", fonte: KIT },
  { id: "stories", grupo: "redes", nome: "Stories / Reels 9:16", largura: 1080, altura: 1920, unidade: "px", sangria: 0, u: 12, corpo: "título 96/108 · texto 32/36", margensU: { sup: 6, inf: 6, lat: 6 }, colunas: 4, medianizU: 2, linhas: 8, tipoPadrao: "colunas", seguraFracao: { sup: 0.14, inf: 0.35, esq: 0.06, dir: 0.06 }, seguraNota: "fora da área segura, a interface cobre (perfil, botões, chamada)", fonte: "Meta, guia de anúncios para Stories (conferido em 13/10/2026)" },
  { id: "linkedin-carrossel", grupo: "redes", nome: "LinkedIn · carrossel (PDF)", largura: 1080, altura: 1350, unidade: "px", sangria: 0, u: 12, margensU: { sup: 6, inf: 6, lat: 6 }, colunas: 6, medianizU: 2, linhas: 8, tipoPadrao: "modular", fonte: MERCADO },
  { id: "linkedin-capa", grupo: "redes", nome: "LinkedIn · capa da página", largura: 1512, altura: 256, unidade: "px", sangria: 0, u: 12, margensU: { sup: 2, inf: 2, lat: 2 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2, 1], seguraNota: "o importante no centro; longe das bordas e do canto inferior direito", fonte: LINKEDIN },
  { id: "linkedin-vitrine", grupo: "redes", nome: "LinkedIn · página vitrine", largura: 1512, altura: 256, unidade: "px", sangria: 0, u: 12, margensU: { sup: 2, inf: 2, lat: 2 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2, 1], seguraNota: "o importante no centro; longe das bordas e do canto inferior direito", fonte: LINKEDIN },
  { id: "linkedin-vida", grupo: "redes", nome: "LinkedIn · aba Vida (Career Pages)", largura: 1128, altura: 376, unidade: "px", sangria: 0, u: 12, margensU: { sup: 3, inf: 3, lat: 3 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2], fonte: LINKEDIN },
  { id: "linkedin-evento", grupo: "redes", nome: "LinkedIn · capa de evento", largura: 1776, altura: 444, unidade: "px", sangria: 0, u: 12, margensU: { sup: 4, inf: 4, lat: 4 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2], fonte: "LinkedIn, central de ajuda (conferido em 09/10/2026, no Kit)" },
  { id: "linkedin-artigo", grupo: "redes", nome: "LinkedIn · capa de artigo/newsletter", largura: 1920, altura: 1080, unidade: "px", sangria: 0, u: 12, margensU: { sup: 8, inf: 8, lat: 8 }, colunas: 12, medianizU: 2, linhas: 7, tipoPadrao: "colunas", fonte: MERCADO },
  { id: "facebook-capa", grupo: "redes", nome: "Facebook · capa", largura: 1640, altura: 624, unidade: "px", sangria: 0, u: 12, margensU: { sup: 4, inf: 4, lat: 4 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2, 1], fonte: KIT },
  { id: "x-capa", grupo: "redes", nome: "X · capa", largura: 1500, altura: 500, unidade: "px", sangria: 0, u: 12, margensU: { sup: 4, inf: 4, lat: 4 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2], fonte: KIT },
  { id: "youtube-banner", grupo: "redes", nome: "YouTube · banner", largura: 2560, altura: 1440, unidade: "px", sangria: 0, u: 12, margensU: { sup: 4, inf: 4, lat: 4 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2, 1], seguraCentral: { largura: 1546, altura: 423 }, seguraNota: "a faixa central aparece em todo aparelho", fonte: KIT },
  { id: "link", grupo: "redes", nome: "Imagem de link", largura: 1200, altura: 630, unidade: "px", sangria: 0, u: 12, margensU: { sup: 5, inf: 5, lat: 5 }, colunas: 12, medianizU: 2, linhas: 6, tipoPadrao: "colunas", fonte: `${KIT}; LinkedIn usa 1200 × 627` },
  { id: "gupy-carreiras", grupo: "redes", nome: "Gupy · página de carreiras", largura: 760, altura: 430, unidade: "px", sangria: 0, u: 12, margensU: { sup: 3, inf: 3, lat: 3 }, colunas: 6, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2], fonte: "Gupy, central de suporte (conferido em 09/10/2026, no Kit)" },
  { id: "gupy-vaga", grupo: "redes", nome: "Gupy · topo da vaga", largura: 1980, altura: 600, unidade: "px", sangria: 0, u: 12, margensU: { sup: 6, inf: 6, lat: 6 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2], fonte: "Gupy, central de suporte (conferido em 09/10/2026, no Kit)" },
  { id: "glassdoor-capa", grupo: "redes", nome: "Glassdoor · capa", largura: 2880, altura: 550, unidade: "px", sangria: 0, u: 12, margensU: { sup: 8, inf: 8, lat: 8 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2], fonte: "Glassdoor, central de ajuda (conferido em 09/10/2026, no Kit)" },
  { id: "viva-engage", grupo: "redes", nome: "Viva Engage · capa da comunidade", largura: 1400, altura: 524, unidade: "px", sangria: 0, u: 12, margensU: { sup: 4, inf: 4, lat: 4 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2], fonte: "Microsoft, suporte do Viva Engage (conferido em 09/10/2026, no Kit)" },
  { id: "videochamada", grupo: "redes", nome: "Fundo de videochamada", largura: 1920, altura: 1080, unidade: "px", sangria: 0, u: 12, margensU: { sup: 8, inf: 8, lat: 8 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2, 1], seguraNota: "o centro fica atrás da pessoa: a marca vai nos cantos superiores", fonte: KIT },
  { id: "papel-de-parede", grupo: "redes", nome: "Papel de parede", largura: 1920, altura: 1080, unidade: "px", sangria: 0, u: 12, margensU: { sup: 8, inf: 8, lat: 8 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2, 1], fonte: KIT },

  // ─── Mídia digital ───────────────────────────────────────────────────────
  { id: "iab-300x250", grupo: "digital", nome: "Retângulo médio 300 × 250", largura: 300, altura: 250, unidade: "px", sangria: 0, u: 8, margensU: { sup: 2, inf: 2, lat: 2 }, colunas: 2, medianizU: 1, linhas: 3, tipoPadrao: "modular", fonte: IAB },
  { id: "iab-728x90", grupo: "digital", nome: "Leaderboard 728 × 90", largura: 728, altura: 90, unidade: "px", sangria: 0, u: 10, margensU: { sup: 1, inf: 1, lat: 1 }, colunas: 12, medianizU: 1, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 3, 1.2], fonte: IAB },
  { id: "iab-160x600", grupo: "digital", nome: "Arranha-céu 160 × 600", largura: 160, altura: 600, unidade: "px", sangria: 0, u: 12, margensU: { sup: 1, inf: 1, lat: 1 }, colunas: 1, medianizU: 1, linhas: 4, tipoPadrao: "colunas", fonte: IAB },
  { id: "iab-300x600", grupo: "digital", nome: "Meia página 300 × 600", largura: 300, altura: 600, unidade: "px", sangria: 0, u: 8, margensU: { sup: 2, inf: 2, lat: 2 }, colunas: 2, medianizU: 1, linhas: 6, tipoPadrao: "modular", fonte: IAB },
  { id: "iab-970x250", grupo: "digital", nome: "Billboard 970 × 250", largura: 970, altura: 250, unidade: "px", sangria: 0, u: 12, margensU: { sup: 2, inf: 2, lat: 2 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 3, 1], fonte: IAB },
  { id: "iab-320x50", grupo: "digital", nome: "Banner de celular 320 × 50", largura: 320, altura: 50, unidade: "px", sangria: 0, u: 6, margensU: { sup: 1, inf: 1, lat: 1 }, colunas: 6, medianizU: 1, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 4], fonte: IAB },
  { id: "email-cabecalho", grupo: "digital", nome: "Cabeçalho de e-mail 600 × 200", largura: 600, altura: 200, unidade: "px", sangria: 0, u: 10, margensU: { sup: 3, inf: 3, lat: 3 }, colunas: 6, medianizU: 2, linhas: 0, tipoPadrao: "colunas", fonte: "largura usual de e-mail (600 px)" },

  // ─── Apresentação ────────────────────────────────────────────────────────
  { id: "slide-16x9", grupo: "apresentacao", nome: "Slide 16:9", largura: 1920, altura: 1080, unidade: "px", sangria: 0, u: 12, corpo: "título 64/72 · texto 28/36", margensU: { sup: 6, inf: 6, lat: 8 }, colunas: 12, medianizU: 2, linhas: 6, tipoPadrao: "colunas", fonte: "16:9 Full HD" },
];

export const GRUPOS: readonly { id: Grupo; nome: string }[] = [
  { id: "impressos", nome: "Impressos" },
  { id: "redes", nome: "Redes, endomarketing e employer branding" },
  { id: "digital", nome: "Mídia digital" },
  { id: "apresentacao", nome: "Apresentação" },
];

export function formatoPorId(id: string): Formato {
  return FORMATOS.find((f) => f.id === id) ?? FORMATOS[0];
}
