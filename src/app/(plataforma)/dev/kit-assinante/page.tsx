import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { ProvedorDeTraducao } from "@/components/ProvedorDeTraducao";
import { idiomaDaSessao } from "@/lib/idioma-da-sessao";
import { KitDoAssinante } from "@/components/ferramentas/KitDoAssinante";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada do Kit do assinante (10/10/2026). A suíte de navegador roda sem
 * banco: as rotas `/api/kit/*` e `/api/assets/kit` são fingidas no teste.
 */
export default async function BancadaDoKitDoAssinante() {
  const idioma = await idiomaDaSessao();
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale={idioma}>
      <ProvedorDeTraducao>
        <KitDoAssinante />
      </ProvedorDeTraducao>
    </LocaleProvider>
  );
}
