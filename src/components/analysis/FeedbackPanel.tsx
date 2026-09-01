"use client";

import { useState } from "react";
import type { AnalysisFeedback } from "@/lib/analysis/history";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";


const OPTIONS_POR_IDIOMA: Record<"en" | "pt-BR", Array<{ value: AnalysisFeedback; label: string }>> = {
  en: [
    { value: "correct", label: "Correct" },
    { value: "partial", label: "Partial" },
    { value: "incorrect", label: "Incorrect" },
  ],
  "pt-BR": [
    { value: "correct", label: "Correta" },
    { value: "partial", label: "Parcial" },
    { value: "incorrect", label: "Incorreta" },
  ],
};

export function FeedbackPanel({
  historyId,
  initialRating = null,
  initialNote = "",
  onSaved,
}: {
  historyId: string;
  initialRating?: AnalysisFeedback | null;
  initialNote?: string;
  onSaved?: () => void;
}) {
  // A marca em que esta tela opera, vinda da URL. Sem ela o servidor não
  // saberia qual, e responderia 409 numa conta com mais de uma.
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const OPTIONS = OPTIONS_POR_IDIOMA[isEnglish ? "en" : "pt-BR"];
  const [rating, setRating] = useState<AnalysisFeedback | null>(initialRating);
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(selected: AnalysisFeedback = rating as AnalysisFeedback) {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(comAlvo(`/api/analysis/history/${historyId}`, alvo), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedbackRating: selected, feedbackNote: note }),
    });
    setSaving(false);
    if (!response.ok) {
      setMessage(isEnglish ? "Couldn't save the review." : "Não foi possível salvar a validação.");
      return;
    }
    setRating(selected);
    setMessage(isEnglish ? "Review saved." : "Validação salva.");
    onSaved?.();
  }

  return (
    <section className="border border-border-default bg-surface-primary p-5">
      <h3 className="font-display text-[10px] font-black uppercase tracking-[0.16em] text-release-analog-turquoise">
        {isEnglish ? "Human review" : "Validação humana"}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        {isEnglish ? "Was the AI's answer correct for this piece?" : "A resposta da IA foi correta para esta peça?"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={isEnglish ? "Analysis quality" : "Qualidade da análise"}>
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={saving}
            onClick={() => {
              setRating(option.value);
              void save(option.value);
            }}
            className={`border px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wide transition-colors ${
              rating === option.value
                ? "border-release-analog-turquoise bg-release-analog-turquoise text-release-analog-black"
                : "border-border-default text-text-secondary hover:border-release-analog-white hover:text-release-analog-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className="mt-5 block font-display text-[10px] font-bold uppercase tracking-wide text-text-secondary">
        {isEnglish ? "Optional note" : "Observação opcional"}
      </label>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={2000}
        rows={3}
        className="mt-2 w-full resize-y border border-border-default bg-background-primary px-3 py-2 text-sm text-release-analog-white focus:border-release-analog-white focus:outline-none"
        placeholder={isEnglish ? "Explain what should be corrected or preserved." : "Explique o que deve ser corrigido ou preservado."}
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!rating || saving}
          className="bg-release-analog-white px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-release-analog-black disabled:opacity-40"
        >
          {saving ? (isEnglish ? "Saving…" : "Salvando…") : (isEnglish ? "Save note" : "Salvar observação")}
        </button>
        {message && <span className="text-xs text-text-secondary" role="status">{message}</span>}
      </div>
    </section>
  );
}
