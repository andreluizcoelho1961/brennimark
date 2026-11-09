import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { PainelDeEmail } from "@/components/console/PainelDeEmail";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada do e-mail de marketing. O teste de navegador finge
 * `/api/console/email`; quem pode enviar, quem recebe e o "uma vez só" estão
 * provados no banco (`scripts/prova-envios-de-email.sh`).
 */
export default async function BancadaDeEmail() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg p-8"><PainelDeEmail /></main>
    </LocaleProvider>
  );
}
