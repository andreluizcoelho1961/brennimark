"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsEnglish } from "@/platform/locale-client";
import { buildSearchIndex, searchIndex, type SearchResult } from "@/lib/search";
import { withBase } from "./navigation";
import type { DocPageEntry } from "@/content/docs";
import { STATUS_CLASSES, resolveStatusLabels, type StatusLabels } from "@/components/docs/status";

/**
 * Busca da plataforma.
 *
 * O teclado é a interface principal aqui: quem trabalha em ferramenta de design
 * vive de atalho, e percebe em segundos se a seleção é fluida, se Enter faz o
 * óbvio e se o foco volta para onde estava.
 *
 * Cada resultado mostra POR QUE apareceu — o trecho que casou — e, quando é
 * diretriz, em que estado editorial ela está. Numa ferramenta de marca, citar
 * uma regra sem dizer que ela é rascunho é pior do que não responder.
 */
export function CommandPalette({
  docs,
  destinations,
  basePath,
  brandLanguage,
  statusLabels,
  onClose,
}: {
  docs: readonly DocPageEntry[];
  destinations: readonly { href: string; label: string }[];
  basePath?: string;
  brandLanguage?: string;
  statusLabels?: StatusLabels;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const restoreFocusTo = useRef<Element | null>(null);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const isEnglish = useIsEnglish();
  const t = (pt: string, en: string) => (isEnglish ? en : pt);
  // O vocabulário editorial é da marca, não da interface: ver StatusBadge.
  const labels = resolveStatusLabels({ language: brandLanguage ?? "pt-BR", override: statusLabels });

  const index = useMemo(() => buildSearchIndex({ docs, destinations }), [docs, destinations]);
  const results = useMemo(() => searchIndex(index, query).slice(0, 12), [index, query]);

  // Reset derivado durante a renderização, não em efeito: é o padrão que o
  // React recomenda para estado que depende de outro, e evita a renderização
  // em cascata que um efeito provocaria a cada tecla.
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setCursor(0);
  }

  // O componente só existe enquanto a busca está aberta. Montar e desmontar,
  // em vez de esconder, garante campo limpo a cada ⌘K — e é o que faz o foco
  // voltar corretamente para quem abriu.
  useEffect(() => {
    restoreFocusTo.current = document.activeElement;
    inputRef.current?.focus();
    return () => {
      // O foco volta para quem abriu, não para o topo do documento.
      (restoreFocusTo.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  const go = useCallback(
    (result: SearchResult) => {
      onClose();
      router.push(withBase(result.href, basePath));
    },
    [basePath, onClose, router],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      const next = event.key === "ArrowDown" ? cursor + 1 : cursor - 1;
      const wrapped = (next + results.length) % results.length;
      setCursor(wrapped);
      listRef.current?.children[wrapped]?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.key === "Enter" && results[cursor]) {
      event.preventDefault();
      go(results[cursor]);
    }
    if (event.key === "Tab") {
      // Enquanto aberto, o foco não escapa: só existe um campo aqui.
      event.preventDefault();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-scrim pt-[12vh]">
      <button
        type="button"
        aria-label={t("Fechar busca", "Close search")}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Buscar no manual", "Search the guide")}
        onKeyDown={onKeyDown}
        className="relative flex max-h-[70vh] w-full max-w-[38rem] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-platform-border bg-platform-panel shadow-[var(--shadow-panel)]"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          role="combobox"
          aria-expanded
          aria-controls="palette-results"
          aria-activedescendant={results[cursor] ? `palette-${cursor}` : undefined}
          placeholder={t("Buscar diretriz, cor, regra…", "Search guideline, colour, rule…")}
          className="h-12 flex-none border-b border-platform-border bg-transparent px-[var(--space-shell-4)] text-[15px] text-platform-text outline-none placeholder:text-platform-text-muted"
        />

        {query.trim() && results.length === 0 && (
          <p className="px-[var(--space-shell-4)] py-[var(--space-shell-5)] text-[13px] text-platform-text-muted">
            {t("Nada encontrado para", "No results for")} “{query.trim()}”.{" "}
            {t(
              "A busca só devolve o que está no material documentado.",
              "Search only returns what the documented material contains.",
            )}
          </p>
        )}

        {!query.trim() && (
          <p className="px-[var(--space-shell-4)] py-[var(--space-shell-5)] text-[13px] leading-relaxed text-platform-text-muted">
            {t(
              "Procure por um título, um grupo, um valor de cor ou o texto de uma regra. O resultado mostra o trecho que casou e o estado editorial dele.",
              "Search a title, a group, a colour value or the text of a rule. Each result shows the matching passage and its editorial status.",
            )}
          </p>
        )}

        <ul id="palette-results" ref={listRef} role="listbox" className="min-h-0 flex-1 overflow-y-auto py-[var(--space-shell-2)]">
          {results.map((result, i) => (
            <li key={result.href} id={`palette-${i}`} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(result)}
                className={`flex w-full flex-col gap-[var(--space-shell-1)] px-[var(--space-shell-4)] py-[var(--space-shell-3)] text-left transition-colors duration-[var(--motion-control)] ${
                  i === cursor ? "bg-platform-signal-soft" : ""
                }`}
              >
                <span className="flex items-center gap-[var(--space-shell-2)]">
                  <span className="truncate text-[14px] font-medium text-platform-text">{result.title}</span>
                  {result.status && (
                    <span
                      className={`flex-none rounded-[var(--radius-control)] border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_CLASSES[result.status]}`}
                    >
                      {labels[result.status]}
                    </span>
                  )}
                </span>
                <span className="truncate text-[12px] text-platform-text-muted">{result.excerpt}</span>
              </button>
            </li>
          ))}
        </ul>

        <footer className="flex flex-none items-center gap-[var(--space-shell-4)] border-t border-platform-border px-[var(--space-shell-4)] py-[var(--space-shell-2)] text-[11px] text-platform-text-muted">
          <span>↑↓ {t("navegar", "navigate")}</span>
          <span>↵ {t("abrir", "open")}</span>
          <span>esc {t("fechar", "close")}</span>
        </footer>
      </div>
    </div>
  );
}
