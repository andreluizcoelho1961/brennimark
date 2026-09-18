import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { TrocaDeSenha } from "@/components/pessoas/TrocaDeSenha";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada da troca de senha.
 *
 * A tela real lê o prazo da sessão, e a suíte de navegador roda sem banco. Aqui
 * o prazo vem do endereço (`?vencida=1`), e o teste finge
 * `/api/conta/trocar-senha` — o que se exercita é o componente de produção.
 */
export default async function BancadaDaTrocaDeSenha({
  searchParams,
}: { searchParams: Promise<{ vencida?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { vencida } = await searchParams;
  const validaAte = vencida ? "2026-09-15T12:00:00.000Z" : "2099-09-21T12:00:00.000Z";
  return (
    <LocaleProvider locale="pt-BR">
      <main className="flex min-h-dvh items-center justify-center bg-platform-bg p-8">
        <TrocaDeSenha email="grafica@fornecedor.test" validaAte={validaAte} vencida={Boolean(vencida)} />
      </main>
    </LocaleProvider>
  );
}
