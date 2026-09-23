import { normalizeAnalysisVerdict, type AnalysisVerdict, type StructuredAnalysis } from "./analysis-result";

/**
 * A peça que se solta no Vini, e o que volta dela — fatia 4b.
 *
 * Sem rede e sem React: a janela decide com estas regras, e os testes de
 * unidade as trancam.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

/** Os formatos que a rota de análise lê (`/api/ai/analyze`). Os mesmos, e só eles:
 *  aceitar aqui o que o servidor recusa seria prometer uma análise que não vem. */
export const FORMATOS_DA_PECA = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** O teto da rota, por imagem. */
export const TETO_DA_PECA_BYTES = 10 * 1024 * 1024;

export type RecusaDaPeca = "formato" | "tamanho";

export function conferirPeca(arquivo: { type: string; size: number }): RecusaDaPeca | null {
  if (!(FORMATOS_DA_PECA as readonly string[]).includes(arquivo.type)) return "formato";
  if (arquivo.size > TETO_DA_PECA_BYTES) return "tamanho";
  return null;
}

/**
 * A recusa diz QUAL limite barrou (spec do Assistente §5): "grande demais"
 * sozinho faria a pessoa achar que o produto não lê peças grandes.
 */
export function textoDaRecusa(recusa: RecusaDaPeca, arquivo: { type: string; size: number }, ingles = false): string {
  if (recusa === "formato") {
    const lido = arquivo.type || (ingles ? "unknown format" : "formato desconhecido");
    return ingles
      ? `The review reads JPG, PNG, WebP and GIF images — this file is ${lido}. EPS, AI and PDF aren't read as pieces yet.`
      : `A análise lê imagens JPG, PNG, WebP e GIF — este arquivo é ${lido}. EPS, AI e PDF ainda não são lidos como peça.`;
  }
  const mb = (arquivo.size / 1024 / 1024).toFixed(1);
  return ingles
    ? `This image has ${mb} MB; the limit is 10 MB per image. Export a lighter version of the piece.`
    : `Esta imagem tem ${mb.replace(".", ",")} MB; o limite é 10 MB por imagem. Exporte uma versão mais leve da peça.`;
}

/** O tom do veredito: o que reprova é a única cor forte da tela (spec §4.2). */
export function tomDoVeredito(veredito: string): AnalysisVerdict {
  return normalizeAnalysisVerdict(veredito);
}

/**
 * A análise estruturada, como Markdown que o renderizador do Vini já sabe
 * desenhar — títulos, listas, e as citações que levam o PDF à página.
 *
 * Seção vazia não aparece: um título sem conteúdo sugere que algo foi
 * verificado e não achado, quando nada foi dito.
 */
export function analiseEmMarkdown(a: StructuredAnalysis, ingles = false): string {
  const t = (pt: string, en: string) => (ingles ? en : pt);
  const partes: string[] = [];
  const lista = (titulo: string, itens: readonly string[]) => {
    const limpos = itens.map((i) => i.trim()).filter(Boolean);
    if (limpos.length > 0) partes.push(`### ${titulo}`, ...limpos.map((i) => `- ${i}`), "");
  };
  const texto = (titulo: string, valor: string) => {
    const limpo = valor.trim();
    if (limpo) partes.push(`### ${titulo}`, limpo, "");
  };

  lista(t("Problemas", "Issues"), a.problems);
  lista(t("Evidências", "Evidence"), a.evidence);
  lista(t("Regras aplicáveis", "Applicable rules"), a.rules);
  texto(t("Impacto", "Impact"), a.impact);
  texto(t("Correção sugerida", "Suggested fix"), a.correction);
  texto(t("Confiança", "Confidence"), a.confidence);
  // As fontes citadas no corpo já viraram links nas seções acima; aqui
  // aparecem as que o modelo só listou, para nenhuma se perder.
  const citadas = partes.join("\n");
  const soltas = a.sources.filter((f) => !citadas.includes(f));
  lista(t("Fontes", "Sources"), soltas.map((f) => `[${f}]`));

  return partes.join("\n").trim();
}
