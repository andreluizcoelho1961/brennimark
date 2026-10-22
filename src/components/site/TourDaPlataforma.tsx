"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
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

export function TourDaPlataforma({ abas }: { abas: AbaDoTour[] }) {
  const [atual, setAtual] = useState(0);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const peloEndereco = () => {
      const i = abas.findIndex((a) => location.hash === `#recurso-${a.id}`);
      if (i < 0) return;
      setAtual(i);
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
  }, [abas]);

  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const destino = { ArrowDown: atual + 1, ArrowRight: atual + 1, ArrowUp: atual - 1, ArrowLeft: atual - 1, Home: 0, End: abas.length - 1 }[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    const i = (destino + abas.length) % abas.length;
    setAtual(i);
    botoes.current[i]?.focus();
  };

  return (
    <div className="tour">
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
            onClick={() => setAtual(i)}
          >
            <IconeDoRecurso id={a.id} />
            <b>{a.rotulo}</b>
            <span>{a.curto}</span>
          </button>
        ))}
      </div>
      {abas.map((a, i) => (
        <div key={a.id} className="tour-panel" role="tabpanel" id={`tour-tela-${a.id}`} aria-labelledby={`tour-aba-${a.id}`} hidden={i !== atual}>
          <div className="tour-copy">
            <h3>{a.titulo}</h3>
            <p>{a.texto}</p>
            <Link className="more" href={a.href}>{a.link} <span aria-hidden="true">→</span></Link>
          </div>
          <div className="tour-tela">{a.tela}</div>
        </div>
      ))}
    </div>
  );
}
