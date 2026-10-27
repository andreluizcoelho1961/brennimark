"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PASSOS_DO_TOUR, passoAnterior, posicaoDoBalao, proximoPasso, type Posicao, type Retangulo } from "@/lib/demonstracao/passos-do-tour";

/**
 * O tour guiado (27/10/2026): balões que apontam as partes da plataforma, um por
 * vez. Não bloqueia a tela (a pessoa pode clicar nas coisas); só destaca o
 * elemento do passo. Sem o elemento na tela, o balão fica no centro.
 *
 * Sem `useTranslations`: mora na moldura, que nem sempre tem o provedor de
 * traduções (mesmo motivo da faixa). Os textos vêm de `passos-do-tour.ts`, com os
 * dois idiomas lado a lado.
 */
const LARGURA = 320;
const ALTURA_ESTIMADA = 190;

function medir(seletor?: string): Retangulo | null {
  if (!seletor) return null;
  const el = document.querySelector(seletor);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { topo: r.top, esquerda: r.left, largura: r.width, altura: r.height };
}

export function TourGuiado({ ingles, aoFechar }: { ingles: boolean; aoFechar: () => void }) {
  const lg = ingles ? "en" : "pt-BR";
  const t = (en: string, pt: string) => (ingles ? en : pt);
  const [indice, setIndice] = useState(0);
  const [alvo, setAlvo] = useState<Retangulo | null>(null);
  const [posicao, setPosicao] = useState<Posicao>({ topo: 80, esquerda: 80, modo: "centro" });
  const balao = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const passo = PASSOS_DO_TOUR[indice];

  useLayoutEffect(() => {
    const recalcular = () => {
      const r = medir(passo.seletor);
      setAlvo(r);
      const caixa = balao.current?.getBoundingClientRect();
      setPosicao(posicaoDoBalao(r, { largura: window.innerWidth, altura: window.innerHeight }, { largura: caixa?.width ?? LARGURA, altura: caixa?.height ?? ALTURA_ESTIMADA }));
    };
    const raf = window.requestAnimationFrame(recalcular);
    window.addEventListener("resize", recalcular);
    window.addEventListener("scroll", recalcular, true);
    return () => { window.cancelAnimationFrame(raf); window.removeEventListener("resize", recalcular); window.removeEventListener("scroll", recalcular, true); };
  }, [passo]);

  useEffect(() => { botao.current?.focus({ preventScroll: true }); }, [indice]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  const ultimo = indice === PASSOS_DO_TOUR.length - 1;
  const avancar = () => { const p = proximoPasso(indice, PASSOS_DO_TOUR.length); if (p === "fim") aoFechar(); else setIndice(p); };
  const botaoBase = "border border-platform-border px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wide text-platform-text hover:bg-platform-text hover:text-platform-bg";

  return (
    <div data-tour-guiado data-passo={passo.id} className="pointer-events-none fixed inset-0 z-[60]">
      {alvo && (
        <div aria-hidden="true" className="absolute rounded-[var(--radius-control)] ring-2 ring-platform-signal"
          style={{ top: alvo.topo - 4, left: alvo.esquerda - 4, width: alvo.largura + 8, height: alvo.altura + 8, boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }} />
      )}
      <div ref={balao} role="dialog" aria-label={passo.titulo[lg]} data-tour-balao
        className="pointer-events-auto absolute border border-platform-border bg-platform-panel p-4 text-platform-text shadow-lg"
        style={{ top: posicao.topo, left: posicao.esquerda, width: LARGURA, maxWidth: "calc(100vw - 24px)" }}>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-platform-text-muted">{indice + 1} / {PASSOS_DO_TOUR.length}</p>
        <h2 className="mt-1 font-display text-lg font-black uppercase leading-tight">{passo.titulo[lg]}</h2>
        <p className="mt-2 text-sm leading-relaxed text-platform-text-muted">{passo.texto[lg]}</p>
        {ultimo && <Link href="/assinar" className="mt-3 inline-block underline">{t("Subscribe to Brennimark", "Assine o Brennimark")}</Link>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button type="button" data-tour-pular onClick={aoFechar} className="text-xs text-platform-text-muted underline">
            {ultimo ? t("Keep exploring", "Continuar explorando") : t("Skip", "Pular")}
          </button>
          <span className="flex gap-2">
            {indice > 0 && <button type="button" data-tour-anterior onClick={() => setIndice(passoAnterior(indice))} className={botaoBase}>{t("Back", "Voltar")}</button>}
            <button ref={botao} type="button" data-tour-proximo onClick={avancar} className={botaoBase}>
              {ultimo ? t("Done", "Concluir") : t("Next", "Próximo")}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
