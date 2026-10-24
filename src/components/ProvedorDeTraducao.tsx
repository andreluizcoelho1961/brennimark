import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

/**
 * Entrega o idioma e os catálogos aos componentes de CLIENTE que usam
 * `useTranslations`. Componente de servidor não precisa dele: chama
 * `getTranslations` direto.
 *
 * O idioma vem de `src/i18n/request.ts`, que usa a mesma regra do resto da
 * interface (`idiomaDaSessao`). Hoje o catálogo inteiro vai ao navegador; quando
 * ele crescer, passe só os trechos de que a tela precisa.
 */
export async function ProvedorDeTraducao({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale={await getLocale()} messages={await getMessages()}>
      {children}
    </NextIntlClientProvider>
  );
}
