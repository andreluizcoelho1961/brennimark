import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getAnalysisAuthContext } from "@/lib/analysis/server";
import { ANALYSIS_EVIDENCE_BUCKET, ANALYSIS_RUN_SELECT, type AnalysisRow } from "@/lib/analysis/history";
import { sanitizeStructuredAnalysis } from "@/lib/ai/analysis-result";
import { brandvilleInstance } from "@/brandville/config";

export const runtime = "nodejs";

const isEnglish = brandvilleInstance.metadata.language === "en";
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

const turquoise = pdfColor(brandvilleInstance.theme.accent);
const ink = pdfColor(brandvilleInstance.theme.backgroundSecondary);
const gray = pdfColor(brandvilleInstance.theme.muted);

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

function drawHeader(page: PDFPage, bold: PDFFont, pageNumber: number) {
  page.drawRectangle({ x: 0, y: PAGE.height - 94, width: PAGE.width, height: 94, color: ink });
  page.drawRectangle({ x: PAGE.margin, y: PAGE.height - 44, width: 55, height: 5, color: turquoise });
  page.drawText(safeText(`${brandvilleInstance.brand.name} / BRANDVILLE`).toUpperCase(), { x: PAGE.margin, y: PAGE.height - 68, size: 13, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`${isEnglish ? "COMPLIANCE REPORT" : "RELATORIO DE CONFORMIDADE"}  /  ${String(pageNumber).padStart(2, "0")}`, { x: PAGE.margin, y: PAGE.height - 84, size: 7.5, font: bold, color: turquoise });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAnalysisAuthContext();
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data, error } = await context.supabase
    .from("analysis_runs")
    .select(ANALYSIS_RUN_SELECT)
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "report_unavailable", message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const row = data as unknown as AnalysisRow;
  const analysis = sanitizeStructuredAnalysis(row.analysis);

  const pdf = await PDFDocument.create();
  pdf.setTitle(isEnglish ? `Compliance report - ${row.file_name}` : `Relatorio de conformidade - ${row.file_name}`);
  pdf.setAuthor(`${brandvilleInstance.brand.name} Brandville`);
  pdf.setSubject(isEnglish ? "Brand application analysis" : "Analise de aplicacao de marca");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let pageNumber = 1;
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  drawHeader(page, bold, pageNumber);
  let y = PAGE.height - 132;
  const contentWidth = PAGE.width - PAGE.margin * 2;

  const newPage = () => {
    pageNumber += 1;
    page = pdf.addPage([PAGE.width, PAGE.height]);
    drawHeader(page, bold, pageNumber);
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
    page.drawText(safeText(title).toUpperCase(), { x: PAGE.margin, y, size: 8, font: bold, color: turquoise });
    y -= 18;
    for (const line of lines) {
      ensure(16);
      page.drawText(line, { x: PAGE.margin, y, size: 10, font: regular, color: ink });
      y -= 14;
    }
    y -= 12;
  };

  page.drawText(isEnglish ? "APPLICATION ANALYSIS" : "ANALISE DE APLICACAO", { x: PAGE.margin, y, size: 24, font: bold, color: ink });
  y -= 28;
  page.drawText(safeText(row.file_name), { x: PAGE.margin, y, size: 11, font: regular, color: gray });
  y -= 17;
  page.drawText(new Date(row.created_at).toLocaleString(locale), { x: PAGE.margin, y, size: 8, font: regular, color: gray });
  y -= 30;

  if (row.image_path && ["image/jpeg", "image/png"].includes(row.image_media_type)) {
    const { data: imageBlob } = await context.supabase.storage.from(ANALYSIS_EVIDENCE_BUCKET).download(row.image_path);
    if (imageBlob) {
      const bytes = new Uint8Array(await imageBlob.arrayBuffer());
      const embedded = row.image_media_type === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const fit = embedded.scaleToFit(contentWidth, 235);
      ensure(fit.height + 24);
      page.drawRectangle({ x: PAGE.margin - 1, y: y - fit.height - 1, width: contentWidth + 2, height: fit.height + 2, borderColor: rgb(0.83, 0.85, 0.87), borderWidth: 1 });
      page.drawImage(embedded, { x: PAGE.margin + (contentWidth - fit.width) / 2, y: y - fit.height, width: fit.width, height: fit.height });
      y -= fit.height + 26;
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
        ? `Brandville - traceable evidence - page ${index + 1} of ${pages.length}`
        : `Brandville - evidencias rastreaveis - pagina ${index + 1} de ${pages.length}`,
      { x: PAGE.margin, y: 24, size: 7, font: regular, color: gray },
    );
  });

  const bytes = await pdf.save();
  const filename = safeText(row.file_name).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || (isEnglish ? "analysis" : "analise");
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="brandville-${filename}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
