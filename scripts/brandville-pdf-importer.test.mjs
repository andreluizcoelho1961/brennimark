import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { applyBrandvilleCuration } from "./brandville-curation.mjs";
import { createBrandvilleInstance } from "./brandville-instance-generator.mjs";
import { buildImportReport, extractPdfPages, importBrandBookPdf } from "./brandville-pdf-importer.mjs";
import { buildVisualReferenceIndex } from "./brandville-visual-references.mjs";

async function samplePdf({ blank = false } = {}) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const first = document.addPage([595, 842]);
  if (!blank) {
    first.drawText("FUNDAMENTOS", { x: 56, y: 760, size: 24, font: bold, color: rgb(0, 0, 0) });
    first.drawText("A marca existe para simplificar decisões complexas.", { x: 56, y: 710, size: 11, font });
    first.drawText("Seu posicionamento combina clareza, proximidade e precisão.", { x: 56, y: 690, size: 11, font });
    const second = document.addPage([595, 842]);
    second.drawText("GUIA DE CORES", { x: 56, y: 760, size: 24, font: bold });
    second.drawText("Azul escuro é a cor de base. Amarelo é usado para destaque.", { x: 56, y: 710, size: 11, font });
    second.drawText("O contraste mínimo deve ser preservado em todos os fundos.", { x: 56, y: 690, size: 11, font });
  }
  return document.save();
}

test("extrai texto e hierarquia tipográfica por página", async () => {
  const pages = await extractPdfPages(await samplePdf());
  assert.equal(pages.length, 2);
  assert.match(pages[0].text, /FUNDAMENTOS/);
  assert.ok(pages[0].lines[0].fontSize > pages[0].lines[1].fontSize);
});

test("converte um brand book em manifesto rascunho rastreável", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "brandville-pdf-"));
  const pdfPath = path.join(directory, "manual.pdf");
  await writeFile(pdfPath, await samplePdf());
  const result = await importBrandBookPdf({ pdfPath, key: "marca-importada", brandName: "Marca Importada", descriptor: "Serviços mais claros" });
  assert.equal(result.validation.valid, true, result.validation.errors.join("\n"));
  assert.equal(result.manifest.docs.length, 2);
  assert.ok(result.manifest.docs.every((doc) => doc.status === "draft"));
  assert.deepEqual(result.manifest.docs[0].source.pages, [1]);
  assert.equal(result.manifest.docs[1].group, "Identidade Visual");
  const report = buildImportReport({ pdfPath, brandName: "Marca Importada", ...result });
  assert.match(report, /Publicação automática: não/);
  assert.match(report, /Páginas: 2/);

  const generatedRoot = path.join(directory, "generated-project");
  const generated = await createBrandvilleInstance({ manifest: result.manifest, root: generatedRoot });
  assert.equal(generated.valid, true, generated.errors.join("\n"));
  assert.equal(generated.files.length, 4);
});

test("bloqueia PDF sem camada de texto suficiente", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "brandville-pdf-blank-"));
  const pdfPath = path.join(directory, "escaneado.pdf");
  await writeFile(pdfPath, await samplePdf({ blank: true }));
  await assert.rejects(() => importBrandBookPdf({ pdfPath, key: "marca-escaneada", brandName: "Marca Escaneada", descriptor: "Teste" }), /OCR|análise visual/);
});

test("aplica cortes e correções editoriais sem perder a origem", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "brandville-curation-"));
  const pdfPath = path.join(directory, "manual.pdf");
  await writeFile(pdfPath, await samplePdf());
  const imported = await importBrandBookPdf({ pdfPath, key: "marca-curada", brandName: "Marca Curada", descriptor: "Teste" });
  const firstSlug = imported.manifest.docs[0].slug;
  const secondSlug = imported.manifest.docs[1].slug;
  const curated = applyBrandvilleCuration(imported.manifest, {
    dropDocs: [firstSlug],
    documents: { [secondSlug]: { title: "Paleta oficial", slug: "identidade-visual/paleta-oficial" } },
    groups: [{ name: "Identidade Visual", code: "IV" }],
    theme: { accent: "#0d827f" },
  });
  assert.equal(curated.validation.valid, true, curated.validation.errors.join("\n"));
  assert.equal(curated.manifest.docs.length, 1);
  assert.equal(curated.manifest.docs[0].title, "Paleta oficial");
  assert.deepEqual(curated.manifest.docs[0].source.pages, [2]);
  assert.equal(curated.manifest.navigation.defaultDocSlug, "identidade-visual/paleta-oficial");
});

test("relaciona documentos curados às páginas visuais renderizadas", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "brandville-references-"));
  const pagesDirectory = path.join(directory, "pages");
  await mkdir(pagesDirectory);
  await writeFile(path.join(pagesDirectory, "page-01.jpg"), "one");
  await writeFile(path.join(pagesDirectory, "page-02.jpg"), "two");
  const manifestPath = path.join(directory, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({
    brand: { name: "Marca" },
    docs: [{ slug: "introducao", title: "Introdução", group: "Início", source: { pages: [1, 2] } }],
  }));
  const index = await buildVisualReferenceIndex({ manifestPath, pagesDirectory });
  assert.equal(index.pageFiles, 2);
  assert.deepEqual(index.missingPages, []);
  assert.deepEqual(index.documents[0].files, ["page-01.jpg", "page-02.jpg"]);
});
