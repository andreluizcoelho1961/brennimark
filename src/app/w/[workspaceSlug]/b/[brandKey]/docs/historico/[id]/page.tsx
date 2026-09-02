"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { FeedbackPanel } from "@/components/analysis/FeedbackPanel";
import type { AnalysisRun, AnalysisVerdict } from "@/lib/analysis/history";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";

const EXPECTED_POR_IDIOMA: Record<"en" | "pt-BR", Array<{ value: Exclude<AnalysisVerdict, "unknown">; label: string }>> = {
  en: [
      { value: "aligned", label: "Aligned" },
      { value: "partially_aligned", label: "Partially aligned" },
      { value: "misaligned", label: "Misaligned" },
  ],
  "pt-BR": [
    { value: "aligned", label: "Alinhada" },
    { value: "partially_aligned", label: "Parcialmente alinhada" },
    { value: "misaligned", label: "Desalinhada" },
  ],
};

function Section({ title, value }: { title: string; value: string | string[] }) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  if (!values.length) return null;
  return (
    <section>
      <h2 className="font-display text-[10px] font-black uppercase tracking-[0.16em] text-platform-text-muted">{title}</h2>
      {Array.isArray(value) ? (
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-platform-text">
          {values.map((item, index) => <li key={`${title}-${index}`} className="border-l border-platform-border pl-4">{item}</li>)}
        </ul>
      ) : <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-platform-text">{value}</p>}
    </section>
  );
}

