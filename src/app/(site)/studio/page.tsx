import { metadadosEmMontagem, PaginaEmMontagem } from "@/components/site/PaginaEmMontagem";

export const metadata = metadadosEmMontagem("studio");

export default function Pagina() {
  return <PaginaEmMontagem slug="studio" />;
}
