import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { Configuracoes } from "@/components/configuracoes/Configuracoes";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada de Configurações. A tela real exige sessão e conta; o teste de
 * navegador finge `/api/configuracoes/consumo` e exercita o componente — mês,
 * tetos, pausas e a tabela por marca. Quem lê o quê está provado no banco
 * (`scripts/prova-consumo-da-conta.sh`).
 */
export default async function BancadaDeConfiguracoes() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg p-8">
        <Configuracoes />
      </main>
    </LocaleProvider>
  );
}
