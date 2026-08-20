import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { validateBrandvilleManifest } from "./brandville-instance-generator.mjs";

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MAX_PAGES = 500;

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pagina";
}

function cleanLine(value) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}

function isPageNumber(value) {
  return /^(?:pagina\s*)?\d+(?:\s*\/\s*\d+)?$/i.test(value.trim());
}

function isDocumentChrome(value) {
  return /visual identity manual/i.test(value) || /\bversion\s*\d/i.test(value) || /^page\s+\d+$/i.test(value) || /^logo$/i.test(value);
}

function isSpecimenOrData(value) {
  return /(?:ABCDEFGHIJKLMNOPQRSTUVWXYZ|abcdefghijklmnopqrstuvwxyz|1234567890|\bHEX\b|\bPANTONE\b|\bCMYK\b|^#[0-9A-F]{3,8}\b|lorem ipsum|text title|bold and large)/i.test(value) ||
    /^(?:thin|extra light|light|light italic|regular|medium|semi bold|bold|extra bold|black|italic|black italic|aabb)$/i.test(value);
}

function cleanDividerTitle(value) {
  const afterPageReference = value.match(/\b\d{1,3}\s+([^\d].*)$/);
  return cleanLine(afterPageReference?.[1] ?? value);
}

function pageTitle(page, bodySize) {
  const useful = page.lines.filter((line) => !isDocumentChrome(line.text) && !isPageNumber(line.text) && !isSpecimenOrData(line.text));
  const huge = useful.filter((line) => line.fontSize >= bodySize * 3 && !/^\d+$/.test(line.text));
  if (huge.length) {
    const title = cleanLine(huge.slice(0, 3).map((line) => cleanDividerTitle(line.text)).join(" "));
    if (/contact|more information|contato/i.test(title)) return "Contact";
    return title && title.length <= 100 ? title : "";
  }
  for (const line of useful.slice(0, 12)) {
    const value = cleanLine(line.text);
    const words = value.split(/\s+/);
    if (line.fontSize < bodySize * 0.92 || words.length > 10 || value.length > 80 || /[.!?]$/.test(value)) continue;
    if (/^(?:illegible|color|combinations|low|contrast|text title in|bold and large|materials\.)$/i.test(value)) continue;
    return value;
  }
  return "";
}

function majorGroupFor(title) {
  const normalized = slugify(title);
  if (/^(?:brand-application|brand-applications|applications|aplicacoes)$/.test(normalized)) return "Aplicações";
  if (/^(?:photographic-language|graphic-elements|typography|colors|identidade-visual|visual-identity)$/.test(normalized)) return "Identidade Visual";
  if (/^(?:verbal-identity|brand-voice|identidade-verbal|linguagem-verbal)$/.test(normalized)) return "Identidade Verbal";
  if (/^(?:fundamentals|foundations|strategy|brand-strategy|fundamentos|estrategia)$/.test(normalized)) return "Fundamentos";
  return "";
}

function paragraphize(lines) {
  const paragraphs = [];
  let current = "";
  for (const raw of lines) {
    const cleaned = cleanLine(raw);
    const compact = cleaned.toLowerCase().replace(/[^a-z]/g, "");
    if (/(?:loremipsum|vestibulum|adipiscing|nullamsceler)/.test(compact)) continue;
    const placeholderStart = cleaned.search(/\b(?:lorem|ipsum|vestibulum|nullam|donec(?:eibulum)?|maecenas|adipisc(?:ing)?|venenatis|scelerisque)\b/i);
    const line = placeholderStart >= 0 ? cleaned.slice(0, placeholderStart).trim() : cleaned;
    if (!line || isPageNumber(line)) continue;
    current = current ? `${current} ${line}` : line;
    if (/[.!?:]$/.test(line) || current.length >= 650) {
      paragraphs.push(current.slice(0, 4000));
      current = "";
    }
  }
  if (current) paragraphs.push(current.slice(0, 4000));
  return paragraphs.slice(0, 40);
}

function categoryFor(title) {
  const normalized = slugify(title);
  if (/(logo|color|colour|cores|tipograf|typograph|fotograf|photograph|icone|icon|grafism|graphic|visual|symbol|simbolo|clear-space|minimum-size|incorrect-use-of-the-brand)/.test(normalized) || /(?:^|-)cor(?:-|$)/.test(normalized)) return "Identidade Visual";
  if (/(voz|voice|tom|tone|linguagem|language|verbal|vocab|manifesto|mensagem|message)/.test(normalized)) return "Identidade Verbal";
  if (/(aplica|application|template|social|digital|impresso|print|papelaria|stationery)/.test(normalized)) return "Aplicações";
  if (/(estrateg|strategy|posicion|position|proposito|purpose|missao|mission|visao|vision|valor|value|publico|audience|personalidade|personality)/.test(normalized)) return "Fundamentos";
  return "Início";
}

function codeFor(group, used) {
  const preferred = { "Início": "IN", Fundamentos: "FU", "Identidade Verbal": "IV", "Identidade Visual": "VS", "Aplicações": "AP" }[group] ?? slugify(group).slice(0, 2).toUpperCase();
  let code = preferred;
  let suffix = 2;
  while (used.has(code)) code = `${preferred.slice(0, 2)}${suffix++}`;
  used.add(code);
  return code;
}

export async function extractPdfPages(input) {
  const bytes = Uint8Array.from(input);
  if (bytes.byteLength === 0) throw new Error("O PDF está vazio.");
  if (bytes.byteLength > MAX_PDF_BYTES) throw new Error("O PDF excede o limite de 50 MB desta etapa de importação.");

  const loadingTask = getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true });
  const pdf = await loadingTask.promise;
  if (pdf.numPages > MAX_PAGES) throw new Error("O PDF excede o limite de 500 páginas.");
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item) => typeof item.str === "string" && item.str.trim())
      .map((item) => ({
        text: item.str.trim(),
        x: Number(item.transform?.[4] ?? 0),
        y: Number(item.transform?.[5] ?? 0),
        fontSize: Math.max(Math.abs(Number(item.transform?.[3] ?? 0)), Number(item.height ?? 0), 1),
      }));
    const rows = new Map();
    for (const item of items) {
      const key = Math.round(item.y * 2) / 2;
      const row = rows.get(key) ?? [];
      row.push(item);
      rows.set(key, row);
    }
    const lines = [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, row]) => {
      row.sort((a, b) => a.x - b.x);
      return { text: cleanLine(row.map((item) => item.text).join(" ")), fontSize: Math.max(...row.map((item) => item.fontSize)) };
    }).filter((line) => line.text);
    pages.push({ pageNumber, lines, text: lines.map((line) => line.text).join("\n") });
    page.cleanup();
  }
  await loadingTask.destroy();
  return pages;
}

