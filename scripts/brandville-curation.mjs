import { readFile, writeFile } from "node:fs/promises";
import { validateBrandvilleManifest } from "./brandville-instance-generator.mjs";

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function applyBrandvilleCuration(manifestInput, rulesInput) {
  const manifest = structuredClone(manifestInput);
  const rules = object(rulesInput);
  const drop = new Set(Array.isArray(rules.dropDocs) ? rules.dropDocs : []);
  const documentRules = object(rules.documents);

  manifest.brand = { ...manifest.brand, ...object(rules.brand) };
  manifest.metadata = { ...manifest.metadata, ...object(rules.metadata) };
  manifest.theme = { ...manifest.theme, ...object(rules.theme) };
  manifest.ai = { ...manifest.ai, ...object(rules.ai) };
  manifest.legal = { ...manifest.legal, ...object(rules.legal) };
  manifest.docs = manifest.docs.filter((doc) => !drop.has(doc.slug)).map((doc) => {
    const patch = object(documentRules[doc.slug]);
    return { ...doc, ...patch, source: doc.source };
  });

  const requestedGroups = Array.isArray(rules.groups) ? rules.groups : manifest.navigation.groups;
  const usedGroups = new Set(manifest.docs.map((doc) => doc.group));
  manifest.navigation.groups = requestedGroups.filter((group) => usedGroups.has(group.name));
  manifest.navigation.defaultDocSlug = rules.defaultDocSlug ?? manifest.navigation.defaultDocSlug;
  if (!manifest.docs.some((doc) => doc.slug === manifest.navigation.defaultDocSlug)) manifest.navigation.defaultDocSlug = manifest.docs[0]?.slug ?? "";
  manifest.curation = {
    curatedAt: new Date().toISOString(),
    requiresEditorialReview: true,
    notes: Array.isArray(rules.notes) ? rules.notes : [],
  };
  const validation = validateBrandvilleManifest(manifest);
  return { manifest, validation };
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function curateManifestFiles({ inputPath, rulesPath, outputPath }) {
  const result = applyBrandvilleCuration(await readJson(inputPath), await readJson(rulesPath));
  if (!result.validation.valid) return result;
  await writeFile(outputPath, `${JSON.stringify(result.manifest, null, 2)}\n`, "utf8");
  return result;
}
