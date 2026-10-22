"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { IconeDoRecurso } from "./IconeDoRecurso";

/**
 * O tour da plataforma na home (22/10/2026): uma aba por recurso, e a tela do
 * produto ao lado. É o que faz a home mostrar a plataforma inteira sem pedir
 * que a pessoa role por dez seções.
 *
 * As telas chegam prontas do servidor (`tela`, um ReactNode) e todas saem no
 * HTML: o buscador e quem está sem JavaScript leem tudo; o script só escolhe
 * qual aparece. Teclado: setas e Home/End andam entre as abas (padrão WAI-ARIA).
 *
 * `/#recurso-<id>` (a barra da abertura) abre o tour já na aba daquele recurso.
 *
 * A demonstração animada (22/10/2026, ideia do André a partir do playhead.fm):
 * quando o tour entra na tela, `data-tocando` liga o roteiro de cada tela (ver
 * `passo()` em `TelasDaHome.tsx`) e, terminado o roteiro, o tour passa sozinho
 * para a aba seguinte. Escolher uma aba, as setas ou Pausar desligam o avanço;
 * o roteiro da aba escolhida continua tocando. Com "reduzir movimento" no
 * sistema, nada avança sozinho e as telas aparecem prontas.
 */
export interface AbaDoTour {
  id: string;
  rotulo: string;
  curto: string;
  titulo: string;
  texto: string;
  href: string;
  link: string;
  tela: ReactNode;
}

/** Quanto vale um passo do roteiro, e o tempo para ler a tela pronta antes de seguir. */
const PASSO_MS = 800;
const DIGITAR_MS = 1100;
const LEITURA_MS = 2800;

/** A duração do roteiro da tela: o último passo dela, mais a digitação e a leitura. */
function duracaoDoRoteiro(painel: HTMLElement | null): number {
  if (!painel) return 6000;
  const passos = [...painel.querySelectorAll<HTMLElement>("[style*='--p']")].map((el) => Number(el.style.getPropertyValue("--p")) || 0);
  return Math.max(0, ...passos) * PASSO_MS + DIGITAR_MS + LEITURA_MS;
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");

export function TourDaPlataforma({ abas }: { abas: AbaDoTour[] }) {
  const [atual, setAtual] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [automatico, setAutomatico] = useState(true);
  const [duracao, setDuracao] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const paineis = useRef<(HTMLDivElement | null)[]>([]);

  const escolher = useCallback((i: number) => {
    setAutomatico(false);
    setAtual((i + abas.length) % abas.length);
  }, [abas.length]);

  useEffect(() => {
    const peloEndereco = () => {
      const i = abas.findIndex((a) => location.hash === `#recurso-${a.id}`);
      if (i < 0) return;
      escolher(i);
      document.getElementById("plataforma")?.scrollIntoView({ block: "start" });
    };
    // O roteador do Next engole o clique num `<a href="#…">` da mesma página
    // sem disparar `hashchange`; por isso o clique é tratado aqui.
    const peloClique = (e: MouseEvent) => {
      const link = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#recurso-"]');
      if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      history.pushState(null, "", link.getAttribute("href"));
      peloEndereco();
    };
    peloEndereco();
    window.addEventListener("hashchange", peloEndereco);
    document.addEventListener("click", peloClique);
    return () => {
      window.removeEventListener("hashchange", peloEndereco);
      document.removeEventListener("click", peloClique);
    };
  }, [abas, escolher]);

  // O roteiro só toca com o tour à vista, e com movimento permitido no sistema.
  useEffect(() => {
    const el = raiz.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observador = new IntersectionObserver(([en]) => setTocando(en.isIntersecting), { threshold: 0.35 });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  // Terminado o roteiro da aba, a seguinte — enquanto ninguém tiver escolhido uma.
  useEffect(() => {
    const ms = duracaoDoRoteiro(paineis.current[atual]);
    setDuracao(ms);
    if (!tocando || !automatico || document.hidden) return;
    const espera = window.setTimeout(() => setAtual((i) => (i + 1) % abas.length), ms);
    return () => window.clearTimeout(espera);
  }, [atual, tocando, automatico, abas.length]);

  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const destino = { ArrowDown: atual + 1, ArrowRight: atual + 1, ArrowUp: atual - 1, ArrowLeft: atual - 1, Home: 0, End: abas.length - 1 }[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    const i = (destino + abas.length) % abas.length;
    escolher(i);
    botoes.current[i]?.focus();
  };

  return (
    <div className="tour" ref={raiz} data-tocando={tocando ? "" : undefined} data-automatico={automatico ? "" : undefined}>
      <div className="tour-tabs" role="tablist" aria-label="Recursos da plataforma" aria-orientation="vertical" onKeyDown={teclas}>
        {abas.map((a, i) => (
          <button
            key={a.id}
            ref={(el) => { botoes.current[i] = el; }}
            type="button"
            role="tab"
            id={`tour-aba-${a.id}`}
            aria-controls={`tour-tela-${a.id}`}
            aria-selected={i === atual}
            tabIndex={i === atual ? 0 : -1}
            className="tour-tab"
            onClick={() => escolher(i)}
          >
            <IconeDoRecurso id={a.id} />
            <b>{a.rotulo}</b>
            <span>{i === atual ? a.texto : a.curto}</span>
            {i === atual && tocando && automatico ? (
              <i key={`${atual}-${duracao}`} className="tour-prog" style={{ animationDuration: `${duracao}ms` }} aria-hidden="true" />
            ) : null}
          </button>
        ))}
      </div>
      <div className="tour-stage">
        <div className="tour-ctrl">
          <button type="button" onClick={() => escolher(atual - 1)} aria-label="Recurso anterior">←</button>
          <span className="tour-cont" aria-live="polite">{doisDigitos(atual + 1)} / {doisDigitos(abas.length)}</span>
          <button type="button" onClick={() => escolher(atual + 1)} aria-label="Próximo recurso">→</button>
          <button type="button" className="tour-auto" aria-pressed={automatico} onClick={() => setAutomatico((v) => !v)}>
            {automatico ? "Pausar a demonstração" : "Tocar a demonstração"}
          </button>
        </div>
        {abas.map((a, i) => (
          <div key={a.id} ref={(el) => { paineis.current[i] = el; }} className="tour-panel" role="tabpanel" id={`tour-tela-${a.id}`} aria-labelledby={`tour-aba-${a.id}`} hidden={i !== atual}>
            <div className="tour-copy">
              <h3>{a.titulo}</h3>
              <Link className="more" href={a.href}>{a.link} <span aria-hidden="true">→</span></Link>
            </div>
            <div className="tour-tela">{a.tela}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
