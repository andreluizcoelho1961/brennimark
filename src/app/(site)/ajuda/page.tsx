import { metadadosEmMontagem, PaginaEmMontagem } from "@/components/site/PaginaEmMontagem";

export const metadata = metadadosEmMontagem("ajuda");

export default function Pagina() {
  return <PaginaEmMontagem slug="ajuda" />;
}
