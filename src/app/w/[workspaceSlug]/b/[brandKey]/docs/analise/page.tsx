"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import type { StructuredAnalysis } from "@/lib/ai/analysis-result";
import { FeedbackPanel } from "@/components/analysis/FeedbackPanel";
import type { AnalysisRun } from "@/lib/analysis/history";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";


type ProgressStage = "preparing" | "consulting" | "fallback" | "verifying";
type Attempt = { provider: string; model: string; elapsedMs: number; status: "failed" | "completed" };
type AnalysisMeta = {
  provider: string;
  model: string;
  fallbackUsed: boolean;
  elapsedMs: number;
  attempts: Attempt[];
};
type StreamEvent =
  | { type: "progress"; stage: ProgressStage; message: string; provider?: string; model?: string; elapsedMs: number }
  | ({ type: "complete"; analysis: StructuredAnalysis; isDemo: boolean; historyId: string | null; historySaved: boolean; imageSaved: boolean } & AnalysisMeta)
  | { type: "error"; error: string; message: string; elapsedMs: number };

const STEPS_POR_IDIOMA: Record<"en" | "pt-BR", Array<{ stage: ProgressStage; label: string }>> = {
  en: [
    { stage: "preparing", label: "Preparing image" },
    { stage: "consulting", label: "Consulting visual AI" },
    { stage: "verifying", label: "Verifying guidelines" },
  ],
  "pt-BR": [
    { stage: "preparing", label: "Preparando imagem" },
    { stage: "consulting", label: "Consultando IA visual" },
    { stage: "verifying", label: "Verificando diretrizes" },
  ],
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function seconds(milliseconds: number, isEnglish: boolean) {
  const value = (milliseconds / 1_000).toFixed(1);
  return isEnglish ? `${value} s` : `${value.replace(".", ",")} s`;
}

function AnalysisProgress({ stage, message, elapsedMs }: { stage: ProgressStage; message: string; elapsedMs: number }) {
  const isEnglish = useIsEnglish();
  const STEPS = STEPS_POR_IDIOMA[isEnglish ? "en" : "pt-BR"];
  const normalizedStage = stage === "fallback" ? "consulting" : stage;
  const currentIndex = STEPS.findIndex((step) => step.stage === normalizedStage);

  return (
    <div className="border border-platform-border p-5" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <p className="font-display text-xs font-black uppercase tracking-wide text-platform-text">{isEnglish ? "Analysis in progress" : "Análise em andamento"}</p>
        <span className="font-mono text-xs text-platform-text-muted">{seconds(elapsedMs, isEnglish)}</span>
      </div>
      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, index) => {
          const complete = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step.stage} className="flex items-center gap-2 text-xs">
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center border ${
                  complete || active
                    ? "border-platform-signal bg-platform-signal text-platform-bg"
                    : "border-platform-border text-platform-text-muted"
                }`}
                aria-hidden="true"
              >
                {complete ? "✓" : index + 1}
              </span>
              <span className={active ? "text-platform-text" : "text-platform-text-muted"}>{step.label}</span>
            </li>
          );
        })}
      </ol>
      <p className={`mt-5 border-l-2 pl-4 text-sm ${stage === "fallback" ? "border-platform-border text-platform-text" : "border-platform-signal text-platform-text-muted"}`}>
        {message}
      </p>
    </div>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="font-display text-[10px] font-black uppercase tracking-[0.16em] text-platform-text-muted">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-platform-text">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="border-l border-platform-border pl-4">{item}</li>
        ))}
      </ul>
    </section>
  );
}

function TextSection({ title, value }: { title: string; value: string }) {
  if (!value) return null;
  return (
    <section>
      <h3 className="font-display text-[10px] font-black uppercase tracking-[0.16em] text-platform-text-muted">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-platform-text">{value}</p>
    </section>
  );
}

function AnalysisResult({ result, meta }: { result: StructuredAnalysis; meta: AnalysisMeta }) {
  const isEnglish = useIsEnglish();
  const hasStructure = Boolean(result.verdict || result.evidence.length || result.rules.length || result.problems.length);
  return (
    <div className="space-y-6">
      {meta.fallbackUsed && (
        <div className="border-l-2 border-platform-border bg-platform-panel-muted/10 px-4 py-3 text-xs leading-relaxed text-platform-text">
          {isEnglish
            ? "The primary AI didn't complete the request. This result came from the authorized fallback AI."
            : "A IA principal não concluiu a solicitação. O resultado foi produzido pela IA de reserva autorizada."}
        </div>
      )}

      {hasStructure ? (
        <>
          <section className="border border-platform-signal p-5">
            <h3 className="font-display text-[10px] font-black uppercase tracking-[0.16em] text-platform-text">{isEnglish ? "Verdict" : "Veredito"}</h3>
            <p className="mt-2 font-display text-xl font-black uppercase leading-tight text-platform-text">
              {result.verdict || (isEnglish ? "Assessment complete" : "Avaliação concluída")}
            </p>
          </section>
          <ListSection title={isEnglish ? "Observed evidence" : "Evidências observadas"} items={result.evidence} />
          <ListSection title={isEnglish ? "Applicable rules" : "Regras aplicáveis"} items={result.rules} />
          <ListSection title={isEnglish ? "Issues identified" : "Problemas identificados"} items={result.problems} />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextSection title={isEnglish ? "Impact" : "Impacto"} value={result.impact} />
            <TextSection title={isEnglish ? "Confidence" : "Confiança"} value={result.confidence} />
          </div>
          <TextSection title={isEnglish ? "Minimum recommended fix" : "Correção mínima recomendada"} value={result.correction} />
          <ListSection title={isEnglish ? "Sources consulted" : "Fontes consultadas"} items={result.sources} />
        </>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-platform-text md:text-base">{result.raw}</p>
      )}

      <details className="border-t border-platform-border pt-4 text-xs text-platform-text-muted">
        <summary className="cursor-pointer font-display text-[10px] font-bold uppercase tracking-wide text-platform-text-muted hover:text-platform-text">
          {isEnglish ? "Execution details" : "Detalhes da execução"}
        </summary>
        <div className="mt-3 space-y-1 font-mono text-[11px]">
          <p>{isEnglish ? "Model" : "Modelo"}: {meta.provider} / {meta.model}</p>
          <p>{isEnglish ? "Total time" : "Tempo total"}: {seconds(meta.elapsedMs, isEnglish)}</p>
          <p>{isEnglish ? "Fallback" : "Reserva"}: {meta.fallbackUsed ? (isEnglish ? "used" : "utilizada") : (isEnglish ? "not used" : "não utilizada")}</p>
          {meta.attempts.map((attempt, index) => (
            <p key={`${attempt.provider}-${attempt.model}-${index}`}>
              {isEnglish ? "Attempt" : "Tentativa"} {index + 1}: {attempt.provider} / {attempt.model} — {attempt.status === "completed" ? (isEnglish ? "completed" : "concluída") : (isEnglish ? "failed" : "falhou")} {isEnglish ? "in" : "em"} {seconds(attempt.elapsedMs, isEnglish)}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}

export default function AnalysisPage() {
  // A marca em que esta tela opera, vinda da URL. Sem ela o servidor não
  // saberia qual, e responderia 409 numa conta com mais de uma.
  const alvo = useAlvo();
  // Os links desta tela vivem dentro da marca da URL. Absolutos (`/docs/...`)
  // sairiam do contexto e o resolvedor teria de adivinhar de volta.
  const base = `/w/${alvo.workspaceSlug}/b/${alvo.brandKey}/docs`;
  const isEnglish = useIsEnglish();
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [parentRunId, setParentRunId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [analysis, setAnalysis] = useState<StructuredAnalysis | null>(null);
  const [meta, setMeta] = useState<AnalysisMeta | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<ProgressStage>("preparing");
  const [progressMessage, setProgressMessage] = useState(isEnglish ? "Preparing the image and brand guidelines…" : "Preparando a imagem e as diretrizes da marca…");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [historySaved, setHistorySaved] = useState(false);
  const [imageSaved, setImageSaved] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(false);

  useEffect(() => {
    const repeatId = new URLSearchParams(window.location.search).get("repeat");
    if (!repeatId) return;
    fetch(comAlvo(`/api/analysis/history/${repeatId}`, alvo))
      .then(async (response) => {
        if (!response.ok) throw new Error("history");
        return response.json();
      })
      .then(async ({ run }: { run: AnalysisRun }) => {
        if (!run.imageUrl) throw new Error("image");
        const imageResponse = await fetch(run.imageUrl);
        if (!imageResponse.ok) throw new Error("image");
        const blob = await imageResponse.blob();
        const file = new File([blob], run.fileName, { type: blob.type || run.imageMediaType });
        const base64 = await fileToBase64(file);
        setImageBase64(base64);
        setPreview(base64);
        setFileName(run.fileName);
        setQuestion(run.question);
        setParentRunId(run.id);
      })
      .catch(() => setError(isEnglish ? "Couldn't retrieve the previous image. Please upload the piece again." : "Não foi possível recuperar a imagem anterior. Envie a peça novamente."))
      .finally(() => setLoadingPrevious(false));
  }, [isEnglish, alvo]);

  useEffect(() => {
    if (!loading || !startedAt) return;
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 100);
    return () => window.clearInterval(timer);
  }, [loading, startedAt]);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError(isEnglish ? "The image must be at most 10 MB." : "A imagem deve ter no máximo 10 MB.");
      return;
    }
    const base64 = await fileToBase64(file);
    setImageBase64(base64);
    setPreview(base64);
    setFileName(file.name);
    setParentRunId(null);
    setAnalysis(null);
    setMeta(null);
    setError("");
    setHistoryId(null);
    setHistorySaved(false);
    setImageSaved(false);
  }

  function handleEvent(event: StreamEvent) {
    if (event.type === "progress") {
      setStage(event.stage);
      setProgressMessage(event.message);
      return;
    }
    if (event.type === "error") {
      setError(event.message);
      setElapsedMs(event.elapsedMs);
      return;
    }
    setAnalysis(event.analysis);
    setMeta({
      provider: event.provider,
      model: event.model,
      fallbackUsed: event.fallbackUsed,
      elapsedMs: event.elapsedMs,
      attempts: event.attempts,
    });
    setElapsedMs(event.elapsedMs);
    setIsDemo(Boolean(event.isDemo));
    setHistoryId(event.historyId);
    setHistorySaved(event.historySaved);
    setImageSaved(event.imageSaved);
  }

  async function handleAnalyze() {
    if (!imageBase64) return;
    const requestStartedAt = Date.now();
    setStartedAt(requestStartedAt);
    setElapsedMs(0);
    setStage("preparing");
    setProgressMessage(isEnglish ? "Preparing the image and brand guidelines…" : "Preparando a imagem e as diretrizes da marca…");
    setLoading(true);
    setError("");
    setAnalysis(null);
    setMeta(null);
    setHistoryId(null);
    setHistorySaved(false);
    setImageSaved(false);

    try {
      const res = await fetch(comAlvo("/api/ai/analyze", alvo), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, fileName, question: question || undefined, parentRunId }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("application/x-ndjson")) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? (isEnglish ? "Failed to analyze the image." : "Falha ao analisar a imagem."));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error(isEnglish ? "Response has no data stream." : "Resposta sem fluxo de dados.");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) handleEvent(JSON.parse(line) as StreamEvent);
        }
        if (done) break;
      }
      if (buffer.trim()) handleEvent(JSON.parse(buffer) as StreamEvent);
    } catch {
      setError(isEnglish ? "Network failure while analyzing the image." : "Falha de rede ao analisar a imagem.");
    } finally {
      setElapsedMs((current) => current || Date.now() - requestStartedAt);
      setLoading(false);
      setStartedAt(null);
    }
  }

  return (
    <article className="px-page-inline py-12 md:py-16">
      <div className="mb-6 inline-flex w-fit items-center gap-3 bg-platform-signal px-4 py-1.5">
        <span className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-platform-bg">{isEnglish ? "Assistant" : "Assistente"}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="break-words font-display font-black uppercase leading-[0.9] tracking-tight text-platform-text" style={{ fontSize: "clamp(2rem, 4.5vw, 4rem)", overflowWrap: "anywhere" }}>
          {isEnglish ? <>Application <span className="text-platform-text">Review</span></> : <>Análise de <span className="text-platform-text">Aplicações</span></>}
        </h1>
        {isDemo && <span className="border border-platform-border px-3 py-1 font-display text-[10px] font-bold uppercase tracking-wide text-platform-text-muted">{isEnglish ? "Demo mode" : "Modo demo"}</span>}
      </div>

      <div className="grid gap-10 md:grid-cols-12">
        <div className="md:col-span-6">
          <label className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-platform-text-muted">{isEnglish ? "Piece image" : "Imagem da peça"}</label>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFile} className="w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text file:mr-4 file:border-0 file:bg-platform-signal file:px-3 file:py-1.5 file:font-display file:text-xs file:font-bold file:uppercase file:text-platform-bg" />
          {loadingPrevious && <p className="mt-3 text-xs text-platform-text-muted" role="status">{isEnglish ? "Retrieving previous piece…" : "Recuperando peça anterior…"}</p>}
          {parentRunId && !loadingPrevious && <p className="mt-3 border-l border-platform-signal pl-3 text-xs text-platform-text-muted">{isEnglish ? "New round linked to the previous analysis for comparison." : "Nova rodada vinculada à análise anterior para comparação."}</p>}

          {preview && (
            <div className="relative mt-4 aspect-video overflow-hidden border border-platform-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt={isEnglish ? "Preview of the uploaded piece" : "Pré-visualização da peça enviada"} className="h-full w-full object-contain" />
            </div>
          )}

          <label className="mb-1.5 mt-6 block font-display text-xs font-bold uppercase tracking-wide text-platform-text-muted">{isEnglish ? "Question (optional)" : "Pergunta (opcional)"}</label>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={isEnglish ? "E.g.: does this color match the system?" : "Ex.: essa cor está de acordo com o sistema?"} className="w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text placeholder:text-platform-text-muted focus:border-platform-signal" />

          <button type="button" onClick={handleAnalyze} disabled={!imageBase64 || loading || loadingPrevious} className="mt-6 bg-platform-signal px-6 py-3 font-display text-xs font-bold uppercase tracking-wide text-platform-bg disabled:opacity-40">
            {loading ? (isEnglish ? "Analyzing…" : "Analisando…") : (isEnglish ? "Analyze" : "Analisar")}
          </button>
        </div>

        <div className="md:col-span-6 md:col-start-7">
          <p className="font-display text-xs font-bold uppercase tracking-wide text-platform-text">{isEnglish ? "Result" : "Resultado"}</p>
          <div className="mt-4 min-h-[8rem]">
            {loading && <AnalysisProgress stage={stage} message={progressMessage} elapsedMs={elapsedMs} />}
            {error && <p className="border-l-2 border-platform-border pl-6 text-sm leading-relaxed text-platform-text-muted" role="alert">{error}</p>}
            {analysis && meta && (
              <div className="space-y-6">
                <AnalysisResult result={analysis} meta={meta} />
                {historySaved && historyId ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 border border-platform-border px-4 py-3">
                      <p className="text-xs text-platform-text-muted">
                        {imageSaved
                          ? (isEnglish ? "Analysis and evidence saved to history." : "Análise e evidência salvas no histórico.")
                          : (isEnglish ? "Analysis saved; the image couldn't be archived." : "Análise salva; a imagem não pôde ser arquivada.")}
                      </p>
                      <div className="flex gap-2">
                        <a href={`/api/analysis/history/${historyId}/report`} className="border border-platform-border px-3 py-2 font-display text-[9px] font-bold uppercase text-platform-text">PDF</a>
                        <Link href={`${base}/historico/${historyId}`} className="bg-platform-text px-3 py-2 font-display text-[9px] font-bold uppercase text-platform-bg">{isEnglish ? "Open record" : "Abrir registro"}</Link>
                      </div>
                    </div>
                    <FeedbackPanel historyId={historyId} />
                  </>
                ) : (
                  <p className="border-l-2 border-platform-border pl-4 text-xs leading-relaxed text-platform-text-muted">{isEnglish ? "The analysis is complete but couldn't be saved to history. The result is still available on this screen." : "A análise foi concluída, mas não pôde ser salva no histórico. O resultado continua disponível nesta tela."}</p>
                )}
              </div>
            )}
            {!analysis && !error && !loading && <p className="border-l-2 border-platform-signal pl-8 text-sm text-platform-text-muted">{isEnglish ? "Upload an image and click Analyze." : "Envie uma imagem e clique em Analisar."}</p>}
          </div>
        </div>
      </div>
    </article>
  );
}
