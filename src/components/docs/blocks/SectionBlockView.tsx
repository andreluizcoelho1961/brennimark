import type { SectionBlock } from "@/content/doc-blocks";

export function SectionBlockView({ block, children }: { block: SectionBlock; children: React.ReactNode }) {
  return (
    <section className="border-t border-border-default pt-10">
      <header className="mb-10">
        {block.eyebrow && (
          <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">
            {block.eyebrow}
          </p>
        )}
        <div className="mt-3 flex items-center gap-4">
          {block.marker && (
            <span
              className="h-4 w-4 flex-none rounded-full border border-border-default"
              style={{ backgroundColor: block.marker }}
              aria-hidden
            />
          )}
          <h2 className="font-brand font-black uppercase leading-none tracking-tight text-release-analog-white text-[clamp(1.5rem,3.5vw,2.5rem)]">
            {block.title}
          </h2>
        </div>
        {block.subtitle && (
          <p className="mt-3 text-base leading-relaxed text-text-secondary md:text-lg">{block.subtitle}</p>
        )}
      </header>
      <div className="space-y-12">{children}</div>
    </section>
  );
}
