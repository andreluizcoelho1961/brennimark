"use client";

import { createContext, useContext, useEffect } from "react";
import { PRODUCT_LOCALE, type ProductLocale } from "./locale";

/**
 * O idioma da interface para os componentes de cliente.
 *
 * Alternativa descartada: passar `locale` por propriedade até o último botão.
 * A moldura tem sete níveis, e uma propriedade esquecida no meio do caminho
 * volta silenciosamente ao padrão — que é justamente o tipo de defeito que
 * não aparece em português e aparece para o primeiro cliente em inglês.
 *
 * Sem provedor, o valor é o padrão do produto. Telas fora da sessão — login,
 * onboarding — funcionam assim.
 */
const LocaleContext = createContext<ProductLocale>(PRODUCT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: ProductLocale;
  children: React.ReactNode;
}) {
  // O layout raiz é estático (fixo em pt-BR) para não tornar dinâmico o site público;
  // dentro da plataforma o `lang` do documento acompanha o idioma da interface.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): ProductLocale {
  return useContext(LocaleContext);
}

/** Mesmo açúcar de locale.ts, para quem já está num componente de cliente. */
export function useIsEnglish(): boolean {
  return useContext(LocaleContext) === "en";
}
