"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState } from "react";
import agenciaDesktop from "./imagens/agencia-desktop.jpg";
import agenciaDupla from "./imagens/agencia-dupla.jpg";
import agenciaTelao from "./imagens/agencia-telao.jpg";
import agenciaLaptop from "./imagens/agencia-laptop.jpg";

/**
 * O capítulo "Num só lugar" (03/10/2026) — trazido da prévia do Codex
 * (`codex/previa-site-vanguarda`), a pedido do André: uma palavra grande sobre
 * fotos de agência em tela cheia, que trocam por dissolução.
 *
 * As fotos são do banco próprio do Brennimark, geradas por IA. São provisórias:
 * a direção é trocá-las por montagens com o manual aberto nos aparelhos.
 *
 * A troca automática só roda com o capítulo visível, com a aba à vista e sem
 * "reduzir movimento" no sistema. Escolher uma aba segura a troca por ~15 s;
 * Pausar a desliga. A frase completa não depende do ciclo.
 */
const PALAVRAS: readonly { palavra: string; foto: StaticImageData; foco: string }[] = [
  { palavra: "MANUAL", foto: agenciaDesktop, foco: "40%" },
  { palavra: "MATERIAIS", foto: agenciaDupla, foco: "55%" },
  { palavra: "REGRAS", foto: agenciaTelao, foco: "60%" },
  { palavra: "NUM SÓ LUGAR", foto: agenciaLaptop, foco: "55%" },
];
const ROTULOS = ["Manual", "Materiais", "Regras", "Num só lugar"];
const INTERVALO_MS = 5200;
/** Escolher uma aba segura a troca por três voltas do ciclo (~15 s). */
const VOLTAS_SEGURADAS = 3;

export function NumSoLugar() {
  const painel = useRef<HTMLElement>(null);
  const [atual, setAtual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const voltasSeguradas = useRef(0);

  useEffect(() => {
    const el = painel.current;
    if (!el || pausado) return;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visivel = false;
    const observador = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }, { threshold: 0.35 });
    observador.observe(el);
    const ciclo = window.setInterval(() => {
      if (!visivel || document.hidden || reduzido.matches) return;
      if (voltasSeguradas.current > 0) { voltasSeguradas.current -= 1; return; }
      setAtual((i) => (i + 1) % PALAVRAS.length);
    }, INTERVALO_MS);
    return () => { observador.disconnect(); window.clearInterval(ciclo); };
  }, [pausado]);

  const escolher = (i: number) => {
    voltasSeguradas.current = VOLTAS_SEGURADAS;
    setAtual(i);
  };

  return (
    <section ref={painel} className="panel phrase-panel" id="num-so-lugar" aria-label="Num só lugar">
      <div className="manual-backdrop" aria-hidden="true">
        {PALAVRAS.map((p, i) => (
          <Image key={p.palavra} className={`manual-page${i === atual ? " is-shown" : ""}`} src={p.foto} alt="" fill
            sizes="100vw" loading={i === 0 ? "eager" : "lazy"} style={{ objectPosition: `${p.foco} center` }} />
        ))}
      </div>
      <div className="wrap phrase-wrap">
        <div className="phrase-header">
          <p className="eyebrow">O que é o Brennimark</p>
          <button type="button" className="phrase-pause" aria-pressed={pausado} onClick={() => setPausado((v) => !v)}
            aria-label={pausado ? "Retomar troca de imagens" : "Pausar troca de imagens"}>
            {pausado ? "Retomar" : "Pausar"}
          </button>
        </div>
        <div className="phrase-display"><p className="phrase-word" aria-hidden="true" data-palavra>{PALAVRAS[atual].palavra}</p></div>
        <div className="phrase-bottom">
          <h2 className="complete-sentence">O manual, os materiais<br />e as regras da sua marca,<br /><em>num só lugar.</em></h2>
          <div className="phrase-tabs" role="group" aria-label="Explorar o conteúdo da marca">
            {ROTULOS.map((r, i) => (
              <button key={r} type="button" aria-pressed={i === atual} data-palavra-aba={i} onClick={() => escolher(i)}>{r}</button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
