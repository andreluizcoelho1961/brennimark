import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { PainelDeCobranca } from "@/components/console/PainelDeCobranca";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada da cobrança no Console. O teste de navegador finge
 * `/api/console/cobranca`; quem pode ajustar planos e preços está provado no
 * banco (`scripts/prova-cobranca.sh`, parte 6).
 */
export default async function BancadaDaCobranca() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg p-8"><PainelDeCobranca /></main>
    </LocaleProvider>
  );
}
