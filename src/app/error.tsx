"use client";

import { useEffect } from "react";

/**
 * Falha fora da moldura do manual: login, cadastro, resolvedor.
 *
 * Igual à de dentro no que importa: a mensagem do erro não aparece, porque
 * pode carregar caminho de arquivo e fragmento de consulta. Só o `digest`, que
 * é opaco e liga o que a pessoa viu ao que o servidor registrou.
 */
export default function ErroDaAplicacao({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] falha ao renderizar:", error.name, error.digest ?? "");
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-platform-bg px-[var(--space-shell-5)]">
      <div className="max-w-[34rem]">
        <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-tight text-platform-text">
          Algo falhou aqui
        </h1>
        <p className="mt-[var(--space-shell-3)] text-[15px] leading-relaxed text-platform-text-muted">
          Nada foi alterado. Tente de novo.
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
    </main>
  );
}
