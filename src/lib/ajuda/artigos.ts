import fs from "node:fs";
import path from "node:path";
import { IDIOMA_PADRAO_DO_SITE, type IdiomaDoSite } from "../site/idiomas";
import { separarCabecalho, textoPuro, type Cabecalho } from "./markdown";

/**
 * A Central de ajuda — os artigos e as categorias.
 *
 * Os artigos moram em `src/content/ajuda/*.md` (decisão de 17/10/2026: no
 * repositório, não no banco — mudam junto com a funcionalidade, em PR, e não
 * pedem schema). O nome do arquivo é o endereço: `kit.md` vira `/ajuda/kit`.
 *
 * O inglês (24/10/2026) mora em `src/content/ajuda/en/*.md`, com o MESMO nome
 * de arquivo, o mesmo cabeçalho e a mesma marcação (`:::site`, `{marca: …}`). Artigo
 * sem versão em inglês cai no português em vez de sumir.
 *
 * Lê o disco, então só roda no servidor. As páginas que usam isto são geradas
 * no build; as do assinante, que são dinâmicas, dependem de
 * `outputFileTracingIncludes` em `next.config.ts` para o Vercel levar os
 * arquivos junto da função.
 */
export const CATEGORIAS = [
  { slug: "primeiros-passos", titulo: "Primeiros passos", descricao: "Criar a primeira marca e publicar o manual." },
  { slug: "manual-em-pdf", titulo: "O manual em PDF", descricao: "Envio, índice, versões e download." },
  { slug: "materiais-da-marca", titulo: "Materiais da marca", descricao: "Grupos, formatos, regras de uso e o kit." },
  { slug: "vini-max", titulo: "Vini Max", descricao: "Perguntas, análise de peça, prompts e limites." },
  { slug: "pessoas-e-acesso", titulo: "Pessoas e acesso", descricao: "Convites, papéis e acesso por marca." },
  { slug: "assinatura", titulo: "Assinatura", descricao: "Planos, cobrança, exportação e encerramento." },
] as const;

/** O texto das categorias nos outros idiomas (o slug, que é o endereço, não muda). */
const CATEGORIAS_TRADUZIDAS: Record<Exclude<IdiomaDoSite, "pt-BR">, Record<SlugDeCategoria, { titulo: string; descricao: string }>> = {
  en: {
    "primeiros-passos": { titulo: "Getting started", descricao: "Create the first brand and publish the manual." },
    "manual-em-pdf": { titulo: "The manual as a PDF", descricao: "Upload, index, versions and download." },
    "materiais-da-marca": { titulo: "Brand materials", descricao: "Groups, formats, usage rules and the kit." },
    "vini-max": { titulo: "Vini Max", descricao: "Questions, piece analysis, prompts and limits." },
    "pessoas-e-acesso": { titulo: "People and access", descricao: "Invitations, roles and access by brand." },
    assinatura: { titulo: "Subscription", descricao: "Plans, billing, export and closing the account." },
  },
};

export type SlugDeCategoria = (typeof CATEGORIAS)[number]["slug"];
export type FerramentaComAjuda = "cores" | "grids" | "kit";

export type Artigo = Cabecalho & { slug: string; corpo: string; texto: string };

const PASTA = path.join(process.cwd(), "src", "content", "ajuda");

/** As categorias com o texto no idioma pedido. */
export function categoriasDoIdioma(idioma: IdiomaDoSite = IDIOMA_PADRAO_DO_SITE) {
  if (idioma === "pt-BR") return CATEGORIAS.map((c) => ({ ...c }));
  return CATEGORIAS.map((c) => ({ slug: c.slug, ...CATEGORIAS_TRADUZIDAS[idioma][c.slug] }));
}

export function categoriaPorSlug(slug: string, idioma: IdiomaDoSite = IDIOMA_PADRAO_DO_SITE) {
  return categoriasDoIdioma(idioma).find((c) => c.slug === slug);
}

/** O arquivo do artigo no idioma, ou o português se ainda não foi traduzido. */
function arquivoDoArtigo(f: string, idioma: IdiomaDoSite): string {
  if (idioma !== "pt-BR") {
    const traduzido = path.join(PASTA, idioma === "en" ? "en" : idioma, f);
    if (fs.existsSync(traduzido)) return traduzido;
  }
  return path.join(PASTA, f);
}

export function listarArtigos(idioma: IdiomaDoSite = IDIOMA_PADRAO_DO_SITE): Artigo[] {
  const slugs = new Set<string>(CATEGORIAS.map((c) => c.slug));
  return fs
    .readdirSync(PASTA)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const slug = f.replace(/\.md$/, "");
      const { cabecalho, corpo } = separarCabecalho(fs.readFileSync(arquivoDoArtigo(f, idioma), "utf8"), f);
      if (!slugs.has(cabecalho.categoria)) throw new Error(`${f}: categoria desconhecida "${cabecalho.categoria}"`);
      return { ...cabecalho, slug, corpo, texto: textoPuro(corpo, idioma) };
    })
    .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, "pt-BR"));
}

export function artigoPorSlug(slug: string, idioma: IdiomaDoSite = IDIOMA_PADRAO_DO_SITE): Artigo | undefined {
  return listarArtigos(idioma).find((a) => a.slug === slug);
}

export function artigoDaFerramenta(ferramenta: FerramentaComAjuda, idioma: IdiomaDoSite = IDIOMA_PADRAO_DO_SITE): Artigo {
  const a = listarArtigos(idioma).find((x) => x.ferramenta === ferramenta);
  if (!a) throw new Error(`Sem artigo de ajuda para a ferramenta "${ferramenta}"`);
  return a;
}

export function artigosDaCategoria(categoria: string, idioma: IdiomaDoSite = IDIOMA_PADRAO_DO_SITE): Artigo[] {
  return listarArtigos(idioma).filter((a) => a.categoria === categoria);
}
