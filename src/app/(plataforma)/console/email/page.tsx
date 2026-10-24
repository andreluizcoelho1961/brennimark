import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocaleProvider } from "@/platform/locale-client";
import { NavDoConsole } from "@/components/console/NavDoConsole";
import { PainelDeEmail } from "@/components/console/PainelDeEmail";

export const metadata = { title: "E-mail · Console · Brennimark", robots: { index: false, follow: false } };

/**
 * O e-mail de marketing (22/10/2026): escolher a campanha, mandar um teste para
 * o seu e-mail e enviar aos poucos a quem aceitou, confirmou e não saiu. Só a
 * equipe; para os outros, "não encontrado".
 */
export default async function ConsoleEmailPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("sou_da_equipe_brennimark");
  if (data !== true) notFound();

  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg px-[var(--space-shell-5)] py-[var(--space-shell-6)]">
        <div className="mx-auto max-w-[76rem]">
          <p className="font-display text-xs font-black uppercase tracking-[0.24em] text-platform-text">Console da Brennimark</p>
          <h1 className="mt-3 font-display text-3xl font-black uppercase text-platform-text">E-mail</h1>
          <p className="mt-3 max-w-[52rem] text-sm leading-relaxed text-platform-text-muted">
            Campanhas para quem se cadastrou nas ferramentas gratuitas e confirmou o e-mail. Mande sempre um teste para você antes.
            Cada pessoa recebe cada campanha uma única vez, e toda rodada fica no registro da equipe, com motivo.
          </p>
          <NavDoConsole atual="email" />
          <div className="mt-8"><PainelDeEmail /></div>
        </div>
      </main>
    </LocaleProvider>
  );
}
