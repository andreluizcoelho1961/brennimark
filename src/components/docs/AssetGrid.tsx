import Image from "next/image";
import type { DocPageImage } from "@/content/docs";

export function AssetGrid({ images }: { images: DocPageImage[] }) {
  return (
    <div className="mt-10 grid gap-8 sm:grid-cols-2">
      {images.map((image) => (
        <figure key={image.src}>
          <div className="relative aspect-[4/3] overflow-hidden border border-brand-border bg-brand-surface">
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(min-width: 640px) 45vw, 100vw"
              className="object-contain"
            />
          </div>
          {image.caption && (
            <figcaption className="mt-3 font-display text-[10px] font-bold uppercase tracking-wide text-brand-text-muted">
              {image.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
