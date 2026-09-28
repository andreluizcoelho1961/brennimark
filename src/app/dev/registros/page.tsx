import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { Registros } from "@/components/registros/Registros";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada de Registros. A tela real exige sessão e conta; o teste de
 * navegador finge `/api/registros` e exercita o caminho do componente — abas,
 * filtros e "carregar mais" —, do clique à requisição. Quem lê o quê está
 * provado no banco (as políticas de cada tabela de registro).
 */
export default async function BancadaDeRegistros() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg p-8">
        <Registros marcas={[
          { id: "d87b93f3-81d8-49f1-a8ef-9371ba05464c", nome: "Marca Um" },
          { id: "a64d5be5-7c7e-4595-9b88-eedc618b3d56", nome: "Marca Dois" },
        ]} />
      </main>
    </LocaleProvider>
  );
}
