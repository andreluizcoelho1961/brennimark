/**
 * Que arquivo o Kit abre (10/10/2026) — "o designer guarda o logo em .ai".
 *
 * - imagem: SVG, PNG, JPG, WebP, GIF e AVIF, que o navegador desenha;
 * - pdf: PDF e AI. O Illustrator salva o .ai com "compatibilidade PDF" ligada
 *   por padrão, e aí ele É um PDF; o Kit desenha a primeira página com o
 *   PDF.js que o produto já tem (o mesmo das miniaturas dos Materiais);
 * - fora: EPS (PostScript; o único leitor sério, o Ghostscript, é AGPL),
 *   Affinity e CorelDRAW (formatos fechados, sem leitor livre). A recusa diz
 *   o formato e o que fazer — nunca "não tem logotipo".
 *
 * Um .ai salvo SEM compatibilidade PDF começa com "%!PS" em vez de "%PDF":
 * `motivoDoCabecalho` reconhece pelos primeiros bytes.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

/** Por que o Kit não abre o arquivo; o texto vem de `textoDaRecusa`, no idioma da tela. */
import type { Tradutor } from "../i18n/tradutor";

export type MotivoDaRecusa = "eps" | "affinity" | "corel" | "aiSemPdf" | "outro";

export type Formato =
  | { tipo: "imagem"; mime: string }
  | { tipo: "pdf" }
  | { tipo: "fora"; motivo: MotivoDaRecusa; extensao: string };

const IMAGENS: Record<string, string> = {
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", gif: "image/gif", avif: "image/avif",
};
const MIMES_DE_IMAGEM = new Set(Object.values(IMAGENS));

const FORA: Record<string, MotivoDaRecusa> = {
  eps: "eps", afdesign: "affinity", afphoto: "affinity", afpub: "affinity", af: "affinity", cdr: "corel",
};

function extensao(nome: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(nome.trim());
  return m ? m[1].toLowerCase() : "";
}

export function formatoDoArquivo(nome: string, mime: string): Formato {
  const ext = extensao(nome);
  const tipo = (mime || "").toLowerCase();
  if (FORA[ext]) return { tipo: "fora", motivo: FORA[ext], extensao: ext };
  if (ext === "pdf" || ext === "ai" || tipo === "application/pdf" || tipo === "application/illustrator") return { tipo: "pdf" };
  if (IMAGENS[ext]) return { tipo: "imagem", mime: IMAGENS[ext] };
  if (MIMES_DE_IMAGEM.has(tipo)) return { tipo: "imagem", mime: tipo };
  if (tipo === "application/postscript") return { tipo: "fora", motivo: "eps", extensao: ext };
  return { tipo: "fora", motivo: "outro", extensao: ext };
}

/**
 * O texto da recusa, no idioma de `t` (ligado a `ferramentas.arquivos`). Quase
 * todas dizem o que fazer: quem edita a marca exporta em SVG ou PDF e envia nos
 * Materiais; só o formato desconhecido lista o que o Kit abre.
 */
export function textoDaRecusa(f: { motivo: MotivoDaRecusa; extensao: string }, t: Tradutor): string {
  if (f.motivo === "outro") return t("recusa.outro", { ext: f.extensao ? ` (.${f.extensao})` : "" });
  return `${t(`recusa.${f.motivo}`)} ${t("recusa.comoResolver")}`;
}

/** Primeiros bytes de um arquivo tratado como PDF: o que dizer se não é PDF. */
export function motivoDoCabecalho(cabecalho: string, nome: string, t: Tradutor): string | null {
  if (cabecalho.includes("%PDF")) return null;
  if (cabecalho.startsWith("%!PS")) return textoDaRecusa({ motivo: extensao(nome) === "ai" ? "aiSemPdf" : "eps", extensao: extensao(nome) }, t);
  return `${t("recusa.naoEPdf", { nome })} ${t("recusa.comoResolver")}`;
}

/** Vetor antes de bitmap: SVG 2, PDF/AI 1, imagem 0; fora −1. */
export function pesoDoFormato(nome: string, mime: string): number {
  const f = formatoDoArquivo(nome, mime);
  if (f.tipo === "fora") return -1;
  if (f.tipo === "pdf") return 1;
  return f.mime === "image/svg+xml" ? 2 : 0;
}
