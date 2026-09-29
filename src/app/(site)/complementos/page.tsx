import { metadadosEmMontagem, PaginaEmMontagem } from "@/components/site/PaginaEmMontagem";

export const metadata = metadadosEmMontagem("complementos");

export default function Pagina() {
  return <PaginaEmMontagem slug="complementos" />;
}
