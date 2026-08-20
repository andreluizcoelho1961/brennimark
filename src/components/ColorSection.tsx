import { foundationColorTokens, releaseAccentTokens, type ColorToken } from "@/content/brand";

function Swatches({ tokens }: { tokens: ColorToken[] }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3">
      {tokens.map((c) => (
        <div key={c.token}>
          <div
            className="aspect-square w-full border border-border-default"
            style={{ backgroundColor: c.hex }}
          />
          <p className="mt-3 font-display text-sm font-bold uppercase tracking-wide text-release-analog-white">
            {c.name}
          </p>
          <p className="font-mono text-xs text-text-secondary">{c.hex}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{c.function}</p>
        </div>
      ))}
    </div>
  );
}

export function ColorSection() {
  return (
    <>
      <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
        The brand colors are black and white. Everything else is variable:
        each single may carry its own accents, sampled with a pixel color
        picker from that release&apos;s own artwork — never estimated by eye.
        Color has a defined function; it is never decorative-only. No
        black-and-amber default blues code, no orange/teal cinematic
        grading.
      </p>

      <section className="mt-12">
        <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-release-analog-turquoise">
          Foundation — permanent
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
          Carries across every release. These do not change.
        </p>
        <Swatches tokens={foundationColorTokens} />
      </section>

      <section className="mt-14 border-t border-border-default pt-10">
        <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-release-analog-blue">
          Accents — Call Me Analog Man
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
          Specific to this release. A future single gets its own accents,
          sampled from its own artwork — do not treat these as brand colors
          or reuse them by default.
        </p>
        <Swatches tokens={releaseAccentTokens} />
      </section>
    </>
  );
}
