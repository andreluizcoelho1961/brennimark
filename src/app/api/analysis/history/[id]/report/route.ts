import { platformIdentity } from "@/platform/identity";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { marcaDaRota } from "@/lib/brandville/contexto-da-rota";
import { nomeSeguro } from "@/lib/storage/caminhos";
import { ANALYSIS_EVIDENCE_BUCKET, ANALYSIS_RUN_SELECT, conferirEvidencia, type AnalysisRow } from "@/lib/analysis/history";
import { sanitizeStructuredAnalysis } from "@/lib/ai/analysis-result";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";

export const runtime = "nodejs";

// Mensagem de erro é do produto, não do manual: quem lê é quem está usando o
// Brennimark. Enquanto a preferência de idioma não tem onde ser guardada, o
// padrão do produto responde por todo mundo — e a fonte é uma só.
const isEnglish = inEnglish(PRODUCT_LOCALE);
const locale = isEnglish ? "en-US" : "pt-BR";

const PAGE = { width: 595.28, height: 841.89, margin: 48 };

function pdfColor(hex: string) {
  const value = hex.replace("#", "");
  return rgb(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  );
}

/**
 * As cores do relatório vêm da MARCA da requisição, não de constantes de
 * módulo.
 *
 * Eram três `const` no topo do arquivo, calculadas uma vez na inicialização do
 * processo a partir da instância global. Num produto multimarca isso é o pior
 * tipo de vazamento: o relatório da marca A saía pintado com a paleta de
 * qualquer marca que tivesse sido lida primeiro, e o PDF é o artefato que vai
 * para o cliente.
 */
function paletaDoRelatorio(theme: { accent: string; backgroundSecondary: string; muted: string }) {
  return {
    destaque: pdfColor(theme.accent),
    tinta: pdfColor(theme.backgroundSecondary),
    cinza: pdfColor(theme.muted),
  };
}

type Paleta = ReturnType<typeof paletaDoRelatorio>;

function safeText(value: string) {
  return value
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of safeText(text).split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    if (!words.length) lines.push("");
  }
  return lines;
}

