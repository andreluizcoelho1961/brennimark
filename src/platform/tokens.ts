import type { CSSProperties } from "react";
import { platformTheme } from "./identity";

type PlatformTheme = typeof platformTheme;

export interface BrandThemeInput {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceLight: string;
  foreground: string;
  muted: string;
  accent: string;
  accentSecondary: string;
  border: string;
  focus: string;
  fontStack?: string;
}

/**
 * Namespaces explícitos, em vez de sombreamento implícito das mesmas variáveis.
 *
 * O motivo é concreto: com sombreamento, um componente dentro do canvas não
 * consegue pedir cor de plataforma — não existe token a que ele se refira. Era
 * exatamente o que o selo de status precisava fazer e não conseguia.
 *
 * Cada mapa emite o par `--x` e `--color-x` a partir do MESMO valor literal, e
 * nunca por indireção do tipo `--color-x: var(--x)`. Uma custom property é
 * resolvida onde é declarada: a indireção declarada no :root congelaria o valor
 * antes de o escopo da marca existir.
 */
function pair(prefix: "platform" | "brand", name: string, value: string) {
  return { [`--${prefix}-${name}`]: value, [`--color-${prefix}-${name}`]: value };
}

export function platformCssVars(theme: PlatformTheme = platformTheme): CSSProperties {
  return {
    ...pair("platform", "bg", theme.bg),
    ...pair("platform", "panel", theme.panel),
    ...pair("platform", "panel-muted", theme.panelMuted),
    ...pair("platform", "text", theme.text),
    ...pair("platform", "text-muted", theme.textMuted),
    ...pair("platform", "border", theme.border),
    ...pair("platform", "signal", theme.signal),
    ...pair("platform", "signal-soft", theme.signalSoft),
    ...pair("platform", "focus", theme.focus),
    ...pair("platform", "success", theme.success),
    ...pair("platform", "warning", theme.warning),
    ...pair("platform", "danger", theme.danger),
  } as CSSProperties;
}

export function brandCssVars(theme: BrandThemeInput): CSSProperties {
  return {
    ...pair("brand", "bg", theme.background),
    ...pair("brand", "bg-secondary", theme.backgroundSecondary),
    ...pair("brand", "surface", theme.surface),
    ...pair("brand", "surface-light", theme.surfaceLight),
    ...pair("brand", "text", theme.foreground),
    ...pair("brand", "text-muted", theme.muted),
    ...pair("brand", "accent", theme.accent),
    ...pair("brand", "accent-secondary", theme.accentSecondary),
    ...pair("brand", "border", theme.border),
    // Só para elementos editoriais internos. Controles globais usam o foco da plataforma.
    ...pair("brand", "focus", theme.focus),
    ...(theme.fontStack ? { "--font-brand": theme.fontStack } : {}),
  } as CSSProperties;
}

/**
 * Aliases de compatibilidade. Os componentes ainda não migrados consomem
 * `--color-*` legado; enquanto existirem, estes aliases os apontam para a
 * plataforma. Removê-los é a última fase, quando um grep provar que não há uso.
 */
export function platformAliasVars(): CSSProperties {
  return {
    "--color-primitive-black": "var(--platform-bg)",
    "--color-primitive-white": "var(--platform-text)",
    "--color-primitive-gray": "var(--platform-text-muted)",
    "--color-primitive-cyan": "var(--platform-focus)",
    "--color-primitive-turquoise": "var(--platform-signal)",
    "--color-primitive-blue": "var(--platform-signal)",
    "--color-release-analog-black": "var(--platform-bg)",
    "--color-release-analog-white": "var(--platform-text)",
    "--color-release-analog-turquoise": "var(--platform-signal)",
    "--color-release-analog-blue": "var(--platform-signal)",
    "--color-background-primary": "var(--platform-bg)",
    "--color-background-secondary": "var(--platform-bg)",
    "--color-surface-primary": "var(--platform-panel)",
    "--color-surface-light": "var(--platform-panel-muted)",
    "--color-text-primary": "var(--platform-text)",
    "--color-text-secondary": "var(--platform-text-muted)",
    "--color-text-inverse": "var(--platform-bg)",
    "--color-accent-primary": "var(--platform-signal)",
    "--color-accent-secondary": "var(--platform-signal)",
    "--color-border-default": "var(--platform-border)",
    "--color-border-strong": "var(--platform-text)",
    "--color-focus-ring": "var(--platform-focus)",
  } as CSSProperties;
}

/**
 * Aliases legados dentro do canvas: apontam para a marca, para que componentes
 * do guide ainda não migrados vistam a marca como sempre vestiram.
 */
export function brandAliasVars(): CSSProperties {
  return {
    "--color-primitive-black": "var(--brand-bg)",
    "--color-primitive-white": "var(--brand-text)",
    "--color-primitive-gray": "var(--brand-text-muted)",
    "--color-primitive-cyan": "var(--brand-focus)",
    "--color-primitive-turquoise": "var(--brand-accent)",
    "--color-primitive-blue": "var(--brand-accent-secondary)",
    "--color-release-analog-black": "var(--brand-bg)",
    "--color-release-analog-white": "var(--brand-text)",
    "--color-release-analog-turquoise": "var(--brand-accent)",
    "--color-release-analog-blue": "var(--brand-accent-secondary)",
    "--color-background-primary": "var(--brand-bg)",
    "--color-background-secondary": "var(--brand-bg-secondary)",
    "--color-surface-primary": "var(--brand-surface)",
    "--color-surface-light": "var(--brand-surface-light)",
    "--color-text-primary": "var(--brand-text)",
    "--color-text-secondary": "var(--brand-text-muted)",
    "--color-text-inverse": "var(--brand-bg)",
    "--color-accent-primary": "var(--brand-accent)",
    "--color-accent-secondary": "var(--brand-accent-secondary)",
    "--color-border-default": "var(--brand-border)",
    "--color-border-strong": "var(--brand-text)",
    "--color-focus-ring": "var(--brand-focus)",
  } as CSSProperties;
}
