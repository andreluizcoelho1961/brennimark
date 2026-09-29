import { metadadosEmMontagem, PaginaEmMontagem } from "@/components/site/PaginaEmMontagem";

export const metadata = metadadosEmMontagem("materiais");

export default function Pagina() {
  return <PaginaEmMontagem slug="materiais" />;
}
