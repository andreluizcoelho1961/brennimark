import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { CoresDoAssinante } from "@/components/ferramentas/CoresDoAssinante";

export const metadata = { robots: { index: false, follow: false } };

/** Bancada do Cores do assinante: `/api/cores/paleta` é fingida no teste. */
export default function BancadaDoCoresDoAssinante() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <LocaleProvider locale="pt-BR">
      <CoresDoAssinante />
    </LocaleProvider>
  );
}
