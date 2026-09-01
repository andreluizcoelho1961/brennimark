import { notFound } from "next/navigation";
import { BrandImporter } from "@/components/import/BrandImporter";
import { LIMITES_DE_IMPORTACAO } from "@/lib/import/limites";
import { LocaleProvider } from "@/platform/locale-client";
import { PRODUCT_LOCALE } from "@/platform/locale";

export const metadata = { robots: { index: false, follow: false } };

/**
 * O importador com um workspace de mentira, para exercitar a leitura do PDF e
 * a prévia num navegador de verdade.
 *
 * A rota REAL é /docs/importar e exige sessão de quem administra. Aqui não há
 * gravação possível: sem sessão, o Storage e a RPC recusam — o que se prova
 * neste laboratório é a extração e a prévia, que acontecem antes de qualquer
 * escrita e são justamente a parte que nenhum teste de unidade alcança.
 *
 * Fora de produção por construção.
 */
export default async function ImportarLab({
  searchParams,
}: {
  searchParams: Promise<{ maxBytes?: string; maxPaginas?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  // Limites reduzíveis pela URL: testar a recusa por tamanho com o limite real
  // exigiria carregar 100 MiB num navegador de teste, e a lógica exercitada é
  // exatamente a mesma. Só existe aqui; a rota real usa o padrão do produto.
  const { maxBytes, maxPaginas } = await searchParams;
  const limites = {
    maxBytes: Number(maxBytes) || LIMITES_DE_IMPORTACAO.maxBytes,
    maxPaginas: Number(maxPaginas) || LIMITES_DE_IMPORTACAO.maxPaginas,
  };

  return (
    <LocaleProvider locale={PRODUCT_LOCALE}>
      <BrandImporter workspaceId="00000000-0000-4000-8000-000000000000" limites={limites} />
    </LocaleProvider>
  );
}
