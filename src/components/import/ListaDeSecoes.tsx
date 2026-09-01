"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import {
  dividir, faixaLegivel, inicioDe, moverPagina, paginasDe, renomear, unir,
  validarInvariantes, type Secao,
} from "@/lib/import/secoes";

const LOTE = 40;

/**
 * As seções da prévia, revisáveis antes de publicar.
 *
 * A lista é PAGINADA, não virtualizada. Uma virtualização caseira desmonta
 * elementos enquanto o teclado ou o leitor de tela ainda os está usando — o
 * foco cai no vazio e a leitura recomeça do topo. Mostrar 40 e oferecer
 * "carregar mais" resolve o mesmo problema de custo sem quebrar navegação.
 *
 * A busca percorre TODAS as seções, inclusive as ainda não renderizadas: uma
 * busca que só encontra o que está na tela não é busca.
 */
export function ListaDeSecoes({
  secoes,
  linhasPorPagina,
  onMudar,
}: {
  secoes: Secao[];
  linhasPorPagina: ReadonlyMap<number, string[]>;
  onMudar: (secoes: Secao[]) => void;
}) {
  const isEnglish = useIsEnglish();
  const t = (pt: string, en: string) => (isEnglish ? en : pt);

  const [busca, setBusca] = useState("");
  const [visiveis, setVisiveis] = useState(LOTE);
  const [erro, setErro] = useState("");
  const idDaBusca = useId();
  const listaRef = useRef<HTMLOListElement>(null);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase();
    if (!termo) return secoes;
    // Sobre o conjunto inteiro, não sobre o que já foi renderizado.
    return secoes.filter(
      (secao) =>
        secao.titulo.toLocaleLowerCase().includes(termo) ||
        faixaLegivel(secao).includes(termo) ||
        secao.linhas.some((linha) => linha.toLocaleLowerCase().includes(termo)),
    );
  }, [secoes, busca]);

  const mostradas = filtradas.slice(0, visiveis);
  const restantes = filtradas.length - mostradas.length;

  /**
   * Toda edição passa por aqui.
   *
   * A operação só é aplicada se as invariantes continuarem válidas depois
   * dela. Uma edição que perdesse uma faixa de páginas seria pior que uma que
   * falha: ela publicaria procedência falsa.
   */
  function aplicar(operacao: () => Secao[], focoDepois?: string) {
    const proximas = operacao();
    const paginasAntes = new Set(secoes.flatMap(paginasDe));
    const paginasDepois = new Set(proximas.flatMap(paginasDe));

    const violacoes = validarInvariantes(
      { secoes: proximas, ignoradas: [], removidos: [], unidasPeloLimite: 0 },
      [...paginasAntes],
    );
    const perdeuPagina = [...paginasAntes].some((p) => !paginasDepois.has(p));

    if (violacoes.length > 0 || perdeuPagina) {
      setErro(t(
        "Esta mudança deixaria páginas fora de qualquer seção. Nada foi alterado.",
        "This change would leave pages outside any section. Nothing changed.",
      ));
      return;
    }

    setErro("");
    onMudar(proximas);
    if (focoDepois) {
      // O foco não pode sumir: depois de mover ou dividir, ele vai para a
      // seção resultante.
      requestAnimationFrame(() => {
        listaRef.current
          ?.querySelector<HTMLElement>(`[data-secao="${focoDepois}"] [data-titulo]`)
          ?.focus();
      });
    }
  }

  return (
    <section className="mt-[var(--space-shell-5)]" aria-labelledby={`${idDaBusca}-titulo`}>
      <div className="flex flex-wrap items-baseline justify-between gap-[var(--space-shell-3)]">
        <h3 id={`${idDaBusca}-titulo`} className="text-[15px] font-semibold text-platform-text">
          {t("Seções detectadas", "Detected sections")}
        </h3>
        <p className="text-[13px] text-platform-text-muted">
          {t(
            `Mostrando ${mostradas.length} de ${filtradas.length}`,
            `Showing ${mostradas.length} of ${filtradas.length}`,
          )}
          {filtradas.length !== secoes.length && ` (${secoes.length} ${t("no total", "total")})`}
        </p>
      </div>

      <label className="mt-[var(--space-shell-3)] block">
        <span className="sr-only">{t("Buscar nas seções", "Search sections")}</span>
        <input
          type="search"
          value={busca}
          onChange={(evento) => {
            setBusca(evento.target.value);
            setVisiveis(LOTE);
          }}
          placeholder={t("Buscar por título, página ou texto", "Search by title, page or text")}
          className="h-11 w-full rounded-[var(--radius-control)] border border-platform-border bg-platform-panel px-[var(--space-shell-3)] text-[14px] text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
        />
      </label>

      {erro && (
        <p role="alert" className="mt-[var(--space-shell-3)] border-l-2 border-platform-danger pl-[var(--space-shell-3)] text-[13px] text-platform-text">
          {erro}
        </p>
      )}

      {/* O total vive no rótulo da lista: um leitor de tela anuncia "lista com
          N itens" mesmo quando só 40 estão no DOM. */}
      <ol
        ref={listaRef}
        aria-label={t(
          `${filtradas.length} seções`,
          `${filtradas.length} sections`,
        )}
        className="mt-[var(--space-shell-4)] flex flex-col gap-[var(--space-shell-2)]"
      >
        {mostradas.map((secao, indice) => (
          <li
            key={secao.id}
            data-secao={secao.id}
            aria-label={t(
              `Seção ${indice + 1} de ${filtradas.length}: ${secao.titulo}`,
              `Section ${indice + 1} of ${filtradas.length}: ${secao.titulo}`,
            )}
            className="rounded-[var(--radius-control)] border border-platform-border p-[var(--space-shell-3)]"
          >
            <div className="flex flex-wrap items-baseline gap-[var(--space-shell-3)]">
              <input
                data-titulo
                value={secao.titulo}
                aria-label={t("Título da seção", "Section title")}
                onChange={(evento) =>
                  aplicar(() => renomear(secoes, secao.id, evento.target.value))
                }
                className="min-w-0 flex-1 rounded-[var(--radius-control)] bg-transparent text-[14px] font-medium text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
              />
              <span className="font-mono text-[11px] text-platform-text-muted">
                {t("Páginas", "Pages")} {faixaLegivel(secao)}
              </span>
              <span
                className="rounded-[var(--radius-control)] bg-platform-panel px-2 py-0.5 text-[10px] uppercase tracking-wide text-platform-text-muted"
                title={t(
                  {
                    outline: "Fronteira declarada no índice do PDF",
                    heading: "Título detectado pelo destaque visual",
                    "page-range": "Sem estrutura detectada: bloco de páginas",
                  }[secao.metodo],
                  {
                    outline: "Boundary declared in the PDF outline",
                    heading: "Title detected by visual prominence",
                    "page-range": "No structure detected: page block",
                  }[secao.metodo],
                )}
              >
                {{ outline: t("Índice", "Outline"), heading: t("Título", "Heading"), "page-range": t("Faixa", "Range") }[secao.metodo]}
              </span>
            </div>

            <div className="mt-[var(--space-shell-2)] flex flex-wrap gap-[var(--space-shell-2)]">
              {paginasDe(secao).length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    aplicar(
                      () => dividir(secoes, secao.id, paginasDe(secao)[1], linhasPorPagina),
                      `${secao.id}b`,
                    )
                  }
                  className="min-h-11 rounded-[var(--radius-control)] px-2 text-[12px] text-platform-text-muted hover:text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
                >
                  {t("Dividir", "Split")}
                </button>
              )}
              {indice > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    aplicar(
                      () => unir(secoes, mostradas[indice - 1].id, secao.id, linhasPorPagina),
                      mostradas[indice - 1].id,
                    )
                  }
                  className="min-h-11 rounded-[var(--radius-control)] px-2 text-[12px] text-platform-text-muted hover:text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
                >
                  {t("Unir com a anterior", "Merge with previous")}
                </button>
              )}
              {indice > 0 && inicioDe(secao) !== null && (
                <button
                  type="button"
                  onClick={() =>
                    aplicar(
                      () =>
                        moverPagina(
                          secoes,
                          inicioDe(secao)!,
                          mostradas[indice - 1].id,
                          linhasPorPagina,
                        ),
                      mostradas[indice - 1].id,
                    )
                  }
                  className="min-h-11 rounded-[var(--radius-control)] px-2 text-[12px] text-platform-text-muted hover:text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
                >
                  {t("Mover 1ª página acima", "Move first page up")}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>

      {restantes > 0 && (
        <button
          type="button"
          onClick={() => setVisiveis((atual) => atual + LOTE)}
          className="mt-[var(--space-shell-4)] flex min-h-11 items-center rounded-[var(--radius-control)] border border-platform-border px-[var(--space-shell-4)] text-[14px] text-platform-text hover:border-platform-signal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
        >
          {t(`Carregar mais ${Math.min(LOTE, restantes)}`, `Load ${Math.min(LOTE, restantes)} more`)}
        </button>
      )}

      {filtradas.length === 0 && (
        <p className="mt-[var(--space-shell-4)] text-[13px] text-platform-text-muted">
          {t("Nenhuma seção corresponde à busca.", "No section matches the search.")}
        </p>
      )}
    </section>
  );
}
