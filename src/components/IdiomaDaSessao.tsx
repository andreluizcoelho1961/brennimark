import { LocaleProvider } from "@/platform/locale-client";
import { idiomaDaSessao } from "@/lib/idioma-da-sessao";

/**
 * Entrega o idioma da interface às telas que ficam fora da moldura da conta —
 * login, onboarding, recuperação de senha. Dentro da moldura quem entrega é
 * `MolduraDaConta`.
 */
export async function IdiomaDaSessao({ children }: { children: React.ReactNode }) {
  return <LocaleProvider locale={await idiomaDaSessao()}>{children}</LocaleProvider>;
}
