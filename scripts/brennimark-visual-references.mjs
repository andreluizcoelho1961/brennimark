import { readFile, readdir, writeFile } from "node:fs/promises";

export async function buildVisualReferenceIndex({ manifestPath, pagesDirectory }) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const files = (await readdir(pagesDirectory)).filter((file) => /\.(?:jpe?g|png|webp)$/i.test(file)).sort();
  const byPage = new Map();
  for (const file of files) {
    const match = file.match(/(\d+)(?=\.[^.]+$)/);
    if (match) byPage.set(Number(match[1]), file);
  }
  const documents = manifest.docs.map((doc) => {
    const pages = Array.isArray(doc.source?.pages) ? doc.source.pages : [];
    return { slug: doc.slug, title: doc.title, group: doc.group, pages, files: pages.map((page) => byPage.get(page)).filter(Boolean) };
  });
  const referencedPages = [...new Set(documents.flatMap((doc) => doc.pages))].sort((a, b) => a - b);
  const missingPages = referencedPages.filter((page) => !byPage.has(page));
  return {
    brand: manifest.brand.name,
    purpose: "Private visual references for editorial review. These are not production-ready brand assets.",
    pageFiles: files.length,
    referencedPages: referencedPages.length,
    missingPages,
    documents,
  };
}

export function visualReferenceReport(index) {
  const groups = [...new Set(index.documents.map((doc) => doc.group))];
  return [
    `# Visual references — ${index.brand}`, "",
    `- Rendered pages: ${index.pageFiles}`,
    `- Pages referenced by curated documents: ${index.referencedPages}`,
    `- Missing pages: ${index.missingPages.length ? index.missingPages.join(", ") : "none"}`, "",
    "These JPEG files are review references generated from the source PDF. They must not replace official vector logos, original photography, font licenses, or production templates.", "",
    ...groups.flatMap((group) => [
      `## ${group}`, "",
      ...index.documents.filter((doc) => doc.group === group).map((doc) => `- ${doc.title}: pages ${doc.pages.join(", ")} — ${doc.files.join(", ")}`), "",
    ]),
  ].join("\n");
}

export async function writeVisualReferenceFiles({ manifestPath, pagesDirectory, outputJson, outputReport }) {
  const index = await buildVisualReferenceIndex({ manifestPath, pagesDirectory });
  if (index.missingPages.length) throw new Error(`Missing rendered pages: ${index.missingPages.join(", ")}`);
  await writeFile(outputJson, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  await writeFile(outputReport, visualReferenceReport(index), "utf8");
  return index;
}
