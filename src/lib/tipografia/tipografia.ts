import type { SupabaseClient } from "@supabase/supabase-js";
import type { Trecho } from "../ai/recuperacao";
import { paginasDoAssunto } from "../ai/paginas-do-assunto";

/**
 * A TIPOGRAFIA DA MARCA (14/10/2026) — a tabela `tipografia_da_marca` (#118),
 * desenho aprovado pelo André: uma linha por USO, com segmento opcional.
 *
 * Guarda o NOME da fonte, nunca o arquivo (ADR-0007: a hospedagem segue
 * bloqueada até o termo de licença). O designer instala a fonte; o InDesign
 * a acha pelo nome — família e estilo, ou o PostScript, que é exato.
 *
 * Tudo aqui é puro, menos `lerTipografia`: as rotas fazem as chamadas, e isto
 * confere. As regras de validação são as MESMAS das constraints do banco,
 * para a recusa chegar com mensagem legível; o banco continua a fronteira.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export const USOS = ["titulo", "subtitulo", "texto", "legenda", "destaque", "apoio"] as const;
export type Uso = (typeof USOS)[number];

export const NOMES_DOS_USOS: Record<Uso, { pt: string; en: string }> = {
  titulo: { pt: "Título", en: "Heading" },
  subtitulo: { pt: "Subtítulo", en: "Subheading" },
  texto: { pt: "Texto", en: "Body" },
  legenda: { pt: "Legenda", en: "Caption" },
  destaque: { pt: "Destaque", en: "Highlight" },
  apoio: { pt: "Apoio", en: "Support" },
};

export type FonteDaMarca = {
  id: string;
  uso: Uso;
  segmento: string;
  familia: string;
  estilo: string;
  postscript: string | null;
  substituta: string | null;
  corpo: number | null;
  entrelinha: number | null;
  espacejamento: number | null;
  caixaAlta: boolean | null;
  descricao: string;
  pagina: number | null;
  ordem: number;
  origem: "ia" | "pessoa";
  status: "draft" | "ready";
  aprovadoEm: string | null;
};

/** O que uma pessoa escreve (o banco cuida de id, origem e situação). */
export type FonteEscrita = {
  uso: Uso; segmento: string; familia: string; estilo: string; postscript: string | null; substituta: string | null;
  corpo: number | null; entrelinha: number | null; espacejamento: number | null; caixa_alta: boolean | null;
  descricao: string; pagina: number | null; ordem: number;
};

export const COLUNAS_DA_TIPOGRAFIA =
  "id, uso, segmento, familia, estilo, postscript, substituta, corpo, entrelinha, espacejamento, caixa_alta, descricao, pagina, ordem, origem, status, aprovado_em";

// Os limites das constraints de `tipografia_da_marca`.
export const LIMITES = {
  segmento: 60, familia: 120, estilo: 60, substituta: 120, descricao: 300,
  corpo: 1000, entrelinha: 2000, espacejamento: [-500, 2000] as const,
};
export const POSTSCRIPT = /^[A-Za-z0-9-]{1,127}$/;

const numero = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;

export function deLinhaDaTipografia(l: Record<string, unknown>): FonteDaMarca | null {
  const uso = l.uso as Uso;
  if (!USOS.includes(uso)) return null;
  return {
    id: String(l.id), uso,
    segmento: typeof l.segmento === "string" ? l.segmento : "",
    familia: String(l.familia ?? ""),
    estilo: typeof l.estilo === "string" ? l.estilo : "",
    postscript: typeof l.postscript === "string" ? l.postscript : null,
    substituta: typeof l.substituta === "string" ? l.substituta : null,
    corpo: numero(l.corpo), entrelinha: numero(l.entrelinha), espacejamento: numero(l.espacejamento),
    caixaAlta: typeof l.caixa_alta === "boolean" ? l.caixa_alta : null,
    descricao: typeof l.descricao === "string" ? l.descricao : "",
    pagina: typeof l.pagina === "number" ? l.pagina : null,
    ordem: typeof l.ordem === "number" ? l.ordem : 0,
    origem: l.origem === "ia" ? "ia" : "pessoa",
    status: l.status === "ready" ? "ready" : "draft",
    aprovadoEm: typeof l.aprovado_em === "string" ? l.aprovado_em : null,
  };
}