export function detectPdfSections(pages) {
  const allSizes = pages.flatMap((page) => page.lines.map((line) => line.fontSize)).filter((size) => size > 0);
  const bodySize = median(allSizes) || 10;
  const contentsPages = new Set(pages.filter((page) => page.lines.some((line) => /^(?:table of contents|contents|índice|sumário)$/i.test(line.text))).map((page) => page.pageNumber));
  const sections = [];
  for (const page of pages) {
    if (contentsPages.has(page.pageNumber)) continue;
    let title = pageTitle(page, bodySize) || (sections.length ? sections.at(-1).title : "Introdução");
    if (page.pageNumber === 1 && /(?:https?:\/\/|www\.|\.[a-z]{2,}(?:\/|$)|@)/i.test(title)) title = "Introdução";
    const titleParts = new Set(title.split(/\s+/).map((part) => slugify(part)).filter(Boolean));
    const rawLines = page.lines.filter((line) => {
      if (isDocumentChrome(line.text) || isPageNumber(line.text) || isSpecimenOrData(line.text)) return false;
      if (page.pageNumber === 1 && /(?:https?:\/\/|www\.|\.[a-z]{2,}(?:\/|$)|@)/i.test(line.text)) return false;
      if (slugify(line.text) === slugify(title)) return false;
      if (line.fontSize >= bodySize * 3 && [...titleParts].some((part) => slugify(line.text).includes(part))) return false;
      return true;
    }).map((line) => line.text);
    const body = paragraphize(rawLines);
    const previous = sections.at(-1);
    if (previous && slugify(previous.title) === slugify(title)) {
      previous.pages.push(page.pageNumber);
      previous.body = [...previous.body, ...body].slice(0, 40);
    } else {
      sections.push({ title, pages: [page.pageNumber], body });
    }
  }
  if (sections.length > 1 && slugify(sections[0].title) === "introducao" && sections[0].body.length === 0 && /^(?:hello|ola)/.test(slugify(sections[1].title))) {
    sections[1].title = "Introdução";
    sections[1].pages = [...sections[0].pages, ...sections[1].pages];
    sections.shift();
  }
  return sections.filter((section) => section.body.length > 0 || section.title !== "Introdução").slice(0, 100);
}

function uniqueSlug(base, used) {
  let value = base;
  let index = 2;
  while (used.has(value)) value = `${base}-${index++}`;
  used.add(value);
  return value;
}

