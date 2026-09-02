import type { SwatchesBlock } from "@/content/doc-blocks";
import { BlockHeader } from "./BlockHeader";

const columnClasses = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
} as const;

export function SwatchesBlockView({ block }: { block: SwatchesBlock }) {
  return (
    <section>
      <BlockHeader eyebrow={block.eyebrow} title={block.title} />
      <ul className={`grid gap-5 ${columnClasses[block.columns ?? 4]}`}>
        {block.items.map((item) => (
          <li key={`${item.name}-${item.hex}`}>
            {/* Labels sit below the chip on purpose: nothing is ever printed on
                top of a content colour, so no contrast maths is needed. */}
            <div
              className="aspect-square w-full border border-brand-border"
              style={{ backgroundColor: item.hex }}
            />
            <p className="mt-3 font-display text-xs font-black uppercase tracking-wide text-brand-text">
              {item.name}
            </p>
            <p className="mt-1 font-mono text-[11px] uppercase text-brand-accent">{item.hex}</p>
            {(item.rgb || item.cmyk) && (
              <p className="mt-1 font-mono text-[10px] leading-relaxed text-brand-text-muted">
                {item.rgb && <>RGB {item.rgb}</>}
                {item.rgb && item.cmyk && <br />}
                {item.cmyk && <>CMYK {item.cmyk}</>}
              </p>
            )}
            {item.note && <p className="mt-2 text-xs leading-relaxed text-brand-text-muted">{item.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
