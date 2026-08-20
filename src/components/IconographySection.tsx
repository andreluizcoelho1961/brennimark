import Image from "next/image";
import { iconGroups } from "@/content/brand";

export function IconographySection() {
  return (
    <>
      <div className="grid gap-10 md:grid-cols-12">
        <div className="md:col-span-7">
          <p className="text-sm leading-relaxed text-text-secondary">
            A single line set of 100 icons, one uniform stroke weight
            throughout, no fills and no corner ornament. Because they all
            come from one drawing hand, mixing them inside a layout stays
            consistent — which is the whole reason to work from a set
            rather than sourcing icons one at a time.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-text-secondary">
            The set is deliberately broad — instruments, formats, transport
            controls, microphones — so a layout rarely has to reach outside
            it. Reaching outside is what breaks the consistency the set
            exists to hold.
          </p>
        </div>
        <div className="md:col-span-4 md:col-start-9">
          <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise">
            Working with them
          </p>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            Keep the stroke weight as drawn — rescaling an icon without
            scaling its stroke is what makes a set stop looking like a
            set. Monochrome, following the mark: white on dark, black on
            light. Size them to the text they sit beside rather than to a
            fixed pixel value.
          </p>
        </div>
      </div>

      {iconGroups.map((group) => (
        <div key={group.key} className="mt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-white">
              {group.label}
            </p>
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">
              {group.count} icons
            </p>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">{group.note}</p>

          <ul className="mt-6 grid grid-cols-6 gap-px border border-border-default bg-border-default sm:grid-cols-12 lg:grid-cols-18">
            {Array.from({ length: group.count }, (_, i) => {
              const name = `${group.key}-${String(i + 1).padStart(2, "0")}`;
              return (
                <li key={name} className="flex aspect-square items-center justify-center bg-surface-primary p-2">
                  <span className="relative block h-full w-full">
                    <Image
                      src={`/icons/set/${name}.png`}
                      alt={`${group.label} icon ${i + 1}`}
                      fill
                      sizes="32px"
                      className="object-contain"
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="mt-16 border-t border-border-default pt-10">
        <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise">
          Source
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
          The editable set lives in the vector master; the PNGs here are
          rendered from it at 300dpi, white on transparent. For a variant
          the set doesn&apos;t cover, take it from the master rather than
          drawing a one-off in a different hand.
        </p>
        <a
          href="/brand/iconografia/Music-Icons.ai"
          download
          className="mt-4 inline-block font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise transition-colors duration-150 hover:text-release-analog-white"
        >
          Vector master (AI) →
        </a>
      </div>
    </>
  );
}
