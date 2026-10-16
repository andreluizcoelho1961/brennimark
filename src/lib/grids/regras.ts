import type { Trecho } from "../ai/recuperacao";
import { paginasDoAssunto } from "../ai/paginas-do-assunto";
import { FORMATOS, type Formato, type TipoDeGrid } from "./formatos";
import { escolhasPadrao, type Escolhas } from "./calcular";

/**
 * As REGRAS DE GRID da marca no Grids do assinante (14/10/2026) — a tabela
 * `regras_de_grid` (#115), desenho aprovado pelo André.
 *
 * De onde vem o grid de um formato, nesta ordem:
 *   1. a regra DAQUELE formato (do manual ou de quem edita);
 *   2. a regra GERAL da marca (`formato = 'todos'`, margens e medianiz em
 *      proporção do lado menor da peça);
 *   3. a proposta do Brennimark (a tabela aprovada em 13/10).
 * A tela e o LEIA-ME dizem sempre qual valeu, com página e situação: só regra
 * aprovada entra em silêncio (ADR-0004 §3.2).
 *
 * Tudo aqui é puro, sem rede: a rota faz as chamadas, e isto decide.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type RegraDeGrid = {
  id: string;
  formato: string;
  tipo: TipoDeGrid;
  unidade: "mm" | "px" | "proporcao";
  colunas: number | null;
  linhas: number | null;
  medianiz: number | null;
  margemSup: number | null;
  margemInf: number | null;
  margemEsq: number | null;
  margemDir: number | null;
  linhaDeBase: number | null;
  zonas: number[] | null;
  descricao: string;
  pagina: number | null;
  origem: "ia" | "pessoa";
  status: "draft" | "ready";
};

export const COLUNAS_DAS_REGRAS_DE_GRID =
  "id, formato, tipo, unidade, colunas, linhas, medianiz, margem_sup, margem_inf, margem_esq, margem_dir, linha_de_base, zonas, descricao, pagina, origem, status";

const TIPOS: readonly TipoDeGrid[] = ["manuscrito", "colunas", "modular", "hierarquico"];
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export function deLinhaDaRegraDeGrid(l: Record<string, unknown>): RegraDeGrid | null {
  const tipo = l.tipo as TipoDeGrid;
  const unidade = l.unidade as RegraDeGrid["unidade"];
  if (!TIPOS.includes(tipo) || !["mm", "px", "proporcao"].includes(unidade)) return null;
  return {
    id: String(l.id), formato: String(l.formato), tipo, unidade,
    colunas: num(l.colunas), linhas: num(l.linhas), medianiz: num(l.medianiz),
    margemSup: num(l.margem_sup), margemInf: num(l.margem_inf), margemEsq: num(l.margem_esq), margemDir: num(l.margem_dir),
    linhaDeBase: num(l.linha_de_base),
    zonas: Array.isArray(l.zonas) ? (l.zonas as unknown[]).map(Number).filter((z) => Number.isFinite(z) && z > 0) : null,
    descricao: typeof l.descricao === "string" ? l.descricao : "",
    pagina: typeof l.pagina === "number" ? l.pagina : null,
    origem: l.origem === "ia" ? "ia" : "pessoa",
    status: l.status === "ready" ? "ready" : "draft",
  };
}

export type OrigemDoGrid =
  | { tipo: "proposta" }
  | { tipo: "regra"; regra: RegraDeGrid; geral: boolean };

const arred = (v: number) => Math.round(v * 100) / 100;

/**
 * As escolhas de um formato com as regras da marca aplicadas, e de onde vieram.
 * Campo que a regra não define fica com a proposta do Brennimark.
 */
export function aplicarRegras(f: Formato, regras: readonly RegraDeGrid[]): { escolhas: Escolhas; origem: OrigemDoGrid } {
  const base = escolhasPadrao(f);
  const doFormato = regras.find((r) => r.formato === f.id);
  const geral = regras.find((r) => r.formato === "todos");
  const regra = doFormato ?? geral;
  if (!regra) return { escolhas: base, origem: { tipo: "proposta" } };

  // Regra geral: proporção do lado menor, na unidade do formato.
  const fator = regra.unidade === "proporcao" ? Math.min(f.largura, f.altura) : 1;
  const medida = (v: number | null, padrao: number) => (v === null ? padrao : arred(v * fator));
  const e: Escolhas = {
    ...base,
    tipo: regra.tipo,
    colunas: regra.colunas ?? base.colunas,
    linhas: regra.linhas ?? base.linhas,
    medianiz: medida(regra.medianiz, base.medianiz),
    margens: {
      sup: medida(regra.margemSup, base.margens.sup), inf: medida(regra.margemInf, base.margens.inf),
      esq: medida(regra.margemEsq, base.margens.esq), dir: medida(regra.margemDir, base.margens.dir),
    },
    linhaDeBase: regra.linhaDeBase ?? base.linhaDeBase,
    zonas: regra.zonas && regra.zonas.length >= 2 ? regra.zonas : base.zonas,
  };
  return { escolhas: e, origem: { tipo: "regra", regra, geral: !doFormato } };
}

