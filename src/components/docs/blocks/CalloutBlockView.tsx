import type { CalloutBlock } from "@/content/doc-blocks";

const toneClasses = {
  accent: "border-brand-accent bg-brand-surface",
  neutral: "border-brand-border bg-brand-surface",
  muted: "border-brand-border bg-brand-bg-secondary",
} as const;

export function CalloutBlockView({ block }: { block: CalloutBlock }) {
  const isHero = block.size === "hero";

  return (
    <aside className={`border-l-4 px-8 py-7 ${toneClasses[block.tone ?? "accent"]}`}>
      {block.label && (
        <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-brand-accent">
          {block.label}
        </p>
      )}
      <p
        className={
          isHero
            ? "mt-4 font-brand font-black uppercase leading-[1.05] tracking-tight text-brand-text text-[clamp(1.75rem,4vw,3rem)]"
            : "mt-3 text-lg leading-relaxed text-brand-text md:text-xl"
        }
      >
        {block.text}
      </p>
    </aside>
  );
}
