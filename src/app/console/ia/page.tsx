import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocaleProvider } from "@/platform/locale-client";
import { NavDoConsole } from "@/components/console/NavDoConsole";
import { PainelDeIa } from "@/components/console/PainelDeIa";

export const metadata = { title: "IA e limites · Console · Brennimark", robots: { index: false, follow: false } };

/**
 * A IA da plataforma e os limites de cada conta — etapa 2 do Console
 * (29/09/2026). Só a equipe; para os outros, "não encontrado".
 */
export default async function ConsoleIaPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("sou_da_equipe_brennimark");
  if (data !== true) notFound();

  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg px-[var(--space-shell-5)] py-[var(--space-shell-6)]">
        <div className="mx-auto max-w-[76rem]">
          <p className="font-display text-xs font-black uppercase tracking-[0.24em] text-platform-text">Console da Brennimark</p>
          <h1 className="mt-3 font-display text-3xl font-black uppercase text-platform-text">IA e limites</h1>
          <p className="mt-3 max-w-[52rem] text-sm leading-relaxed text-platform-text-muted">
            Os modelos que movem o Vini para todas as contas, e o teto de gasto de cada uma. Toda mudança pede motivo e fica no
            registro da equipe.
          </p>
          <NavDoConsole atual="ia" />
          <div className="mt-8"><PainelDeIa /></div>
        </div>
      </main>
    </LocaleProvider>
  );
}
