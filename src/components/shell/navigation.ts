import { brandvilleInstance, brandvilleUtilityLinks } from "@/brandville/config";

export type ShellRole = "owner" | "member";

export interface ShellDestination {
  href: string;
  label: string;
  /** Menor papel que enxerga o destino. Ausente = todos. */
  requires?: ShellRole;
  /** Aparece na navegação inferior do mobile. */
  mobile?: boolean;
}

export interface ShellSection {
  id: string;
  label: string;
  destinations: ShellDestination[];
}

const isEnglish = brandvilleInstance.metadata.language === "en";
const t = (pt: string, en: string) => (isEnglish ? en : pt);

/**
 * Fonte única dos destinos globais, separada da apresentação.
 *
 * A V1 montava esta lista dentro do componente de navegação, misturada com
 * estado de UI. Aqui ela é dado: o shell V2 e o mobile leem o mesmo módulo, e
 * a permissão é decidida antes de renderizar — um member nunca recebe link
 * que terminaria em 403.
 */
export function shellSections({ role }: { role: ShellRole }): ShellSection[] {
  const utilities = brandvilleUtilityLinks.map((link) => ({ href: link.href, label: link.label }));

  const sections: ShellSection[] = [
    {
      id: "guide",
      label: t("Guia", "Guide"),
      destinations: [{ href: "/docs", label: t("Visão geral", "Overview"), mobile: true }],
    },
    {
      id: "library",
      label: t("Acervo", "Library"),
      destinations: [
        { href: "/docs/biblioteca", label: t("Biblioteca de assets", "Asset library"), mobile: true },
      ],
    },
    {
      id: "intelligence",
      label: t("Inteligência", "Intelligence"),
      destinations: utilities,
    },
    {
      id: "governance",
      label: t("Governança", "Governance"),
      destinations: [
        { href: "/docs/admin", label: t("Administração", "Administration"), requires: "owner" },
      ],
    },
  ];

  return sections
    .map((section) => ({
      ...section,
      destinations: section.destinations.filter((d) => !d.requires || d.requires === role),
    }))
    .filter((section) => section.destinations.length > 0);
}

/** Ativo considerando rotas filhas: /docs/historico/42 acende /docs/historico. */
export function isDestinationActive(href: string, pathname: string): boolean {
  if (href === "/docs") return pathname === "/docs" || !pathname.startsWith("/docs/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Reescreve um destino para outro prefixo. Sem prefixo, devolve o original. */
export function withBase(href: string, basePath?: string): string {
  if (!basePath) return href;
  return href.replace(/^\/docs/, basePath);
}
