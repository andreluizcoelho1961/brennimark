import { getTranslations } from "next-intl/server";
import { PedidoDeNovaSenha } from "@/components/acesso/PedidoDeNovaSenha";

export async function generateMetadata() {
  const t = await getTranslations("cadastroPublico.esqueciSenha");
  return { title: t("metaTitulo"), robots: { index: false, follow: false } };
}

export default function PaginaEsqueciASenha() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-page-inline py-24">
      <PedidoDeNovaSenha />
    </main>
  );
}
