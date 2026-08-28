import type { CSSProperties } from "react";
import { exampleInstance } from "./instances/example";
import { generatedBrandvilleInstances } from "./instances/generated";
import { theBluesMakerInstance } from "./instances/the-bluesmaker";
import { platformTheme } from "../platform/identity";
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

/**
 * Mapeia uma paleta para as variáveis CSS que os componentes já consomem.
 * O mesmo componente usa `bg-surface-primary` na moldura e no conteúdo; o que
 * muda é o escopo em que a variável foi definida.
 */
function toThemeStyle(theme: {
  background: string; backgroundSecondary: string; surface: string; surfaceLight: string;
  foreground: string; muted: string; accent: string; accentSecondary: string;
  border: string; focus: string; fontStack?: string;
}): CSSProperties {
  return {
    "--color-primitive-black": theme.background,
    "--color-primitive-white": theme.foreground,
    "--color-primitive-gray": theme.muted,
    "--color-primitive-cyan": theme.focus,
    "--color-primitive-turquoise": theme.accent,
    "--color-primitive-blue": theme.accentSecondary,
    "--color-release-analog-black": theme.background,
    "--color-release-analog-white": theme.foreground,
    "--color-release-analog-turquoise": theme.accent,
    "--color-release-analog-blue": theme.accentSecondary,
    "--color-background-primary": theme.background,
    "--color-background-secondary": theme.backgroundSecondary,
    "--color-surface-primary": theme.surface,
    "--color-surface-light": theme.surfaceLight,
    "--color-text-primary": theme.foreground,
    "--color-text-secondary": theme.muted,
    "--color-text-inverse": theme.background,
    "--color-accent-primary": theme.accent,
    "--color-accent-secondary": theme.accentSecondary,
    "--color-border-default": theme.border,
    "--color-border-strong": theme.foreground,
    "--color-focus-ring": theme.focus,
    ...(theme.fontStack ? { "--font-brand": theme.fontStack } : {}),
  } as CSSProperties;
}

/** Moldura do produto: login, navegação, administração, configurações, rodapé. */
export const platformThemeStyle = toThemeStyle(platformTheme);

/** Conteúdo da marca: páginas do manual, blocos, galerias. Escopo do BrandCanvas. */
export const brandThemeStyle = toThemeStyle(brandvilleInstance.theme);

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
