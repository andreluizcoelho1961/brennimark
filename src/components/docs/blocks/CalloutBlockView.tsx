import type { CalloutBlock } from "@/content/doc-blocks";

const toneClasses = {
  accent: "border-release-analog-turquoise bg-surface-primary",
  neutral: "border-border-default bg-surface-primary",
  muted: "border-border-default bg-background-secondary",
} as const;

export function CalloutBlockView({ block }: { block: CalloutBlock }) {
  const isHero = block.size === "hero";

  return (
    <aside className={`border-l-4 px-8 py-7 ${toneClasses[block.tone ?? "accent"]}`}>
      {block.label && (
        <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-release-analog-turquoise">
          {block.label}
        </p>
      )}
      <p
        className={
          isHero
            ? "mt-4 font-display font-black uppercase leading-[1.05] tracking-tight text-release-analog-white text-[clamp(1.75rem,4vw,3rem)]"
            : "mt-3 text-lg leading-relaxed text-release-analog-white md:text-xl"
        }
      >
        {block.text}
      </p>
    </aside>
  );
}
