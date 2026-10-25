import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { ProvedorDeTraducao } from "@/components/ProvedorDeTraducao";
import { idiomaDaSessao } from "@/lib/idioma-da-sessao";
import { CoresDoAssinante } from "@/components/ferramentas/CoresDoAssinante";

export const metadata = { robots: { index: false, follow: false } };

/** Bancada do Cores do assinante: `/api/cores/paleta` é fingida no teste. */
export default async function BancadaDoCoresDoAssinante() {
  const idioma = await idiomaDaSessao();
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale={idioma}>
      <ProvedorDeTraducao>
        <CoresDoAssinante />
      </ProvedorDeTraducao>
    </LocaleProvider>
  );
}
