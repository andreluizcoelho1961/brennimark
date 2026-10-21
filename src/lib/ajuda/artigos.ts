import fs from "node:fs";
import path from "node:path";
import { separarCabecalho, textoPuro, type Cabecalho } from "./markdown";

/**
 * A Central de ajuda — os artigos e as categorias.
 *
 * Os artigos moram em `src/content/ajuda/*.md` (decisão de 17/10/2026: no
 * repositório, não no banco — mudam junto com a funcionalidade, em PR, e não
 * pedem schema). O nome do arquivo é o endereço: `kit.md` vira `/ajuda/kit`.
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

export type SlugDeCategoria = (typeof CATEGORIAS)[number]["slug"];
export type FerramentaComAjuda = "cores" | "grids" | "kit";

export type Artigo = Cabecalho & { slug: string; corpo: string; texto: string };

const PASTA = path.join(process.cwd(), "src", "content", "ajuda");

export function listarArtigos(): Artigo[] {
  const slugs = new Set<string>(CATEGORIAS.map((c) => c.slug));
  return fs
    .readdirSync(PASTA)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const slug = f.replace(/\.md$/, "");
      const { cabecalho, corpo } = separarCabecalho(fs.readFileSync(path.join(PASTA, f), "utf8"), f);
      if (!slugs.has(cabecalho.categoria)) throw new Error(`${f}: categoria desconhecida "${cabecalho.categoria}"`);
      return { ...cabecalho, slug, corpo, texto: textoPuro(corpo) };
    })
    .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, "pt-BR"));
}

export function artigoPorSlug(slug: string): Artigo | undefined {
  return listarArtigos().find((a) => a.slug === slug);
}

export function artigoDaFerramenta(ferramenta: FerramentaComAjuda): Artigo {
  const a = listarArtigos().find((x) => x.ferramenta === ferramenta);
  if (!a) throw new Error(`Sem artigo de ajuda para a ferramenta "${ferramenta}"`);
  return a;
}

export function artigosDaCategoria(categoria: string): Artigo[] {
  return listarArtigos().filter((a) => a.categoria === categoria);
}
