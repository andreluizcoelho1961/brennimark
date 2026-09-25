"use client";

import { useState } from "react";
import { BrandCanvas } from "@/components/BrandCanvas";
import type { BrennimarkTheme } from "@/brennimark/types";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";

type ChaveDeCor = "background" | "backgroundSecondary" | "surface" | "surfaceLight"
  | "foreground" | "muted" | "accent" | "accentSecondary" | "border" | "focus";

const CAMPOS_DE_COR: readonly { chave: ChaveDeCor; pt: string; en: string }[] = [
  { chave: "background", pt: "Fundo", en: "Background" },
  { chave: "backgroundSecondary", pt: "Fundo secundário", en: "Secondary background" },
  { chave: "surface", pt: "Superfície", en: "Surface" },
  { chave: "surfaceLight", pt: "Superfície clara", en: "Light surface" },
  { chave: "foreground", pt: "Texto", en: "Text" },
  { chave: "muted", pt: "Texto discreto", en: "Muted text" },
  { chave: "accent", pt: "Destaque", en: "Accent" },
  { chave: "accentSecondary", pt: "Destaque secundário", en: "Secondary accent" },
  { chave: "border", pt: "Borda", en: "Border" },
  { chave: "focus", pt: "Foco", en: "Focus" },
];

/**
 * Achado da auditoria de produto (04/09): a importação de PDF nunca extraiu
 * cor ou fonte, e não existia tela nenhuma para uma pessoa da agência
 * corrigir isso depois — toda marca ficava presa no placeholder cinza de
 * `TEMA_INICIAL` para sempre. Esta é essa tela.
 *
 * A regra que rege o conteúdo: os valores digitados aqui devem ser a
 * TRANSCRIÇÃO fiel do que o manual da marca já declara — nunca uma escolha
 * nova. "Neutro" é o produto (a moldura); a marca nunca é neutra.
 */
export function ThemeEditor({ theme }: { theme: BrennimarkTheme }) {
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const [tema, setTema] = useState(theme);
  const [persistido, setPersistido] = useState(theme);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const hasUnsavedChanges = JSON.stringify(tema) !== JSON.stringify(persistido);

  function update(patch: Partial<BrennimarkTheme>) {
    setTema((atual) => ({ ...atual, ...patch }));
    setMessage("");
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(comAlvo("/api/admin/brand", alvo), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: tema }),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (response.ok) setPersistido(tema);
    setMessage(response.ok
      ? (isEnglish ? "Theme saved. The guide already reflects it." : "Tema salvo. O guia já reflete.")
      : (result.message ?? (isEnglish ? "Couldn't save." : "Não foi possível salvar.")));
  }

  return (
    <section className="mt-16 border-t border-platform-border pt-12">
      <p className="font-display text-xs font-black uppercase tracking-[0.24em] text-platform-text">
        {isEnglish ? "Visual identity" : "Identidade visual"}
      </p>
      <h2 className="mt-3 font-display text-3xl font-black uppercase text-platform-text">
        {isEnglish ? "Brand theme" : "Tema da marca"}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-platform-text-muted">
        {isEnglish
          ? "Enter the exact values already documented in the brand's own manual — colors, fonts. Never invent an identity here: transcribe what's already written."
          : "Digite os valores exatos que o próprio manual da marca já documenta — cores, fontes. Nunca invente uma identidade aqui: transcreva o que já está escrito."}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-5 sm:grid-cols-2">
          {CAMPOS_DE_COR.map(({ chave, pt, en }) => (
            <label key={chave} className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-platform-text-muted">
                {isEnglish ? en : pt}
              </span>
              <div className="flex items-center gap-3 border border-platform-border bg-platform-bg px-3 py-2 focus-within:border-platform-signal">
                <span aria-hidden className="h-6 w-6 shrink-0 border border-platform-border" style={{ background: tema[chave] }} />
                <input
                  value={tema[chave]}
                  onChange={(event) => update({ [chave]: event.target.value } as Partial<BrennimarkTheme>)}
                  spellCheck={false}
                  className="w-full bg-transparent text-sm text-platform-text focus:outline-none"
                  placeholder="#000000"
                />
              </div>
            </label>
          ))}

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-platform-text-muted">
              {isEnglish ? "Body font" : "Fonte de corpo"}
            </span>
            <input
              value={tema.fontStack}
              onChange={(event) => update({ fontStack: event.target.value })}
              className="w-full border border-platform-border bg-platform-bg px-4 py-3 text-sm text-platform-text focus:border-platform-signal focus:outline-none"
              placeholder={isEnglish ? "e.g. Georgia, serif" : "ex.: Georgia, serif"}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-platform-text-muted">
              {isEnglish ? "Title/display font" : "Fonte de título/destaque"}
              <span className="ml-2 font-normal normal-case">
                {isEnglish ? "— optional, inherits the body font when empty" : "— opcional, herda a fonte de corpo quando vazio"}
              </span>
            </span>
            <input
              value={tema.fontStackDisplay ?? ""}
              onChange={(event) => update({ fontStackDisplay: event.target.value || undefined })}
              className="w-full border border-platform-border bg-platform-bg px-4 py-3 text-sm text-platform-text focus:border-platform-signal focus:outline-none"
              placeholder={isEnglish ? "e.g. Univers Condensed, sans-serif" : "ex.: Univers Condensed, sans-serif"}
            />
          </label>
        </div>

        <div className="border border-platform-border">
          <p className="border-b border-platform-border bg-platform-panel px-4 py-2 font-display text-[10px] font-black uppercase tracking-wider text-platform-text-muted">
            {isEnglish ? "Live preview" : "Prévia ao vivo"}
          </p>
          {/* A mesma composição de cores/fonte que o guia real usa — não um
             resumo aproximado. É o que torna a prévia confiável. */}
          <BrandCanvas theme={tema}>
            <div className="px-6 py-8">
              <p className="mb-4 inline-block bg-brand-accent px-3 py-1 font-display text-[10px] font-black uppercase tracking-wider text-brand-bg">
                {isEnglish ? "Section" : "Seção"}
              </p>
              <p className="font-brand-display text-3xl font-black uppercase leading-none text-brand-text">
                {isEnglish ? "Sample Title" : "Título de amostra"}
              </p>
              <p className="mt-4 font-brand text-sm leading-relaxed text-brand-text-muted">
                {isEnglish
                  ? "Body text reads like this, in the brand's own type."
                  : "O texto de corpo aparece assim, na fonte da própria marca."}
              </p>
            </div>
          </BrandCanvas>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving || !hasUnsavedChanges}
          onClick={save}
          className="bg-platform-signal px-5 py-3 font-display text-xs font-black uppercase text-platform-bg disabled:opacity-50"
        >
          {saving ? (isEnglish ? "Saving…" : "Salvando…") : (isEnglish ? "Save theme" : "Salvar tema")}
        </button>
        {message && <p role="status" className="text-sm text-platform-text-muted">{message}</p>}
      </div>
    </section>
  );
}
