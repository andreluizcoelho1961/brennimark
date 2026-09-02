import Link from "next/link";
import type { DocPageEntry } from "@/content/docs";
import { trilha, vizinhos } from "./documentos";

/**
 * Onde estou, e para onde sigo.
 *
 * As duas peças andam juntas porque respondem à mesma pergunta em tempos
 * diferentes: a trilha diz onde a pessoa está agora, os vizinhos dizem para
 * onde ela vai a seguir. Separá-las em dois componentes faria a página de
 * documento importar dois e esquecer um.
 *
 * Componentes de servidor: não há estado, e o que eles mostram já foi
 * resolvido na requisição.
 */
export function Trilha({
  marca,
  documento,
  base,
  ingles,
}: {
  marca: string;
  documento?: DocPageEntry;
  base: string;
  ingles: boolean;
}) {
  const migalhas = trilha({ marca, documento, base });

  return (
    <nav aria-label={ingles ? "Breadcrumb" : "Trilha"} className="mb-[var(--space-shell-4)]">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-platform-text-muted">
        {migalhas.map((migalha, indice) => (
          <li key={`${migalha.rotulo}-${indice}`} className="flex items-center gap-2">
            {indice > 0 && (
              <span aria-hidden className="text-platform-border">
                ›
              </span>
            )}
            {migalha.href ? (
              <Link
                href={migalha.href}
                className="rounded-[var(--radius-control)] hover:text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
              >
                {migalha.rotulo}
              </Link>
            ) : (
              // O último item recebe aria-current: quem usa leitor de tela
              // ouve a trilha inteira e precisa saber onde ela termina.
              <span aria-current={indice === migalhas.length - 1 ? "page" : undefined}>
                {migalha.rotulo}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Vizinhos({
  docs,
  slug,
  base,
  ingles,
}: {
  docs: readonly DocPageEntry[];
  slug: string;
  base: string;
  ingles: boolean;
}) {
  const { anterior, proximo } = vizinhos(docs, slug);
  if (!anterior && !proximo) return null;

  return (
    <nav
      aria-label={ingles ? "Manual pages" : "Páginas do manual"}
      className="mt-[var(--space-shell-6)] flex flex-wrap justify-between gap-[var(--space-shell-3)] border-t border-platform-border pt-[var(--space-shell-4)]"
    >
      {/* O espaçador mantém "próximo" à direita quando não há anterior. Sem
          ele, a primeira página do manual mostraria "próximo" à esquerda, e a
          posição do controle mudaria de página para página. */}
      {anterior ? (
        <Link
          href={`${base}/${anterior.slug}`}
          rel="prev"
          data-vizinho="anterior"
          className="flex min-h-11 max-w-[45%] flex-col justify-center rounded-[var(--radius-control)] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
        >
          <span className="text-[11px] text-platform-text-muted">
            {ingles ? "Previous" : "Anterior"}
          </span>
          <span className="truncate text-[14px] text-platform-text">{anterior.title}</span>
        </Link>
      ) : (
        <span aria-hidden />
      )}

      {proximo && (
        <Link
          href={`${base}/${proximo.slug}`}
          rel="next"
          data-vizinho="proximo"
          className="flex min-h-11 max-w-[45%] flex-col justify-center rounded-[var(--radius-control)] text-right focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
        >
          <span className="text-[11px] text-platform-text-muted">
            {ingles ? "Next" : "Próxima"}
          </span>
          <span className="truncate text-[14px] text-platform-text">{proximo.title}</span>
        </Link>
      )}
    </nav>
  );
}
