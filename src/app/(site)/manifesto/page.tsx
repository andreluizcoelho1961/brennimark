import { metadadosEmMontagem, PaginaEmMontagem } from "@/components/site/PaginaEmMontagem";

export const metadata = metadadosEmMontagem("manifesto");

export default function Pagina() {
  return <PaginaEmMontagem slug="manifesto" />;
}
