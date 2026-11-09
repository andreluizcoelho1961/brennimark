import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { PainelDeOperacao } from "@/components/console/PainelDeOperacao";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada da operação do Console. O teste de navegador finge
 * `/api/console/operacao`; quem pode pausar está provado no banco
 * (`scripts/prova-operacao-do-console.sh`).
 */
export default async function BancadaDaOperacao() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg p-8"><PainelDeOperacao /></main>
    </LocaleProvider>
  );
}