/** Como a tela e o LEIA-ME dizem de onde veio o grid. */
export function fraseDaOrigem(o: OrigemDoGrid): string {
  if (o.tipo === "proposta") return "proposta do Brennimark — o manual não define o grid deste formato";
  const r = o.regra;
  const onde = r.pagina ? `do manual, p. ${r.pagina}` : r.origem === "ia" ? "do manual" : "informada por quem edita a marca";
  const geral = o.geral ? " (regra geral da marca, aplicada a este formato)" : "";
  const situacao = r.status === "ready" ? "aprovada" : r.origem === "ia" ? "lida pela IA, ainda não confirmada" : "ainda não aprovada";
  return `${onde}${geral} — ${situacao}`;
}

/** As escolhas da tela como regra da marca para aquele formato (o que o PATCH grava). */
export function regraDasEscolhas(f: Formato, e: Escolhas, extra: { descricao?: string; pagina?: number | null } = {}) {
  return {
    formato: f.id,
    tipo: e.tipo,
    unidade: f.unidade,
    colunas: e.tipo === "manuscrito" ? null : e.colunas,
    linhas: e.tipo === "modular" ? e.linhas : null,
    medianiz: e.tipo === "manuscrito" ? null : e.medianiz,
    margem_sup: e.margens.sup, margem_inf: e.margens.inf, margem_esq: e.margens.esq, margem_dir: e.margens.dir,
    linha_de_base: e.linhaDeBase,
    zonas: e.tipo === "hierarquico" ? e.zonas : null,
    descricao: (extra.descricao ?? "").slice(0, 300),
    pagina: extra.pagina ?? null,
  };
}

// ─── A leitura do manual pela IA ───────────────────────────────────────────

/**
 * Sete (15/10/2026; eram quatro): o manual da Bradesco tem sete páginas de
 * grid, e as duas com números (Estrutura 3×3 e 5×5) ficavam de fora do corte.
 */
export const MAXIMO_DE_PAGINAS_DO_GRID = 7;

const TERMOS_DO_GRID =
  /\b(grid|grade|grelha|malha|diagrama[çc][ãa]o|colunas|medianiz|calha|margens?|m[óo]dulos?|layout|baseline|linha\s+de\s+base|gutter|columns|margins)\b/i;

/** As páginas onde o manual fala de grid e diagramação. */
export function paginasDoGrid(trechos: readonly Trecho[], maximo = MAXIMO_DE_PAGINAS_DO_GRID): number[] {
  return paginasDoAssunto(trechos, TERMOS_DO_GRID, maximo);
}

const IDS_DOS_FORMATOS = FORMATOS.map((f) => f.id);

/** O pedido à IA: uma regra por linha, em JSON. */
export function instrucoesDoGrid(paginas: readonly number[]): string {
  const lista = FORMATOS.map((f) => `${f.id} (${f.nome}, ${String(f.largura).replace(".", ",")} × ${String(f.altura).replace(".", ",")} ${f.unidade})`).join("; ");
  return [
    "Você lê páginas de um manual de marca e transcreve as REGRAS DE GRID E DIAGRAMAÇÃO. Responda só com linhas JSON, uma por regra, nada mais.",
    `As páginas enviadas são, na ordem: ${paginas.join(", ")}.`,
    "",
    "Cada linha é um objeto com:",
    '{"formato": "...", "tipo": "manuscrito|colunas|modular|hierarquico", "colunas": n, "linhas": n, "medianiz": n, "margem_sup": n, "margem_inf": n, "margem_esq": n, "margem_dir": n, "linha_de_base": n, "zonas": [n, n], "descricao": "como o manual diz", "pagina": n}',
    "",
    `"formato" é um destes identificadores, quando o manual dá o grid de uma peça específica: ${lista}.`,
    'Se o manual define um sistema de grid geral (para todas as peças), use "formato": "todos", e dê margens e medianiz como FRAÇÃO DO LADO MENOR da peça (ex.: 0.08), nunca em mm ou px.',
    "Nas regras de um formato específico, margens e medianiz em mm para impressos e em px para digitais; linha de base em pt nos impressos e px nos digitais.",
    "",
    "Regras:",
    "- Só o que está nas páginas. Campo que o manual não dá, OMITA. Formato que o manual não cita, não escreva. Nunca invente nem complete com o usual.",
    "- Se o manual mede por um elemento (\"margem = 2x\", \"x = altura do símbolo\"), estime pela proporção do diagrama e diga a medida original em \"descricao\".",
    "- \"pagina\" é uma das enviadas.",
    "- Manual que define o grid como ESTRUTURA \"N×N\" ou \"NxM\" (ex.: \"Estrutura 3X3\", \"5x5\", módulos em frações 1/5, 2/5…) está dando um grid MODULAR: N COLUNAS × M LINHAS — \"3X3\" é 3 colunas e 3 linhas, nunca 1 coluna. Escreva \"tipo\": \"modular\", \"colunas\" e \"linhas\"; se ele vale para todas as peças, use \"formato\": \"todos\".",
    "- Só UMA regra por formato (por \"todos\"). Se o manual apresenta mais de uma estrutura (3X3 e depois 5X5), escreva SÓ a principal, a primeira que ele apresenta, e cite a outra em \"descricao\" (ex.: \"Estrutura 3X3; o manual traz também a 5X5\"). Em \"descricao\", copie o nome da estrutura como o manual escreve.",
    "- Diagrama de composição sem medida (onde vão a foto, o título, a assinatura) não é regra de grid: não escreva nada para ele.",
  ].join("\n");
}

