import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { KitDoAssinante } from "@/components/ferramentas/KitDoAssinante";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada do Kit do assinante (10/10/2026). A suíte de navegador roda sem
 * banco: as rotas `/api/kit/*` e `/api/assets/kit` são fingidas no teste.
 */
export default function BancadaDoKitDoAssinante() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale="pt-BR">
      <KitDoAssinante />
    </LocaleProvider>
  );
}
