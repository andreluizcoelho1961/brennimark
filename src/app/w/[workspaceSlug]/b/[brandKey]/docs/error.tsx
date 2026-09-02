"use client";

import { useEffect } from "react";

/**
 * Falha ao renderizar uma página do manual.
 *
 * Dentro do layout: quem está lendo continua com a navegação, e a falha fica
 * contida na área de conteúdo em vez de derrubar a tela inteira.
 *
 * A mensagem do erro NÃO aparece. Ela pode carregar caminho de arquivo,
 * fragmento de consulta e, por ele, texto do manual do cliente — e a tela é o
 * lugar mais público onde isso poderia sair. O `digest` aparece porque é um
 * identificador opaco: ele liga o que a pessoa viu ao que o servidor registrou,
 * sem dizer nada sobre o conteúdo.
 */
export default function ErroNoManual({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[docs] falha ao renderizar:", error.name, error.digest ?? "");
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col justify-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-platform-text-muted">
        Erro
      </p>
      <h1 className="mt-[var(--space-shell-3)] text-[clamp(1.25rem,2.5vw,1.75rem)] font-semibold tracking-tight text-platform-text">
        Não foi possível abrir esta página
      </h1>
      <p className="mt-[var(--space-shell-3)] max-w-[42ch] text-[15px] leading-relaxed text-platform-text-muted">
        O conteúdo não foi alterado. Tente de novo; se persistir, o resto do
        manual continua acessível pela navegação.
      </p>
      <div className="mt-[var(--space-shell-5)] flex flex-wrap items-center gap-[var(--space-shell-3)]">
        <button
          type="button"
          onClick={reset}
          className="flex min-h-11 items-center rounded-[var(--radius-control)] border border-platform-border px-[var(--space-shell-4)] text-[14px] text-platform-text hover:border-platform-signal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
        >
          Tentar de novo
        </button>
        {error.digest && (
          <p className="font-mono text-[11px] text-platform-text-muted">
            Referência: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
