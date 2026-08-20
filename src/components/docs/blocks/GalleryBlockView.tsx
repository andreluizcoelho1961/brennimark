import Image from "next/image";
import type { GalleryBlock } from "@/content/doc-blocks";
import { BlockHeader } from "./BlockHeader";

const columnClasses = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
} as const;

const aspectClasses = {
  "1/1": "aspect-square",
  "4/3": "aspect-[4/3]",
  "3/4": "aspect-[3/4]",
  "4/5": "aspect-[4/5]",
  "16/9": "aspect-[16/9]",
} as const;

export function GalleryBlockView({ block }: { block: GalleryBlock }) {
  const columns = block.columns ?? 2;
  const fit = block.fit ?? "cover";

  return (
    <section>
      <BlockHeader eyebrow={block.eyebrow} title={block.title} />
      <div className={`grid gap-6 ${columnClasses[columns]}`}>
        {block.items.map((item) => (
          <figure key={item.src}>
            <div
              className={`relative overflow-hidden border border-border-default bg-surface-light ${
                aspectClasses[block.aspect ?? "4/3"]
              }`}
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes={columns === 1 ? "100vw" : `(min-width: 640px) ${Math.round(90 / columns)}vw, 100vw`}
                className={fit === "contain" ? "object-contain p-6" : "object-cover"}
              />
            </div>
            {item.caption && (
              <figcaption className="mt-3 font-display text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                {item.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}
