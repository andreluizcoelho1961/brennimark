import { notFound } from "next/navigation";
import { BrandImporter } from "@/components/import/BrandImporter";
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
export default async function ImportarLab() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale={PRODUCT_LOCALE}>
      <BrandImporter workspaceId="00000000-0000-4000-8000-000000000000" />
    </LocaleProvider>
  );
}
