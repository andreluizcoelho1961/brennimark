import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { EntradaNoTour } from "@/components/demonstracao/EntradaNoTour";

export async function generateMetadata() {
  const t = await getTranslations("demonstracao");
  return { title: t("metaTitulo"), robots: { index: false, follow: false } };
}

/**
 * A porta do tour de demonstração. Caminho exato em `caminhos-publicos.ts`: quem
 * chega aqui não tem conta. Passar sem sessão não é passar sem autorização — o
 * acesso só existe depois do captcha e do teto do dia, no servidor.
 */
export default async function PaginaDoTour() {
  // Quem já tem sessão (o visitante que voltou do site, ou quem tem conta) não preenche o formulário de
  // novo: um segundo cadastro daria outra cota de perguntas, e para quem tem conta trocaria a sessão.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/docs");

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-page-inline py-24">
      <EntradaNoTour />
    </main>
  );
}
