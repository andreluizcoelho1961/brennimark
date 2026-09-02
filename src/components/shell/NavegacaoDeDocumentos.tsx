"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { DocPageEntry } from "@/content/docs";
import { useIsEnglish } from "@/platform/locale-client";
import { agruparDocumentos, recortarGrupo } from "./documentos";

/**
 * O manual, navegável.
 *
 * Antes esta peça não existia: a barra tinha "Visão geral" e as utilidades, e
 * um manual de 152 seções só era alcançável pela busca ou pela página de
 * entrada. Quem não sabia o nome exato do que procurava não chegava a lugar
 * nenhum.
 *
 * Paginada por grupo, não virtualizada — mesma decisão da prévia de
 * importação, e pelo mesmo motivo: virtualização caseira desmonta elementos
 * enquanto o teclado ou o leitor de tela ainda os usa.
 */
export function NavegacaoDeDocumentos({
  docs,
  base,
  onNavigate,
}: {
  docs: readonly DocPageEntry[];
  /** Prefixo da marca ativa: /w/<conta>/b/<marca>/docs */
  base: string;
  onNavigate?: () => void;
}) {
  const isEnglish = useIsEnglish();
  const t = (pt: string, en: string) => (isEnglish ? en : pt);
  const pathname = usePathname();
  const [expandidos, setExpandidos] = useState<ReadonlySet<string>>(new Set());

  if (docs.length === 0) return null;

  // O slug da página aberta sai da URL, e não de prop: a navegação existe em
  // dois lugares — barra e gaveta — e passar o slug por dois caminhos daria
  // duas chances de eles discordarem sobre onde a pessoa está.
  const prefixo = `${base}/`;
  const slugAtual = pathname.startsWith(prefixo)
    ? pathname.slice(prefixo.length)
    : undefined;

  const grupos = agruparDocumentos(docs);

  return (
    <nav aria-label={t("Páginas do manual", "Manual pages")} className="flex flex-col gap-[var(--space-shell-4)]">
      {grupos.map((grupo) => {
        const expandido = expandidos.has(grupo.nome);
        const { visiveis, restantes } = recortarGrupo(grupo, { expandido, slugAtual });

        return (
          <div key={grupo.nome} className="flex flex-col gap-[var(--space-shell-1)]">
            <h2 className="px-[var(--space-shell-3)] pb-[var(--space-shell-2)] text-[11px] font-medium tracking-[0.06em] text-platform-text-muted">
              {grupo.nome}
              {/* O total aparece quando nem tudo está na tela: sem ele, a
                  lista cortada é indistinguível de uma lista completa. */}
              {/* O espaço é do TEXTO, não da margem: um leitor de tela lê o
                  nome acessível, e "Aplicações(15)" sai colado. */}
              {restantes > 0 && <span className="font-normal"> ({grupo.total})</span>}
            </h2>

            <ul className="flex flex-col gap-[var(--space-shell-1)]">
              {visiveis.map((doc) => {
                const ativo = doc.slug === slugAtual;
                return (
                  <li key={doc.slug}>
                    <Link
                      href={`${base}/${doc.slug}`}
                      aria-current={ativo ? "page" : undefined}
                      data-doc-destino={doc.slug}
                      onClick={onNavigate}
                      className={`flex min-h-11 items-center rounded-[var(--radius-control)] px-[var(--space-shell-3)] text-[13px] transition-colors duration-[var(--motion-control)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus ${
                        ativo
                          ? "bg-platform-signal-soft font-medium text-platform-text"
                          : "font-normal text-platform-text-muted hover:bg-platform-panel hover:text-platform-text"
                      }`}
                    >
                      <span className="truncate">{doc.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {restantes > 0 && (
              <button
                type="button"
                onClick={() => setExpandidos((atual) => new Set(atual).add(grupo.nome))}
                className="mx-[var(--space-shell-3)] flex min-h-11 items-center text-left text-[12px] text-platform-text-muted hover:text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
              >
                {t(`Ver mais ${restantes}`, `Show ${restantes} more`)}
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}
