import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocaleProvider } from "@/platform/locale-client";
import { PainelDeCustos } from "@/components/console/PainelDeCustos";

export const metadata = { title: "Console · Brennimark", robots: { index: false, follow: false } };

/**
 * O Console da Brennimark — só a EQUIPE (28/09/2026).
 *
 * Fora de qualquer conta de cliente, de propósito: a Brennimark opera a
 * plataforma, não trabalha dentro das marcas. Quem não está na equipe recebe
 * "não encontrado" — o mesmo de um endereço que nunca existiu. A decisão é do
 * banco (`sou_da_equipe_brennimark`); a tela só obedece.
 */
export default async function ConsolePage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("sou_da_equipe_brennimark");
  if (data !== true) notFound();

  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg px-[var(--space-shell-5)] py-[var(--space-shell-6)]">
        <div className="mx-auto max-w-[76rem]">
          <p className="font-display text-xs font-black uppercase tracking-[0.24em] text-platform-text">Console da Brennimark</p>
          <h1 className="mt-3 font-display text-3xl font-black uppercase text-platform-text">Custos</h1>
          <p className="mt-3 max-w-[52rem] text-sm leading-relaxed text-platform-text-muted">
            Quanto cada conta e cada marca consome: IA e armazenamento, por mês. Só a equipe da Brennimark vê esta
            tela, e ela só lê — nada aqui muda a conta de um cliente.
          </p>
          <div className="mt-8"><PainelDeCustos /></div>
        </div>
      </main>
    </LocaleProvider>
  );
}
