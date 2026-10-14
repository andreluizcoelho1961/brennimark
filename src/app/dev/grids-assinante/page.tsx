import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { GridsDoAssinante } from "@/components/ferramentas/GridsDoAssinante";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada do Grids do assinante (14/10/2026). A suíte de navegador roda sem
 * banco: as rotas `/api/grids/*` e `/api/assets/kit` são fingidas no teste.
 */
export default function BancadaDoGridsDoAssinante() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale="pt-BR">
      <GridsDoAssinante />
    </LocaleProvider>
  );
}
