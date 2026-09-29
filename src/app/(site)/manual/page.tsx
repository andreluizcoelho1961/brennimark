import { metadadosEmMontagem, PaginaEmMontagem } from "@/components/site/PaginaEmMontagem";

export const metadata = metadadosEmMontagem("manual");

export default function Pagina() {
  return <PaginaEmMontagem slug="manual" />;
}
