#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { writeVisualReferenceFiles } from "./brandville-visual-references.mjs";

function parse(argv) {
  const result = { manifestPath: "", pagesDirectory: "", outputJson: "", outputReport: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--manifest") result.manifestPath = path.resolve(argv[++index] ?? "");
    else if (value === "--pages") result.pagesDirectory = path.resolve(argv[++index] ?? "");
    else if (value === "--output") result.outputJson = path.resolve(argv[++index] ?? "");
    else if (value === "--report") result.outputReport = path.resolve(argv[++index] ?? "");
    else throw new Error(`Unknown option: ${value}`);
  }
  return result;
}

async function main() {
  const options = parse(process.argv.slice(2));
  if (Object.values(options).some((value) => !value)) throw new Error("Informe --manifest, --pages, --output e --report.");
  const index = await writeVisualReferenceFiles(options);
  console.log(`Visual references indexed: ${index.pageFiles} files for ${index.documents.length} documents.`);
  console.log(`Index: ${path.relative(process.cwd(), options.outputJson)}`);
  console.log(`Report: ${path.relative(process.cwd(), options.outputReport)}`);
}

main().catch((error) => { console.error(`ERRO: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
