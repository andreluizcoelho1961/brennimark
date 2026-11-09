import type { Trecho } from "../ai/recuperacao";
import { paginasDoAssunto } from "../ai/paginas-do-assunto";
import type { Tradutor } from "../i18n/tradutor";
import { FORMATOS, textoDoFormato, type Formato, type TipoDeGrid } from "./formatos";
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
  /** O nome da estrutura, como o manual a chama ("Estrutura 3X3"); '' quando só há uma. */
  variante: string;
  /** A linha de negócio ou meio a que vale ("Institucional", "Wealth"); '' quando vale para todos. */
  segmento: string;
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
  "id, formato, variante, segmento, tipo, unidade, colunas, linhas, medianiz, margem_sup, margem_inf, margem_esq, margem_dir, linha_de_base, zonas, descricao, pagina, origem, status";

const TIPOS: readonly TipoDeGrid[] = ["manuscrito", "colunas", "modular", "hierarquico"];
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export function deLinhaDaRegraDeGrid(l: Record<string, unknown>): RegraDeGrid | null {
  const tipo = l.tipo as TipoDeGrid;
  const unidade = l.unidade as RegraDeGrid["unidade"];
  if (!TIPOS.includes(tipo) || !["mm", "px", "proporcao"].includes(unidade)) return null;
  return {
    id: String(l.id), formato: String(l.formato), tipo, unidade,
    variante: typeof l.variante === "string" ? l.variante : "",
    segmento: typeof l.segmento === "string" ? l.segmento : "",
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

const arred = (v: number) => Math.round(v * 100) / 100;

/** O nome da regra na tela: "Estrutura 3X3 · Institucional"; sem nome, o que ela é. */
export function nomeDaRegra(r: Pick<RegraDeGrid, "formato" | "variante" | "segmento">, t: Tradutor): string {
  const base = r.variante || (r.formato === "todos" ? t("regras.gridGeral") : t("regras.gridDoFormato"));
  return r.segmento ? `${base} · ${r.segmento}` : base;
}

/**
 * Os grids da marca que valem para um formato: os DELE; sem nenhum, os da regra
 * geral (`todos`). Aprovados primeiro, depois por página e nome — a ordem em
 * que a tela os oferece, e o primeiro é o padrão.
 */
export function regrasDoFormato(f: Pick<Formato, "id">, regras: readonly RegraDeGrid[], t: Tradutor): { regras: RegraDeGrid[]; geral: boolean } {
  const doFormato = regras.filter((r) => r.formato === f.id);
  const geral = doFormato.length === 0;
  const lista = geral ? regras.filter((r) => r.formato === "todos") : doFormato;
  const ordem = [...lista].sort((a, b) =>
    Number(b.status === "ready") - Number(a.status === "ready")
    || (a.pagina ?? 9999) - (b.pagina ?? 9999)
    || nomeDaRegra(a, t).localeCompare(nomeDaRegra(b, t), t("idioma")));
  return { regras: ordem, geral };
}

export type OrigemDoGrid =
  | { tipo: "proposta" }
  | { tipo: "regra"; regra: RegraDeGrid; geral: boolean };

/**
 * As escolhas de um formato com as regras da marca aplicadas, e de onde vieram.
 * Campo que a regra não define fica com a proposta do Brennimark. Com várias
 * regras para o formato, vale a escolhida (`idEscolhido`, se ela vale para este
 * formato) ou a primeira da lista.
 */
export function aplicarRegras(f: Formato, regras: readonly RegraDeGrid[], t: Tradutor, idEscolhido?: string | null): { escolhas: Escolhas; origem: OrigemDoGrid } {
  const base = escolhasPadrao(f);
  const { regras: candidatas, geral } = regrasDoFormato(f, regras, t);
  const regra = candidatas.find((r) => r.id === idEscolhido) ?? candidatas[0];
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
  return { escolhas: e, origem: { tipo: "regra", regra, geral } };
}

/** Como a tela e o LEIA-ME dizem de onde veio o grid. */
export function fraseDaOrigem(o: OrigemDoGrid, t: Tradutor): string {
  if (o.tipo === "proposta") return t("regras.proposta");
  const r = o.regra;
  const nome = r.variante || r.segmento ? `${nomeDaRegra(r, t)} — ` : "";
  const onde = r.pagina ? t("regras.doManualPagina", { n: r.pagina }) : r.origem === "ia" ? t("regras.doManual") : t("regras.informada");
  const geral = o.geral ? ` ${t("regras.geral")}` : "";
  const situacao = r.status === "ready" ? t("regras.aprovada") : r.origem === "ia" ? t("regras.lidaPelaIA") : t("regras.naoAprovada");
  return `${nome}${onde}${geral} — ${situacao}`;
}

/** As escolhas da tela como regra da marca para aquele formato (o que o PATCH grava). */
export function regraDasEscolhas(f: Formato, e: Escolhas, extra: { descricao?: string; pagina?: number | null; variante?: string; segmento?: string } = {}) {
  return {
    formato: f.id,
    variante: extra.variante ?? "",
    segmento: extra.segmento ?? "",
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
 * Dez (16/10/2026; eram sete, e antes quatro): o manual da Bradesco tem dez
 * páginas de grid (28 a 37), com várias estruturas por segmento.
 */
export const MAXIMO_DE_PAGINAS_DO_GRID = 10;

const TERMOS_DO_GRID =
  /\b(grid|grade|grelha|malha|diagrama[çc][ãa]o|colunas|medianiz|calha|margens?|m[óo]dulos?|layout|baseline|linha\s+de\s+base|gutter|columns|margins)\b/i;

/** As páginas onde o manual fala de grid e diagramação. */
export function paginasDoGrid(trechos: readonly Trecho[], maximo = MAXIMO_DE_PAGINAS_DO_GRID): number[] {
  return paginasDoAssunto(trechos, TERMOS_DO_GRID, maximo);
}

const IDS_DOS_FORMATOS = FORMATOS.map((f) => f.id);

/** O pedido à IA: uma regra por linha, em JSON. */
/** O pedido à IA é sempre em português (os manuais e a conferência são); `t` só dá os nomes dos formatos. */
export function instrucoesDoGrid(paginas: readonly number[], t: Tradutor): string {
  const lista = FORMATOS.map((f) => `${f.id} (${textoDoFormato(f, t).nome}, ${String(f.largura).replace(".", ",")} × ${String(f.altura).replace(".", ",")} ${f.unidade})`).join("; ");
  return [
    "Você lê páginas de um manual de marca e transcreve as REGRAS DE GRID E DIAGRAMAÇÃO. Responda só com linhas JSON, uma por regra, nada mais.",
    `As páginas enviadas são, na ordem: ${paginas.join(", ")}.`,
    "",
    "Cada linha é um objeto com:",
    '{"formato": "...", "variante": "...", "segmento": "...", "tipo": "manuscrito|colunas|modular|hierarquico", "colunas": n, "linhas": n, "medianiz": n, "margem_sup": n, "margem_inf": n, "margem_esq": n, "margem_dir": n, "linha_de_base": n, "zonas": [n, n], "descricao": "como o manual diz", "pagina": n}',
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
    "- UMA regra por ESTRUTURA. O manual pode apresentar vários grids (\"Estrutura 3X3\", \"Estrutura 5X5\"…), e cada um é uma linha. \"variante\" é o NOME da estrutura copiado como o manual escreve (\"Estrutura 3X3\"); sem nome, omita.",
    "- \"segmento\" é a linha de negócio ou o meio a que o grid vale, copiado do título da página (ex.: \"Institucional / Varejo / Negócios Digitais\", \"Wealth / Atacado\"). O manual que repete as mesmas estruturas para segmentos diferentes tem uma linha por estrutura E por segmento. Grid que vale para todos: omita.",
    "- Não repita a mesma estrutura do mesmo segmento (a mesma estrutura costuma aparecer em páginas seguidas: escreva uma vez, com a primeira página).",
    "- Diagrama de composição sem medida (onde vão a foto, o título, a assinatura) não é regra de grid: não escreva nada para ele.",
  ].join("\n");
}

export type RegraDeGridLida = Record<string, unknown> & { formato: string; variante: string; segmento: string; tipo: TipoDeGrid; pagina: number };

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
    // Uma regra por formato × segmento × variante (a identidade no banco).
    const variante = String(o.variante ?? "").trim().slice(0, 60).trim();
    const segmento = String(o.segmento ?? "").trim().slice(0, 60).trim();
    if (lidas.some((l) => l.formato === formato && l.segmento === segmento && l.variante === variante)) continue;
    const tipo = String(o.tipo ?? "") as TipoDeGrid;
    if (!TIPOS.includes(tipo)) continue;
    const pagina = Number(o.pagina);
    if (!paginasEnviadas.includes(pagina)) continue;
    const f = FORMATOS.find((x) => x.id === formato);
    const unidade = formato === "todos" ? "proporcao" : f!.unidade;
    const teto = unidade === "proporcao" ? 0.5 : unidade === "mm" ? 1000 : 10000;
    const regra: RegraDeGridLida = { formato, variante, segmento, tipo, unidade, pagina, descricao: String(o.descricao ?? "").slice(0, 300) };
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
    const estrutura = /(\d{1,2})\s*[x×X]\s*(\d{1,2})/.exec(`${variante} ${String(regra.descricao)}`);
    if (regra.tipo === "modular" && estrutura) {
      const [cols, lins] = [Number(estrutura[1]), Number(estrutura[2])];
      if (cols >= 1 && cols <= 24 && lins >= 1 && lins <= 40) { regra.colunas = cols; regra.linhas = lins; util = true; }
    }
    if (util) lidas.push(regra);
  }
  return lidas;
}