/** Na ordem dos usos (título primeiro), depois o segmento ("" antes), depois a ordem. */
export function ordenarTipografia<T extends Pick<FonteDaMarca, "uso" | "segmento" | "ordem">>(fontes: readonly T[]): T[] {
  return [...fontes].sort((a, b) =>
    USOS.indexOf(a.uso) - USOS.indexOf(b.uso) || a.segmento.localeCompare(b.segmento, "pt-BR") || a.ordem - b.ordem);
}

/** "Bradesco Sans Bold" — como a pessoa procura no menu de fontes. */
export function nomeDaFonte(f: Pick<FonteDaMarca, "familia" | "estilo">): string {
  return f.estilo ? `${f.familia} ${f.estilo}` : f.familia;
}

/** As medidas que o manual dá, numa linha: "32/36 pt · espacejamento 20 · caixa alta". */
export function medidasDaFonte(f: Pick<FonteDaMarca, "corpo" | "entrelinha" | "espacejamento" | "caixaAlta">, ingles = false): string[] {
  const partes: string[] = [];
  const n = (v: number) => (ingles ? String(v) : String(v).replace(".", ","));
  if (f.corpo !== null && f.entrelinha !== null) partes.push(`${n(f.corpo)}/${n(f.entrelinha)} pt`);
  else if (f.corpo !== null) partes.push(`${n(f.corpo)} pt`);
  else if (f.entrelinha !== null) partes.push(ingles ? `leading ${n(f.entrelinha)} pt` : `entrelinha ${n(f.entrelinha)} pt`);
  if (f.espacejamento !== null) partes.push(ingles ? `tracking ${f.espacejamento}` : `espacejamento ${f.espacejamento}`);
  if (f.caixaAlta === true) partes.push(ingles ? "all caps" : "caixa alta");
  return partes;
}

export type MotivoDaRecusa =
  | "uso" | "segmento" | "familia" | "estilo" | "postscript" | "substituta"
  | "corpo" | "entrelinha" | "espacejamento" | "descricao" | "pagina";

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const textoOuNulo = (v: unknown): string | null => {
  const t = texto(v);
  return t === "" ? null : t;
};

/** Confere o corpo de um pedido com as regras das constraints do banco. */
export function lerFonteEscrita(
  corpo: unknown,
  paginasDoManual: number | null = null,
): { ok: true; fonte: FonteEscrita } | { ok: false; motivo: MotivoDaRecusa } {
  const c = (corpo ?? {}) as Record<string, unknown>;
  if (!USOS.includes(c.uso as Uso)) return { ok: false, motivo: "uso" };
  const segmento = texto(c.segmento);
  if (segmento.length > LIMITES.segmento) return { ok: false, motivo: "segmento" };
  const familia = texto(c.familia);
  if (familia.length < 1 || familia.length > LIMITES.familia) return { ok: false, motivo: "familia" };
  const estilo = texto(c.estilo);
  if (estilo.length > LIMITES.estilo) return { ok: false, motivo: "estilo" };
  const postscript = textoOuNulo(c.postscript);
  if (postscript !== null && !POSTSCRIPT.test(postscript)) return { ok: false, motivo: "postscript" };
  const substituta = textoOuNulo(c.substituta);
  if (substituta !== null && substituta.length > LIMITES.substituta) return { ok: false, motivo: "substituta" };

  const medida = (chave: string) => {
    const bruto = c[chave];
    if (bruto === null || bruto === undefined || bruto === "") return { ok: true as const, v: null };
    const v = Number(String(bruto).replace(",", "."));
    return Number.isFinite(v) ? { ok: true as const, v } : { ok: false as const };
  };
  const mc = medida("corpo");
  if (!mc.ok || (mc.v !== null && !(mc.v > 0 && mc.v <= LIMITES.corpo))) return { ok: false, motivo: "corpo" };
  const me = medida("entrelinha");
  if (!me.ok || (me.v !== null && !(me.v > 0 && me.v <= LIMITES.entrelinha))) return { ok: false, motivo: "entrelinha" };
  const ms = medida("espacejamento");
  const [minE, maxE] = LIMITES.espacejamento;
  if (!ms.ok || (ms.v !== null && !(Number.isInteger(ms.v) && ms.v >= minE && ms.v <= maxE))) return { ok: false, motivo: "espacejamento" };

  const caixa_alta = c.caixa_alta === true || c.caixa_alta === "sim" ? true : c.caixa_alta === false || c.caixa_alta === "nao" ? false : null;
  const descricao = texto(c.descricao);
  if (descricao.length > LIMITES.descricao) return { ok: false, motivo: "descricao" };

  let pagina: number | null = null;
  if (c.pagina !== null && c.pagina !== undefined && c.pagina !== "") {
    const n = Number(c.pagina);
    if (!Number.isInteger(n) || n < 1 || (paginasDoManual !== null && n > paginasDoManual)) return { ok: false, motivo: "pagina" };
    pagina = n;
  }
  const ordemBruta = Number(c.ordem);
  const ordem = Number.isInteger(ordemBruta) ? ordemBruta : 0;

  return {
    ok: true,
    fonte: {
      uso: c.uso as Uso, segmento, familia, estilo, postscript, substituta,
      corpo: mc.v, entrelinha: me.v, espacejamento: ms.v, caixa_alta, descricao, pagina, ordem,
    },
  };
}

