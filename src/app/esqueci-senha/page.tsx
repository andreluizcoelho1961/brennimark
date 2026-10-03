import { PedidoDeNovaSenha } from "@/components/acesso/PedidoDeNovaSenha";

export const metadata = { title: "Esqueci a senha · Brennimark", robots: { index: false, follow: false } };

export default function PaginaEsqueciASenha() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-page-inline py-24">
      <PedidoDeNovaSenha />
    </main>
  );
}
