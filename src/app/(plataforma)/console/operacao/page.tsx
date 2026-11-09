import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocaleProvider } from "@/platform/locale-client";
import { NavDoConsole } from "@/components/console/NavDoConsole";
import { PainelDeOperacao } from "@/components/console/PainelDeOperacao";

export const metadata = { title: "Operação · Console · Brennimark", robots: { index: false, follow: false } };

/**
 * A operação — etapa 3 do Console (30/09/2026): a trava geral, as contas, a
 * ficha de cada uma e as pausas. Só a equipe; para os outros, "não encontrado".
 */
export default async function ConsoleOperacaoPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("sou_da_equipe_brennimark");
  if (data !== true) notFound();

  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg px-[var(--space-shell-5)] py-[var(--space-shell-6)]">
        <div className="mx-auto max-w-[76rem]">
          <p className="font-display text-xs font-black uppercase tracking-[0.24em] text-platform-text">Console da Brennimark</p>
          <h1 className="mt-3 font-display text-3xl font-black uppercase text-platform-text">Operação</h1>
          <p className="mt-3 max-w-[52rem] text-sm leading-relaxed text-platform-text-muted">
            Pausar e retomar o Vini — em todas as contas, numa conta ou numa marca — e a ficha de cada conta para o suporte. Toda
            ação pede motivo e fica no registro da equipe.
          </p>
          <NavDoConsole atual="operacao" />
          <div className="mt-8"><PainelDeOperacao /></div>
        </div>
      </main>
    </LocaleProvider>
  );
}