export async function lerTipografia(
  supabase: SupabaseClient,
  brandId: string,
): Promise<{ ok: true; fontes: FonteDaMarca[] } | { ok: false }> {
  const { data, error } = await supabase.from("tipografia_da_marca").select(COLUNAS_DA_TIPOGRAFIA).eq("brand_id", brandId);
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "tipografia_indisponivel", code: error.code ?? "unknown", brandId }));
    return { ok: false };
  }
  return {
    ok: true,
    fontes: ordenarTipografia((data ?? []).map((l) => deLinhaDaTipografia(l as Record<string, unknown>)).filter((f): f is FonteDaMarca => f !== null)),
  };
}

// ─── A leitura do manual pela IA ───────────────────────────────────────────

export const MAXIMO_DE_PAGINAS_DA_TIPOGRAFIA = 4;

const TERMOS_DA_TIPOGRAFIA =
  /\b(tipografia|tipogr[áa]fic[ao]s?|fontes?|fam[íi]lias?\s+tipogr|typeface|typography|fonts?|font\s+family)\b/i;

/** As páginas onde o manual trata de tipografia (pelo texto já indexado; menu repetido não conta). */
export function paginasDaTipografia(trechos: readonly Trecho[], maximo = MAXIMO_DE_PAGINAS_DA_TIPOGRAFIA): number[] {
  return paginasDoAssunto(trechos, TERMOS_DA_TIPOGRAFIA, maximo);
}

/** As páginas que quem edita digitou ("21, 22"), conferidas. */
export function lerPaginasPedidas(
  valor: unknown,
  paginasDoManual: number | null,
): { ok: true; paginas: number[] } | { ok: false; motivo: "formato" | "demais" | "fora-do-manual" } {
  if (valor === undefined || valor === null || valor === "") return { ok: true, paginas: [] };
  const numeros = String(valor).split(/[,;\s]+/).filter(Boolean).map(Number);
  if (numeros.some((n) => !Number.isInteger(n) || n < 1)) return { ok: false, motivo: "formato" };
  const unicas = [...new Set(numeros)].sort((a, b) => a - b);
  if (unicas.length > MAXIMO_DE_PAGINAS_DA_TIPOGRAFIA) return { ok: false, motivo: "demais" };
  if (paginasDoManual !== null && unicas.some((n) => n > paginasDoManual)) return { ok: false, motivo: "fora-do-manual" };
  return { ok: true, paginas: unicas };
}

