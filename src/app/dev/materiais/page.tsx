import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { CatalogoDeMateriais } from "@/components/materiais/Materiais";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada de Materiais (fatia 5): o catálogo sem banco. A suíte finge a rede
 * (`/api/assets`, `/api/assets/kit`), como no resto da biblioteca.
 */
export default async function BancadaDeMateriais({ searchParams }: { searchParams: Promise<{ gerencia?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { gerencia } = await searchParams;
  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg">
        <CatalogoDeMateriais podeGerenciar={gerencia === "1"} raiz="/dev/materiais" />
      </main>
    </LocaleProvider>
  );
}
