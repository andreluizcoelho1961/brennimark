import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { LinksDeEntrega } from "@/components/links/LinksDeEntrega";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada de Links de entrega. A tela real exige sessão e conta; o teste de
 * navegador finge `/api/links` e `/api/assets` e exercita o componente —
 * criar, ver o endereço uma vez, listar, ver acessos, encerrar. Quem lê e quem
 * cria está provado no banco (`scripts/prova-links-de-entrega.sh`).
 */
export default async function BancadaDeLinks({ searchParams }: { searchParams: Promise<{ marca?: string; arquivos?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const busca = await searchParams;
  return (
    <LocaleProvider locale="pt-BR">
      <main className="min-h-dvh bg-platform-bg p-8">
        <LinksDeEntrega
          marcas={[{ id: "m1", nome: "Marca Um", chave: "marca-um" }, { id: "m2", nome: "Marca Dois", chave: "marca-dois" }]}
          inicial={busca.marca ? { marca: busca.marca, arquivos: (busca.arquivos ?? "").split(",").filter(Boolean) } : undefined}
        />
      </main>
    </LocaleProvider>
  );
}
