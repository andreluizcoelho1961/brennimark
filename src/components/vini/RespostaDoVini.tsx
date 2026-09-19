"use client";

import { Fragment, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { parseBrandCitations } from "@/lib/ai/citations";
import { blocosDeMarkdown, enfases } from "@/lib/ai/markdown-leve";
import { destinoDaCitacao, type MapaDePaginas } from "@/lib/ai/paginas-citadas";
import { useStatusLabels } from "@/platform/brand-vocabulary-client";
import { useIsEnglish } from "@/platform/locale-client";
import type { DocStatus } from "@/content/docs";

/**
 * A resposta do Vini, formatada — e sem HTML.
 *
 * Três camadas, nesta ordem: blocos de Markdown (título, lista, parágrafo);
 * dentro de cada bloco, as citações `[Fonte: … — STATUS · /docs/…]`; no texto
 * entre citações, negrito e itálico. Tudo vira elemento React, que escapa o
 * texto — ver `lib/ai/markdown-leve.ts` para o porquê.
 *
 * A citação é instrumento de governança: fala em `--platform-*`, nunca na cor
 * da marca, e leva ao PDF na página (`lib/ai/paginas-citadas.ts`) SEM fechar a
 * janela — a janela mora na moldura, que não remonta ao trocar de página.
 */
const COR_DO_ESTADO: Record<DocStatus, string> = {
  ready: "text-platform-success",
  draft: "text-platform-warning",
  pending: "text-platform-text-muted",
};

export function RespostaDoVini({
  conteudo, paginas, basePath,
}: { conteudo: string; paginas: MapaDePaginas; basePath: string }) {
  const isEnglish = useIsEnglish();
  const rotulos = useStatusLabels();
  const router = useRouter();

  function linha(texto: string, chave: string): ReactNode {
    return parseBrandCitations(texto, rotulos).map((parte, i) => {
      if (parte.type === "text") {
        return (
          <Fragment key={`${chave}-${i}`}>
            {enfases(parte.value).map((e, j) =>
              e.tipo === "negrito" ? <strong key={j} className="font-semibold">{e.valor}</strong>
              : e.tipo === "italico" ? <em key={j}>{e.valor}</em>
              : <Fragment key={j}>{e.valor}</Fragment>)}
          </Fragment>
        );
      }
      const destino = destinoDaCitacao(parte.path, paginas, basePath, "0");
      return (
        <a
          key={`${chave}-${i}`}
          href={destino.href}
          data-citacao
          data-pagina={destino.pagina ?? undefined}
          onClick={(evento) => {
            if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return;
            evento.preventDefault();
            // Um pedido novo a cada clique: clicar de novo na mesma citação,
            // depois de rolar para longe, leva de novo à página.
            router.push(destinoDaCitacao(parte.path, paginas, basePath, String(Date.now())).href, { scroll: false });
          }}
          title={destino.pagina
            ? (isEnglish ? `Open the manual at page ${destino.pagina}` : `Abrir o manual na página ${destino.pagina}`)
            : (isEnglish ? "Open the manual" : "Abrir o manual")}
          className="mx-0.5 inline-flex flex-wrap items-baseline gap-1 border-b border-platform-border font-medium text-platform-text transition-colors hover:border-platform-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
        >
          <span>{parte.title}</span>
          {destino.pagina && <span className="text-platform-text-muted">{isEnglish ? "p." : "p."} {destino.pagina}</span>}
          <span className={`font-display text-[9px] font-bold uppercase tracking-wide ${parte.statusKey ? COR_DO_ESTADO[parte.statusKey] : "text-platform-text-muted"}`}>
            {parte.status}
          </span>
        </a>
      );
    });
  }

  return (
    <div data-resposta-do-vini className="space-y-3 text-[14px] leading-relaxed text-platform-text">
      {blocosDeMarkdown(conteudo).map((bloco, i) =>
        bloco.tipo === "titulo" ? (
          <p key={i} role="heading" aria-level={Math.min(bloco.nivel + 2, 6)}
            className="pt-1 font-display text-[11px] font-bold uppercase tracking-wide text-platform-text-muted">
            {linha(bloco.texto, `t${i}`)}
          </p>
        ) : bloco.tipo === "lista" ? (
          bloco.ordenada ? (
            <ol key={i} className="list-decimal space-y-1.5 pl-5">
              {bloco.itens.map((item, j) => <li key={j}>{linha(item, `o${i}-${j}`)}</li>)}
            </ol>
          ) : (
            <ul key={i} className="list-disc space-y-1.5 pl-5">
              {bloco.itens.map((item, j) => <li key={j}>{linha(item, `u${i}-${j}`)}</li>)}
            </ul>
          )
        ) : (
          <p key={i} className="whitespace-pre-wrap">{linha(bloco.texto, `p${i}`)}</p>
        ),
      )}
    </div>
  );
}
