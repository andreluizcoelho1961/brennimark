import type { CSSProperties } from "react";
import { generatedBrandvilleInstances } from "./instances/generated";
import { brandvilleInstanceDefinition as unconfiguredInstance } from "./instances/unconfigured";
import { brandAliasVars, brandCssVars, platformAliasVars, platformCssVars } from "../platform/tokens";
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

export const brandvilleInstance = resolveBrandvilleInstance(process.env.NEXT_PUBLIC_BRANDVILLE_INSTANCE);

/** Verdadeiro enquanto nenhum manual tiver sido importado. */
export const hasBrand = brandvilleInstance.key !== "unconfigured";

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

/** Conteúdo da marca. Escopo do BrandCanvas, nunca do documento. */
export const brandThemeStyle = {
  ...brandCssVars(brandvilleInstance.theme),
  ...brandAliasVars(),
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

export const brandvilleUtilityLinks = brandvilleInstance.navigation.utilityLinks.map((key) => (brandvilleInstance.metadata.language === "en" ? utilityCatalogEn : utilityCatalog)[key]);
export const activeDocsRegistry = [...brandvilleInstance.docs];

export function getActiveDocBySlug(slug: string) {
  return activeDocsRegistry.find((entry) => entry.slug === slug);
}
