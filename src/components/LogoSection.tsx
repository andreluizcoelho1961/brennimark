import { Fragment } from "react";
import Image from "next/image";
import { brandvilleInstance } from "@/brandville/config";
import { ClearSpaceDiagram } from "@/components/ClearSpaceDiagram";
import { brandAssets, logoLockups, logoUsageRules, streamingLogos } from "@/content/brand";

/** The three supplied lockups. Black variants exist alongside each
 * white file, same filename with -black.
 *
 * Dimensions and capHeight are measured off the 600dpi exports — the
 * cap height is read from a flat-topped line (THE / MAKER) rather than
 * BLUES, whose round S overshoots the cap line by a few pixels the way
 * type designers intend it to. */

/** Usage guidance, written as direction with the reason attached —
 * see feedback_direction_not_prohibition in project memory. */

export function LogoSection() {
  return (
    <>
      <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
        The mark is a wordmark — no symbol, no icon. It comes in three
        lockups, all the same drawing of the name, differing only in how
        the words are arranged. Pick by the shape of the space, not by
        preference: a wide slot takes the horizontal, a square or tall one
        takes a stacked version.
      </p>

      {/* 1 — the lockups themselves, uncluttered */}
      <div className="mt-10 grid gap-10 md:grid-cols-3">
        {logoLockups.map((lockup) => (
          <div key={lockup.key}>
            <div className="flex items-center justify-center border border-border-default bg-surface-primary px-8 py-12">
              <div className="relative w-full" style={{ aspectRatio: `${lockup.width} / ${lockup.height}` }}>
                <Image
                  src={lockup.src}
                  alt={`${brandvilleInstance.brand.name} wordmark — ${lockup.name.toLowerCase()} lockup`}
                  fill
                  sizes="(min-width: 768px) 30vw, 90vw"
                  className="object-contain"
                />
              </div>
            </div>
            <p className="mt-4 font-display text-xs font-bold uppercase tracking-wide text-release-analog-white">
              {lockup.name}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{lockup.use}</p>
          </div>
        ))}
      </div>

      {/* 2 — the two colour variants, each on the background it is for */}
      <div className="mt-16">
        <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise">
          Colour variants
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
          Every lockup ships in two files. Choose by the value behind the
          mark, not by which looks better in isolation: reversed on
          anything dark, positive on anything light.
        </p>

        <div className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">
            Reversed — white on dark
          </p>
          <p className="hidden font-display text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary sm:block">
            Positive — black on light
          </p>

          {logoLockups.map((lockup) => (
            <Fragment key={lockup.key}>
              <div className="flex items-center justify-center border border-border-default bg-release-analog-black px-8 py-10">
                <div className="relative w-full" style={{ aspectRatio: `${lockup.width} / ${lockup.height}` }}>
                  <Image
                    src={lockup.src}
                    alt={`${lockup.name} lockup, reversed for dark backgrounds`}
                    fill
                    sizes="(min-width: 640px) 45vw, 90vw"
                    className="object-contain"
                  />
                </div>
              </div>
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary sm:hidden">
                Positive — black on light
              </p>
              <div className="flex items-center justify-center border border-border-default bg-release-analog-white px-8 py-10">
                <div className="relative w-full" style={{ aspectRatio: `${lockup.width} / ${lockup.height}` }}>
                  <Image
                    src={lockup.srcBlack}
                    alt={`${lockup.name} lockup, positive for light backgrounds`}
                    fill
                    sizes="(min-width: 640px) 45vw, 90vw"
                    className="object-contain"
                  />
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </div>

      {/* 3 — clear space, measured */}
      <div className="mt-16">
        <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise">
          Clear space
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
          The dashed frame is the clear space: nothing —{" "}
          <span className="text-release-analog-white">type, image, edge of the page, another logo</span>{" "}
          — comes inside it. The distance is one cap height, the height of
          the letters themselves, marked in turquoise in the corner of each
          diagram. Because the measure is taken from the mark, it scales
          with it: no separate value to look up at each size.
        </p>

        <div className="mt-8 grid gap-10 md:grid-cols-3">
          {logoLockups.map((lockup) => (
            <div key={lockup.key}>
              <div className="border border-border-default bg-surface-primary p-6">
                <ClearSpaceDiagram
                  src={lockup.src}
                  alt={`${lockup.name} lockup shown inside its clear space`}
                  width={lockup.width}
                  height={lockup.height}
                  capHeight={lockup.capHeight}
                />
              </div>
              <p className="mt-3 font-display text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                {lockup.name}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-14">
        <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise">
          Usage
        </p>
        <ul className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {logoUsageRules.map((rule, index) => (
            <li key={rule.title} className="flex gap-5">
              <span className="font-display text-[10px] font-bold tabular-nums text-release-analog-turquoise">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-white">
                  {rule.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{rule.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-14 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-6">
          <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise">
            Colour
          </p>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            The wordmark is monochrome: white on dark, black on light.
            Each lockup ships in both. It carries no colour of its own —
            the release accent lives in the artwork and the typography
            around it, never in the mark (see Guia de Cores).
          </p>
        </div>
        <div className="md:col-span-6">
          <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise">
            Minimum size
          </p>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            Not fixed yet. The limit is legibility of the thinnest
            counters — the enclosed gaps in B, E and R close up before
            anything else does. A working rule until it&apos;s measured on
            press and on screen: stop reducing the horizontal lockup
            below roughly 120px wide, and the stacked ones below 90px.
          </p>
        </div>
      </div>

      <div className="mt-16 border-t border-border-default pt-10">
        <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise">
          Streaming badges
        </p>
        <ul className="mt-4 flex flex-wrap items-center gap-4">
          {streamingLogos.map((name) => (
            <li key={name} className="relative h-11 w-[86px]">
              <Image
                src={`/icons/streaming/${name}.png`}
                alt={`${name} badge`}
                fill
                sizes="86px"
                className="object-contain"
              />
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-xl text-xs leading-relaxed text-text-secondary">
          Client-supplied badges, used as-is. Each platform owns its own
          mark and publishes its own guidelines — recoloring, outlining or
          recomposing one puts the release at odds with the service it is
          pointing to.
        </p>
      </div>

      <div className="mt-16 border-t border-border-default pt-10">
        <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise">
          Assets
        </p>
        <ul className="mt-4 max-w-2xl divide-y divide-border-default border-t border-border-default">
          {brandAssets.filter((asset) => asset.category !== "iconography").map((asset) => (
            <li key={asset.label} className="flex items-center justify-between gap-4 py-4">
              <span className="text-sm text-release-analog-white">{asset.label}</span>
              {asset.status === "available" && asset.href ? (
                <a
                  href={asset.href}
                  download
                  className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise transition-colors duration-150 hover:text-release-analog-white"
                >
                  Download →
                </a>
              ) : (
                <span className="font-display text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                  {asset.status === "restricted" ? "Licensed — contact studio" : "Pending"}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-xl text-xs leading-relaxed text-text-secondary">
          Gotham is licensed to the client and self-hosted in the codebase —
          the raw font files are not distributed from this page. For
          production use outside the existing sites, request the license
          directly.
        </p>
      </div>
    </>
  );
}
