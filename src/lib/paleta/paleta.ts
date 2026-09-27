import type { SupabaseClient } from "@supabase/supabase-js";
import type { Trecho } from "../ai/recuperacao";

/**
 * A ficha da paleta da marca — as cores conferidas por uma pessoa (27/09/2026).
 *
 * No ensaio, o Vini contou 6 cores no Bradesco, onde há 19: a página da paleta
 * é uma tabela de amostras, e o texto extraído dela é uma sopa de códigos. A
 * ficha é a paleta como DADO — nome, papel, códigos, página de origem —, e o
 * status editorial de cada cor: quem edita redige, quem aprova aprova
 * (ADR-0002), e o banco garante a separação (`paleta_da_marca`).
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export const PAPEIS = ["principal", "apoio"] as const;
export type Papel = (typeof PAPEIS)[number];
export type StatusDaCor = "draft" | "ready";

export const NOME_MAXIMO = 80;
export const SEGMENTO_MAXIMO = 80;
export const CODIGO_MAXIMO = 40;

export type CorDaPaleta = {
  id: string;
  nome: string;
  papel: Papel;
  segmento: string;
  hex: string | null;
  rgb: string | null;
  cmyk: string | null;
  pms: string | null;
  pagina: number | null;
  ordem: number;
  status: StatusDaCor;
  aprovadoEm: string | null;
};

/** O que uma pessoa escreve: tudo menos o que o banco decide. */
export type CorEscrita = Omit<CorDaPaleta, "id" | "status" | "aprovadoEm">;

/**
 * HEX na forma canônica do banco: `#` e seis dígitos maiúsculos. Aceita o que
 * um designer cola — `cc092f`, `#CC092F`, `# cc 09 2f`, `#c02` —, e devolve
 * `null` para o que não é HEX.
 */
export function normalizarHex(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  let digitos = valor.replace(/[\s#]/g, "").toUpperCase();
  if (/^[0-9A-F]{3}$/.test(digitos)) digitos = digitos.split("").map((c) => c + c).join("");
  return /^[0-9A-F]{6}$/.test(digitos) ? `#${digitos}` : null;
}

function textoOpcional(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim().replace(/\s+/g, " ");
  return limpo === "" ? null : limpo;
}

export type MotivoDaRecusa =
  | "nome" | "papel" | "segmento" | "hex" | "codigo-longo" | "sem-codigo" | "pagina";

export type CorLida = { ok: true; cor: CorEscrita } | { ok: false; motivo: MotivoDaRecusa };

/**
 * Confere o corpo de um pedido com as MESMAS regras das constraints do banco,
 * para a recusa chegar com mensagem legível em vez de "erro ao salvar". O
 * banco continua sendo a fronteira: isto é cortesia, não segurança.
 */
export function lerCorEscrita(corpo: unknown, paginasDoManual: number | null = null): CorLida {
  const c = (corpo ?? {}) as Record<string, unknown>;

  const nome = textoOpcional(c.nome);
  if (!nome || nome.length > NOME_MAXIMO) return { ok: false, motivo: "nome" };

  if (!PAPEIS.includes(c.papel as Papel)) return { ok: false, motivo: "papel" };
  const papel = c.papel as Papel;

  const segmento = textoOpcional(c.segmento) ?? "";
  if (segmento.length > SEGMENTO_MAXIMO) return { ok: false, motivo: "segmento" };

  const hexBruto = textoOpcional(c.hex);
  const hex = hexBruto === null ? null : normalizarHex(hexBruto);
  if (hexBruto !== null && hex === null) return { ok: false, motivo: "hex" };

  const rgb = textoOpcional(c.rgb);
  const cmyk = textoOpcional(c.cmyk);
  const pms = textoOpcional(c.pms);
  if ([rgb, cmyk, pms].some((v) => v !== null && v.length > CODIGO_MAXIMO)) return { ok: false, motivo: "codigo-longo" };
  if (hex === null && rgb === null && cmyk === null && pms === null) return { ok: false, motivo: "sem-codigo" };

  let pagina: number | null = null;
  if (c.pagina !== null && c.pagina !== undefined && c.pagina !== "") {
    const n = Number(c.pagina);
    if (!Number.isInteger(n) || n < 1 || (paginasDoManual !== null && n > paginasDoManual)) return { ok: false, motivo: "pagina" };
    pagina = n;
  }

  const ordemBruta = Number(c.ordem);
  const ordem = Number.isInteger(ordemBruta) ? ordemBruta : 0;

  return { ok: true, cor: { nome, papel, segmento, hex, rgb, cmyk, pms, pagina, ordem } };
}

/** Principais antes, depois a ordem escolhida, depois o nome. */
export function ordenarPaleta<T extends Pick<CorDaPaleta, "papel" | "ordem" | "nome">>(cores: readonly T[]): T[] {
  return [...cores].sort((a, b) =>
    (a.papel === b.papel ? 0 : a.papel === "principal" ? -1 : 1)
    || a.ordem - b.ordem
    || a.nome.localeCompare(b.nome, "pt-BR"));
}

const COLUNAS = "id, nome, papel, segmento, hex, rgb, cmyk, pms, pagina, ordem, status, aprovado_em";

export function deLinha(linha: Record<string, unknown>): CorDaPaleta {
  return {
    id: String(linha.id),
    nome: String(linha.nome ?? ""),
    papel: linha.papel === "principal" ? "principal" : "apoio",
    segmento: String(linha.segmento ?? ""),
    hex: typeof linha.hex === "string" ? linha.hex : null,
    rgb: typeof linha.rgb === "string" ? linha.rgb : null,
    cmyk: typeof linha.cmyk === "string" ? linha.cmyk : null,
    pms: typeof linha.pms === "string" ? linha.pms : null,
    pagina: typeof linha.pagina === "number" ? linha.pagina : null,
    ordem: typeof linha.ordem === "number" ? linha.ordem : 0,
    status: linha.status === "ready" ? "ready" : "draft",
    aprovadoEm: typeof linha.aprovado_em === "string" ? linha.aprovado_em : null,
  };
}

/**
 * A ficha da marca, lida com a SESSÃO de quem pede: a RLS decide o que a
 * pessoa vê, e o `brand_id` vai como filtro obrigatório.
 */
export async function lerPaleta(
  supabase: SupabaseClient,
  brandId: string,
): Promise<{ ok: true; cores: CorDaPaleta[] } | { ok: false }> {
  const { data, error } = await supabase
    .from("paleta_da_marca")
    .select(COLUNAS)
    .eq("brand_id", brandId);
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "paleta_indisponivel", code: error.code ?? "unknown", brandId }));
    return { ok: false };
  }
  return { ok: true, cores: ordenarPaleta((data ?? []).map((l) => deLinha(l as Record<string, unknown>))) };
}

