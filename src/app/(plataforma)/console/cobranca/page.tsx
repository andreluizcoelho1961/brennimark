import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocaleProvider } from "@/platform/locale-client";
import { NavDoConsole } from "@/components/console/NavDoConsole";
import { PainelDeCobranca } from "@/components/console/PainelDeCobranca";

export const metadata = { title: "Cobrança · Console · Brennimark", robots: { index: false, follow: false } };

/**
 * A cobrança no Console (01/10/2026): assinaturas, planos, preços do Stripe e
 * o link de pagamento do piloto. Só a equipe; para os outros, "não encontrado".
 */
export default async function ConsoleCobrancaPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("sou_da_equipe_brennimark");
  if (data !== true) notFound();

  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg px-[var(--space-shell-5)] py-[var(--space-shell-6)]">
        <div className="mx-auto max-w-[76rem]">
          <p className="font-display text-xs font-black uppercase tracking-[0.24em] text-platform-text">Console da Brennimark</p>
          <h1 className="mt-3 font-display text-3xl font-black uppercase text-platform-text">Cobrança</h1>
          <p className="mt-3 max-w-[52rem] text-sm leading-relaxed text-platform-text-muted">
            Quem assina, o que cada plano inclui, os preços ligados ao Stripe e o link de pagamento para um cliente piloto. Toda
            mudança pede motivo e fica no registro da equipe.
          </p>
          <NavDoConsole atual="cobranca" />
          <div className="mt-8"><PainelDeCobranca /></div>
        </div>
      </main>
    </LocaleProvider>
  );
}
