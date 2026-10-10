import type { Trecho } from "../ai/recuperacao";
import type { ReducaoMinima } from "./pacote";

/**
 * As REGRAS DO LOGO que o Kit do assinante aplica (10/10/2026) — a área de
 * proteção e a redução mínima, lidas do manual.
 *
 * Decisão do André: o Kit do assinante é automático — "ele conhece as regras
 * do manual e usa". A IA da plataforma lê as páginas (a área de proteção quase
 * sempre é DIAGRAMA, então ela vê a imagem) e propõe; a proposta nasce
 * rascunho (`regras_do_logo`, o banco garante). Só regra aprovada é aplicada
 * em silêncio; o rascunho é aplicado com a etiqueta "lido pela IA — confira".
 *
 * Tudo aqui é puro, sem rede: a rota faz as chamadas, e isto decide.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export const CHAVES_DAS_REGRAS = ["area_de_protecao", "reducao_minima_logo", "reducao_minima_simbolo"] as const;
export type ChaveDaRegra = (typeof CHAVES_DAS_REGRAS)[number];

export type RegraDoLogo = {
  id: string;
  chave: ChaveDaRegra;
  valor: number;
  descricao: string;
  pagina: number | null;
  origem: "ia" | "pessoa";
  status: "draft" | "ready";
};

export const COLUNAS_DAS_REGRAS = "id, chave, valor, descricao, pagina, origem, status";

/** Quantas páginas a IA vê por leitura. Cada imagem custa ~1.100–2.300 tokens. */
export const MAXIMO_DE_PAGINAS_DAS_REGRAS = 4;

const FAIXA: Record<ChaveDaRegra, [number, number]> = {
  area_de_protecao: [0.01, 2],
  reducao_minima_logo: [4, 2000],
  reducao_minima_simbolo: [4, 2000],
};

export function deLinhaDaRegra(l: Record<string, unknown>): RegraDoLogo | null {
  const chave = l.chave as ChaveDaRegra;
  if (!CHAVES_DAS_REGRAS.includes(chave)) return null;
  return {
    id: String(l.id),
    chave,
    valor: Number(l.valor),
    descricao: typeof l.descricao === "string" ? l.descricao : "",
    pagina: typeof l.pagina === "number" ? l.pagina : null,
    origem: l.origem === "ia" ? "ia" : "pessoa",
    status: l.status === "ready" ? "ready" : "draft",
  };
}

/** As regras como o Kit as usa: fração de proteção e larguras mínimas. */
export function regrasParaOKit(regras: readonly RegraDoLogo[]): { protecao: number; reducao: ReducaoMinima } {
  const de = (c: ChaveDaRegra) => regras.find((r) => r.chave === c)?.valor ?? null;
  return {
    protecao: de("area_de_protecao") ?? 0,
    reducao: { logo: de("reducao_minima_logo"), simbolo: de("reducao_minima_simbolo") },
  };
}

/** O que falta: as chaves sem regra nenhuma (nem rascunho). */
export function chavesQueFaltam(regras: readonly RegraDoLogo[]): ChaveDaRegra[] {
  return CHAVES_DAS_REGRAS.filter((c) => !regras.some((r) => r.chave === c));
}

const TERMOS_DAS_REGRAS =
  /(área|area)\s+de\s+(prote[çc][ãa]o|respiro|seguran[çc]a|n[ãa]o\s+interfer[êe]ncia)|redu[çc][ãa]o\s+m[íi]nima|tamanho\s+m[íi]nimo|dimens[ãa]o\s+m[íi]nima|clear\s*space|exclusion\s+zone|minimum\s+size|safe\s+area/i;

/**
 * As páginas onde o manual fala das regras do logo. Primeiro as que quem edita
 * já ligou ao item Logotipo (`regra_paginas`) — escolha de uma pessoa, vale
 * mais que a busca. Sem elas, os trechos que citam os termos das regras.
 */
