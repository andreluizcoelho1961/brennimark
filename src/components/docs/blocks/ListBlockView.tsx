import type { ListBlock } from "@/content/doc-blocks";
import { BlockHeader } from "./BlockHeader";

const columnClasses = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
} as const;

export function ListBlockView({ block }: { block: ListBlock }) {
  const grid = `grid gap-x-10 gap-y-5 ${columnClasses[block.columns ?? 1]}`;

  return (
    <section>
      <BlockHeader eyebrow={block.eyebrow} title={block.title} />

      {block.variant === "cards" ? (
        <div className={`${grid} gap-y-6`}>
          {block.items.map((item, i) => (
            <article key={i} className="border border-brand-border bg-brand-surface p-7">
              <span className="font-mono text-xs text-brand-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              {item.title && (
                <h3 className="mt-4 font-display text-lg font-black uppercase leading-tight text-brand-text">
                  {item.title}
                </h3>
              )}
              <p className="mt-3 text-sm leading-relaxed text-brand-text-muted">{item.text}</p>
            </article>
          ))}
        </div>
      ) : (
        <ol className={grid}>
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-4">
              <span
                className="flex-none font-mono text-xs leading-6 text-brand-accent"
                aria-hidden={block.variant === "bullet"}
              >
                {block.variant === "numbered" ? String(i + 1).padStart(2, "0") : "—"}
              </span>
              <p className="text-base leading-relaxed text-brand-text-muted">
                {item.title && (
                  <span className="font-display font-bold uppercase text-brand-text">
                    {item.title}{" "}
                  </span>
                )}
                {item.text}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
