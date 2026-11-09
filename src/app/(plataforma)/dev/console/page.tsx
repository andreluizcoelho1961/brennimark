import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { PainelDeCustos } from "@/components/console/PainelDeCustos";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada do painel de custos. O teste de navegador finge
 * `/api/console/custos`; quem pode ler está provado no banco
 * (`scripts/prova-console-da-brennimark.sh`).
 */
export default async function BancadaDoConsole() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg p-8"><PainelDeCustos /></main>
    </LocaleProvider>
  );
}
