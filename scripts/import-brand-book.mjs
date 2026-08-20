#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { buildImportReport, importBrandBookPdf } from "./brandville-pdf-importer.mjs";

function parseArguments(argv) {
  const result = { pdfPath: "", brandName: "", key: "", descriptor: "", output: path.resolve("brandville/imports"), dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--pdf") result.pdfPath = argv[++index] ?? "";
    else if (value === "--brand") result.brandName = argv[++index] ?? "";
    else if (value === "--key") result.key = argv[++index] ?? "";
    else if (value === "--descriptor") result.descriptor = argv[++index] ?? "";
    else if (value === "--output") result.output = path.resolve(argv[++index] ?? "brandville/imports");
    else if (value === "--dry-run") result.dryRun = true;
    else if (value === "--help") result.help = true;
    else if (!result.pdfPath && !value.startsWith("--")) result.pdfPath = value;
    else throw new Error(`Opção desconhecida: ${value}`);
  }
  return result;
}

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function completeMissing(options) {
  if (options.pdfPath && options.brandName && options.key && options.descriptor) return options;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (!options.pdfPath) options.pdfPath = (await prompt.question("Caminho do brand book em PDF: ")).trim();
    if (!options.brandName) options.brandName = (await prompt.question("Nome oficial da marca: ")).trim();
    if (!options.key) options.key = (await prompt.question(`Chave da instância [${slugify(options.brandName)}]: `)).trim() || slugify(options.brandName);
    if (!options.descriptor) options.descriptor = (await prompt.question("Descrição curta da marca: ")).trim();
    return options;
  } finally { prompt.close(); }
}

async function main() {
  let options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log("npm run brandville:import -- --pdf manual.pdf --brand 'Empresa' --key empresa --descriptor 'Descrição'");
    return;
  }
  options = await completeMissing(options);
  if (!options.pdfPath.toLowerCase().endsWith(".pdf")) throw new Error("Selecione um arquivo com extensão .pdf.");
  const result = await importBrandBookPdf({ pdfPath: path.resolve(options.pdfPath), key: options.key, brandName: options.brandName, descriptor: options.descriptor });
  if (!result.validation.valid) throw new Error(`O manifesto extraído precisa de correção:\n- ${result.validation.errors.join("\n- ")}`);
  const manifestPath = path.join(options.output, `${options.key}.json`);
  const reportPath = path.join(options.output, `${options.key}-import-report.md`);
  if (!options.dryRun) {
    await mkdir(options.output, { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(result.manifest, null, 2)}\n`, "utf8");
    await writeFile(reportPath, buildImportReport({ pdfPath: options.pdfPath, brandName: options.brandName, ...result }), "utf8");
  }
  console.log(`PDF lido: ${result.pages.length} páginas, ${result.extractedCharacters} caracteres, ${result.sections.length} seções propostas.`);
  console.log("Todo o conteúdo foi marcado como rascunho e exige revisão editorial.");
  if (!options.dryRun) {
    console.log(`Manifesto: ${path.relative(process.cwd(), manifestPath)}`);
    console.log(`Relatório: ${path.relative(process.cwd(), reportPath)}`);
    console.log(`Depois da revisão: npm run brandville:new -- --input ${path.relative(process.cwd(), manifestPath)} --check`);
  }
}

main().catch((error) => { console.error(`ERRO: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
