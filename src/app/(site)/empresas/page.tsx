import { metadadosEmMontagem, PaginaEmMontagem } from "@/components/site/PaginaEmMontagem";

export const metadata = metadadosEmMontagem("empresas");

export default function Pagina() {
  return <PaginaEmMontagem slug="empresas" />;
}
