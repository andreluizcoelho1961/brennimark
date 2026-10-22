import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocaleProvider } from "@/platform/locale-client";
import { NavDoConsole } from "@/components/console/NavDoConsole";
import { PainelDeFonts } from "@/components/console/PainelDeFonts";

export const metadata = { title: "Fonts · Console · Brennimark", robots: { index: false, follow: false } };

/**
 * As licenças do beta do Brennimark Fonts (16/10/2026): criar a licença,
 * ativar o computador do testador e gerar o certificado assinado. Só a equipe;
 * para os outros, "não encontrado".
 */
export default async function ConsoleFontsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("sou_da_equipe_brennimark");
  if (data !== true) notFound();

  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg px-[var(--space-shell-5)] py-[var(--space-shell-6)]">
        <div className="mx-auto max-w-[76rem]">
          <p className="font-display text-xs font-black uppercase tracking-[0.24em] text-platform-text">Console da Brennimark</p>
          <h1 className="mt-3 font-display text-3xl font-black uppercase text-platform-text">Fonts</h1>
          <p className="mt-3 max-w-[52rem] text-sm leading-relaxed text-platform-text-muted">
            Licenças do beta do Brennimark Fonts. Crie a licença, receba do testador o código do computador (tela Sobre do aplicativo)
            e gere o certificado. Toda ação pede motivo e fica no registro da equipe.
          </p>
          <NavDoConsole atual="fonts" />
          <div className="mt-8"><PainelDeFonts /></div>
        </div>
      </main>
    </LocaleProvider>
  );
}
