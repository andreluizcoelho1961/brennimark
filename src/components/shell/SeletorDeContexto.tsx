"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";

export interface OpcaoDeContexto {
  slug: string;
  nome: string;
  marcas: readonly { key: string; nome: string }[];
}

/**
 * Qual conta e qual marca esta tela está mostrando — e como trocar.
 *
 * Ele existe porque o contexto ativo passou a ser uma escolha. Enquanto era "a
 * primeira marca", não havia o que mostrar nem o que trocar: a pessoa não
 * sabia que estava vendo uma entre várias, e é assim que se manda a peça de um
 * cliente para outro.
 *
 * Links, não um seletor com JavaScript: cada marca tem endereço próprio, e um
 * `<a>` é compartilhável, abre em nova aba e funciona antes de qualquer script
 * carregar. O botão só controla a visibilidade da lista.
 *
 * A cor vem dos tokens da PLATAFORMA, nunca da marca. A moldura é o produto; se
 * ela se pintasse com a marca em exibição, trocar de marca pareceria trocar de
 * aplicativo — e o seletor, que é a peça que prova que há várias, seria a
 * primeira a mentir sobre isso.
 */
export function SeletorDeContexto({
  workspaceSlug,
  brandKey,
  opcoes,
}: {
  workspaceSlug: string;
  brandKey: string;
  opcoes: readonly OpcaoDeContexto[];
}) {
  const isEnglish = useIsEnglish();
  const t = (pt: string, en: string) => (isEnglish ? en : pt);
  const [aberto, setAberto] = useState(false);
  const id = useId();

  const conta = opcoes.find((o) => o.slug === workspaceSlug);
  const marca = conta?.marcas.find((m) => m.key === brandKey);
  const total = opcoes.reduce((soma, o) => soma + o.marcas.length, 0);

  const rotulo = marca?.nome ?? brandKey;
  // Com uma marca só não há troca a oferecer. O rótulo permanece: saber qual
  // marca está aberta continua valendo mesmo quando ela é a única.
  if (total <= 1) {
    return (
      <p
        data-contexto-ativo={`${workspaceSlug}/${brandKey}`}
        className="truncate text-[13px] font-medium text-platform-text"
      >
        {rotulo}
      </p>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-contexto-ativo={`${workspaceSlug}/${brandKey}`}
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((v) => !v)}
        className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-[var(--space-shell-2)] text-[13px] font-medium text-platform-text hover:bg-platform-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
      >
        <span className="truncate">{rotulo}</span>
        <span aria-hidden className="text-platform-text-muted">
          ⌄
        </span>
        <span className="sr-only">
          {t(`Trocar de marca. ${total} disponíveis.`, `Switch brand. ${total} available.`)}
        </span>
      </button>

      {aberto && (
        <div
          id={id}
          className="absolute left-0 top-full z-30 mt-1 min-w-[16rem] rounded-[var(--radius-control)] border border-platform-border bg-platform-panel p-[var(--space-shell-2)] shadow-lg"
        >
          {opcoes.map((opcao) => (
            <section key={opcao.slug} className="mb-[var(--space-shell-2)] last:mb-0">
              {/* A conta aparece mesmo com uma marca só: duas marcas de mesmo
                  nome em contas diferentes ficariam indistinguíveis sem isso. */}
              <h2 className="px-[var(--space-shell-2)] py-1 text-[11px] uppercase tracking-[0.06em] text-platform-text-muted">
                {opcao.nome}
              </h2>
              {opcao.marcas.map((m) => {
                const atual = opcao.slug === workspaceSlug && m.key === brandKey;
                return (
                  <Link
                    key={m.key}
                    href={`/w/${opcao.slug}/b/${m.key}/docs`}
                    aria-current={atual ? "true" : undefined}
                    onClick={() => setAberto(false)}
                    className={`flex min-h-11 items-center rounded-[var(--radius-control)] px-[var(--space-shell-2)] text-[13px] ${
                      atual
                        ? "bg-platform-signal-soft font-medium text-platform-text"
                        : "text-platform-text-muted hover:bg-platform-panel-muted hover:text-platform-text"
                    }`}
                  >
                    {m.nome}
                  </Link>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
