import { metadadosEmMontagem, PaginaEmMontagem } from "@/components/site/PaginaEmMontagem";

export const metadata = metadadosEmMontagem("novidades");

export default function Pagina() {
  return <PaginaEmMontagem slug="novidades" />;
}
