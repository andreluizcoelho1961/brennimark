"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AnalysisRun, AnalysisVerdict } from "@/lib/analysis/history";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";

const VERDICT_LABELS_POR_IDIOMA = {
  en: { aligned: "Aligned", partially_aligned: "Partially aligned", misaligned: "Misaligned", unknown: "Unclassified" },
  "pt-BR": { aligned: "Alinhada", partially_aligned: "Parcialmente alinhada", misaligned: "Desalinhada", unknown: "Sem classificação" },
} satisfies Record<string, Record<AnalysisVerdict, string>>;

function seconds(value: number, isEnglish: boolean) {
  const formatted = (value / 1_000).toFixed(1);
  return isEnglish ? `${formatted} s` : `${formatted.replace(".", ",")} s`;
}

function normalizePattern(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\[(?:fonte|source):[^\]]+\]/gi, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function AnalysisHistoryPage() {
  // A marca em que esta tela opera, vinda da URL. Sem ela o servidor não
  // saberia qual, e responderia 409 numa conta com mais de uma.
  const alvo = useAlvo();
  // Os links desta tela vivem dentro da marca da URL. Absolutos (`/docs/...`)
  // sairiam do contexto e o resolvedor teria de adivinhar de volta.
  const base = `/w/${alvo.workspaceSlug}/b/${alvo.brandKey}/docs`;
  const isEnglish = useIsEnglish();
  const VERDICT_LABELS = VERDICT_LABELS_POR_IDIOMA[isEnglish ? "en" : "pt-BR"];
  const locale = isEnglish ? "en-US" : "pt-BR";
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [verdict, setVerdict] = useState<AnalysisVerdict | "all">("all");

  useEffect(() => {
    fetch(comAlvo("/api/analysis/history?limit=200", alvo))
      .then(async (response) => {
        if (!response.ok) throw new Error("history");
        return response.json();
      })
      .then((data) => setRuns(data.runs ?? []))
      .catch(() => setError(isEnglish ? "Couldn't load history." : "Não foi possível carregar o histórico."))
      .finally(() => setLoading(false));
  }, [isEnglish, alvo]);

  const metrics = useMemo(() => {
    const calibrated = runs.filter((run) => run.calibrationEnabled && run.calibrationExpectedVerdict);
    const calibratedMatches = calibrated.filter((run) => run.verdict === run.calibrationExpectedVerdict).length;
    const feedback = runs.filter((run) => run.feedbackRating);
    return {
      total: runs.length,
      misaligned: runs.filter((run) => run.verdict === "misaligned").length,
      averageMs: runs.length ? runs.reduce((sum, run) => sum + run.elapsedMs, 0) / runs.length : 0,
      fallbackRate: runs.length ? (runs.filter((run) => run.fallbackUsed).length / runs.length) * 100 : 0,
      feedbackAgreement: feedback.length ? (feedback.filter((run) => run.feedbackRating === "correct").length / feedback.length) * 100 : null,
      calibrationAccuracy: calibrated.length ? (calibratedMatches / calibrated.length) * 100 : null,
      calibrated: calibrated.length,
    };
  }, [runs]);

  const patterns = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const run of runs) {
      for (const problem of run.analysis.problems) {
        const key = normalizePattern(problem).split(" ").slice(0, 12).join(" ");
        if (!key) continue;
        const current = counts.get(key);
        counts.set(key, { label: current?.label ?? problem.replace(/\[Fonte:[^\]]+\]/gi, "").trim(), count: (current?.count ?? 0) + 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [runs]);

  const gaps = useMemo(() => {
    const expressions = /nao (ha|existe|esta documentad)|insuficient|sem diretriz|nao informado|em construcao|rascunho|ambig|not (enough|documented)|no guideline|undocumented|in progress|draft|ambiguous/i;
    return runs
      .flatMap((run) => [...run.analysis.rules, ...run.analysis.problems, run.analysis.confidence])
      .filter((item) => expressions.test(normalizePattern(item)))
      .slice(0, 5);
  }, [runs]);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizePattern(query);
    return runs.filter((run) => {
      if (verdict !== "all" && run.verdict !== verdict) return false;
      if (!normalizedQuery) return true;
      return normalizePattern(`${run.fileName} ${run.question} ${run.analysis.verdict}`).includes(normalizedQuery);
    });
  }, [query, runs, verdict]);

  return (
    <article className="px-page-inline py-12 md:py-16">
      <div className="inline-flex bg-release-analog-turquoise px-4 py-1.5">
        <span className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-release-analog-black">{isEnglish ? "Governance" : "Governança"}</span>
      </div>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-display font-black uppercase leading-[0.9] tracking-tight text-release-analog-white" style={{ fontSize: "clamp(2rem, 4.5vw, 4rem)" }}>
            {isEnglish ? <>History &amp; <span className="text-release-analog-turquoise">Calibration</span></> : <>Histórico e <span className="text-release-analog-turquoise">Calibração</span></>}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-text-secondary">
            {isEnglish
              ? "Evidence, human review, and recurring patterns that turn every analysis into brand learning."
              : "Evidências, validação humana e padrões recorrentes para transformar cada análise em aprendizado de marca."}
          </p>
        </div>
        <Link href={`${base}/analise`} className="bg-release-analog-turquoise px-5 py-3 font-display text-xs font-bold uppercase tracking-wide text-release-analog-black">
          {isEnglish ? "New analysis" : "Nova análise"}
        </Link>
      </div>

      {loading && <p className="mt-10 text-sm text-text-secondary" role="status">{isEnglish ? "Loading history…" : "Carregando histórico…"}</p>}
      {error && <p className="mt-10 border-l-2 border-release-analog-blue pl-4 text-sm text-release-analog-blue" role="alert">{error}</p>}

      {!loading && !error && (
        <>
          <section className="mt-10 grid gap-px bg-border-default sm:grid-cols-2 xl:grid-cols-5">
            {(isEnglish
              ? [
                  ["Analyses", String(metrics.total)],
                  ["Misaligned", String(metrics.misaligned)],
                  ["Average time", metrics.total ? seconds(metrics.averageMs, isEnglish) : "-"],
                  ["Fallback usage", `${metrics.fallbackRate.toFixed(0)}%`],
                  ["Calibrated accuracy", metrics.calibrationAccuracy === null ? "-" : `${metrics.calibrationAccuracy.toFixed(0)}%`],
                ]
              : [
                  ["Análises", String(metrics.total)],
                  ["Desalinhadas", String(metrics.misaligned)],
                  ["Tempo médio", metrics.total ? seconds(metrics.averageMs, isEnglish) : "-"],
                  ["Uso de reserva", `${metrics.fallbackRate.toFixed(0)}%`],
                  ["Precisão calibrada", metrics.calibrationAccuracy === null ? "-" : `${metrics.calibrationAccuracy.toFixed(0)}%`],
                ]
            ).map(([label, value]) => (
              <div key={label} className="bg-surface-primary p-5">
                <p className="font-display text-[10px] font-bold uppercase tracking-wide text-text-secondary">{label}</p>
                <p className="mt-2 font-display text-2xl font-black text-release-analog-white">{value}</p>
              </div>
            ))}
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="border border-border-default p-6">
              <h2 className="font-display text-sm font-black uppercase tracking-wide text-release-analog-white">{isEnglish ? "Recurring issues" : "Problemas recorrentes"}</h2>
              {patterns.length ? (
                <ol className="mt-5 space-y-4">
                  {patterns.map((pattern, index) => (
                    <li key={`${pattern.label}-${index}`} className="grid grid-cols-[2rem_1fr_auto] gap-3 text-sm">
                      <span className="font-mono text-release-analog-turquoise">{String(index + 1).padStart(2, "0")}</span>
                      <span className="leading-relaxed text-release-analog-white">{pattern.label}</span>
                      <span className="font-mono text-xs text-text-secondary">{pattern.count}×</span>
                    </li>
                  ))}
                </ol>
              ) : <p className="mt-5 text-sm text-text-secondary">{isEnglish ? "Patterns will appear after the first analyses." : "Os padrões aparecerão após as primeiras análises."}</p>}
            </div>
            <div className="border border-border-default p-6">
              <h2 className="font-display text-sm font-black uppercase tracking-wide text-release-analog-white">{isEnglish ? "Possible gaps in the guide" : "Possíveis lacunas do guide"}</h2>
              {gaps.length ? (
                <ul className="mt-5 space-y-3 text-sm leading-relaxed text-release-analog-white">
                  {gaps.map((gap, index) => <li key={`${gap}-${index}`} className="border-l border-release-analog-blue pl-4">{gap}</li>)}
                </ul>
              ) : <p className="mt-5 text-sm leading-relaxed text-text-secondary">{isEnglish ? "No explicit gap was detected. This panel looks for answers with insufficient, ambiguous, or undocumented information." : "Nenhuma lacuna explícita foi detectada. O painel procura respostas com informação insuficiente, ambígua ou não documentada."}</p>}
            </div>
          </section>

          <section className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-default pb-4">
              <div>
                <h2 className="font-display text-xl font-black uppercase text-release-analog-white">{isEnglish ? "All analyses" : "Todas as análises"}</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {isEnglish
                    ? `${filtered.length} result(s) · ${metrics.calibrated} reference case(s)`
                    : `${filtered.length} resultado(s) · ${metrics.calibrated} caso(s) de referência`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isEnglish ? "Search piece or question" : "Buscar peça ou pergunta"} aria-label={isEnglish ? "Search history" : "Buscar no histórico"} className="min-w-56 border border-border-default bg-transparent px-3 py-2 text-sm text-release-analog-white placeholder:text-text-secondary focus:border-release-analog-white focus:outline-none" />
                <select value={verdict} onChange={(event) => setVerdict(event.target.value as AnalysisVerdict | "all")} aria-label={isEnglish ? "Filter by verdict" : "Filtrar por veredito"} className="border border-border-default bg-background-primary px-3 py-2 text-sm text-release-analog-white">
                  <option value="all">{isEnglish ? "All verdicts" : "Todos os vereditos"}</option>
                  {Object.entries(VERDICT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>

            {filtered.length ? (
              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {filtered.map((run) => (
                  <Link key={run.id} href={`${base}/historico/${run.id}`} className="group grid min-h-40 grid-cols-[7rem_1fr] overflow-hidden border border-border-default bg-surface-primary transition-colors hover:border-release-analog-white">
                    <div className="bg-background-secondary">
                      {run.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={run.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : <div className="grid h-full place-items-center font-mono text-xs text-text-secondary">{isEnglish ? "NO IMG" : "SEM IMG"}</div>}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-2 font-display text-sm font-bold uppercase text-release-analog-white">{run.fileName}</p>
                        {run.calibrationEnabled && <span className="border border-release-analog-turquoise px-2 py-1 font-display text-[8px] font-bold uppercase text-release-analog-turquoise">{isEnglish ? "Reference" : "Referência"}</span>}
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-secondary">{run.question}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-wide text-text-secondary">
                        <span className="text-release-analog-turquoise">{VERDICT_LABELS[run.verdict]}</span>
                        <span>{new Date(run.createdAt).toLocaleDateString(locale)}</span>
                        <span>{seconds(run.elapsedMs, isEnglish)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : <p className="mt-8 text-sm text-text-secondary">{isEnglish ? "No analysis matches the filters." : "Nenhuma análise corresponde aos filtros."}</p>}
          </section>
        </>
      )}
    </article>
  );
}