export type RegraDeGridLida = Record<string, unknown> & { formato: string; tipo: TipoDeGrid; pagina: number };

const FAIXAS: Record<string, [number, number, boolean]> = {
  colunas: [1, 24, true], linhas: [1, 40, true], linha_de_base: [0.5, 200, false],
};

/**
 * A resposta da IA, conferida linha a linha — formato conhecido, tipo da lista,
 * números dentro do que o banco admite, página entre as enviadas. O campo
 * fora da faixa é descartado; a regra sem nada útil, também. A primeira de
 * cada formato vale. O banco confere de novo (constraints).
 */
export function lerRegrasDeGridDaIA(texto: string, paginasEnviadas: readonly number[]): RegraDeGridLida[] {
  const lidas: RegraDeGridLida[] = [];
  for (const linha of texto.split("\n")) {
    const i = linha.indexOf("{"), j = linha.lastIndexOf("}");
    if (i < 0 || j <= i) continue;
    let o: Record<string, unknown>;
    try { o = JSON.parse(linha.slice(i, j + 1)); } catch { continue; }
    const formato = String(o.formato ?? "").trim();
    if (formato !== "todos" && !IDS_DOS_FORMATOS.includes(formato)) continue;
    if (lidas.some((l) => l.formato === formato)) continue;
    const tipo = String(o.tipo ?? "") as TipoDeGrid;
    if (!TIPOS.includes(tipo)) continue;
    const pagina = Number(o.pagina);
    if (!paginasEnviadas.includes(pagina)) continue;
    const f = FORMATOS.find((x) => x.id === formato);
    const unidade = formato === "todos" ? "proporcao" : f!.unidade;
    const teto = unidade === "proporcao" ? 0.5 : unidade === "mm" ? 1000 : 10000;
    const regra: RegraDeGridLida = { formato, tipo, unidade, pagina, descricao: String(o.descricao ?? "").slice(0, 300) };
    let util = false;
    for (const [campo, [min, max, inteiro]] of Object.entries(FAIXAS)) {
      const v = Number(o[campo]);
      if (o[campo] !== undefined && Number.isFinite(v) && v >= min && v <= max) { regra[campo] = inteiro ? Math.round(v) : v; util = true; }
    }
    for (const campo of ["medianiz", "margem_sup", "margem_inf", "margem_esq", "margem_dir"]) {
      const v = Number(o[campo]);
      if (o[campo] !== undefined && Number.isFinite(v) && v >= 0 && v <= teto) { regra[campo] = v; util = true; }
    }
    if (Array.isArray(o.zonas)) {
      const z = (o.zonas as unknown[]).map(Number);
      if (z.length >= 2 && z.length <= 6 && z.every((n) => Number.isFinite(n) && n > 0)) { regra.zonas = z; util = true; }
    }
    // Rede de segurança (15/10/2026): na Bradesco a IA leu "Estrutura 3X3" e
    // gravou 1 coluna × 3 linhas. Quando a descrição traz "NxM" e a regra é
    // modular, as colunas e as linhas são esses números, e prevalecem.
    const estrutura = /(\d{1,2})\s*[x×X]\s*(\d{1,2})/.exec(String(regra.descricao));
    if (regra.tipo === "modular" && estrutura) {
      const [cols, lins] = [Number(estrutura[1]), Number(estrutura[2])];
      if (cols >= 1 && cols <= 24 && lins >= 1 && lins <= 40) { regra.colunas = cols; regra.linhas = lins; util = true; }
    }
    if (util) lidas.push(regra);
  }
  return lidas;
}