export function paginasDasRegras(
  trechos: readonly Trecho[],
  regraPaginas: readonly number[],
  maximo = MAXIMO_DE_PAGINAS_DAS_REGRAS,
): number[] {
  if (regraPaginas.length > 0) return [...new Set(regraPaginas)].sort((a, b) => a - b).slice(0, maximo);
  const paginas: number[] = [];
  for (const t of trechos) {
    if (t.pageStart === null || t.origem === "complemento") continue;
    if (!TERMOS_DAS_REGRAS.test(`${t.section ?? ""} ${t.content}`)) continue;
    if (!paginas.includes(t.pageStart)) paginas.push(t.pageStart);
    if (paginas.length >= maximo) break;
  }
  return paginas.sort((a, b) => a - b);
}

/** O pedido à IA: uma linha por regra, com `|`. Sem JSON: custa menos token. */
export function instrucoesDasRegras(paginas: readonly number[]): string {
  return [
    "Você lê páginas de um manual de marca e transcreve as REGRAS DE USO DO LOGO. Responda só com linhas, nada mais.",
    `As páginas enviadas são, na ordem: ${paginas.join(", ")}.`,
    "",
    "Formato, uma linha por regra encontrada:",
    "chave | valor | como o manual diz | página",
    "",
    "Chaves possíveis:",
    "- area_de_protecao: o espaço livre em volta do logotipo, como FRAÇÃO DA ALTURA DO LOGOTIPO inteiro (0.25 = um quarto da altura).",
    "  Se o manual mede por um elemento (\"x = altura da letra B\", \"x = altura do símbolo\"), estime a fração pela proporção do diagrama e diga a medida original em \"como o manual diz\".",
    "- reducao_minima_logo: a menor LARGURA do logotipo em PIXELS, para tela.",
    "- reducao_minima_simbolo: a menor LARGURA do símbolo (ícone) isolado em PIXELS, para tela.",
    "",
    "Regras:",
    "- Só o que está nas páginas. O que não estiver, não escreva a linha. Nunca invente.",
    "- Redução mínima só em pixels: se o manual dá só milímetros para impressão, NÃO converta; omita a linha.",
    "- Valor com ponto decimal, sem unidade. A página é uma das enviadas.",
    "",
    "Exemplo:",
    "area_de_protecao | 0.25 | x = altura do B, em todos os lados | 12",
    "reducao_minima_logo | 120 | 120 px de largura (digital) | 13",
  ].join("\n");
}

export type RegraLida = { chave: ChaveDaRegra; valor: number; descricao: string; pagina: number };

/**
 * A resposta da IA, conferida linha a linha: chave conhecida, valor dentro da
 * faixa, página entre as enviadas. O resto é descartado — uma linha esquisita
 * não vira regra. A primeira linha de cada chave vale.
 */
export function lerRegrasDaIA(texto: string, paginasEnviadas: readonly number[]): RegraLida[] {
  const lidas: RegraLida[] = [];
  for (const linha of texto.split("\n")) {
    const partes = linha.replace(/^[\s*\-•]+/, "").split("|").map((p) => p.trim());
    if (partes.length < 4) continue;
    const chave = partes[0].toLowerCase() as ChaveDaRegra;
    if (!CHAVES_DAS_REGRAS.includes(chave) || lidas.some((l) => l.chave === chave)) continue;
    const valor = Number(partes[1].replace(",", ".").replace(/[^\d.]/g, ""));
    const [minimo, maximo] = FAIXA[chave];
    if (!Number.isFinite(valor) || valor < minimo || valor > maximo) continue;
    const pagina = Number(partes[3].replace(/\D/g, ""));
    if (!paginasEnviadas.includes(pagina)) continue;
    lidas.push({ chave, valor, descricao: partes[2].slice(0, 200), pagina });
  }
  return lidas;
}

/** Como a tela diz o valor. */
export function valorLegivel(r: Pick<RegraDoLogo, "chave" | "valor">): string {
  if (r.chave === "area_de_protecao") return `${Math.round(r.valor * 100)}% da altura do logo`;
  return `${Math.round(r.valor)} px de largura`;
}

export const NOME_DA_REGRA: Record<ChaveDaRegra, string> = {
  area_de_protecao: "Área de proteção",
  reducao_minima_logo: "Redução mínima do logotipo",
  reducao_minima_simbolo: "Redução mínima do símbolo",
};
