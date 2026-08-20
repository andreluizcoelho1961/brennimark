import type { CSSProperties } from "react";
import { exampleInstance } from "./instances/example";
import { generatedBrandvilleInstances } from "./instances/generated";
import { theBluesMakerInstance } from "./instances/the-bluesmaker";
import type { BrandvilleInstance, BrandvilleUtilityKey } from "./types";

export const brandvilleInstances = {
  "the-bluesmaker": theBluesMakerInstance,
  example: exampleInstance,
  ...generatedBrandvilleInstances,
} satisfies Record<string, BrandvilleInstance>;

export type BrandvilleInstanceKey = keyof typeof brandvilleInstances;

export function resolveBrandvilleInstance(key?: string): BrandvilleInstance {
  const requested = key || "the-bluesmaker";
  const instance = brandvilleInstances[requested as BrandvilleInstanceKey];
  if (!instance) {
    throw new Error(`Instância Brandville desconhecida: ${requested}. Opções: ${Object.keys(brandvilleInstances).join(", ")}`);
  }
  return instance;
}

export const brandvilleInstance = resolveBrandvilleInstance(process.env.NEXT_PUBLIC_BRANDVILLE_INSTANCE);

export const brandvilleThemeStyle = {
  "--color-primitive-black": brandvilleInstance.theme.background,
  "--color-primitive-white": brandvilleInstance.theme.foreground,
  "--color-primitive-gray": brandvilleInstance.theme.muted,
  "--color-primitive-cyan": brandvilleInstance.theme.focus,
  "--color-primitive-turquoise": brandvilleInstance.theme.accent,
  "--color-primitive-blue": brandvilleInstance.theme.accentSecondary,
  "--color-release-analog-black": brandvilleInstance.theme.background,
  "--color-release-analog-white": brandvilleInstance.theme.foreground,
  "--color-release-analog-turquoise": brandvilleInstance.theme.accent,
  "--color-release-analog-blue": brandvilleInstance.theme.accentSecondary,
  "--color-background-primary": brandvilleInstance.theme.background,
  "--color-background-secondary": brandvilleInstance.theme.backgroundSecondary,
  "--color-surface-primary": brandvilleInstance.theme.surface,
  "--color-surface-light": brandvilleInstance.theme.surfaceLight,
  "--color-text-primary": brandvilleInstance.theme.foreground,
  "--color-text-secondary": brandvilleInstance.theme.muted,
  "--color-text-inverse": brandvilleInstance.theme.background,
  "--color-accent-primary": brandvilleInstance.theme.accent,
  "--color-accent-secondary": brandvilleInstance.theme.accentSecondary,
  "--color-border-default": brandvilleInstance.theme.border,
  "--color-border-strong": brandvilleInstance.theme.foreground,
  "--color-focus-ring": brandvilleInstance.theme.focus,
  "--brand-font-display": brandvilleInstance.theme.fontStack,
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
