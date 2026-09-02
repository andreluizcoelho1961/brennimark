import type { ProseBlock } from "@/content/doc-blocks";
import { BlockHeader } from "./BlockHeader";

export function ProseBlockView({ block }: { block: ProseBlock }) {
  return (
    <section className="max-w-3xl">
      <BlockHeader eyebrow={block.eyebrow} title={block.title} />
      {block.lead && (
        <p className="text-lg leading-relaxed text-brand-text md:text-xl">{block.lead}</p>
      )}
      <div className={`space-y-5 ${block.lead ? "mt-6" : ""}`}>
        {block.paragraphs.map((paragraph, i) => (
          <p key={i} className="text-base leading-relaxed text-brand-text-muted md:text-lg">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
