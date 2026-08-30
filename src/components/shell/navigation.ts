import type { BrandvilleUtilityKey } from "../../brandville/types";
import type { ProductLocale } from "../../platform/locale";
import { can, type BrandCapability } from "../../platform/capabilities";

export interface ShellDestination {
  href: string;
  label: string;
  /** Capacidade necessária para o destino existir. Ausente = basta consultar. */
  requires?: BrandCapability;
  /** Aparece na navegação inferior do mobile. */
  mobile?: boolean;
}

export interface ShellSection {
  id: string;
  label: string;
  destinations: ShellDestination[];
}

/**
 * O catálogo das funcionalidades é da PLATAFORMA: rota e rótulo são do
 * produto, e o rótulo fala o idioma da interface.
 *
 * Quais delas existem é da MARCA. Uma conta pode ter contratado o assistente e
 * não a análise de peças, e essa escolha é da instalação, não do produto.
 *
 * A seleção vinha de `brandvilleUtilityLinks`, que lia a instância global — e
 * a instância global é `unconfigured`, com zero utilidades. A seção
 * "Inteligência" ficava permanentemente vazia, e a promoção da V2 levou esse
 * fio junto.
 */
const CATALOGO_DE_UTILIDADES: Record<
  BrandvilleUtilityKey,
  { href: string; pt: string; en: string }
> = {
  chat: { href: "/docs/chat", pt: "Chat da marca", en: "Brand assistant" },
  analysis: { href: "/docs/analise", pt: "Análise de aplicações", en: "Application review" },
  history: { href: "/docs/historico", pt: "Histórico e calibração", en: "History & calibration" },
  "ai-settings": {
    href: "/docs/configuracoes/ia",
    pt: "Configurações — Conecte sua IA",
    en: "AI settings",
  },
};



/**
 * Fonte única dos destinos globais, separada da apresentação.
 *
 * A V1 montava esta lista dentro do componente de navegação, misturada com
 * estado de UI. Aqui ela é dado: o shell V2 e o mobile leem o mesmo módulo, e
 * a permissão é decidida antes de renderizar — um member nunca recebe link
 * que terminaria em 403.
 */
export function shellSections({
  capabilities,
  locale,
  utilityLinks = [],
}: {
  capabilities: readonly BrandCapability[];
  /** Idioma da INTERFACE. Os destinos da moldura são do produto; o manual pode
   *  estar em outra língua sem que a navegação mude. */
  locale: ProductLocale;
  /** As funcionalidades desta MARCA, vindas da requisição. Ausente = nenhuma,
   *  que é o estado de quem ainda não tem marca. */
  utilityLinks?: readonly BrandvilleUtilityKey[];
}): ShellSection[] {
  const t = (pt: string, en: string) => (locale === "en" ? en : pt);
  const utilities = utilityLinks
    .map((chave) => CATALOGO_DE_UTILIDADES[chave])
    .filter(Boolean)
    .map((item) => ({ href: item.href, label: locale === "en" ? item.en : item.pt }));

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
        { href: "/docs/admin", label: t("Administração", "Administration"), requires: "administrar" },
      ],
    },
  ];

  return sections
    .map((section) => ({
      ...section,
      // O destino não existe quando falta a capacidade. Não é botão desabilitado:
      // quem consulta não vê sinal de que há uma superfície de edição.
      destinations: section.destinations.filter((d) => can(capabilities, d.requires ?? "consultar")),
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
