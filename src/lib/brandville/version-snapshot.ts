import { parseDocBlocks, type DocBlock } from "../../content/doc-blocks";
import type { DocPageEntry, DocPageImage, DocStatus } from "../../content/docs";

/**
 * O instantâneo de uma versão, e a página que ele reconstrói.
 *
 * Puro, sem Supabase, porque é aqui que a recuperação perde conteúdo em
 * silêncio — e perdeu: o gatilho já gravava `blocks` no instantâneo, mas a
 * leitura ignorava o campo e a página voltava com o padrão `[]`. Texto e
 * imagens reapareciam; paletas, galerias e territórios não. Um teste que
 * compara a página recuperada com a original pega isso; ler o código não pegou.
 */
export interface VersionSnapshot {
  slug: string;
  group: string;
  title: string;
  status: DocStatus;
  body: string[];
  images: DocPageImage[];
  /** Ausente nos instantâneos anteriores à coluna `blocks`. */
  blocks?: readonly DocBlock[];
  sortOrder: number;
  updatedAt?: string;
}

const STATUS = new Set<DocStatus>(["ready", "draft", "pending"]);

export function validImages(value: unknown): value is DocPageImage[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const image = item as Record<string, unknown>;
    return typeof image.src === "string" && typeof image.alt === "string" &&
      (image.caption === undefined || typeof image.caption === "string");
  });
}

export function parseSnapshot(value: unknown): VersionSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Record<string, unknown>;
  if (
    typeof snapshot.slug !== "string" ||
    typeof snapshot.group !== "string" ||
    typeof snapshot.title !== "string" ||
    !STATUS.has(snapshot.status as DocStatus) ||
    !Array.isArray(snapshot.body) || !snapshot.body.every((item) => typeof item === "string") ||
    !validImages(snapshot.images) ||
    typeof snapshot.sortOrder !== "number"
  ) return null;

  // Instantâneo antigo não tem `blocks`, e isso não o invalida: a coluna nasceu
  // depois. Bloco malformado também não derruba a versão inteira — vira
  // ausência, como em brand-row.ts.
  const blocks = parseDocBlocks(snapshot.blocks) ?? undefined;
  return { ...(snapshot as unknown as VersionSnapshot), blocks };
}

/** O que a recuperação grava e devolve. Tudo que o instantâneo guardou. */
export function pageFromSnapshot(snapshot: VersionSnapshot): DocPageEntry {
  return {
    slug: snapshot.slug,
    group: snapshot.group,
    title: snapshot.title,
    status: snapshot.status,
    body: snapshot.body,
    images: snapshot.images,
    blocks: snapshot.blocks,
  };
}

/** Os campos que definem se duas versões são a mesma coisa. */
export function comparable(snapshot: VersionSnapshot | null) {
  if (!snapshot) return null;
  return {
    group: snapshot.group,
    title: snapshot.title,
    status: snapshot.status,
    body: snapshot.body,
    images: snapshot.images,
    blocks: snapshot.blocks ?? [],
    sortOrder: snapshot.sortOrder,
  };
}
