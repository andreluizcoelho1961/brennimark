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

import type { Tradutor } from "../i18n/tradutor";

export type Unidade = "mm" | "px";
export type TipoDeGrid = "manuscrito" | "colunas" | "modular" | "hierarquico";
export type Grupo = "impressos" | "redes" | "digital" | "apresentacao";

export type Formato = {
  id: string;
  grupo: Grupo;
  /** Largura e altura na unidade do formato (mm ou px). */
  largura: number;
  altura: number;
  unidade: Unidade;
  /** Sangria em mm (só impressos). */
  sangria: number;
  /** A unidade do grid: pt nos impressos (a entrelinha), px nos digitais. */
  u: number;
  /** Corpo e entrelinha do texto aprovados para o formato, em pt/px (o Grids parte deles para os estilos). */
  corpo?: { titulo?: [number, number]; texto: [number, number] };
  /** A plataforma manda evitar o canto inferior direito (capa e vitrine do LinkedIn): o logo nasce em cima. */
  evitaCantoInferiorDireito?: true;
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
  /** Capa de livro: o documento cresce com lombada e orelhas informadas. */
  livro?: true;
};

const MOLDE_IMPRESSO = { sangria: 3 } as const;

export const FORMATOS: readonly Formato[] = [
  // ─── Impressos ───────────────────────────────────────────────────────────
  { id: "a4", grupo: "impressos", largura: 210, altura: 297, unidade: "mm", ...MOLDE_IMPRESSO, u: 12, corpo: { texto: [9.5, 12] }, margensU: { sup: 4, inf: 5, lat: 4 }, colunas: 12, medianizU: 1, linhas: 16, tipoPadrao: "colunas" },
  { id: "a3", grupo: "impressos", largura: 297, altura: 420, unidade: "mm", ...MOLDE_IMPRESSO, u: 14, corpo: { texto: [11, 14] }, margensU: { sup: 4, inf: 5, lat: 4 }, colunas: 12, medianizU: 1, linhas: 18, tipoPadrao: "colunas" },
  { id: "a5", grupo: "impressos", largura: 148, altura: 210, unidade: "mm", ...MOLDE_IMPRESSO, u: 11, corpo: { texto: [8.5, 11] }, margensU: { sup: 3, inf: 4, lat: 3 }, colunas: 6, medianizU: 1, linhas: 9, tipoPadrao: "colunas" },
  { id: "carta", grupo: "impressos", largura: 215.9, altura: 279.4, unidade: "mm", ...MOLDE_IMPRESSO, u: 12, corpo: { texto: [9.5, 12] }, margensU: { sup: 4, inf: 5, lat: 4 }, colunas: 12, medianizU: 1, linhas: 15, tipoPadrao: "colunas" },
  { id: "cartaz-50x70", grupo: "impressos", largura: 500, altura: 700, unidade: "mm", ...MOLDE_IMPRESSO, u: 30, corpo: { texto: [22, 30] }, margensU: { sup: 4, inf: 5, lat: 4 }, colunas: 12, medianizU: 1, linhas: 17, tipoPadrao: "modular" },
  { id: "cartao-br", grupo: "impressos", largura: 90, altura: 50, unidade: "mm", ...MOLDE_IMPRESSO, u: 9, corpo: { texto: [7, 9] }, margensMm: 5, colunas: 6, medianizU: 1, linhas: 3, tipoPadrao: "hierarquico", zonas: [1, 2] },
  { id: "cartao-int", grupo: "impressos", largura: 85, altura: 55, unidade: "mm", ...MOLDE_IMPRESSO, u: 9, corpo: { texto: [7, 9] }, margensMm: 5, colunas: 6, medianizU: 1, linhas: 4, tipoPadrao: "hierarquico", zonas: [1, 2] },
  { id: "livro-14x21", grupo: "impressos", largura: 140, altura: 210, unidade: "mm", ...MOLDE_IMPRESSO, u: 14, margensMm: 10, colunas: 6, medianizU: 1, linhas: 0, tipoPadrao: "colunas", livro: true },
  { id: "livro-16x23", grupo: "impressos", largura: 160, altura: 230, unidade: "mm", ...MOLDE_IMPRESSO, u: 14, margensMm: 10, colunas: 6, medianizU: 1, linhas: 0, tipoPadrao: "colunas", livro: true },

  // ─── Redes, endomarketing e employer branding ────────────────────────────
  { id: "post-4x5", grupo: "redes", largura: 1080, altura: 1350, unidade: "px", sangria: 0, u: 12, corpo: { titulo: [96, 108], texto: [32, 36] }, margensU: { sup: 6, inf: 6, lat: 6 }, colunas: 6, medianizU: 2, linhas: 8, tipoPadrao: "modular" },
  { id: "post-1x1", grupo: "redes", largura: 1080, altura: 1080, unidade: "px", sangria: 0, u: 12, corpo: { titulo: [96, 108], texto: [32, 36] }, margensU: { sup: 6, inf: 6, lat: 6 }, colunas: 6, medianizU: 2, linhas: 6, tipoPadrao: "modular" },
  { id: "stories", grupo: "redes", largura: 1080, altura: 1920, unidade: "px", sangria: 0, u: 12, corpo: { titulo: [96, 108], texto: [32, 36] }, margensU: { sup: 6, inf: 6, lat: 6 }, colunas: 4, medianizU: 2, linhas: 8, tipoPadrao: "colunas", seguraFracao: { sup: 0.14, inf: 0.35, esq: 0.06, dir: 0.06 } },
  { id: "linkedin-carrossel", grupo: "redes", largura: 1080, altura: 1350, unidade: "px", sangria: 0, u: 12, margensU: { sup: 6, inf: 6, lat: 6 }, colunas: 6, medianizU: 2, linhas: 8, tipoPadrao: "modular" },
  { id: "linkedin-capa", grupo: "redes", largura: 1512, altura: 256, unidade: "px", sangria: 0, u: 12, evitaCantoInferiorDireito: true, margensU: { sup: 2, inf: 2, lat: 2 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2, 1] },
  { id: "linkedin-vitrine", grupo: "redes", largura: 1512, altura: 256, unidade: "px", sangria: 0, u: 12, evitaCantoInferiorDireito: true, margensU: { sup: 2, inf: 2, lat: 2 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2, 1] },
  { id: "linkedin-vida", grupo: "redes", largura: 1128, altura: 376, unidade: "px", sangria: 0, u: 12, margensU: { sup: 3, inf: 3, lat: 3 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2] },
  { id: "linkedin-evento", grupo: "redes", largura: 1776, altura: 444, unidade: "px", sangria: 0, u: 12, margensU: { sup: 4, inf: 4, lat: 4 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2] },
  { id: "linkedin-artigo", grupo: "redes", largura: 1920, altura: 1080, unidade: "px", sangria: 0, u: 12, margensU: { sup: 8, inf: 8, lat: 8 }, colunas: 12, medianizU: 2, linhas: 7, tipoPadrao: "colunas" },
  { id: "facebook-capa", grupo: "redes", largura: 1640, altura: 624, unidade: "px", sangria: 0, u: 12, margensU: { sup: 4, inf: 4, lat: 4 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2, 1] },
  { id: "x-capa", grupo: "redes", largura: 1500, altura: 500, unidade: "px", sangria: 0, u: 12, margensU: { sup: 4, inf: 4, lat: 4 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2] },
  { id: "youtube-banner", grupo: "redes", largura: 2560, altura: 1440, unidade: "px", sangria: 0, u: 12, margensU: { sup: 4, inf: 4, lat: 4 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2, 1], seguraCentral: { largura: 1546, altura: 423 } },
  { id: "link", grupo: "redes", largura: 1200, altura: 630, unidade: "px", sangria: 0, u: 12, margensU: { sup: 5, inf: 5, lat: 5 }, colunas: 12, medianizU: 2, linhas: 6, tipoPadrao: "colunas" },
  { id: "gupy-carreiras", grupo: "redes", largura: 760, altura: 430, unidade: "px", sangria: 0, u: 12, margensU: { sup: 3, inf: 3, lat: 3 }, colunas: 6, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2] },
  { id: "gupy-vaga", grupo: "redes", largura: 1980, altura: 600, unidade: "px", sangria: 0, u: 12, margensU: { sup: 6, inf: 6, lat: 6 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2] },
  { id: "glassdoor-capa", grupo: "redes", largura: 2880, altura: 550, unidade: "px", sangria: 0, u: 12, margensU: { sup: 8, inf: 8, lat: 8 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2] },
  { id: "viva-engage", grupo: "redes", largura: 1400, altura: 524, unidade: "px", sangria: 0, u: 12, margensU: { sup: 4, inf: 4, lat: 4 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2] },
  { id: "videochamada", grupo: "redes", largura: 1920, altura: 1080, unidade: "px", sangria: 0, u: 12, margensU: { sup: 8, inf: 8, lat: 8 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2, 1] },
  { id: "papel-de-parede", grupo: "redes", largura: 1920, altura: 1080, unidade: "px", sangria: 0, u: 12, margensU: { sup: 8, inf: 8, lat: 8 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 2, 1] },

  // ─── Mídia digital ───────────────────────────────────────────────────────
  { id: "iab-300x250", grupo: "digital", largura: 300, altura: 250, unidade: "px", sangria: 0, u: 8, margensU: { sup: 2, inf: 2, lat: 2 }, colunas: 2, medianizU: 1, linhas: 3, tipoPadrao: "modular" },
  { id: "iab-728x90", grupo: "digital", largura: 728, altura: 90, unidade: "px", sangria: 0, u: 10, margensU: { sup: 1, inf: 1, lat: 1 }, colunas: 12, medianizU: 1, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 3, 1.2] },
  { id: "iab-160x600", grupo: "digital", largura: 160, altura: 600, unidade: "px", sangria: 0, u: 12, margensU: { sup: 1, inf: 1, lat: 1 }, colunas: 1, medianizU: 1, linhas: 4, tipoPadrao: "colunas" },
  { id: "iab-300x600", grupo: "digital", largura: 300, altura: 600, unidade: "px", sangria: 0, u: 8, margensU: { sup: 2, inf: 2, lat: 2 }, colunas: 2, medianizU: 1, linhas: 6, tipoPadrao: "modular" },
  { id: "iab-970x250", grupo: "digital", largura: 970, altura: 250, unidade: "px", sangria: 0, u: 12, margensU: { sup: 2, inf: 2, lat: 2 }, colunas: 12, medianizU: 2, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 3, 1] },
  { id: "iab-320x50", grupo: "digital", largura: 320, altura: 50, unidade: "px", sangria: 0, u: 6, margensU: { sup: 1, inf: 1, lat: 1 }, colunas: 6, medianizU: 1, linhas: 0, tipoPadrao: "hierarquico", zonas: [1, 4] },
  { id: "email-cabecalho", grupo: "digital", largura: 600, altura: 200, unidade: "px", sangria: 0, u: 10, margensU: { sup: 3, inf: 3, lat: 3 }, colunas: 6, medianizU: 2, linhas: 0, tipoPadrao: "colunas" },

  // ─── Apresentação ────────────────────────────────────────────────────────
  { id: "slide-16x9", grupo: "apresentacao", largura: 1920, altura: 1080, unidade: "px", sangria: 0, u: 12, corpo: { titulo: [64, 72], texto: [28, 36] }, margensU: { sup: 6, inf: 6, lat: 8 }, colunas: 12, medianizU: 2, linhas: 6, tipoPadrao: "colunas" },
];

