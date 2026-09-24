import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { PaginaDoItem } from "@/components/materiais/Materiais";

export const metadata = { robots: { index: false, follow: false } };

/** A bancada da página de um item — `?edita=1` mostra o editor da regra. */
export default async function BancadaDoItem({
  params,
  searchParams,
}: {
  params: Promise<{ item: string }>;
  searchParams: Promise<{ edita?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const [{ item }, { edita }] = await Promise.all([params, searchParams]);
  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg">
        <PaginaDoItem itemId={item} podeEditar={edita === "1"} raiz="/dev/materiais" />
      </main>
    </LocaleProvider>
  );
}
