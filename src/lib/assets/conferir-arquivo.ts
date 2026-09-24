/**
 * O arquivo é o que diz ser? — a checagem de conteúdo dos materiais.
 *
 * Tipo declarado pelo cliente é uma pista, não prova. Cada tipo traz as
 * assinaturas de bytes que o conteúdo precisa apresentar. Sai da rota para
 * uma biblioteca em 24/09/2026: com o envio direto ao Storage, a checagem
 * passa a ser feita sobre os primeiros bytes LIDOS do Storage, e não sobre o
 * arquivo que atravessava a função.
 *
 * `application/octet-stream` não entra: como também era o que o navegador
 * declarava quando não sabia o tipo, sua presença tornava a lista inócua.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export const TAMANHO_MAXIMO_DE_MATERIAL = 25 * 1024 * 1024;

const MAGIC: Record<string, string[]> = {
  "image/jpeg": ["ffd8ff"],
  "image/png": ["89504e47"],
  "image/webp": ["52494646"], // RIFF; o marcador WEBP é conferido à parte
  "application/pdf": ["25504446"],
  "application/zip": ["504b0304", "504b0506", "504b0708"],
  "application/postscript": ["25215053", "c5d0d3c6"],
  "font/otf": ["4f54544f"],
  "font/ttf": ["00010000", "74727565"],
  "font/woff": ["774f4646"],
  "font/woff2": ["774f4632"],
};

/**
 * SVG é texto, sem assinatura de bytes: aceito com checagem textual e servido
 * só como download, porque SVG é executável quando desenhado em linha.
 */
export const TIPO_SVG = "image/svg+xml";

export const TIPOS_ACEITOS: ReadonlySet<string> = new Set([...Object.keys(MAGIC), TIPO_SVG]);

/** Quantos bytes do começo bastam para decidir — o SVG pede os 512. */
export const BYTES_DO_COMECO = 512;

export function conteudoConfere(comeco: Uint8Array, tipo: string): boolean {
  if (tipo === TIPO_SVG) {
    const texto = new TextDecoder().decode(comeco.slice(0, BYTES_DO_COMECO)).trimStart().toLowerCase();
    return texto.startsWith("<?xml") || texto.startsWith("<svg") || texto.startsWith("<!doctype svg");
  }
  const assinaturas = MAGIC[tipo];
  if (!assinaturas) return false;
  const hex = Array.from(comeco.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  if (!assinaturas.some((a) => hex.startsWith(a))) return false;
  // RIFF cobre vários formatos; exigir o marcador WEBP nos bytes 8-11.
  if (tipo === "image/webp") return hex.slice(16, 24) === "57454250";
  return true;
}
