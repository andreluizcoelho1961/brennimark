"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Dica } from "@/components/shell/Dica";
import { textoDaDica } from "@/components/shell/dicas";

/**
 * O "Como usar" de uma ferramenta — 17/10/2026, pedido do André: a ajuda do
 * Cores, do Grids e do Kit mora DENTRO de cada um, para quem está usando não
 * precisar ir procurar em outro lugar.
 *
 * Abre pela direita, sobre a ferramenta (não empurra: o Grids tem uma prévia
 * que não pode mudar de tamanho enquanto se lê). Não é modal — a pessoa lê e
 * continua mexendo na ferramenta ao lado. Esc fecha, e o foco volta ao botão.
 *
 * O HTML chega pronto do servidor (`AjudaDaFerramenta`), de um Markdown do
 * repositório; aqui só se decide mostrar ou não. Tokens da PLATAFORMA, nunca a
 * cor da marca cliente.
 */
export function PainelComoUsar({ titulo, html, hrefDoArtigo }: { titulo: string; html: string; hrefDoArtigo: string }) {
  const [aberto, setAberto] = useState(false);
  const idDoTitulo = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const fechar = useRef<HTMLButtonElement>(null);
  const jaAbriu = useRef(false);

  useEffect(() => {
    if (aberto) {
      jaAbriu.current = true;
      fechar.current?.focus();
    } else if (jaAbriu.current) {
      botao.current?.focus();
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto]);

  return (
    <>
      <Dica texto={textoDaDica("como-usar", false) ?? ""} lado="baixo">
        <button ref={botao} type="button" data-como-usar-abrir aria-expanded={aberto} aria-controls={idDoTitulo + "-painel"}
          onClick={() => setAberto((v) => !v)}
          className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-platform-border px-3 py-1.5 text-sm text-platform-text hover:border-platform-text">
          <span aria-hidden className="font-mono text-[12px]">?</span>
          Como usar
        </button>
      </Dica>
      {aberto && (
        <aside id={idDoTitulo + "-painel"} data-como-usar role="dialog" aria-modal="false" aria-labelledby={idDoTitulo}
          className="fixed bottom-0 right-0 top-[var(--shell-topbar)] z-40 flex w-[min(440px,100vw)] flex-col border-l border-platform-border bg-platform-panel shadow-[var(--shadow-painel,0_0_24px_rgba(0,22,33,0.12))]">
          <header className="flex items-center justify-between gap-3 border-b border-platform-border px-5 py-3">
            <h2 id={idDoTitulo} className="font-display text-[17px] font-semibold tracking-tight text-platform-text">{titulo}</h2>
            <button ref={fechar} type="button" data-como-usar-fechar onClick={() => setAberto(false)}
              className="rounded-[var(--radius-control)] border border-platform-border px-2.5 py-1 text-sm text-platform-text">
              Fechar
            </button>
          </header>
          <div className="prosa-da-ajuda min-h-0 flex-1 overflow-y-auto px-5 py-4" dangerouslySetInnerHTML={{ __html: html }} />
          <footer className="border-t border-platform-border px-5 py-3 text-[13px] text-platform-text-muted">
            <a href={hrefDoArtigo} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-platform-text">
              Abrir na Central de ajuda
            </a>
          </footer>
        </aside>
      )}
    </>
  );
}