export default function AnalysisHistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // A marca em que esta tela opera, vinda da URL. Sem ela o servidor não
  // saberia qual, e responderia 409 numa conta com mais de uma.
  const alvo = useAlvo();
  // Os links desta tela vivem dentro da marca da URL. Absolutos (`/docs/...`)
  // sairiam do contexto e o resolvedor teria de adivinhar de volta.
  const base = `/w/${alvo.workspaceSlug}/b/${alvo.brandKey}/docs`;
  const isEnglish = useIsEnglish();
  const EXPECTED = EXPECTED_POR_IDIOMA[isEnglish ? "en" : "pt-BR"];
  const locale = isEnglish ? "en-US" : "pt-BR";
  const { id } = use(params);
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [calibrationEnabled, setCalibrationEnabled] = useState(false);
  const [expected, setExpected] = useState<Exclude<AnalysisVerdict, "unknown">>("aligned");
  const [label, setLabel] = useState("");
  const [calibrationMessage, setCalibrationMessage] = useState("");

  function load() {
    fetch(comAlvo(`/api/analysis/history/${id}`, alvo))
      .then(async (response) => {
        if (!response.ok) throw new Error("history");
        return response.json();
      })
      .then((data) => {
        const next = data.run as AnalysisRun;
        setRun(next);
        setCalibrationEnabled(next.calibrationEnabled);
        setExpected(next.calibrationExpectedVerdict ?? "aligned");
        setLabel(next.calibrationLabel ?? "");
      })
      .catch(() => setError(isEnglish ? "Couldn't load this analysis." : "Não foi possível carregar esta análise."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id, isEnglish, alvo]);

  async function saveCalibration() {
    setCalibrationMessage(isEnglish ? "Saving…" : "Salvando…");
    const response = await fetch(comAlvo(`/api/analysis/history/${id}`, alvo), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calibrationEnabled, calibrationExpectedVerdict: expected, calibrationLabel: label }),
    });
    if (!response.ok) {
      setCalibrationMessage(isEnglish ? "Couldn't save." : "Não foi possível salvar.");
      return;
    }
    const data = await response.json();
    setRun(data.run);
    setCalibrationMessage(isEnglish ? "Reference case updated." : "Caso de referência atualizado.");
  }

  if (loading) return <p className="px-page-inline py-16 text-sm text-platform-text-muted" role="status">{isEnglish ? "Loading analysis…" : "Carregando análise…"}</p>;
  if (error || !run) return <p className="px-page-inline py-16 text-sm text-platform-text-muted" role="alert">{error || (isEnglish ? "Analysis not found." : "Análise não encontrada.")}</p>;

  return (
    <article className="px-page-inline py-12 md:py-16">
      <Link href={`${base}/historico`} className="font-display text-[10px] font-bold uppercase tracking-wide text-platform-text-muted hover:text-platform-text">{isEnglish ? "← Back to history" : "← Voltar ao histórico"}</Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="font-display text-[10px] font-black uppercase tracking-[0.18em] text-platform-text">{isEnglish ? "Compliance record" : "Registro de conformidade"}</p>
          <h1 className="mt-3 max-w-4xl break-words font-display text-3xl font-black uppercase leading-tight text-platform-text md:text-5xl">{run.fileName}</h1>
          <p className="mt-3 text-xs text-platform-text-muted">{new Date(run.createdAt).toLocaleString(locale)} · {isEnglish ? (run.elapsedMs / 1000).toFixed(1) : (run.elapsedMs / 1000).toFixed(1).replace(".", ",")} s</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/analysis/history/${run.id}/report`} className="border border-platform-signal px-4 py-2.5 font-display text-[10px] font-bold uppercase tracking-wide text-platform-text hover:bg-platform-text hover:text-platform-bg">{isEnglish ? "Download PDF" : "Baixar PDF"}</a>
          <Link href={`${base}/analise?repeat=${run.id}`} className="bg-platform-signal px-4 py-2.5 font-display text-[10px] font-bold uppercase tracking-wide text-platform-bg">{isEnglish ? "Analyze again" : "Analisar novamente"}</Link>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="aspect-video overflow-hidden border border-platform-border bg-platform-panel">
            {run.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={run.imageUrl} alt={isEnglish ? `Analyzed piece: ${run.fileName}` : `Peça analisada: ${run.fileName}`} className="h-full w-full object-contain" />
            ) : <div className="grid h-full place-items-center text-sm text-platform-text-muted">{isEnglish ? "Image unavailable" : "Imagem não disponível"}</div>}
          </div>
          <section className="mt-6 border border-platform-border p-5">
            <p className="font-display text-[10px] font-black uppercase tracking-wide text-platform-text-muted">{isEnglish ? "Question" : "Pergunta"}</p>
            <p className="mt-2 text-sm leading-relaxed text-platform-text">{run.question}</p>
          </section>
          <details className="mt-4 border border-platform-border p-5 text-xs text-platform-text-muted">
            <summary className="cursor-pointer font-display text-[10px] font-bold uppercase tracking-wide">{isEnglish ? "Technical details" : "Detalhes técnicos"}</summary>
            <div className="mt-4 space-y-2 font-mono text-[11px]">
              <p>{run.provider} / {run.model}</p>
              <p>{isEnglish ? "Fallback" : "Reserva"}: {run.fallbackUsed ? (isEnglish ? "used" : "utilizada") : (isEnglish ? "not used" : "não utilizada")}</p>
              <p>{isEnglish ? "Size" : "Tamanho"}: {(run.imageSizeBytes / 1024).toFixed(0)} KB</p>
            </div>
          </details>
        </div>

        <div className="space-y-7 lg:col-span-7">
          <section className="border border-platform-signal p-6">
            <p className="font-display text-[10px] font-black uppercase tracking-[0.16em] text-platform-text">{isEnglish ? "Verdict" : "Veredito"}</p>
            <p className="mt-2 font-display text-2xl font-black uppercase leading-tight text-platform-text">{run.analysis.verdict || run.verdict}</p>
          </section>
          <Section title={isEnglish ? "Observed evidence" : "Evidências observadas"} value={run.analysis.evidence} />
          <Section title={isEnglish ? "Applicable rules" : "Regras aplicáveis"} value={run.analysis.rules} />
          <Section title={isEnglish ? "Issues identified" : "Problemas identificados"} value={run.analysis.problems} />
          <div className="grid gap-6 sm:grid-cols-2">
            <Section title={isEnglish ? "Impact" : "Impacto"} value={run.analysis.impact} />
            <Section title={isEnglish ? "Confidence" : "Confiança"} value={run.analysis.confidence} />
          </div>
          <Section title={isEnglish ? "Minimum recommended fix" : "Correção mínima recomendada"} value={run.analysis.correction} />
          <Section title={isEnglish ? "Sources consulted" : "Fontes consultadas"} value={run.analysis.sources} />
          <FeedbackPanel historyId={run.id} initialRating={run.feedbackRating} initialNote={run.feedbackNote ?? ""} onSaved={load} />

          <section className="border border-platform-border p-6">
            <div className="flex items-start justify-between gap-5">
              <div>
                <h2 className="font-display text-sm font-black uppercase text-platform-text">{isEnglish ? "Reference case" : "Caso de referência"}</h2>
                <p className="mt-2 text-sm leading-relaxed text-platform-text-muted">{isEnglish ? "Use validated pieces to measure whether model or prompt changes preserve quality." : "Use peças validadas para medir se trocas de modelo ou de prompt preservam a qualidade."}</p>
              </div>
              <button type="button" role="switch" aria-checked={calibrationEnabled} onClick={() => setCalibrationEnabled((value) => !value)} className={`relative h-7 w-12 shrink-0 border ${calibrationEnabled ? "border-platform-signal bg-platform-signal" : "border-platform-border bg-platform-bg"}`}>
                <span className={`absolute top-1 h-[18px] w-[18px] bg-platform-text transition-transform ${calibrationEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            {calibrationEnabled && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-xs text-platform-text-muted">{isEnglish ? "Expected result" : "Resultado esperado"}
                  <select value={expected} onChange={(event) => setExpected(event.target.value as Exclude<AnalysisVerdict, "unknown">)} className="mt-2 block w-full border border-platform-border bg-platform-bg px-3 py-2.5 text-sm text-platform-text">
                    {EXPECTED.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="text-xs text-platform-text-muted">{isEnglish ? "Test label" : "Rótulo do teste"}
                  <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} placeholder={isEnglish ? "E.g.: critical contrast" : "Ex.: contraste crítico"} className="mt-2 block w-full border border-platform-border bg-platform-bg px-3 py-2.5 text-sm text-platform-text placeholder:text-platform-text-muted" />
                </label>
              </div>
            )}
            <div className="mt-5 flex items-center gap-3">
              <button type="button" onClick={() => void saveCalibration()} className="bg-platform-text px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-platform-bg">{isEnglish ? "Save reference" : "Salvar referência"}</button>
              {calibrationMessage && <span className="text-xs text-platform-text-muted" role="status">{calibrationMessage}</span>}
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