export const GRUPOS: readonly { id: Grupo }[] = [{ id: "impressos" }, { id: "redes" }, { id: "digital" }, { id: "apresentacao" }];

/**
 * Os formatos da versão GRATUITA (decisão do André, 16/10/2026): 13 dos mais
 * usados, um recorte de cada grupo. Os outros — A3, cartaz, capas de livro,
 * Gupy, Glassdoor, Viva Engage, aba Vida, evento, videochamada e os demais
 * banners — são do assinante. É só vitrine: o assinante usa a lista inteira.
 */
export const FORMATOS_GRATIS: ReadonlySet<string> = new Set([
  "a4", "a5", "cartao-br",
  "post-4x5", "post-1x1", "stories", "linkedin-carrossel", "linkedin-capa", "link", "youtube-banner",
  "iab-300x250", "email-cabecalho",
  "slide-16x9",
]);

export function formatoPorId(id: string): Formato {
  return FORMATOS.find((f) => f.id === id) ?? FORMATOS[0];
}

/**
 * Os textos de um formato — nome, de onde veio a medida, corpo do texto e a
 * nota da área segura — moram no catálogo (`ferramentas.grids.formatos.<id>`),
 * não na tabela: a tabela é medida, e medida não tem idioma. `t` é o tradutor
 * ligado a `ferramentas.grids`.
 */
export function textoDoFormato(f: Pick<Formato, "id" | "corpo">, t: Tradutor): { nome: string; fonte: string; corpo?: string; seguraNota?: string } {
  const decimal = t("separadorDecimal");
  const n = (v: number) => String(v).replace(".", decimal);
  const c = f.corpo;
  const corpo = !c
    ? undefined
    : c.titulo
      ? t("corpo.tituloETexto", { t1: n(c.titulo[0]), t2: n(c.titulo[1]), x1: n(c.texto[0]), x2: n(c.texto[1]) })
      : t("corpo.soTexto", { a: n(c.texto[0]), b: n(c.texto[1]) });
  return {
    nome: t(`formatos.${f.id}.nome`),
    fonte: t(`formatos.${f.id}.fonte`),
    corpo,
    seguraNota: COM_NOTA_DE_AREA_SEGURA.has(f.id) ? t(`formatos.${f.id}.seguraNota`) : undefined,
  };
}

/** Os formatos que têm a nota da área segura no catálogo (os demais não mostram a linha). */
const COM_NOTA_DE_AREA_SEGURA: ReadonlySet<string> = new Set(["stories", "linkedin-capa", "linkedin-vitrine", "youtube-banner", "videochamada"]);
