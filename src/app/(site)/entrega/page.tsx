import { metadadosEmMontagem, PaginaEmMontagem } from "@/components/site/PaginaEmMontagem";

export const metadata = metadadosEmMontagem("entrega");

export default function Pagina() {
  return <PaginaEmMontagem slug="entrega" />;
}
