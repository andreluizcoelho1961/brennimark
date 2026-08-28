import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED_UTILITIES = new Set(["chat", "analysis", "history", "ai-settings"]);
const ALLOWED_STATUS = new Set(["ready", "draft", "pending"]);
const RESERVED_KEYS = new Set(["example", "the-bluesmaker", "generated"]);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const INSTANCE_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DOC_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function srgb(channel) {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const rgb = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  return 0.2126 * srgb(rgb[0]) + 0.7152 * srgb(rgb[1]) + 0.0722 * srgb(rgb[2]);
}

export function contrastRatio(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const BLOCK_LIMITS = { blocks: 40, items: 60, string: 4000 };
const BLOCK_ENUMS = {
  variant: ["numbered", "bullet", "cards"],
  tone: ["accent", "neutral", "muted"],
  size: ["default", "hero"],
  fit: ["cover", "contain"],
  aspect: ["1/1", "4/3", "3/4", "4/5", "16/9"],
};

/** Mirrors parseDocBlocks in src/content/doc-blocks.ts. The two are kept in
 * sync by the manifest round-trip test — the .mjs script cannot import TS. */
function validateDocBlocks(blocks, slug, errors, { nested = false } = {}) {
  if (!Array.isArray(blocks) || blocks.length > BLOCK_LIMITS.blocks) {
    errors.push(`${slug}: blocks deve ser uma lista com no maximo ${BLOCK_LIMITS.blocks} itens.`);
    return;
  }

  const str = (value) => typeof value === "string" && value.length > 0 && value.length <= BLOCK_LIMITS.string;
  const optStr = (value) => value === undefined || str(value);
  const optEnum = (value, key) => value === undefined || BLOCK_ENUMS[key].includes(value);
  const sized = (value) => Array.isArray(value) && value.length > 0 && value.length <= BLOCK_LIMITS.items;

  blocks.forEach((block, index) => {
    const at = `${slug}: blocks[${index}]`;
    const kind = block?.kind;

    if (kind === "section") {
      if (nested) return errors.push(`${at}: section nao pode ser aninhada dentro de outra section.`);
      if (!str(block.title)) errors.push(`${at}: section exige title.`);
      if (block.marker !== undefined && !HEX_COLOR.test(block.marker)) errors.push(`${at}: marker deve ser hexadecimal de 6 digitos.`);
      if (!optStr(block.eyebrow) || !optStr(block.subtitle)) errors.push(`${at}: eyebrow/subtitle invalidos.`);
      return validateDocBlocks(block.blocks, `${slug}: blocks[${index}]`, errors, { nested: true });
    }

    if (kind === "prose") {
      const paragraphs = block.paragraphs;
      if (!Array.isArray(paragraphs) || paragraphs.length > BLOCK_LIMITS.items || !paragraphs.every(str)) errors.push(`${at}: paragraphs deve ser uma lista de textos.`);
      else if (!paragraphs.length && !str(block.lead) && !str(block.title)) errors.push(`${at}: prose precisa de paragraphs, lead ou title.`);
      if (!optStr(block.eyebrow) || !optStr(block.title) || !optStr(block.lead)) errors.push(`${at}: campos de texto invalidos.`);
    } else if (kind === "list") {
      if (!optEnum(block.variant, "variant") || block.variant === undefined) errors.push(`${at}: list exige variant (${BLOCK_ENUMS.variant.join(", ")}).`);
      if (block.columns !== undefined && ![1, 2, 3].includes(block.columns)) errors.push(`${at}: columns deve ser 1, 2 ou 3.`);
      if (!sized(block.items) || !block.items.every((item) => str(item?.text) && optStr(item?.title))) errors.push(`${at}: list exige items com text.`);
    } else if (kind === "callout") {
      if (!str(block.text)) errors.push(`${at}: callout exige text.`);
      if (!optEnum(block.tone, "tone") || !optEnum(block.size, "size") || !optStr(block.label)) errors.push(`${at}: tone/size/label invalidos.`);
    } else if (kind === "swatches") {
      if (block.columns !== undefined && ![2, 3, 4, 5].includes(block.columns)) errors.push(`${at}: columns deve ser 2, 3, 4 ou 5.`);
      if (!sized(block.items)) errors.push(`${at}: swatches exige items.`);
      else block.items.forEach((item, i) => {
        if (!str(item?.name)) errors.push(`${at}.items[${i}]: name obrigatorio.`);
        if (typeof item?.hex !== "string" || !HEX_COLOR.test(item.hex)) errors.push(`${at}.items[${i}]: hex deve ser hexadecimal de 6 digitos.`);
      });
    } else if (kind === "gallery") {
      if (block.columns !== undefined && ![1, 2, 3, 4].includes(block.columns)) errors.push(`${at}: columns deve ser 1, 2, 3 ou 4.`);
      if (!optEnum(block.aspect, "aspect") || !optEnum(block.fit, "fit")) errors.push(`${at}: aspect/fit invalidos.`);
      if (!sized(block.items) || !block.items.every((item) => str(item?.src) && typeof item?.alt === "string")) errors.push(`${at}: gallery exige items com src e alt.`);
    } else {
      errors.push(`${at}: kind desconhecido "${kind}".`);
    }
  });
}

export function validateBrandvilleManifest(input) {
  const errors = [];
  const warnings = [];
  const manifest = input && typeof input === "object" ? input : {};
  const key = text(manifest.key);
  const brand = manifest.brand && typeof manifest.brand === "object" ? manifest.brand : {};
  const metadata = manifest.metadata && typeof manifest.metadata === "object" ? manifest.metadata : {};
  const navigation = manifest.navigation && typeof manifest.navigation === "object" ? manifest.navigation : {};
  const theme = manifest.theme && typeof manifest.theme === "object" ? manifest.theme : {};
  const ai = manifest.ai && typeof manifest.ai === "object" ? manifest.ai : {};
  const legal = manifest.legal && typeof manifest.legal === "object" ? manifest.legal : {};
  const groups = list(navigation.groups);
  const docs = list(manifest.docs);
  const utilityLinks = list(navigation.utilityLinks);

  if (manifest.schemaVersion !== 1 && manifest.schemaVersion !== 2) errors.push("schemaVersion deve ser 1 ou 2.");
  if (!INSTANCE_KEY.test(key)) errors.push("key deve usar apenas letras minusculas, numeros e hifens.");
  if (RESERVED_KEYS.has(key)) errors.push(`key reservada pela matriz: ${key}.`);
  if (!text(brand.name)) errors.push("brand.name e obrigatorio.");
  if (!text(brand.shortName)) errors.push("brand.shortName e obrigatorio.");
  if (!text(brand.descriptor)) errors.push("brand.descriptor e obrigatorio.");
  if (!text(metadata.description)) errors.push("metadata.description e obrigatorio.");
  if (!text(metadata.language)) errors.push("metadata.language e obrigatorio.");
  if (groups.length === 0 || groups.length > 10) errors.push("navigation.groups deve ter entre 1 e 10 grupos.");
  if (docs.length === 0 || docs.length > 100) errors.push("docs deve ter entre 1 e 100 paginas.");

  const groupNames = groups.map((group) => text(group?.name));
  const groupCodes = groups.map((group) => text(group?.code).toUpperCase());
  if (groupNames.some((name) => !name)) errors.push("Todo grupo precisa de nome.");
  if (new Set(groupNames).size !== groupNames.length) errors.push("Os nomes dos grupos devem ser unicos.");
  if (groupCodes.some((code) => !/^[A-Z0-9]{2,3}$/.test(code))) errors.push("Cada codigo de grupo deve ter 2 ou 3 letras/numeros.");
  if (new Set(groupCodes).size !== groupCodes.length) errors.push("Os codigos dos grupos devem ser unicos.");

  const slugs = docs.map((doc) => text(doc?.slug));
  if (slugs.some((slug) => !DOC_SLUG.test(slug))) errors.push("Todo slug de pagina deve usar minusculas, hifens e barras.");
  if (new Set(slugs).size !== slugs.length) errors.push("Os slugs das paginas devem ser unicos.");
  for (const doc of docs) {
    const slug = text(doc?.slug) || "pagina sem slug";
    if (!groupNames.includes(text(doc?.group))) errors.push(`${slug}: grupo inexistente.`);
    if (!text(doc?.title)) errors.push(`${slug}: titulo obrigatorio.`);
    if (!ALLOWED_STATUS.has(doc?.status)) errors.push(`${slug}: status invalido.`);
    if (!Array.isArray(doc?.body) || doc.body.some((paragraph) => typeof paragraph !== "string")) errors.push(`${slug}: body deve ser uma lista de paragrafos.`);
    if (doc?.blocks !== undefined) {
      if (manifest.schemaVersion !== 2) errors.push(`${slug}: blocks exige schemaVersion 2.`);
      else validateDocBlocks(doc.blocks, slug, errors);
    }
  }
  for (const groupName of groupNames) {
    if (!docs.some((doc) => text(doc?.group) === groupName)) errors.push(`Grupo sem pagina: ${groupName}.`);
  }

  const defaultDocSlug = text(navigation.defaultDocSlug);
  if (!slugs.includes(defaultDocSlug)) errors.push("navigation.defaultDocSlug deve apontar para uma pagina existente.");
  if (utilityLinks.some((item) => !ALLOWED_UTILITIES.has(item))) errors.push("navigation.utilityLinks contem um recurso desconhecido.");
  if (new Set(utilityLinks).size !== utilityLinks.length) errors.push("navigation.utilityLinks nao pode repetir recursos.");

  const requiredColors = ["background", "backgroundSecondary", "surface", "surfaceLight", "foreground", "muted", "accent", "accentSecondary", "border", "focus"];
  for (const color of requiredColors) if (!HEX_COLOR.test(theme[color] ?? "")) errors.push(`theme.${color} deve ser uma cor hexadecimal com 6 digitos.`);
  if (!text(theme.fontStack)) errors.push("theme.fontStack e obrigatorio.");
  if (HEX_COLOR.test(theme.background ?? "") && HEX_COLOR.test(theme.foreground ?? "") && contrastRatio(theme.background, theme.foreground) < 4.5) errors.push("O contraste entre fundo e texto principal deve ser pelo menos 4.5:1.");
  if (HEX_COLOR.test(theme.background ?? "") && HEX_COLOR.test(theme.focus ?? "") && contrastRatio(theme.background, theme.focus) < 3) warnings.push("O foco visual tem contraste inferior a 3:1 sobre o fundo.");

  if (ai.knowledgeMode !== "docs" && ai.knowledgeMode !== "full") errors.push("ai.knowledgeMode deve ser docs ou full.");
  if (!text(ai.chatRole)) errors.push("ai.chatRole e obrigatorio.");
  if (!text(ai.analysisRole)) errors.push("ai.analysisRole e obrigatorio.");
  if (manifest.statusLabels !== undefined) {
    const l = manifest.statusLabels;
    const ok = l && typeof l === "object" && ["ready", "draft", "pending"].every((k) => text(l[k]));
    if (!ok) errors.push("statusLabels, quando presente, precisa de ready, draft e pending.");
  }
  if (!text(legal.footerNotice)) errors.push("legal.footerNotice e obrigatorio.");
  if (docs.some((doc) => doc.status !== "ready")) warnings.push("Existem paginas ainda nao aprovadas editorialmente.");

  return { valid: errors.length === 0, errors, warnings };
}

function normalizedInstance(manifest) {
  const groups = manifest.navigation.groups.map((group) => group.name.trim());
  const groupCodes = Object.fromEntries(manifest.navigation.groups.map((group) => [group.name.trim(), group.code.trim().toUpperCase()]));
  return {
    key: manifest.key.trim(),
    brand: {
      name: manifest.brand.name.trim(),
      shortName: manifest.brand.shortName.trim(),
      descriptor: manifest.brand.descriptor.trim(),
    },
    metadata: {
      title: text(manifest.metadata.title) || `${manifest.brand.name.trim()} — Brandville`,
      description: manifest.metadata.description.trim(),
      language: manifest.metadata.language.trim(),
    },
    navigation: {
      groups,
      groupCodes,
      defaultDocSlug: manifest.navigation.defaultDocSlug.trim(),
      utilityLinks: manifest.navigation.utilityLinks,
    },
    docs: manifest.docs.map((doc) => ({
      slug: doc.slug.trim(), group: doc.group.trim(), title: doc.title.trim(), status: doc.status,
      body: doc.body.map((paragraph) => paragraph.trim()).filter(Boolean),
      ...(Array.isArray(doc.images) && doc.images.length ? { images: doc.images } : {}),
      ...(Array.isArray(doc.blocks) && doc.blocks.length ? { blocks: doc.blocks } : {}),
    })),
    ...(manifest.statusLabels ? { statusLabels: manifest.statusLabels } : {}),
    theme: manifest.theme,
    ai: manifest.ai,
    legal: manifest.legal,
  };
}

function instanceSource(manifest) {
  const instance = normalizedInstance(manifest);
  return `import type { BrandvilleInstance } from "../types";\n\n// Gerado pelo onboarding Brandville. Edite o manifesto e gere novamente.\nexport const brandvilleInstanceDefinition = ${JSON.stringify(instance, null, 2)} satisfies BrandvilleInstance;\n`;
}

function identifierFor(key) {
  return `${key.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase()).replace(/[^a-zA-Z0-9_$]/g, "")}Instance`;
}

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

export async function rebuildGeneratedRegistry(root) {
  const directory = path.join(root, "src/brandville/instances");
  const entries = (await readdir(directory)).filter((name) => name.endsWith(".manifest.json")).sort();
  const keys = entries.map((name) => name.replace(/\.manifest\.json$/, ""));
  const imports = keys.map((key) => `import { brandvilleInstanceDefinition as ${identifierFor(key)} } from "./${key}";`).join("\n");
  const rows = keys.map((key) => `  ${JSON.stringify(key)}: ${identifierFor(key)},`).join("\n");
  const source = `import type { BrandvilleInstance } from "../types";\n${imports ? `\n${imports}\n` : ""}\n// Este arquivo e atualizado pelo onboarding de novas instancias.\nexport const generatedBrandvilleInstances = {\n${rows}${rows ? "\n" : ""}} satisfies Record<string, BrandvilleInstance>;\n`;
  await writeFile(path.join(directory, "generated.ts"), source, "utf8");
}

function checklist(manifest) {
  const name = manifest.brand.name.trim();
  const key = manifest.key.trim();
  return `# Implantacao — ${name}\n\n## Identidade da instancia\n\n- Chave: \`${key}\`\n- Variavel de build: \`NEXT_PUBLIC_BRANDVILLE_INSTANCE=${key}\`\n- Dominio final: pendente\n\n## Infraestrutura exclusiva\n\n- [ ] Criar projeto Supabase exclusivo\n- [ ] Aplicar todas as migrations da matriz\n- [ ] Criar projeto Vercel exclusivo\n- [ ] Configurar URL, chaves publicas e chave de criptografia\n- [ ] Configurar dominio e URLs de autenticacao\n- [ ] Criar usuario proprietario e testar permissoes\n\n## Conteudo e experiencia\n\n- [ ] Revisar paginas em rascunho ou construcao\n- [ ] Enviar assets oficiais e conferir licencas\n- [ ] Configurar IA principal, reserva e regras de troca\n- [ ] Testar chat com citacoes e recusas\n- [ ] Testar analise de uma peca alinhada e outra desalinhada\n- [ ] Revisar celular, teclado, contraste e carregamento\n\n## Entrega\n\n- [ ] Aprovar conteudo com o cliente\n- [ ] Registrar responsavel por atualizacoes\n- [ ] Definir plano Brandville Care\n- [ ] Documentar backup, renovacao e suporte\n`;
}

export async function createBrandvilleInstance({ manifest, root, dryRun = false }) {
  const validation = validateBrandvilleManifest(manifest);
  if (!validation.valid) return { ...validation, files: [] };

  const key = manifest.key.trim();
  const instanceDirectory = path.join(root, "src/brandville/instances");
  const instancePath = path.join(instanceDirectory, `${key}.ts`);
  const manifestPath = path.join(instanceDirectory, `${key}.manifest.json`);
  const assetReadmePath = path.join(root, "public/brand", key, "README.md");
  const checklistPath = path.join(root, "docs/instances", `${key}-launch-checklist.md`);
  const files = [instancePath, manifestPath, assetReadmePath, checklistPath];

  if (await exists(instancePath) || await exists(manifestPath)) {
    return { valid: false, errors: [`A instancia ${key} ja existe. Nenhum arquivo foi alterado.`], warnings: validation.warnings, files: [] };
  }
  if (dryRun) return { ...validation, files };

  await mkdir(instanceDirectory, { recursive: true });
  await mkdir(path.dirname(assetReadmePath), { recursive: true });
  await mkdir(path.dirname(checklistPath), { recursive: true });
  await writeFile(instancePath, instanceSource(manifest), "utf8");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(assetReadmePath, `# Assets — ${manifest.brand.name.trim()}\n\nArquivos publicos aprovados desta instancia. Materiais privados devem ser enviados pela biblioteca do Brandville.\n`, "utf8");
  await writeFile(checklistPath, checklist(manifest), "utf8");
  await rebuildGeneratedRegistry(root);
  return { ...validation, files };
}

export async function readManifest(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}
