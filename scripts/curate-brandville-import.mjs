#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { curateManifestFiles } from "./brandville-curation.mjs";

function args(argv) {
  const result = { inputPath: "", rulesPath: "", outputPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--input") result.inputPath = path.resolve(argv[++index] ?? "");
    else if (value === "--rules") result.rulesPath = path.resolve(argv[++index] ?? "");
    else if (value === "--output") result.outputPath = path.resolve(argv[++index] ?? "");
    else if (value === "--help") result.help = true;
    else throw new Error(`Opção desconhecida: ${value}`);
  }
  return result;
}

async function main() {
  const options = args(process.argv.slice(2));
  if (options.help) {
    console.log("npm run brandville:curate -- --input import.json --rules curation.json --output curated.json");
    return;
  }
  if (!options.inputPath || !options.rulesPath || !options.outputPath) throw new Error("Informe --input, --rules e --output.");
  const result = await curateManifestFiles(options);
  for (const warning of result.validation.warnings) console.warn(`AVISO: ${warning}`);
  if (!result.validation.valid) throw new Error(result.validation.errors.join("\n"));
  console.log(`Manifesto curado: ${path.relative(process.cwd(), options.outputPath)}`);
  console.log(`Páginas editoriais: ${result.manifest.docs.length}`);
}

main().catch((error) => { console.error(`ERRO: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
