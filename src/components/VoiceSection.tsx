import { voice } from "@/content/brand";

export function VoiceSection() {
  return (
    <div className="grid gap-10 md:grid-cols-12">
      <div className="md:col-span-5">
        <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise">
          Voice is
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {voice.characteristics.map((c) => (
            <li
              key={c}
              className="border border-border-default px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wide text-release-analog-white"
            >
              {c}
            </li>
          ))}
        </ul>

        <p className="mt-8 font-display text-xs font-bold uppercase tracking-wide text-release-analog-white">
          Outside the vocabulary
        </p>
        <ul className="mt-3 space-y-1.5">
          {voice.outsideVocabulary.map((item) => (
            <li key={item} className="text-sm text-text-secondary">— {item}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-text-secondary">
          These ask to be believed before anything has been heard. This is a
          matter of register, not of subject: say what something is and what
          it does differently, and leave the verdict to the reader.
        </p>
      </div>

      <div className="md:col-span-6 md:col-start-7">
        <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise">
          Language rules
        </p>
        <ul className="mt-3 space-y-3">
          {voice.languageRules.map((rule) => (
            <li key={rule} className="border-t border-border-default pt-3 text-sm leading-relaxed text-text-secondary">
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