export { COLUNAS as COLUNAS_DA_PALETA };

// ─── Para o Vini ─────────────────────────────────────────────────────────────

export const SLUG_DA_FICHA = "ficha-da-paleta";
export const SLUG_DA_FICHA_EM_RASCUNHO = "ficha-da-paleta-rascunho";

export function ehFichaDaPaleta(trecho: Pick<Trecho, "documentSlug">): boolean {
  return trecho.documentSlug === SLUG_DA_FICHA || trecho.documentSlug === SLUG_DA_FICHA_EM_RASCUNHO;
}

function linhaDaCor(cor: CorDaPaleta, ingles: boolean): string {
  const codigos = [
    cor.hex && `HEX ${cor.hex}`,
    cor.rgb && `RGB ${cor.rgb}`,
    cor.cmyk && `CMYK ${cor.cmyk}`,
    cor.pms && `PMS ${cor.pms}`,
  ].filter(Boolean).join(" · ");
  const papel = cor.papel === "principal" ? (ingles ? "primary" : "principal") : (ingles ? "support" : "apoio");
  const segmento = cor.segmento ? ` · ${ingles ? "segment" : "segmento"}: ${cor.segmento}` : "";
  const pagina = cor.pagina !== null ? ` · p. ${cor.pagina}` : "";
  return `- ${cor.nome} (${papel}${segmento}) — ${codigos}${pagina}`;
}

function contagem(cores: readonly CorDaPaleta[], ingles: boolean): string {
  const principais = cores.filter((c) => c.papel === "principal").length;
  const apoio = cores.length - principais;
  return ingles
    ? `${cores.length} color(s): ${principais} primary, ${apoio} support.`
    : `${cores.length} cor(es): ${principais} principal(is), ${apoio} de apoio.`;
}

/**
 * A ficha como fontes do Vini — uma para as cores APROVADAS e outra para as
 * em RASCUNHO, cada uma com o seu status. "Só regra aprovada entra num prompt
 * em silêncio" (ADR-0004 §3.2): o rascunho vai, mas com o rótulo de rascunho,
 * e a regra do prompt manda identificá-lo.
 *
 * A contagem vai pronta: foi contar que o Vini errou.
 */
export function trechosDaFicha(cores: readonly CorDaPaleta[], ingles: boolean): Trecho[] {
  const trechos: Trecho[] = [];
  const grupos: [StatusDaCor, string, string][] = [
    ["ready", SLUG_DA_FICHA, ingles ? "Palette sheet (approved)" : "Ficha da paleta (aprovada)"],
    ["draft", SLUG_DA_FICHA_EM_RASCUNHO, ingles ? "Palette sheet (draft)" : "Ficha da paleta (rascunho)"],
  ];
  for (const [status, slug, titulo] of grupos) {
    const doGrupo = ordenarPaleta(cores.filter((c) => c.status === status));
    if (doGrupo.length === 0) continue;
    const paginas = doGrupo.map((c) => c.pagina).filter((p): p is number => p !== null);
    trechos.push({
      documentSlug: slug,
      documentTitle: titulo,
      groupName: ingles ? "Colors" : "Cores",
      section: null,
      status,
      pageStart: paginas.length > 0 ? Math.min(...paginas) : null,
      pageEnd: paginas.length > 0 ? Math.max(...paginas) : null,
      content: [contagem(doGrupo, ingles), ...doGrupo.map((c) => linhaDaCor(c, ingles))].join("\n"),
    });
  }
  return trechos;
}
