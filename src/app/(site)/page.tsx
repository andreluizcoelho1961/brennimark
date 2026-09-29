import type { Metadata } from "next";
import { CapitulosDaHome } from "@/components/site/CapitulosDaHome";
import { MolduraDoSite } from "@/components/site/MolduraDoSite";
import { TrilhoDaHome } from "@/components/site/TrilhoDaHome";

/**
 * A home do site. Quem já entrou nem chega aqui: o `proxy` leva ao produto.
 *
 * Gerada no deploy (sem ler sessão nem banco): é o mesmo HTML para todos, e o
 * servidor não trabalha a cada visita.
 */
export const metadata: Metadata = {
  title: "Brennimark · Plataforma de gestão de marca",
  description:
    "Menos tempo procurando, mais segurança para decidir e mais atenção para criar. O manual, os materiais e as orientações da marca num só lugar, com o Vini para ajudar durante o trabalho.",
};

export default function HomeDoSite() {
  return (
    <MolduraDoSite>
      <TrilhoDaHome>
        <CapitulosDaHome />
      </TrilhoDaHome>
    </MolduraDoSite>
  );
}
