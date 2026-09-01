/**
 * O que deu errado com este PDF, dito de forma acionável.
 *
 * "Não foi possível ler este PDF" é uma resposta que não ajuda ninguém: quem
 * mandou um arquivo protegido por senha precisa saber que é senha, e quem
 * mandou um digitalizado precisa saber que não há texto para extrair — são
 * ações diferentes.
 *
 * E o produto não promete ler "qualquer PDF". Ele lê PDFs válidos das versões
 * que o parser suporta; o resto recebe explicação, não silêncio.
 */
export type FalhaDePdf =
  | "assinatura-invalida"
  | "protegido-por-senha"
  | "corrompido"
  | "grande-demais"
  | "paginas-demais"
  | "sem-texto"
  | "desconhecida";

export interface DiagnosticoDePdf {
  falha: FalhaDePdf;
  pt: string;
  en: string;
}

const DIAGNOSTICOS: Record<FalhaDePdf, { pt: string; en: string }> = {
  "assinatura-invalida": {
    pt: "Este arquivo não é um PDF. A extensão pode dizer .pdf, mas o conteúdo não começa como um.",
    en: "This file isn't a PDF. The extension may say .pdf, but the content doesn't start like one.",
  },
  "protegido-por-senha": {
    pt: "Este PDF está protegido por senha. Abra-o e salve uma cópia sem proteção para importar.",
    en: "This PDF is password protected. Open it and save an unprotected copy to import.",
  },
  corrompido: {
    pt: "Este PDF está corrompido ou usa um recurso que o leitor não entende. Tente exportá-lo de novo a partir do arquivo original.",
    en: "This PDF is damaged or uses a feature the reader doesn't understand. Try exporting it again from the original file.",
  },
  "grande-demais": {
    pt: "O arquivo passa do limite de tamanho.",
    en: "The file is over the size limit.",
  },
  "paginas-demais": {
    pt: "O PDF tem mais páginas do que o limite permite.",
    en: "The PDF has more pages than the limit allows.",
  },
  "sem-texto": {
    pt: "Nenhuma página tem texto extraível. O PDF provavelmente é digitalizado, e precisaria de OCR antes de virar manual.",
    en: "No page has extractable text. The PDF is likely scanned and would need OCR before becoming a manual.",
  },
  desconhecida: {
    pt: "Não foi possível ler este PDF.",
    en: "Couldn't read this PDF.",
  },
};

export function diagnosticar(falha: FalhaDePdf): DiagnosticoDePdf {
  return { falha, ...DIAGNOSTICOS[falha] };
}

/** A assinatura de um PDF são os cinco primeiros bytes: `%PDF-`. */
export function temAssinaturaDePdf(buffer: ArrayBuffer): boolean {
  const inicio = new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength));
  return (
    inicio.length === 5 &&
    inicio[0] === 0x25 && // %
    inicio[1] === 0x50 && // P
    inicio[2] === 0x44 && // D
    inicio[3] === 0x46 && // F
    inicio[4] === 0x2d //   -
  );
}

/**
 * Traduz a exceção do parser em falha nomeada.
 *
 * O PDF.js identifica seus erros pelo `name`, e não por instância — comparar
 * com `instanceof` quebra quando o módulo é carregado dinamicamente, que é
 * exatamente como ele é carregado aqui.
 */
export function classificarErroDoParser(erro: unknown): FalhaDePdf {
  const nome = (erro as { name?: string } | null)?.name ?? "";
  const mensagem = (erro as { message?: string } | null)?.message ?? "";

  if (nome === "PasswordException" || /password/i.test(mensagem)) return "protegido-por-senha";
  if (nome === "InvalidPDFException" || /invalid pdf/i.test(mensagem)) return "corrompido";
  if (nome === "UnexpectedResponseException" || nome === "MissingPDFException") return "corrompido";
  if (/structure|xref|corrupt/i.test(mensagem)) return "corrompido";
  return "desconhecida";
}
