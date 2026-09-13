import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { AssetLibrary } from "@/components/assets/AssetLibrary";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada da biblioteca de assets.
 *
 * A tela real vive em `/w/…/docs/biblioteca` e exige sessão, marca e Storage —
 * corretamente. A suíte de navegador roda sem banco, então sem esta rota o
 * comportamento de descontinuar seria provado só por leitura de código, que é
 * como os defeitos de moldura têm chegado até aqui.
 *
 * O teste finge `/api/assets`, como os do importador fingem a rede. O que se
 * exercita é o caminho de produção do componente, do clique à requisição.
 *
 * `?gerencia=0` mostra a tela de quem só consulta.
 */
export default async function BancadaDaBiblioteca({
  searchParams,
}: {
  searchParams: Promise<{ gerencia?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { gerencia } = await searchParams;

  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg p-8">
        <AssetLibrary canManage={gerencia !== "0"} />
      </main>
    </LocaleProvider>
  );
}
