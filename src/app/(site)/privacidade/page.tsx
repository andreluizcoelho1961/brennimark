import { metadadosEmMontagem, PaginaEmMontagem } from "@/components/site/PaginaEmMontagem";

export const metadata = metadadosEmMontagem("privacidade");

export default function Pagina() {
  return <PaginaEmMontagem slug="privacidade" />;
}
