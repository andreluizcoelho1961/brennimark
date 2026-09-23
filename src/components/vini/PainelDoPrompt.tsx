"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useIsEnglish } from "@/platform/locale-client";
import { useStatusLabels } from "@/platform/brand-vocabulary-client";
import { destinoDaCitacao } from "@/lib/ai/paginas-citadas";
import type { RegraResumida } from "@/lib/ai/copiloto";
import type { DocStatus } from "@/content/docs";
import type { useCopilotoDePrompt } from "./useCopilotoDePrompt";

/**
 * O estado "Gerar prompt" do Vini (spec do Assistente §4.3; ADR-0004 §3.1).
 *
 * ⚖️ Aprovadas aparecem como o que ENTRA; rascunhos, como o que a pessoa
 * PODE incluir — desmarcados. O prompt pronto vem com a lista do que usou, e
 * rascunho usado sai dito como rascunho: quem copiar o prompt sabe no que ele
 * se apoia.
 */
export function PainelDoPrompt({
  copiloto, basePath,
}: { copiloto: ReturnType<typeof useCopilotoDePrompt>; basePath: string }) {
  const isEnglish = useIsEnglish();
  const t = (pt: string, en: string) => (isEnglish ? en : pt);
  const rotulos = useStatusLabels();
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const { regras, marcados, prompt, usadas, erro, aviso, gerando, paginas } = copiloto;

  const rotuloDoStatus = (s: string) => rotulos[s as DocStatus] ?? s;

  function Fonte({ regra }: { regra: RegraResumida }) {
    const destino = destinoDaCitacao(`/docs/${regra.slug}`, paginas, basePath, "0");
    const pagina = regra.pagina ?? destino.pagina;
    return (
      <a
        href={pagina ? `${basePath}/original?pagina=${pagina}` : `${basePath}/original`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          router.push(pagina ? `${basePath}/original?pagina=${pagina}&ir=${Date.now()}` : `${basePath}/original`, { scroll: false });
        }}
        className="border-b border-platform-border text-platform-text hover:border-platform-signal"
      >
        {regra.titulo}{pagina ? <span className="text-platform-text-muted"> · p. {pagina}</span> : null}
      </a>
    );
  }

  if (!regras) {
    return (
      <div data-prompt-vazio className="space-y-3 text-[14px] leading-relaxed text-platform-text-muted">
        <p>{t(
          "Descreva o que você vai criar — a peça, o canal, o assunto. Eu busco no manual o que governa isso e monto o prompt com o que está documentado.",
          "Describe what you're going to create — the piece, the channel, the subject. I'll look up what governs it in the manual and build the prompt from what's documented.",
        )}</p>
        <p className="text-[12px]">{t(
          "Só regra aprovada entra sozinha. Rascunho aparece para você escolher.",
          "Only approved rules go in on their own. Drafts are shown for you to choose.",
        )}</p>
        {erro && <p role="alert" data-prompt-erro className="text-platform-text">{erro}</p>}
      </div>
    );
  }

  const usouRascunho = usadas.some((r) => r.status !== "ready");

  return (
    <div data-prompt className="space-y-5 text-[14px]">
      <section data-regras-aprovadas>
        <h3 className="mb-2 font-display text-[11px] font-bold uppercase tracking-wide text-platform-text-muted">
          {t("Entram no prompt — aprovadas", "Go into the prompt — approved")}
        </h3>
        {regras.aprovadas.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-platform-text-muted">{t(
            "Nenhuma regra aprovada sobre isso neste manual. Nada entra em silêncio: escolha abaixo o que incluir, sabendo que é rascunho.",
            "No approved rule on this in the manual. Nothing goes in silently: choose below what to include, knowing it's a draft.",
          )}</p>
        ) : (
          <ul className="space-y-1.5">
            {regras.aprovadas.map((r) => <li key={r.slug}><Fonte regra={r} /></li>)}
          </ul>
        )}
      </section>

      {regras.rascunhos.length > 0 && (
        <fieldset data-regras-rascunho>
          <legend className="mb-2 font-display text-[11px] font-bold uppercase tracking-wide text-platform-text-muted">
            {t("Em rascunho — marque para incluir", "Draft — tick to include")}
          </legend>
          <ul className="space-y-2">
            {regras.rascunhos.map((r) => (
              <li key={r.slug} className="flex items-start gap-2">
                <input
                  type="checkbox" id={`rascunho-${r.slug}`} checked={marcados.includes(r.slug)}
                  onChange={() => copiloto.alternar(r.slug)} className="mt-1"
                  aria-describedby={`status-${r.slug}`}
                />
                <label htmlFor={`rascunho-${r.slug}`} className="flex flex-wrap items-baseline gap-x-2">
                  <span>{r.titulo}{r.pagina ? <span className="text-platform-text-muted"> · p. {r.pagina}</span> : null}</span>
                  <span id={`status-${r.slug}`} className="font-display text-[9px] font-bold uppercase tracking-wide text-platform-warning">
                    {rotuloDoStatus(r.status)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {(prompt || gerando) && (
        <section data-prompt-resultado className="space-y-3 border-t border-platform-border pt-4">
          <h3 className="font-display text-[11px] font-bold uppercase tracking-wide text-platform-text-muted">{t("Prompt", "Prompt")}</h3>
          {/* Sem rolagem própria: no Mac a barra fica escondida, e no ensaio de
              23/09 o prompt pareceu terminar em "avoid busy" com a geração
              registrada como completa — o resto, muito provavelmente, estava
              abaixo, sem sinal. A janela do Vini já rola; o prompt aparece inteiro. */}
          <pre data-prompt-texto className="whitespace-pre-wrap break-words border border-platform-border bg-platform-bg p-3 font-mono text-[13px] leading-relaxed text-platform-text">
            {prompt || "…"}
          </pre>
          {prompt && !gerando && (
            <button type="button" data-copiar-prompt
              onClick={async () => {
                await navigator.clipboard?.writeText(prompt).catch(() => undefined);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
              className="h-9 border border-platform-border px-4 text-[12px] font-semibold text-platform-text hover:border-platform-signal">
              {copiado ? t("Copiado", "Copied") : t("Copiar prompt", "Copy prompt")}
            </button>
          )}
          {usadas.length > 0 && (
            <div data-regras-usadas className="text-[12px] text-platform-text-muted">
              <p className="mb-1">{t("Feito a partir de:", "Built from:")}</p>
              <ul className="space-y-1">
                {usadas.map((r) => (
                  <li key={r.slug}>
                    <Fonte regra={r} />{" "}
                    <span className={`font-display text-[9px] font-bold uppercase tracking-wide ${r.status === "ready" ? "text-platform-text-muted" : "text-platform-warning"}`}>
                      {rotuloDoStatus(r.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {usouRascunho && !gerando && (
            <p data-prompt-usa-rascunho className="border-l-2 border-platform-warning pl-3 text-[12px] leading-relaxed text-platform-text">
              {t(
                "Este prompt usa regra em rascunho — a marca ainda não a aprovou. Confira antes de levar a peça ao cliente.",
                "This prompt uses a draft rule — the brand hasn't approved it yet. Check before taking the piece to the client.",
              )}
            </p>
          )}
          {!gerando && usadas.length === 0 && prompt && (
            <p className="text-[12px] text-platform-text-muted">{t(
              "Nenhuma regra do manual entrou — o prompt usa só a sua descrição.",
              "No rule from the manual went in — the prompt uses only your description.",
            )}</p>
          )}
        </section>
      )}

      {aviso && <p role="status" data-prompt-aviso className="text-[13px] text-platform-text">{aviso}</p>}
      {erro && <p role="alert" data-prompt-erro className="border border-platform-border px-3 py-2 text-[13px] text-platform-text">{erro}</p>}
    </div>
  );
}
