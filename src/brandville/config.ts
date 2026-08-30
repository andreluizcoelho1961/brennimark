import type { CSSProperties } from "react";
import { generatedBrandvilleInstances } from "./instances/generated";
import { brandvilleInstanceDefinition as unconfiguredInstance } from "./instances/unconfigured";
import { platformAliasVars, platformCssVars } from "../platform/tokens";
import type { BrandvilleInstance } from "./types";

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

// O catálogo de utilidades saiu daqui para components/shell/navigation.ts: ele
// é da plataforma, e a seleção é da marca da requisição. Aqui ele dependia da
// instância global e da linguagem do manual.

export const activeDocsRegistry = [...brandvilleInstance.docs];

export function getActiveDocBySlug(slug: string) {
  return activeDocsRegistry.find((entry) => entry.slug === slug);
}
