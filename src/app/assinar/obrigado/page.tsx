import Link from "next/link";

export const metadata = { title: "Pagamento enviado · Brennimark", robots: { index: false, follow: false } };

/**
 * A volta do checkout. Ela NÃO confirma nada: é um endereço que qualquer um
 * pode abrir. Quem confirma o pagamento e abre a conta é o webhook assinado
 * do Stripe (`/api/cobranca/stripe`). Por isso a página diz o que vem a
 * seguir, sem afirmar que a conta existe.
 */
export default function ObrigadoPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-page-inline py-24">
      <div className="w-full max-w-md" data-volta-do-pagamento>
        <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-platform-text">Brennimark</p>
        <h1 className="mt-3 font-display text-3xl font-black uppercase leading-[0.95] text-platform-text">Pagamento enviado</h1>
        <p className="mt-4 text-sm leading-relaxed text-platform-text-muted">
          Assim que o Stripe confirmar o pagamento, a sua conta é criada e você recebe as instruções de acesso no e-mail
          que informou. No cartão, isso leva segundos; no Pix, acontece quando o banco aprovar a autorização.
        </p>
        <p className="mt-8 border-t border-platform-border pt-6 text-xs text-platform-text-muted">
          Já tem acesso? <Link href="/login" className="underline">Entrar</Link>
        </p>
      </div>
    </main>
  );
}
