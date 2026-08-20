import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBrandvilleInstance, readManifest, validateBrandvilleManifest } from "./brandville-instance-generator.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const fixturePath = path.join(projectRoot, "brandville/intake.example.json");

test("manifesto de exemplo atende ao contrato", async () => {
  const manifest = await readManifest(fixturePath);
  const result = validateBrandvilleManifest(manifest);
  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.match(result.warnings.join(" "), /paginas ainda nao aprovadas/);
});

test("gera instancia, registro, assets e checklist em uma raiz limpa", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "brandville-generator-"));
  const manifest = await readManifest(fixturePath);
  const result = await createBrandvilleInstance({ manifest, root });
  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.equal(result.files.length, 4);

  const source = await readFile(path.join(root, "src/brandville/instances/empresa-modelo.ts"), "utf8");
  const registry = await readFile(path.join(root, "src/brandville/instances/generated.ts"), "utf8");
  const checklist = await readFile(path.join(root, "docs/instances/empresa-modelo-launch-checklist.md"), "utf8");
  assert.match(source, /brandvilleInstanceDefinition/);
  assert.match(source, /Empresa Modelo/);
  assert.match(registry, /"empresa-modelo": empresaModeloInstance/);
  assert.match(checklist, /NEXT_PUBLIC_BRANDVILLE_INSTANCE=empresa-modelo/);

  const duplicate = await createBrandvilleInstance({ manifest, root });
  assert.equal(duplicate.valid, false);
  assert.match(duplicate.errors[0], /ja existe/);
});

test("recusa chaves, grupos e contraste invalidos", async () => {
  const manifest = await readManifest(fixturePath);
  manifest.key = "Empresa Modelo";
  manifest.navigation.groups[1].code = "IN";
  manifest.theme.foreground = "#07131f";
  const result = validateBrandvilleManifest(manifest);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /key deve usar/);
  assert.match(result.errors.join(" "), /codigos dos grupos devem ser unicos/);
  assert.match(result.errors.join(" "), /contraste/);
});

const withBlocks = (blocks, schemaVersion = 2) => ({
  schemaVersion,
  key: "marca-blocos",
  brand: { name: "Marca Blocos", shortName: "Blocos", descriptor: "Teste de blocos" },
  metadata: { title: "Marca Blocos — Brandville", description: "Teste.", language: "pt-BR" },
  navigation: {
    groups: [{ name: "Inicio", code: "IN" }],
    defaultDocSlug: "introducao",
    utilityLinks: ["chat"],
  },
  docs: [{ slug: "introducao", group: "Inicio", title: "Introducao", status: "ready", body: [], blocks }],
  theme: {
    background: "#ffffff", backgroundSecondary: "#f4f4f4", surface: "#f4f4f4", surfaceLight: "#fafafa",
    foreground: "#1a1a1a", muted: "#6b6b6b", accent: "#e1251b", accentSecondary: "#fc8224",
    border: "#d8d8d8", focus: "#ab1a1e", fontStack: "Inter, sans-serif",
  },
  ai: { knowledgeMode: "docs", chatRole: "Assistente.", analysisRole: "Analista." },
  legal: { footerNotice: "Uso autorizado." },
});

test("aceita blocos validos em schemaVersion 2", () => {
  const result = validateBrandvilleManifest(withBlocks([
    { kind: "callout", text: "Se a mensagem pede empatia, o design pede contencao." },
    { kind: "swatches", items: [{ name: "Vermelho", hex: "#E1251B" }] },
    { kind: "section", marker: "#E1251B", title: "Territorio 1", blocks: [{ kind: "prose", paragraphs: ["Texto."] }] },
  ]));
  assert.equal(result.valid, true, result.errors.join("\n"));
});

test("recusa blocos em schemaVersion 1", () => {
  const result = validateBrandvilleManifest(withBlocks([{ kind: "callout", text: "Oi." }], 1));
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /blocks exige schemaVersion 2/);
});

test("recusa hex invalido, kind desconhecido e section aninhada", () => {
  const hex = validateBrandvilleManifest(withBlocks([{ kind: "swatches", items: [{ name: "X", hex: "vermelho" }] }]));
  assert.match(hex.errors.join("\n"), /hex deve ser hexadecimal/);

  const kind = validateBrandvilleManifest(withBlocks([{ kind: "tabela", items: [] }]));
  assert.match(kind.errors.join("\n"), /kind desconhecido/);

  const nested = validateBrandvilleManifest(withBlocks([
    { kind: "section", title: "Externa", blocks: [{ kind: "section", title: "Interna", blocks: [] }] },
  ]));
  assert.match(nested.errors.join("\n"), /nao pode ser aninhada/);
});
