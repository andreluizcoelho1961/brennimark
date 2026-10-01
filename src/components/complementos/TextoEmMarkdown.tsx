import { Fragment, type ReactNode } from "react";
import { blocosDeMarkdown, enfases } from "@/lib/ai/markdown-leve";

/**
 * Um complemento formatado para LEITURA: títulos, listas, parágrafos, negrito
 * e itálico — o mesmo Markdown leve que a janela do Vini já interpreta
 * (`lib/ai/markdown-leve.ts`). Nada de HTML vindo do texto: cada bloco vira
 * elemento React, então o que alguém escrever nunca vira código na página.
 */
function linha(texto: string): ReactNode {
  return enfases(texto).map((e, i) =>
    e.tipo === "negrito" ? <strong key={i} className="font-semibold">{e.valor}</strong>
    : e.tipo === "italico" ? <em key={i}>{e.valor}</em>
    : <Fragment key={i}>{e.valor}</Fragment>);
}

export function TextoEmMarkdown({ texto }: { texto: string }) {
  return (
    <div data-texto-em-markdown className="space-y-3 text-[15px] leading-relaxed text-platform-text">
      {blocosDeMarkdown(texto).map((bloco, i) =>
        bloco.tipo === "separador" ? (
          <hr key={i} className="border-platform-border" />
        ) : bloco.tipo === "titulo" ? (
          <p key={i} role="heading" aria-level={Math.min(bloco.nivel + 2, 6)}
            className={bloco.nivel <= 2
              ? "pt-2 font-display text-[13px] font-black uppercase tracking-wider"
              : "pt-1 font-display text-[11px] font-bold uppercase tracking-wide text-platform-text-muted"}>
            {linha(bloco.texto)}
          </p>
        ) : bloco.tipo === "lista" ? (
          bloco.ordenada ? (
            <ol key={i} className="list-decimal space-y-1 pl-5">{bloco.itens.map((item, j) => <li key={j}>{linha(item)}</li>)}</ol>
          ) : (
            <ul key={i} className="list-disc space-y-1 pl-5">{bloco.itens.map((item, j) => <li key={j}>{linha(item)}</li>)}</ul>
          )
        ) : (
          <p key={i} className="whitespace-pre-wrap">{linha(bloco.texto)}</p>
        ),
      )}
    </div>
  );
}
