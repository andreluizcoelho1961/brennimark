import { metadadosEmMontagem, PaginaEmMontagem } from "@/components/site/PaginaEmMontagem";

export const metadata = metadadosEmMontagem("termos");

export default function Pagina() {
  return <PaginaEmMontagem slug="termos" />;
}
