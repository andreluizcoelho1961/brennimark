import { SenhaNaVolta } from "@/components/cobranca/SenhaNaVolta";
import { sessaoValida } from "@/lib/cobranca/senha-na-volta";

export const metadata = { title: "Pagamento enviado · Brennimark", robots: { index: false, follow: false } };

/**
 * A volta do checkout. O endereço, sozinho, NÃO confirma nada: qualquer um
 * pode abri-lo. Quem confirma o pagamento e abre a conta é o webhook assinado
 * do Stripe (`/api/cobranca/stripe`), e quem decide se a senha pode ser criada
 * aqui é `/api/cobranca/senha`, pela prova do navegador
 * (`@/lib/cobranca/senha-na-volta`).
 */
export default async function ObrigadoPage({ searchParams }: { searchParams: Promise<{ sessao?: string | string[] }> }) {
  const { sessao } = await searchParams;
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-page-inline py-24">
      <SenhaNaVolta sessao={sessaoValida(sessao) ? sessao : null} />
    </main>
  );
}
