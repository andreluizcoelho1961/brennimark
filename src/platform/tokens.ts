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
  fontStackDisplay?: string;
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
    /*
     * SEMPRE declarado aqui, com valor LITERAL — nunca por indireção
     * `var(--font-brand)`. Achado ao testar: o `@theme` global já tentava
     * essa indireção (`--font-brand-display: var(--font-brand)`), e ela
     * "congelava" no valor de `--font-brand` NO MOMENTO em que
     * `--font-brand-display` foi declarado — no :root, antes de qualquer
     * marca existir — porque uma custom property só é recalculada onde é
     * REDECLARADA, não onde é usada. Resultado: toda marca herdava a
     * fonte de UI, não a de corpo dela mesma, mesmo com `fontStack`
     * corretamente aplicado ao lado. O mesmo motivo que `pair()` já evita
     * indireção para cor, agora vale para fonte também.
     */
    ...(theme.fontStackDisplay || theme.fontStack
      ? { "--font-brand-display": theme.fontStackDisplay || theme.fontStack }
      : {}),
  } as CSSProperties;
}

/*
 * Os aliases de compatibilidade foram removidos no V1.
 *
 * Eles apontavam o vocabulário legado — `--color-release-analog-*`,
 * `--color-background-primary` e companhia — para a plataforma ou para a
 * marca, conforme o escopo. Serviram para migrar sem quebrar tudo de uma vez,
 * e a última fase sempre foi removê-los.
 *
 * Enquanto existiam, um componente novo podia consumir o nome antigo e
 * funcionar. Funcionar é o problema: o vocabulário legado não dizia se aquela
 * cor era da moldura ou da marca, e essa é exatamente a distinção que o
 * produto precisa manter. Agora só há dois namespaces, e escolher entre eles
 * é obrigatório.
 */