function drawHeader(
  page: PDFPage,
  bold: PDFFont,
  pageNumber: number,
  paleta: Paleta,
  nomeDaMarca: string,
) {
  page.drawRectangle({ x: 0, y: PAGE.height - 94, width: PAGE.width, height: 94, color: paleta.tinta });
  page.drawRectangle({ x: PAGE.margin, y: PAGE.height - 44, width: 55, height: 5, color: paleta.destaque });
  // "BRANDVILLE" era codinome técnico legado e não pode aparecer em artefato
  // entregue a cliente. Quem assina o relatório é a marca, e o produto é o
  // Brennimark.
  page.drawText(safeText(`${nomeDaMarca} / ${platformIdentity.displayName}`).toUpperCase(), { x: PAGE.margin, y: PAGE.height - 68, size: 13, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`${isEnglish ? "COMPLIANCE REPORT" : "RELATORIO DE CONFORMIDADE"}  /  ${String(pageNumber).padStart(2, "0")}`, { x: PAGE.margin, y: PAGE.height - 84, size: 7.5, font: bold, color: paleta.destaque });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const context = { supabase: resolvido.auth.supabase, workspaceId: resolvido.workspaceId, brandId: resolvido.brandId };
  const marca = resolvido.brand;
  const paleta = paletaDoRelatorio(marca.theme);
  const { id } = await params;

  const { data, error } = await context.supabase
    .from("analysis_runs")
    .select(ANALYSIS_RUN_SELECT)
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
    .eq("brand_id", context.brandId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "report_unavailable", message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const row = data as unknown as AnalysisRow;
  const analysis = sanitizeStructuredAnalysis(row.analysis);

  const pdf = await PDFDocument.create();
  pdf.setTitle(isEnglish ? `Compliance report - ${row.file_name}` : `Relatorio de conformidade - ${row.file_name}`);
  pdf.setAuthor(`${marca.brand.name} — ${platformIdentity.displayName}`);
  pdf.setSubject(isEnglish ? "Brand application analysis" : "Analise de aplicacao de marca");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let pageNumber = 1;
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  drawHeader(page, bold, pageNumber, paleta, marca.brand.name);
  let y = PAGE.height - 132;
  const contentWidth = PAGE.width - PAGE.margin * 2;

  const newPage = () => {
    pageNumber += 1;
    page = pdf.addPage([PAGE.width, PAGE.height]);
    drawHeader(page, bold, pageNumber, paleta, marca.brand.name);
    y = PAGE.height - 126;
  };

  const ensure = (height: number) => {
    if (y - height < 48) newPage();
  };

  const section = (title: string, value: string | string[]) => {
    const values = Array.isArray(value) ? value : [value];
    const body = values.filter(Boolean).map((item) => Array.isArray(value) ? `- ${item}` : item).join("\n");
    if (!body) return;
    const lines = wrap(body, regular, 10, contentWidth);
    ensure(Math.min(28 + lines.length * 14, 180));
    page.drawText(safeText(title).toUpperCase(), { x: PAGE.margin, y, size: 8, font: bold, color: paleta.destaque });
    y -= 18;
    for (const line of lines) {
      ensure(16);
      page.drawText(line, { x: PAGE.margin, y, size: 10, font: regular, color: paleta.tinta });
      y -= 14;
    }
    y -= 12;
  };

  page.drawText(isEnglish ? "APPLICATION ANALYSIS" : "ANALISE DE APLICACAO", { x: PAGE.margin, y, size: 24, font: bold, color: paleta.tinta });
  y -= 28;
  page.drawText(safeText(row.file_name), { x: PAGE.margin, y, size: 11, font: regular, color: paleta.cinza });
  y -= 17;
  page.drawText(new Date(row.created_at).toLocaleString(locale), { x: PAGE.margin, y, size: 8, font: regular, color: paleta.cinza });
  y -= 30;

  if (row.image_path && ["image/jpeg", "image/png"].includes(row.image_media_type)) {
    const { data: imageBlob } = await context.supabase.storage.from(ANALYSIS_EVIDENCE_BUCKET).download(row.image_path);
    if (imageBlob) {
      const bytes = new Uint8Array(await imageBlob.arrayBuffer());

      /*
       * A peça desenhada precisa ser a peça analisada.
       *
       * O relatório é documento de conformidade: mostrar uma imagem ao lado de
       * um veredito afirma que aquele veredito é sobre aquela imagem. Se os
       * bytes mudaram depois da análise, desenhar assim mesmo seria afirmar o
       * falso — e com aparência de prova.
       *
       * Decisão, e ela é de produto: o relatório DIZ o que houve e segue com o
       * resto. Omitir em silêncio deixaria o leitor achar que a análise nunca
       * teve peça; recusar o relatório inteiro tiraria dele o que continua
       * verdadeiro — o veredito, a data e as regras citadas.
       */
      const conferencia = conferirEvidencia(row.image_fingerprint, Buffer.from(bytes));
      if (conferencia !== "confere") {
        const aviso = conferencia === "diverge"
          ? (isEnglish
              ? "The stored evidence no longer matches the image that was analyzed, so it is not shown here."
              : "A evidência guardada não confere mais com a imagem analisada, e por isso não é mostrada aqui.")
          : (isEnglish
              ? "This analysis predates evidence fingerprinting, so the image cannot be confirmed as the one analyzed."
              : "Esta análise é anterior à impressão digital da evidência, então não dá para confirmar que a imagem é a analisada.");
        ensure(30);
        page.drawText(aviso, { x: PAGE.margin, y, size: 8, font: regular, color: paleta.cinza, maxWidth: contentWidth });
        y -= 26;
      } else {
      const embedded = row.image_media_type === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const fit = embedded.scaleToFit(contentWidth, 235);
      ensure(fit.height + 24);
      page.drawRectangle({ x: PAGE.margin - 1, y: y - fit.height - 1, width: contentWidth + 2, height: fit.height + 2, borderColor: rgb(0.83, 0.85, 0.87), borderWidth: 1 });
      page.drawImage(embedded, { x: PAGE.margin + (contentWidth - fit.width) / 2, y: y - fit.height, width: fit.width, height: fit.height });
      y -= fit.height + 26;
      }
    }
  }

  if (isEnglish) {
    section("Question", row.question);
    section("Verdict", analysis.verdict || row.verdict);
    section("Observed evidence", analysis.evidence);
    section("Applicable rules", analysis.rules);
    section("Issues identified", analysis.problems);
    section("Impact", analysis.impact);
    section("Minimum recommended fix", analysis.correction);
    section("Confidence", analysis.confidence);
    section("Sources consulted", analysis.sources);
    section("Execution", `${row.provider} / ${row.model}\nTime: ${(row.elapsed_ms / 1000).toFixed(1)} s\nFallback AI: ${row.fallback_used ? "used" : "not used"}`);
    if (row.feedback_rating) section("Human review", `${row.feedback_rating}${row.feedback_note ? `\n${row.feedback_note}` : ""}`);
    if (row.calibration_enabled) section("Reference case", `${row.calibration_label || "No label"}\nExpected result: ${row.calibration_expected_verdict}`);
  } else {
    section("Pergunta", row.question);
    section("Veredito", analysis.verdict || row.verdict);
    section("Evidencias observadas", analysis.evidence);
    section("Regras aplicaveis", analysis.rules);
    section("Problemas identificados", analysis.problems);
    section("Impacto", analysis.impact);
    section("Correcao minima recomendada", analysis.correction);
    section("Confianca", analysis.confidence);
    section("Fontes consultadas", analysis.sources);
    section("Execucao", `${row.provider} / ${row.model}\nTempo: ${(row.elapsed_ms / 1000).toFixed(1)} s\nIA de reserva: ${row.fallback_used ? "utilizada" : "nao utilizada"}`);
    if (row.feedback_rating) section("Validacao humana", `${row.feedback_rating}${row.feedback_note ? `\n${row.feedback_note}` : ""}`);
    if (row.calibration_enabled) section("Caso de referencia", `${row.calibration_label || "Sem rotulo"}\nResultado esperado: ${row.calibration_expected_verdict}`);
  }

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => {
    pdfPage.drawText(
      isEnglish
        ? `${platformIdentity.displayName} - traceable evidence - page ${index + 1} of ${pages.length}`
        : `${platformIdentity.displayName} - evidencias rastreaveis - pagina ${index + 1} de ${pages.length}`,
      { x: PAGE.margin, y: 24, size: 7, font: regular, color: paleta.cinza },
    );
  });

  const bytes = await pdf.save();
  const chaveDaMarca = nomeSeguro(marca.key);
  const filename = safeText(row.file_name).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || (isEnglish ? "analysis" : "analise");
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": // O nome do arquivo é da marca, não do codinome legado do produto.
      `attachment; filename="${chaveDaMarca}-${filename}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
