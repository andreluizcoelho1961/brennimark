#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { createBrandvilleInstance, readManifest, validateBrandvilleManifest } from "./brandville-instance-generator.mjs";

function argumentsFrom(argv) {
  const result = { input: "", root: process.cwd(), dryRun: false, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--input") result.input = argv[++index] ?? "";
    else if (value === "--output-root") result.root = path.resolve(argv[++index] ?? process.cwd());
    else if (value === "--dry-run") result.dryRun = true;
    else if (value === "--check") result.check = true;
    else if (value === "--help") result.help = true;
    else throw new Error(`Opcao desconhecida: ${value}`);
  }
  return result;
}

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function groupCode(name, used) {
  const letters = slugify(name).split("-").map((part) => part[0]).join("").toUpperCase();
  let code = (letters.length >= 2 ? letters : slugify(name).slice(0, 2)).toUpperCase().padEnd(2, "X");
  let suffix = 2;
  while (used.has(code)) code = `${code.slice(0, 2)}${suffix++}`;
  used.add(code);
  return code;
}

async function guidedManifest() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("\nONBOARDING BRANDVILLE\nResponda somente o essencial. O conteudo podera ser refinado no painel administrativo.\n");
    const name = (await prompt.question("Nome oficial da marca: ")).trim();
    const keyAnswer = (await prompt.question(`Chave da instancia [${slugify(name)}]: `)).trim();
    const descriptor = (await prompt.question("Descricao curta da marca: ")).trim();
    const description = (await prompt.question("Descricao para busca e compartilhamento: ")).trim();
    const groupAnswer = (await prompt.question("Secoes, separadas por virgula [Inicio, Fundamentos, Identidade]: ")).trim();
    const groupNames = (groupAnswer || "Inicio, Fundamentos, Identidade").split(",").map((item) => item.trim()).filter(Boolean);
    const usedCodes = new Set();
    const groups = groupNames.map((group) => ({ name: group, code: groupCode(group, usedCodes) }));
    const docs = groups.map((group, index) => ({
      slug: index === 0 ? "introducao" : `${slugify(group.name)}/visao-geral`, group: group.name,
      title: index === 0 ? "Introducao" : "Visao geral", status: "draft",
      body: [index === 0 ? `Este e o Brandville de ${name}.` : `Conteudo de ${group.name} em preparacao.`],
    }));
    return {
      schemaVersion: 1, key: keyAnswer || slugify(name),
      brand: { name, shortName: name, descriptor },
      metadata: { title: `${name} — Brandville`, description, language: "pt-BR" },
      navigation: { groups, defaultDocSlug: "introducao", utilityLinks: ["chat", "analysis", "history", "ai-settings"] },
      docs,
      theme: { background: "#080b0f", backgroundSecondary: "#10151c", surface: "#141b24", surfaceLight: "#1b2632", foreground: "#f5f2ea", muted: "#9ca8b5", accent: "#27d3b2", accentSecondary: "#4da7e8", border: "#2d3947", focus: "#58f0d2", fontStack: "Inter, 'Helvetica Neue', Arial, sans-serif" },
      ai: { knowledgeMode: "docs", chatRole: `Voce e o assistente oficial da marca ${name} dentro do Brandville.`, analysisRole: `Voce analisa pecas de ${name} contra as diretrizes documentadas neste Brandville.` },
      legal: { footerNotice: `Diretrizes oficiais de ${name}. Uso autorizado.` },
    };
  } finally { prompt.close(); }
}

function printValidation(result) {
  for (const warning of result.warnings) console.warn(`AVISO: ${warning}`);
  for (const error of result.errors) console.error(`ERRO: ${error}`);
}

async function main() {
  const options = argumentsFrom(process.argv.slice(2));
  if (options.help) {
    console.log("npm run brandville:new -- [--input arquivo.json] [--check] [--dry-run] [--output-root pasta]");
    return;
  }
  const manifest = options.input ? await readManifest(path.resolve(options.input)) : await guidedManifest();
  if (options.check) {
    const validation = validateBrandvilleManifest(manifest);
    printValidation(validation);
    if (!validation.valid) process.exitCode = 1;
    else console.log("Manifesto valido e pronto para gerar uma instancia.");
    return;
  }
  const result = await createBrandvilleInstance({ manifest, root: options.root, dryRun: options.dryRun });
  printValidation(result);
  if (!result.valid) { process.exitCode = 1; return; }
  console.log(options.dryRun ? "Simulacao concluida. Arquivos previstos:" : "Instancia criada. Arquivos:");
  for (const file of result.files) console.log(`- ${path.relative(options.root, file)}`);
  if (!options.dryRun) console.log(`\nProximo passo: configure NEXT_PUBLIC_BRANDVILLE_INSTANCE=${manifest.key} no projeto exclusivo do cliente.`);
}

main().catch((error) => { console.error(`ERRO: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
