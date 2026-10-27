import { getTranslations } from "next-intl/server";
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
export default function PaginaDoTour() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-page-inline py-24">
      <EntradaNoTour />
    </main>
  );
}
