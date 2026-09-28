import type { SupabaseClient } from "@supabase/supabase-js";
import type { CorDaPaleta } from "./paleta";

/**
 * A cor CONFERIDA NO MANUAL — decisão do André, 27/09/2026 (opção A).
 *
 * A IA lê a imagem da página; o PDF traz também o TEXTO da página, e na tabela
 * de amostras esse texto é justamente a "sopa de códigos". Cada código que a
 * IA transcreveu é procurado ali. Achou todos → "conferida no manual". Faltou
 * algum → "conferir", dizendo qual. Sem IA, sem custo, sem banco novo: é
 * calculado na hora, a partir do índice que já existe (`brand_chunks`).
 *
 * A conferência NÃO aprova. Ela diz em que a pessoa pode confiar, e a tela
 * oferece "Aprovar as conferidas" — um clique, de uma pessoa. "Só pessoa
 * aprova" é o que se vende ao dono da marca.
 *
 * O que ela prova e o que não prova: que cada código ESTÁ ESCRITO naquela
 * página. Não prova que o código pertence àquela cor e não à do lado — isso a
 * imagem decide, e a amostra na tela deixa a pessoa ver.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type Conferencia =
  | { estado: "conferida" }
  | {
      estado: "conferir";
      faltam: ("HEX" | "RGB" | "CMYK" | "PMS")[];
      /** Os códigos TODOS estão escritos em outra página: a página gravada é que está errada. */
      achadaNaPagina?: number;
    }
  | { estado: "sem-pagina" };

export type CorConferida = CorDaPaleta & { conferencia?: Conferencia };

/** Texto comparável: caixa alta, espaços únicos. */
function normalizar(texto: string): string {
  return texto.toUpperCase().replace(/\s+/g, " ");
}

function numeros(valor: string): string[] {
  return valor.match(/\d+(?:[.,]\d+)?/g) ?? [];
}

/**
 * Os números de um código, na ordem, com as letras opcionais: "C0 M100 Y75 K4",
 * "0 100 75 4" e "0/100/75/4" são o mesmo CMYK. O manual do Bradesco imprime
 * "167 G169 B172" (sem o R) — também casa.
 */
function padraoDeSequencia(valores: string[], letras: string): RegExp | null {
  if (valores.length !== letras.length) return null;
  const partes = valores.map((n, i) => `(?:${letras[i]}\\s*:?\\s*)?${n.replace(/[.,]/, "[.,]")}`);
  return new RegExp(`(?<![\\d.,])${partes.join("\\s*[,/;|]?\\s*")}(?![\\d])`);
}

function temHex(texto: string, hex: string): boolean {
  const digitos = hex.replace("#", "").toUpperCase();
  return new RegExp(`(?<![0-9A-F])#?${digitos}(?![0-9A-F])`).test(texto);
}

function temPms(texto: string, pms: string): boolean {
  const nucleo = pms.toUpperCase().replace(/^(PMS|PANTONE)\s*/, "").trim();
  const m = /^(\d+)\s*([A-Z]*)$/.exec(nucleo);
  if (!m) return texto.includes(nucleo);
  const sufixo = m[2] ? `\\s*${m[2]}` : "(?:\\s*[A-Z]{1,2})?";
  return new RegExp(`(?:PMS|PANTONE)\\s*${m[1]}${sufixo}(?![\\dA-Z])`).test(texto);
}

/** Uma cor contra o texto da página dela. Pura. */
export function conferirNoTexto(cor: Pick<CorDaPaleta, "hex" | "rgb" | "cmyk" | "pms" | "pagina">, textoDaPagina: string | null): Conferencia {
  if (cor.pagina === null || !textoDaPagina) return { estado: "sem-pagina" };
  const texto = normalizar(textoDaPagina);
  const faltam: ("HEX" | "RGB" | "CMYK" | "PMS")[] = [];

  if (cor.hex && !temHex(texto, cor.hex)) faltam.push("HEX");
  if (cor.rgb) {
    const padrao = padraoDeSequencia(numeros(cor.rgb), "RGB");
    if (!padrao || !padrao.test(texto)) faltam.push("RGB");
  }
  if (cor.cmyk) {
    const padrao = padraoDeSequencia(numeros(cor.cmyk), "CMYK");
    if (!padrao || !padrao.test(texto)) faltam.push("CMYK");
  }
  if (cor.pms && !temPms(texto, cor.pms)) faltam.push("PMS");

  return faltam.length === 0 ? { estado: "conferida" } : { estado: "conferir", faltam };
}

/**
 * O texto de cada página, montado dos trechos indexados que a cobrem. Um
 * trecho que atravessa várias páginas entra em todas elas — a conferência fica
 * um pouco mais larga ali, nunca mais estreita.
 */
export function textosPorPagina(
  trechos: readonly { page_start: number | null; page_end: number | null; content: string }[],
  paginas: readonly number[],
): Map<number, string> {
  const mapa = new Map<number, string>();
  for (const p of paginas) {
    const partes = trechos
      .filter((t) => t.page_start !== null && t.page_start <= p && (t.page_end ?? t.page_start) >= p)
      .map((t) => t.content);
    if (partes.length > 0) mapa.set(p, partes.join("\n"));
  }
  return mapa;
}

/**
 * A conferência de uma cor, e — se os códigos não estão na página dela — a
 * página onde ESTÃO. Ensaio de 27/09: a IA pôs o branco do Bradesco na p. 21,
 * que mostra o branco sem código; os códigos estão na p. 22.
 */
export function conferirNoManual(
  cor: Pick<CorDaPaleta, "hex" | "rgb" | "cmyk" | "pms" | "pagina">,
  textos: ReadonlyMap<number, string>,
): Conferencia {
  const naPagina = conferirNoTexto(cor, cor.pagina === null ? null : (textos.get(cor.pagina) ?? null));
  if (naPagina.estado === "conferida") return naPagina;
  const outras = [...textos.keys()].filter((p) => p !== cor.pagina).sort((a, b) => a - b);
  const achada = outras.find((p) => conferirNoTexto({ ...cor, pagina: p }, textos.get(p)!).estado === "conferida");
  if (achada === undefined) return naPagina;
  return {
    estado: "conferir",
    faltam: naPagina.estado === "conferir" ? naPagina.faltam : [],
    achadaNaPagina: achada,
  };
}

/**
 * A ficha com a conferência de cada cor — lida com a SESSÃO (a RLS de
 * `brand_chunks` decide). Falhar ao ler o texto não esconde a ficha: as cores
 * voltam sem conferência, e a tela não mostra selo nenhum.
 */
export async function conferirPaleta<T extends CorDaPaleta>(
  supabase: SupabaseClient,
  brandId: string,
  cores: readonly T[],
): Promise<(T & { conferencia?: Conferencia })[]> {
  if (cores.length === 0) return [];
  const { data, error } = await supabase
    .from("brand_chunks")
    .select("page_start, page_end, content")
    .eq("brand_id", brandId);
  if (error || !data) return cores.map((c) => ({ ...c }));

  const trechos = data as { page_start: number | null; page_end: number | null; content: string }[];
  const todas = [...new Set(trechos.flatMap((t) => {
    if (t.page_start === null) return [];
    const fim = t.page_end ?? t.page_start;
    return Array.from({ length: fim - t.page_start + 1 }, (_, i) => t.page_start! + i);
  }))];
  const textos = textosPorPagina(trechos, todas);
  return cores.map((c) => ({ ...c, conferencia: conferirNoManual(c, textos) }));
}
