/**
 * O nome do PDF do manual — no fólio e no arquivo baixado.
 *
 * Vem de `brand_imports.report.arquivo`, o nome com que a agência enviou o
 * manual. É texto do cliente: vira nome de arquivo no computador de outra
 * pessoa, então sai sem barra, sem caractere de controle e com `.pdf` no fim.
 * Sem nome guardado (importações antigas), o nome da marca responde por ele.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
const LIMITE = 120;

export function nomeDoArquivoDoManual(arquivo: unknown, marca: string): string {
  const bruto = typeof arquivo === "string" ? arquivo : "";
  const limpo = bruto
    // Só o nome: um caminho ("C:\\manuais\\x.pdf", "../x.pdf") perde as pastas.
    .split(/[\\/]/).pop()!
    .replace(/[\u0000-\u001f\u007f"<>:|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // A extensão sai antes dos pontos iniciais: ".pdf" sozinho não vira "pdf.pdf".
  const semExtensao = limpo.replace(/\.pdf$/i, "").replace(/^\.+/, "").trim();
  const base = semExtensao || `${marca.trim() || "Marca"} — manual`;
  return `${base.slice(0, LIMITE)}.pdf`;
}
