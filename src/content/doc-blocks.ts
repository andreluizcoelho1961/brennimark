import type { DocPageImage } from "./docs";

export type BlockTone = "accent" | "neutral" | "muted";

export interface ProseBlock {
  kind: "prose";
  eyebrow?: string;
  title?: string;
  lead?: string;
  paragraphs: string[];
}

export interface ListBlock {
  kind: "list";
  variant: "numbered" | "bullet" | "cards";
  eyebrow?: string;
  title?: string;
  columns?: 1 | 2 | 3;
  items: { title?: string; text: string }[];
}

export interface CalloutBlock {
  kind: "callout";
  tone?: BlockTone;
  label?: string;
  text: string;
  size?: "default" | "hero";
}

export interface SwatchesBlock {
  kind: "swatches";
  eyebrow?: string;
  title?: string;
  columns?: 2 | 3 | 4 | 5;
  items: { name: string; hex: string; rgb?: string; cmyk?: string; note?: string }[];
}

export interface GalleryBlock {
  kind: "gallery";
  eyebrow?: string;
  title?: string;
  columns?: 1 | 2 | 3 | 4;
  aspect?: "1/1" | "4/3" | "3/4" | "4/5" | "16/9";
  fit?: "cover" | "contain";
  items: DocPageImage[];
}

export type LeafBlock = ProseBlock | ListBlock | CalloutBlock | SwatchesBlock | GalleryBlock;

export interface SectionBlock {
  kind: "section";
  /** Hex of the chromatic marker dot. Content, not styling. */
  marker?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  blocks: LeafBlock[];
}

export type DocBlock = LeafBlock | SectionBlock;

const HEX = /^#[0-9a-fA-F]{6}$/;
const TONES: BlockTone[] = ["accent", "neutral", "muted"];
const ASPECTS = ["1/1", "4/3", "3/4", "4/5", "16/9"];
const FITS = ["cover", "contain"];
const VARIANTS = ["numbered", "bullet", "cards"];

const MAX_BLOCKS_PER_PAGE = 40;
const MAX_ITEMS_PER_BLOCK = 60;
const MAX_STRING = 4000;

function str(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_STRING;
}

function optStr(value: unknown): boolean {
  return value === undefined || str(value);
}

function strArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_ITEMS_PER_BLOCK && value.every(str);
}

function optEnum(value: unknown, allowed: readonly unknown[]): boolean {
  return value === undefined || allowed.includes(value);
}

function items(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_ITEMS_PER_BLOCK &&
    value.every((item) => typeof item === "object" && item !== null && !Array.isArray(item))
  );
}

function isLeafBlock(block: unknown): block is LeafBlock {
  if (typeof block !== "object" || block === null) return false;
  const b = block as Record<string, unknown>;

  switch (b.kind) {
    case "prose":
      return (
        optStr(b.eyebrow) &&
        optStr(b.title) &&
        optStr(b.lead) &&
        strArray(b.paragraphs) &&
        (b.paragraphs.length > 0 || str(b.lead) || str(b.title))
      );
    case "list":
      return (
        VARIANTS.includes(b.variant as string) &&
        optStr(b.eyebrow) &&
        optStr(b.title) &&
        optEnum(b.columns, [1, 2, 3]) &&
        items(b.items) &&
        b.items.every((item) => str(item.text) && optStr(item.title))
      );
    case "callout":
      return optEnum(b.tone, TONES) && optEnum(b.size, ["default", "hero"]) && optStr(b.label) && str(b.text);
    case "swatches":
      return (
        optStr(b.eyebrow) &&
        optStr(b.title) &&
        optEnum(b.columns, [2, 3, 4, 5]) &&
        items(b.items) &&
        b.items.every(
          (item) =>
            str(item.name) &&
            typeof item.hex === "string" &&
            HEX.test(item.hex) &&
            optStr(item.rgb) &&
            optStr(item.cmyk) &&
            optStr(item.note),
        )
      );
    case "gallery":
      return (
        optStr(b.eyebrow) &&
        optStr(b.title) &&
        optEnum(b.columns, [1, 2, 3, 4]) &&
        optEnum(b.aspect, ASPECTS) &&
        optEnum(b.fit, FITS) &&
        items(b.items) &&
        b.items.every((item) => str(item.src) && typeof item.alt === "string" && optStr(item.caption))
      );
    default:
      return false;
  }
}

function isBlock(block: unknown): block is DocBlock {
  if (typeof block !== "object" || block === null) return false;
  const b = block as Record<string, unknown>;

  if (b.kind === "section") {
    return (
      str(b.title) &&
      optStr(b.eyebrow) &&
      optStr(b.subtitle) &&
      (b.marker === undefined || (typeof b.marker === "string" && HEX.test(b.marker))) &&
      Array.isArray(b.blocks) &&
      b.blocks.length <= MAX_BLOCKS_PER_PAGE &&
      b.blocks.every(isLeafBlock)
    );
  }

  return isLeafBlock(block);
}

/** Returns null when the input is absent or malformed, so callers fall back
 * to the static registry instead of rendering a broken page. */
export function parseDocBlocks(value: unknown): DocBlock[] | null {
  if (!Array.isArray(value) || value.length > MAX_BLOCKS_PER_PAGE) return null;
  if (!value.every(isBlock)) return null;
  return value as DocBlock[];
}

function leafToFacts(block: LeafBlock): string[] {
  switch (block.kind) {
    case "prose":
      return [block.title, block.lead, ...block.paragraphs].filter((line): line is string => Boolean(line));
    case "list":
      return block.items.map((item) => {
        const head = [block.title, item.title].filter(Boolean).join(" — ");
        return head ? `${head}: ${item.text}` : item.text;
      });
    case "callout":
      return [block.label ? `Destaque (${block.label}): ${block.text}` : `Destaque: ${block.text}`];
    case "swatches":
      return block.items.map((item) =>
        [`${item.name} — HEX ${item.hex}`, item.rgb && `RGB ${item.rgb}`, item.cmyk && `CMYK ${item.cmyk}`, item.note]
          .filter(Boolean)
          .join(" · "),
      );
    case "gallery":
      return block.items.map((item) =>
        `Referência visual: ${item.src} — ${item.alt}${item.caption ? ` (${item.caption})` : ""}`,
      );
  }
}

/** Flattens blocks into plain lines for the AI brand context. Lines inside a
 * section carry a "[Section] " prefix so the model cannot mix facts that
 * belong to different territories. */
export function flattenBlocksToFacts(blocks: readonly DocBlock[]): string[] {
  return blocks.flatMap((block) => {
    if (block.kind !== "section") return leafToFacts(block);
    const head = [`Seção: ${block.title}`, block.subtitle].filter(Boolean).join(" — ");
    const children = block.blocks.flatMap(leafToFacts).map((line) => `[${block.title}] ${line}`);
    return [head, ...children];
  });
}
