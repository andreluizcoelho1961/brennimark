import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { PainelDeIa } from "@/components/console/PainelDeIa";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada da IA da plataforma. O teste de navegador finge
 * `/api/console/ia`; quem pode mudar está provado no banco
 * (`scripts/prova-ia-da-plataforma.sh`).
 */
export default async function BancadaDaIaDaPlataforma() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg p-8"><PainelDeIa /></main>
    </LocaleProvider>
  );
}