/** O pedido à IA: uma fonte por linha, em JSON. */
export function instrucoesDaTipografia(paginas: readonly number[]): string {
  return [
    "Você lê páginas de um manual de marca e transcreve a TIPOGRAFIA DA MARCA: que fonte vai em cada uso. Responda só com linhas JSON, uma por fonte, nada mais.",
    `As páginas enviadas são, na ordem: ${paginas.join(", ")}.`,
    "",
    "Cada linha é um objeto com:",
    '{"uso": "titulo|subtitulo|texto|legenda|destaque|apoio", "segmento": "", "familia": "...", "estilo": "...", "postscript": "...", "substituta": "...", "corpo": n, "entrelinha": n, "espacejamento": n, "caixa_alta": true|false, "descricao": "como o manual diz", "pagina": n}',
    "",
    "Os usos: titulo (títulos e chamadas), subtitulo, texto (texto corrido), legenda, destaque (números, citações, frases em evidência), apoio (fonte secundária ou complementar).",
    'Quando o manual nomeia a fonte sem dizer o uso: a fonte "principal", "institucional" ou "primária" vai em "titulo"; a "secundária", "de apoio" ou "complementar", em "apoio". Se uma família só serve para tudo, escreva "texto" e diga isso em "descricao".',
    '"familia" é o nome da família como aparece no menu de fontes ("Bradesco Sans"); "estilo" é o peso ou variação ("Bold", "Light Italic"). Um peso diferente por uso vira uma linha por uso.',
    '"postscript" é o nome técnico sem espaços ("BradescoSans-Bold"): só se a página o escreve.',
    '"substituta" é a fonte de sistema que o manual manda usar onde a da marca não roda (e-mail, Office, web): só se a página diz.',
    '"segmento" só quando o manual separa por meio ou linha ("impresso", "digital"); senão, "".',
    '"corpo" e "entrelinha" em pt; "espacejamento" em milésimos de eme (o tracking do InDesign); "caixa_alta" só se o manual manda.',
    "",
    "Regras:",
    "- Só o que está nas páginas. Campo que o manual não dá, OMITA. Nunca invente nem complete com o usual; nunca deduza o nome pela aparência das letras.",
    "- Copie os nomes exatamente como escritos.",
    '- "pagina" é uma das enviadas.',
  ].join("\n");
}

export type FonteLida = {
  uso: Uso; segmento: string; familia: string; estilo: string; pagina: number; descricao: string; ordem: number;
  postscript?: string; substituta?: string; corpo?: number; entrelinha?: number; espacejamento?: number; caixa_alta?: boolean;
};

/**
 * A resposta da IA, conferida linha a linha — uso da lista, família presente,
 * cada campo dentro do que o banco admite, página entre as enviadas. O campo
 * fora da faixa é descartado (não a linha); a primeira de cada uso e segmento
 * vale. O banco confere de novo (constraints).
 */
export function lerTipografiaDaIA(textoDaIA: string, paginasEnviadas: readonly number[]): FonteLida[] {
  const lidas: FonteLida[] = [];
  for (const linha of textoDaIA.split("\n")) {
    const i = linha.indexOf("{"), j = linha.lastIndexOf("}");
    if (i < 0 || j <= i) continue;
    let o: Record<string, unknown>;
    try { o = JSON.parse(linha.slice(i, j + 1)); } catch { continue; }
    const uso = String(o.uso ?? "").trim() as Uso;
    if (!USOS.includes(uso)) continue;
    const familia = texto(o.familia);
    if (familia.length < 1 || familia.length > LIMITES.familia) continue;
    const pagina = Number(o.pagina);
    if (!paginasEnviadas.includes(pagina)) continue;
    const segmento = texto(o.segmento).slice(0, LIMITES.segmento).trim();
    if (lidas.some((l) => l.uso === uso && l.segmento === segmento)) continue;

    const f: FonteLida = {
      uso, segmento, familia, estilo: texto(o.estilo).slice(0, LIMITES.estilo).trim(), pagina,
      descricao: texto(o.descricao).slice(0, LIMITES.descricao), ordem: lidas.length,
    };
    const ps = texto(o.postscript);
    if (POSTSCRIPT.test(ps)) f.postscript = ps;
    const sub = texto(o.substituta);
    if (sub && sub.length <= LIMITES.substituta) f.substituta = sub;
    const corpo = Number(o.corpo);
    if (o.corpo !== undefined && Number.isFinite(corpo) && corpo > 0 && corpo <= LIMITES.corpo) f.corpo = corpo;
    const entrelinha = Number(o.entrelinha);
    if (o.entrelinha !== undefined && Number.isFinite(entrelinha) && entrelinha > 0 && entrelinha <= LIMITES.entrelinha) f.entrelinha = entrelinha;
    const esp = Number(o.espacejamento);
    if (o.espacejamento !== undefined && Number.isInteger(esp) && esp >= LIMITES.espacejamento[0] && esp <= LIMITES.espacejamento[1]) f.espacejamento = esp;
    if (typeof o.caixa_alta === "boolean") f.caixa_alta = o.caixa_alta;
    lidas.push(f);
  }
  return lidas;
}
