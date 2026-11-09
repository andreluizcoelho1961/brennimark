import { Complementos } from "@/components/complementos/Complementos";

/**
 * Complementos da marca — o terceiro segmento da barra (01/10/2026).
 *
 * O acesso à marca é conferido pelo layout. Quem vê o rascunho e quem edita
 * decide o banco (`complementos`, `rascunhos_de_complemento`); a tela recebe
 * `podeEditar` da rota, que só decide o que APARECE.
 */
export default function PaginaDeComplementos() {
  return <Complementos />;
}
