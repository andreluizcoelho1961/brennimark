"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useIsEnglish } from "@/platform/locale-client";

/**
 * A tela de falha, uma só, com a copy de cada superfície por parâmetro.
 *
 * Cinco arquivos `error.tsx` quase idênticos seriam cinco lugares para alguém
 * acrescentar `{error.message}` num deles. A regra que importa — **a mensagem
 * técnica nunca aparece** — vive aqui, e as fronteiras só dizem onde estão e
 * para onde voltar.
 *
 * Por que a mensagem não aparece: ela pode carregar caminho de arquivo,
 * fragmento de consulta SQL e, por ele, texto do manual de um cliente. A tela
 * é o lugar mais público onde isso poderia sair — inclusive numa captura de
 * tela colada num chat de equipe.
 *
 * O `digest` aparece porque é opaco: ele liga o que a pessoa viu ao que o
 * servidor registrou, sem dizer nada sobre o conteúdo.
 */
export function LimiteDeErro({
  error,
  reset,
  titulo,
  tituloEn,
  descricao,
  descricaoEn,
  retorno,
  contexto,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  titulo: string;
  tituloEn: string;
  descricao: string;
  descricaoEn: string;
  /** Saída segura: um lugar que existe e não depende do que falhou. */
  retorno?: { href: string; rotulo: string; rotuloEn: string };
  /** Aparece no log, para separar as fronteiras entre si. */
  contexto: string;
}) {
  const isEnglish = useIsEnglish();
  const t = (pt: string, en: string) => (isEnglish ? en : pt);

  useEffect(() => {
    // Nome e digest. Nunca `error.message`, nem no console: log de navegador
    // vai para relatório de suporte e para captura de tela.
    console.error(`[${contexto}] falha ao renderizar:`, error.name, error.digest ?? "");
  }, [error, contexto]);

  return (
    <div
      data-limite-de-erro={contexto}
      className="flex min-h-[60vh] flex-col justify-center px-[var(--space-shell-4)]"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-platform-text-muted">
        {t("Erro", "Error")}
      </p>
      <h1 className="mt-[var(--space-shell-3)] text-[clamp(1.25rem,2.5vw,1.75rem)] font-semibold tracking-tight text-platform-text">
        {t(titulo, tituloEn)}
      </h1>
      <p className="mt-[var(--space-shell-3)] max-w-[46ch] text-[15px] leading-relaxed text-platform-text-muted">
        {t(descricao, descricaoEn)}
      </p>

      <div className="mt-[var(--space-shell-5)] flex flex-wrap items-center gap-[var(--space-shell-3)]">
        <button
          type="button"
          onClick={reset}
          data-tentar-de-novo
          className="flex min-h-11 items-center rounded-[var(--radius-control)] border border-platform-border px-[var(--space-shell-4)] text-[14px] text-platform-text hover:border-platform-signal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
        >
          {t("Tentar de novo", "Try again")}
        </button>

        {/* A saída segura existe porque "tentar de novo" pode falhar de novo:
            sem ela, a pessoa fica presa numa tela cujo único botão não
            funciona. */}
        {retorno && (
          <Link
            href={retorno.href}
            data-saida-segura
            className="flex min-h-11 items-center rounded-[var(--radius-control)] px-[var(--space-shell-3)] text-[14px] text-platform-text-muted hover:text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
          >
            {t(retorno.rotulo, retorno.rotuloEn)}
          </Link>
        )}

        {error.digest && (
          <p className="font-mono text-[11px] text-platform-text-muted">
            {t("Referência", "Reference")}: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
