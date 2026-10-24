import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { idiomaDaSessao } from "@/lib/idioma-da-sessao";
import { Complementos } from "@/components/complementos/Complementos";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada de Complementos. A tela real exige sessão e marca; o teste de
 * navegador finge `/api/complementos` e exercita o componente — ler, escrever
 * com prévia, publicar, arquivar, histórico. Quem lê o quê está provado no
 * banco (`scripts/prova-complementos.sh`).
 */
export default async function BancadaDeComplementos() {
  const idioma = await idiomaDaSessao();
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale={idioma}>
      <main className="min-h-dvh bg-platform-bg">
        <Complementos />
      </main>
    </LocaleProvider>
  );
}
