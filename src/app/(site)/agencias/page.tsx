import { metadadosEmMontagem, PaginaEmMontagem } from "@/components/site/PaginaEmMontagem";

export const metadata = metadadosEmMontagem("agencias");

export default function Pagina() {
  return <PaginaEmMontagem slug="agencias" />;
}
