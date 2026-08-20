import { typeRoles } from "@/content/brand";

const WEIGHT_MAP: Record<string, string> = {
  "Gotham Black (900)": "font-black",
  "Gotham Bold (700)": "font-bold",
  "Gotham Medium (500)": "font-medium",
  "Gotham Book (400)": "font-normal",
};

export function TypographySection() {
  return (
    <>
      <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
        Gotham only — Book, Medium, Bold and Black. Licensed to the client;
        self-hosted in the codebase, never bundled or redistributed outside
        it. If Gotham fails to load, the fallback stack is Avenir Next,
        Montserrat, Helvetica Neue, Arial.
      </p>

      <div className="mt-12 space-y-10">
        {typeRoles.map((role) => (
          <div key={role.name} className="border-t border-border-default pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise">
                {role.name}
              </p>
              <p className="font-mono text-xs text-text-secondary">{role.weight}</p>
            </div>
            <p
              className={`mt-3 ${WEIGHT_MAP[role.weight] ?? "font-normal"} font-display uppercase leading-tight text-release-analog-white`}
              style={{ fontSize: role.name === "Display" ? "clamp(1.75rem, 5vw, 3.5rem)" : role.name === "Body" ? "1.125rem" : "1.5rem" }}
            >
              {role.name === "Body" ? (
                <span className="normal-case tracking-normal">{role.sample}</span>
              ) : (
                role.sample
              )}
            </p>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-text-secondary">{role.usage}</p>
          </div>
        ))}
      </div>
    </>
  );
}
