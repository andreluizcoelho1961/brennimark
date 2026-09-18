"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import type { DestinoDaMarca } from "./coluna";

/**
 * O Vini, no canto inferior direito — o único lugar do contato com a marca
 * por IA (decisão do André, reafirmada em 18/09).
 *
 * ─── O que ele é nesta versão ───────────────────────────────────────────────
 *
 * Um LANÇADOR: o botão no lugar definitivo, abrindo uma lista curta que leva
 * às telas que já existem — perguntar, analisar peça, histórico. Na fatia 4
 * (plano da interface §3) ele vira a janela de três estados — recolhida,
 * conversa e análise —, e o chat passa a acontecer dentro dela, com a citação
 * levando o PDF à página.
 *
 * Lançador agora, e não janela, pelo mesmo motivo de sempre: nada some antes
 * de ter para onde ir. Chat e análise saíram da coluna da esquerda; o caminho
 * até eles precisava continuar existindo, e ele já nasce no endereço certo.
 *
 * ⚖️ Não é modal: o conteúdo continua usável com a lista aberta. Esc fecha e
 * devolve o foco ao botão; clicar fora fecha.
 */
const ROTULOS: [string, string, string][] = [
  // segmento do endereço, português, inglês
  ["chat", "Perguntar", "Ask"],
  ["analise", "Analisar peça", "Review a piece"],
  ["historico", "Histórico", "History"],
];

function rotuloDoVini(href: string, ingles: boolean): string | null {
  const segmentos = href.split(/[?#]/)[0].split("/");
  const achado = ROTULOS.find(([segmento]) => segmentos.includes(segmento));
  return achado ? (ingles ? achado[2] : achado[1]) : null;
}

export function LancadorDoVini({ destinos }: { destinos: readonly DestinoDaMarca[] }) {
  const isEnglish = useIsEnglish();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setAberto(false);
        botao.current?.focus();
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  if (destinos.length === 0) return null;

  return (
    <div ref={raiz} data-vini className="fixed bottom-[max(env(safe-area-inset-bottom),1.25rem)] right-[max(env(safe-area-inset-right),1.25rem)] z-40 flex flex-col items-end gap-[var(--space-shell-2)]">
      {aberto && (
        <div
          id="vini-lista"
          data-vini-lista
          className="w-[16rem] overflow-hidden rounded-[var(--radius-entry,12px)] border border-platform-border bg-platform-panel shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
        >
          <p className="border-b border-platform-border px-[var(--space-shell-4)] py-[var(--space-shell-3)] text-[12px] leading-relaxed text-platform-text-muted">
            {isEnglish
              ? "Ask about the brand, review a piece against the manual."
              : "Pergunte sobre a marca, confira uma peça contra o manual."}
          </p>
          <ul className="py-[var(--space-shell-1)]">
            {destinos.map((destino) => (
              <li key={destino.href}>
                <Link
                  href={destino.href}
                  onClick={() => setAberto(false)}
                  data-destino-do-vini
                  className="flex min-h-10 items-center px-[var(--space-shell-4)] text-[14px] text-platform-text hover:bg-platform-signal-soft focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-platform-focus"
                >
                  {rotuloDoVini(destino.href, isEnglish) ?? destino.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        aria-controls="vini-lista"
        data-botao-do-vini
        className="flex h-11 items-center gap-[var(--space-shell-2)] rounded-full border border-platform-border bg-platform-panel px-[var(--space-shell-4)] text-[14px] font-medium text-platform-text shadow-[0_6px_18px_rgba(0,0,0,0.14)] hover:border-platform-signal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
      >
        <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5.5h16v10H9l-5 4v-14z" />
        </svg>
        Vini
      </button>
    </div>
  );
}
