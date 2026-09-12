import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { TelaInicial } from "@/components/shell/TelaInicial";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada da tela inicial.
 *
 * A tela real vive em `/docs` e exige sessão, conta e marcas resolvidas no
 * banco — corretamente. A suíte de navegador roda sem banco, então sem esta
 * rota a tela seria provada só por leitura de código, que é como os defeitos
 * de moldura têm chegado até aqui.
 *
 * `?marcas=N` monta N cards. O caso de UMA marca importa tanto quanto o de
 * várias: foi por causa dele que esta tela passou a aparecer sempre.
 */
export default async function BancadaDaTelaInicial({
  searchParams,
}: {
  searchParams: Promise<{ marcas?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { marcas } = await searchParams;
  const quantas = Math.min(Math.max(Number(marcas) || 3, 1), 10);

  const opcoes = Array.from({ length: quantas }, (_, i) => ({
    workspaceSlug: "conta-de-teste",
    brandKey: `marca-${i + 1}`,
    conta: "Conta de teste",
    marca: `Marca ${i + 1}`,
  }));

  return (
    <LocaleProvider locale="pt-BR">
      <main>
        <TelaInicial opcoes={opcoes} />
      </main>
    </LocaleProvider>
  );
}
