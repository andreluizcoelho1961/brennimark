import type { DocBlock } from "@/content/doc-blocks";
import { CalloutBlockView } from "./CalloutBlockView";
import { GalleryBlockView } from "./GalleryBlockView";
import { ListBlockView } from "./ListBlockView";
import { ProseBlockView } from "./ProseBlockView";
import { SectionBlockView } from "./SectionBlockView";
import { SwatchesBlockView } from "./SwatchesBlockView";

export function BlockRenderer({ block }: { block: DocBlock }) {
  switch (block.kind) {
    case "prose":
      return <ProseBlockView block={block} />;
    case "list":
      return <ListBlockView block={block} />;
    case "callout":
      return <CalloutBlockView block={block} />;
    case "swatches":
      return <SwatchesBlockView block={block} />;
    case "gallery":
      return <GalleryBlockView block={block} />;
    case "section":
      return (
        <SectionBlockView block={block}>
          {block.blocks.map((child, i) => (
            <BlockRenderer key={i} block={child} />
          ))}
        </SectionBlockView>
      );
    default: {
      const exhaustive: never = block;
      void exhaustive;
      return null;
    }
  }
}
