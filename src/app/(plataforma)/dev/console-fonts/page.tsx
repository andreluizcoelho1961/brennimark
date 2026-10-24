import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { PainelDeFonts } from "@/components/console/PainelDeFonts";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada das licenças do Fonts. O teste de navegador finge
 * `/api/console/fonts`; quem pode emitir está provado no banco
 * (`scripts/prova-licencas-do-fonts.sh`) e a assinatura, na suíte de unidade.
 */
export default async function BancadaDeFonts() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg p-8"><PainelDeFonts /></main>
    </LocaleProvider>
  );
}
