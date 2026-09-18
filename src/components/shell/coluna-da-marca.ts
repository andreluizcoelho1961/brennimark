import { colunaDaPlataforma, segmentadoDaMarca, type GrupoDaColuna } from "./coluna";
import { withBase, type ShellSection } from "./navigation";

/**
 * A coluna e o segmentado de uma marca ABERTA, a partir dos destinos que a
 * navegação da marca já calculou.
 *
 * Um lugar só, porque três telas montam isto — o layout real da marca e as
 * duas bancadas da suíte de navegador. Montar à mão em cada uma seria garantir
 * que a bancada testasse uma moldura diferente da que vai para produção.
 */
export function molduraDaMarcaAberta({
  sections,
  basePath,
  contaSlug,
  administraConta,
  ingles,
}: {
  sections: readonly ShellSection[];
  basePath: string;
  contaSlug?: string;
  administraConta: boolean;
  ingles: boolean;
}): { coluna: GrupoDaColuna[]; segmentado: { manual?: string; materiais?: string } } {
  return {
    coluna: colunaDaPlataforma({
      contaSlug,
      administraConta,
      ingles,
      marca: {
        destinos: sections.flatMap((secao) =>
          secao.destinations.map((d) => ({ href: withBase(d.href, basePath, d.foraDaMarca), label: d.label })),
        ),
      },
    }),
    segmentado: segmentadoDaMarca(basePath),
  };
}
