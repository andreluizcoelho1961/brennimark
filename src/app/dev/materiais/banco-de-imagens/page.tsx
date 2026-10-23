import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { BancoDeImagens } from "@/components/materiais/BancoDeImagens";

export const metadata = { robots: { index: false, follow: false } };

/** A bancada do Banco de imagens: a suíte finge a rede, como em `/dev/materiais`. */
export default async function BancadaDoBancoDeImagens({ searchParams }: { searchParams: Promise<{ gerencia?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { gerencia } = await searchParams;
  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg">
        <BancoDeImagens podeGerenciar={gerencia === "1"} raiz="/dev/materiais" />
      </main>
    </LocaleProvider>
  );
}
