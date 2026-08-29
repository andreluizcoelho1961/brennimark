import type { CSSProperties } from "react";
import { generatedBrandvilleInstances } from "./instances/generated";
import { brandvilleInstanceDefinition as unconfiguredInstance } from "./instances/unconfigured";
import { platformAliasVars, platformCssVars } from "../platform/tokens";
import type { BrandvilleInstance, BrandvilleUtilityKey } from "./types";

export const brandvilleInstances = {
  unconfigured: unconfiguredInstance,
  ...generatedBrandvilleInstances,
} satisfies Record<string, BrandvilleInstance>;

export type BrandvilleInstanceKey = keyof typeof brandvilleInstances;

export function resolveBrandvilleInstance(key?: string): BrandvilleInstance {
  const requested = key || "unconfigured";
  const instance = brandvilleInstances[requested as BrandvilleInstanceKey];
  if (!instance) {
    throw new Error(`Instância Brandville desconhecida: ${requested}. Opções: ${Object.keys(brandvilleInstances).join(", ")}`);
  }
  return instance;
}

/**
 * COMPATIBILIDADE TEMPORÁRIA, não arquitetura.
 *
 * A marca ativa é resolvida por requisição, em
 * lib/brandville/workspace-context.ts. Este objeto sobrevive apenas para os
 * pontos ainda não migrados — microcópia por idioma (patch 3) e o caminho de
 * escrita da administração (patch 2) — e sai no patch 7, quando a marca passar
 * a ser escolhida em tempo de execução.
 *
 * Nenhum componente novo deve lê-lo como fonte da marca ativa. Ele é global
 * por processo: duas contas servidas pelo mesmo processo veriam a mesma marca.
 */
export const brandvilleInstance = resolveBrandvilleInstance(process.env.NEXT_PUBLIC_BRANDVILLE_INSTANCE);

/**
 * Duas camadas, dois namespaces.
 *
 * A moldura recebe `--platform-*` mais os aliases legados, no <html>. O canvas
 * recebe `--brand-*` e reaponta os aliases para a marca, no seu próprio escopo.
 * Assim um componente não migrado continua funcionando nos dois lados, e um
 * componente migrado escolhe explicitamente de qual camada quer a cor.
 */
export const platformThemeStyle = {
  ...platformCssVars(),
  ...platformAliasVars(),
} as CSSProperties;

const utilityCatalog: Record<BrandvilleUtilityKey, { href: string; code: string; label: string }> = {
  chat: { href: "/docs/chat", code: "CH", label: "Chat da marca" },
  analysis: { href: "/docs/analise", code: "AN", label: "Análise de aplicações" },
  history: { href: "/docs/historico", code: "HI", label: "Histórico e calibração" },
  "ai-settings": { href: "/docs/configuracoes/ia", code: "CF", label: "Configurações — Conecte sua IA" },
};

const utilityCatalogEn: Record<BrandvilleUtilityKey, { href: string; code: string; label: string }> = {
  chat: { href: "/docs/chat", code: "CH", label: "Brand assistant" },
  analysis: { href: "/docs/analise", code: "AN", label: "Application review" },
  history: { href: "/docs/historico", code: "HI", label: "History & calibration" },
  "ai-settings": { href: "/docs/configuracoes/ia", code: "CF", label: "AI settings" },
};

/**
 * Os destinos de utilidade da navegação, no idioma da INTERFACE.
 *
 * O rótulo "Chat da marca" é do produto, não do manual: um manual em inglês
 * não deve renomear a navegação de quem está lendo em português.
 */
export function brandvilleUtilityLinks(locale: string) {
  const catalogo = locale === "en" ? utilityCatalogEn : utilityCatalog;
  return brandvilleInstance.navigation.utilityLinks.map((key) => catalogo[key]);
}
export const activeDocsRegistry = [...brandvilleInstance.docs];

export function getActiveDocBySlug(slug: string) {
  return activeDocsRegistry.find((entry) => entry.slug === slug);
}