export function buildImportedManifest({ key, brandName, descriptor, sourceFile, pages, sections }) {
  const usedSlugs = new Set();
  let activeGroup = "Início";
  const docs = sections.map((section, index) => {
    const majorGroup = majorGroupFor(section.title);
    if (majorGroup) activeGroup = majorGroup;
    const inferredGroup = categoryFor(section.title);
    let group = inferredGroup === "Início" ? activeGroup : inferredGroup;
    if (activeGroup === "Aplicações") group = activeGroup;
    if (activeGroup === "Identidade Visual" && inferredGroup === "Fundamentos") group = activeGroup;
    const prefix = group === "Início" ? "" : `${slugify(group)}/`;
    const slug = uniqueSlug(index === 0 && slugify(section.title) === "introducao" ? "introducao" : `${prefix}${slugify(section.title)}`, usedSlugs);
    return {
      slug, group, title: section.title, status: "draft", body: section.body,
      source: { file: path.basename(sourceFile), pages: section.pages },
    };
  });
  const groupNames = [...new Set(docs.map((doc) => doc.group))];
  const usedCodes = new Set();
  const groups = groupNames.map((group) => ({ name: group, code: codeFor(group, usedCodes) }));
  const manifest = {
    schemaVersion: 1, key,
    brand: { name: brandName, shortName: brandName, descriptor },
    metadata: { title: `${brandName} — Brandville`, description: `Diretrizes vivas de marca de ${brandName}, importadas para revisão editorial.`, language: "pt-BR" },
    navigation: { groups, defaultDocSlug: docs[0]?.slug ?? "introducao", utilityLinks: ["chat", "analysis", "history", "ai-settings"] },
    docs,
    theme: { background: "#080b0f", backgroundSecondary: "#10151c", surface: "#141b24", surfaceLight: "#1b2632", foreground: "#f5f2ea", muted: "#9ca8b5", accent: "#27d3b2", accentSecondary: "#4da7e8", border: "#2d3947", focus: "#58f0d2", fontStack: "Inter, 'Helvetica Neue', Arial, sans-serif" },
    ai: { knowledgeMode: "docs", chatRole: `Você é o assistente oficial da marca ${brandName} dentro do Brandville.`, analysisRole: `Você analisa peças de ${brandName} contra as diretrizes documentadas neste Brandville.` },
    legal: { footerNotice: `Diretrizes oficiais de ${brandName}. Uso autorizado.` },
    import: { sourceFile: path.basename(sourceFile), pageCount: pages.length, importedAt: new Date().toISOString(), requiresEditorialReview: true },
  };
  return { manifest, validation: validateBrandvilleManifest(manifest) };
}

export async function importBrandBookPdf({ pdfPath, key, brandName, descriptor }) {
  const buffer = await readFile(pdfPath);
  const pages = await extractPdfPages(buffer);
  const extractedCharacters = pages.reduce((total, page) => total + page.text.length, 0);
  if (extractedCharacters < Math.max(30, pages.length * 12)) {
    throw new Error("O PDF parece escaneado ou não possui texto suficiente. Execute OCR ou use análise visual antes de importar.");
  }
  const sections = detectPdfSections(pages);
  if (!sections.length) throw new Error("Não foi possível identificar conteúdo editorial no PDF.");
  const result = buildImportedManifest({ key, brandName, descriptor, sourceFile: pdfPath, pages, sections });
  return { ...result, pages, sections, extractedCharacters };
}

export function buildImportReport({ pdfPath, brandName, pages, sections, extractedCharacters, validation }) {
  const lines = [
    `# Relatório de importação — ${brandName}`, "",
    `- Arquivo: \`${path.basename(pdfPath)}\``,
    `- Páginas: ${pages.length}`,
    `- Caracteres extraídos: ${extractedCharacters}`,
    `- Seções propostas: ${sections.length}`,
    `- Publicação automática: não`, "",
    "## Alertas", "",
    "- Todo conteúdo foi marcado como rascunho.",
    "- Títulos e categorias foram inferidos pela hierarquia tipográfica e precisam de revisão humana.",
    "- Imagens, cores e relações espaciais do PDF não são convertidas em regras apenas pela extração textual.",
    ...validation.warnings.map((warning) => `- ${warning}`), "",
    "## Seções propostas", "",
    ...sections.flatMap((section) => [`### ${section.title}`, `Páginas: ${section.pages.join(", ")}`, section.body[0] ? `Prévia: ${section.body[0].slice(0, 240)}` : "Prévia: sem texto corrido", ""]),
    "## Próximas verificações", "",
    "- [ ] Comparar cada seção com as páginas indicadas no PDF.",
    "- [ ] Separar regra objetiva, recomendação, exemplo e interpretação.",
    "- [ ] Revisar nomes, grupos, estados editoriais e duplicidades.",
    "- [ ] Migrar assets aprovados para a biblioteca.",
    "- [ ] Validar o manifesto antes de gerar a instância.", "",
  ];
  return lines.join("\n");
}
