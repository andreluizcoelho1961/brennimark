import type { DocBlock } from "./doc-blocks";

export type { DocBlock };

export type DocStatus = "ready" | "draft" | "pending";

export interface DocPageImage {
  /**
   * Either a path under /public (e.g. "/brand/mockups/poster-01.jpg") — always
   * starts with "/" — or a `brand-assets` Storage object path
   * ("workspaceId/brandId/...", no leading slash). Storage paths are resolved
   * to a signed URL server-side, fresh per render (see resolverImagensDeStorage
   * in lib/brennimark/server.ts) before this type reaches any renderer; the
   * leading-slash check is what tells the two apart.
   */
  src: string;
  alt: string;
  caption?: string;
}

export interface DocPageEntry {
  /** URL path segments, e.g. "nucleo-da-marca/posicionamento" */
  slug: string;
  group: string;
  title: string;
  status: DocStatus;
  /** Prose paragraphs for the generic DocPage renderer. Ignored for
   * slugs that have a custom component (see COMPONENT_SLUGS in the
   * [...slug] route). */
  body?: string[];
  /** Reference images/mockups rendered as a grid below the body text.
   * Drop files under public/brand/<group-folder>/ and list them here —
   * see public/brand/README.md for the folder convention. */
  images?: DocPageImage[];
  /** Structured visual content, rendered after `body` and before `images`.
   * Absent means the page renders exactly as it did before blocks existed. */
  blocks?: readonly DocBlock[];
}

/**
 * O conteúdo de uma marca vive no banco, não aqui.
 *
 * Este módulo guarda só o CONTRATO de uma página de manual. O registro de
 * páginas que existia neste arquivo era o material do The BluesMaker: conteúdo
 * de um cliente específico versionado como se fosse estrutura de produto.
 *
 * Ver docs/adr/0003-produto-hospedado-multi-marca.md e
 * docs/plan/migracao-1-conteudo-vira-dado.md
 */
