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

export type Formato =
  | { tipo: "imagem"; mime: string }
  | { tipo: "pdf" }
  | { tipo: "fora"; motivo: string };

const IMAGENS: Record<string, string> = {
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", gif: "image/gif", avif: "image/avif",
};
const MIMES_DE_IMAGEM = new Set(Object.values(IMAGENS));

const COMO_RESOLVER = "Quem edita a marca pode exportar em SVG ou PDF e enviar nos Materiais.";

const FORA: Record<string, string> = {
  eps: `O arquivo está em EPS, que o Kit ainda não abre. ${COMO_RESOLVER}`,
  afdesign: `O arquivo é do Affinity, um formato fechado que só o próprio Affinity abre. ${COMO_RESOLVER}`,
  afphoto: `O arquivo é do Affinity, um formato fechado que só o próprio Affinity abre. ${COMO_RESOLVER}`,
  afpub: `O arquivo é do Affinity, um formato fechado que só o próprio Affinity abre. ${COMO_RESOLVER}`,
  af: `O arquivo é do Affinity, um formato fechado que só o próprio Affinity abre. ${COMO_RESOLVER}`,
  cdr: `O arquivo é do CorelDRAW, um formato fechado que só o próprio CorelDRAW abre. ${COMO_RESOLVER}`,
};

export const AI_SEM_PDF = `O arquivo .ai foi salvo sem "compatibilidade PDF", e assim só o Illustrator o abre. ${COMO_RESOLVER}`;

function extensao(nome: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(nome.trim());
  return m ? m[1].toLowerCase() : "";
}

export function formatoDoArquivo(nome: string, mime: string): Formato {
  const ext = extensao(nome);
  const tipo = (mime || "").toLowerCase();
  if (FORA[ext]) return { tipo: "fora", motivo: FORA[ext] };
  if (ext === "pdf" || ext === "ai" || tipo === "application/pdf" || tipo === "application/illustrator") return { tipo: "pdf" };
  if (IMAGENS[ext]) return { tipo: "imagem", mime: IMAGENS[ext] };
  if (MIMES_DE_IMAGEM.has(tipo)) return { tipo: "imagem", mime: tipo };
  if (tipo === "application/postscript") return { tipo: "fora", motivo: FORA.eps };
  return { tipo: "fora", motivo: `O Kit não abre este formato${ext ? ` (.${ext})` : ""}. Use SVG, PDF, AI, PNG ou JPG.` };
}

/** Primeiros bytes de um arquivo tratado como PDF: o que dizer se não é PDF. */
export function motivoDoCabecalho(cabecalho: string, nome: string): string | null {
  if (cabecalho.includes("%PDF")) return null;
  if (cabecalho.startsWith("%!PS")) return extensao(nome) === "ai" ? AI_SEM_PDF : FORA.eps;
  return `O arquivo ${nome} não parece um PDF válido. ${COMO_RESOLVER}`;
}

/** Vetor antes de bitmap: SVG 2, PDF/AI 1, imagem 0; fora −1. */
export function pesoDoFormato(nome: string, mime: string): number {
  const f = formatoDoArquivo(nome, mime);
  if (f.tipo === "fora") return -1;
  if (f.tipo === "pdf") return 1;
  return f.mime === "image/svg+xml" ? 2 : 0;
}
