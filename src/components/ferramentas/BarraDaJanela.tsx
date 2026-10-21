"use client";

import { useEffect } from "react";
import {
  CHAVE_DO_ARMAZENAMENTO, enderecoNormal, lerGeometria, mudouGeometria, NOMES_DAS_FERRAMENTAS, type FerramentaEmJanela,
} from "@/lib/ferramentas/janela";

/**
 * A barra fina da janela solta (21/10/2026): o nome da ferramenta e "Voltar à
 * aba do site". Some o menu do site e o título grande, para sobrar o espaço todo
 * à ferramenta.
 *
 * Enquanto a janela está aberta, ela anota o próprio tamanho e a posição (neste
 * computador) para a próxima abertura voltar ao mesmo lugar. O navegador não avisa
 * quando a janela é ARRASTADA, só quando ela é redimensionada; por isso a conferência
 * é por tempo, e só grava quando mudou de verdade.
 */
export function BarraDaJanela({ ferramenta }: { ferramenta: FerramentaEmJanela }) {
  useEffect(() => {
    const chave = CHAVE_DO_ARMAZENAMENTO(ferramenta);
    let ultima = null as ReturnType<typeof lerGeometria>;
    try { ultima = lerGeometria(localStorage.getItem(chave)); } catch { /* sem armazenamento */ }
    const id = window.setInterval(() => {
      const agora = { largura: window.outerWidth, altura: window.outerHeight, esquerda: window.screenX, topo: window.screenY };
      if (!mudouGeometria(ultima, agora)) return;
      ultima = agora;
      try { localStorage.setItem(chave, JSON.stringify(agora)); } catch { /* cheio ou bloqueado: segue sem lembrar */ }
    }, 800);
    return () => window.clearInterval(id);
  }, [ferramenta]);

  function voltar() {
    const origem = window.opener as Window | null;
    if (origem && !origem.closed) {
      try { origem.focus(); } catch { /* o navegador pode recusar o foco */ }
      window.close();
      return;
    }
    // Sem a aba de origem (foi fechada, ou a janela veio de um link): abre na própria janela.
    window.location.href = enderecoNormal(ferramenta);
  }

  return (
    <div data-barra-da-janela className="fixed inset-x-0 top-0 z-30 flex h-[44px] items-center justify-between gap-3 border-b border-platform-border bg-platform-bg px-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-platform-text-muted">
        Brennimark <span className="text-platform-text">{NOMES_DAS_FERRAMENTAS[ferramenta]}</span>
      </p>
      <button
        type="button"
        data-janela-voltar
        onClick={voltar}
        className="rounded-[var(--radius-control)] border border-platform-border px-3 py-1 text-[13px] text-platform-text hover:border-platform-text"
      >
        Voltar à aba do site
      </button>
    </div>
  );
}
