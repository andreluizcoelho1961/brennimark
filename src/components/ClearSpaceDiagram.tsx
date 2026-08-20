import Image from "next/image";

interface ClearSpaceDiagramProps {
  src: string;
  alt: string;
  /** Artwork width in source pixels. */
  width: number;
  /** Artwork height in source pixels. */
  height: number;
  /** Cap height in the same source pixels — the clear-space unit. */
  capHeight: number;
}

/**
 * Shows a lockup inside its clear space, drawn to measure rather than
 * approximated: the dashed frame sits exactly one cap height away from
 * the artwork on every side.
 *
 * The geometry is derived from the source pixel dimensions instead of
 * hardcoded percentages, so re-exporting the logo at another size keeps
 * the diagram correct. Percentage insets are used (not padding, which
 * resolves against width on both axes) so the margin stays square at
 * any rendered size.
 */
export function ClearSpaceDiagram({ src, alt, width, height, capHeight }: ClearSpaceDiagramProps) {
  const totalWidth = width + capHeight * 2;
  const totalHeight = height + capHeight * 2;
  const insetX = (capHeight / totalWidth) * 100;
  const insetY = (capHeight / totalHeight) * 100;

  return (
    <div
      className="relative w-full border border-dashed border-release-analog-turquoise/60"
      style={{ aspectRatio: `${totalWidth} / ${totalHeight}` }}
    >
      {/* The clear-space unit itself, sitting in the top-left margin so
          the reader can see what "one cap height" refers to. */}
      <div
        aria-hidden="true"
        className="absolute bg-release-analog-turquoise/15"
        style={{
          left: 0,
          top: 0,
          width: `${insetX}%`,
          height: `${insetY}%`,
        }}
      />
      <div
        className="absolute"
        style={{
          left: `${insetX}%`,
          right: `${insetX}%`,
          top: `${insetY}%`,
          bottom: `${insetY}%`,
        }}
      >
        <Image src={src} alt={alt} fill sizes="(min-width: 768px) 30vw, 90vw" className="object-contain" />
      </div>
    </div>
  );
}
