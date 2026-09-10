import { slugify } from "../import/draft";
import type { Secao } from "../import/secoes";
import type { PaginaDoRelatorio } from "./registrar";

/**
 * O manifesto por página, montado na importação e gravado no relatório.
 *
 * ─── Por que ele vai no relatório da transação A ────────────────────────
 *
 * A segunda transação — a que grava `brand_source_documents` e
 * `brand_source_pages` — é derivada deste manifesto. Se ele vivesse só no
 * estado do navegador, recarregar a aba entre as duas transações tornaria a
 * publicação impossível de concluir. Gravado no relatório, ele é durável, e a
 * repetição monta o mesmo pedido por construção. Ver
 * `documento-fonte/registrar.ts`.
 *
 * Este módulo é puro de propósito: montar o manifesto é a regra, e regra se
 * testa sem navegador.
 */

/** A geometria de uma página, como saiu da leitura do PDF. */
export interface GeometriaDaPagina {
  numero: number;
  larguraPt: number;
  alturaPt: number;
  rotacao: number;
  /** Quantos caracteres úteis a extração aproveitou. Zero é página só visual. */
  caracteres: number;
}

/**
 * Um slug por seção, decidido UMA vez.
 *
 * Antes disto o importador calculava o slug em três lugares, e um deles — o do
 * relatório — não aplicava o desempate. Duas seções com o mesmo título
 * (comuníssimo num manual: "Aplicações", "Cores") produziam `aplicacoes` e
 * `aplicacoes-2` nos documentos e `aplicacoes` duas vezes no relatório. O
 * manifesto resolve seção POR SLUG contra `brand_documents`, então a segunda
 * ocorrência apontaria para o documento da primeira — página atribuída à seção
 * errada, em silêncio, com o número certo de páginas.
 *
 * A ordem do array é o desempate, e é a mesma que gera os documentos.
 */
export function atribuirSlugs(secoes: readonly Secao[]): Map<string, string> {
  const usados = new Set<string>();
  const porSecao = new Map<string, string>();

  secoes.forEach((secao, indice) => {
    let slug = slugify(secao.titulo) || secao.id;
    if (usados.has(slug)) slug = `${slug}-${indice + 1}`;
    usados.add(slug);
    porSecao.set(secao.id, slug);
  });

  return porSecao;
}

/**
 * Página → slug da seção que a cobre.
 *
 * `sourcePageRanges` é a fonte de verdade da seção, e não o par início/fim:
 * uma seção pode ser "1–5 e 9" depois de alguém mover uma página. Percorrer os
 * intervalos é o que continua verdadeiro nesse caso.
 *
 * Sobreposição não deveria existir — `agrupar` não a produz — mas se
 * existisse, a PRIMEIRA seção vence, e não a última: assim o resultado depende
 * da ordem visível na prévia, e não de qual laço terminou por último.
 */
export function coberturaPorPagina(
  secoes: readonly Secao[],
  slugs: Map<string, string>,
): Map<number, string> {
  const cobertura = new Map<number, string>();

  for (const secao of secoes) {
    const slug = slugs.get(secao.id);
    if (!slug) continue;
    for (const intervalo of secao.sourcePageRanges) {
      for (let pagina = intervalo.de; pagina <= intervalo.ate; pagina += 1) {
        if (!cobertura.has(pagina)) cobertura.set(pagina, slug);
      }
    }
  }

  return cobertura;
}

/**
 * O manifesto completo: uma linha por página do PDF, de 1 a N.
 *
 * **Completo é a invariante, e ela é o motivo de tudo isto existir.** A RPC
 * recusa qualquer manifesto que não cubra exatamente `1..N`, então a página
 * que nenhuma seção cobre entra aqui como página sem seção — nunca como
 * página ausente. Uma abertura de capítulo só com imagem, uma folha em branco
 * e uma página que a extração não entendeu são todas fatos sobre o original, e
 * o manifesto existe para registrá-los em vez de descartá-los.
 */
export function montarManifesto({
  geometria,
  secoes,
  totalDePaginas,
}: {
  geometria: readonly GeometriaDaPagina[];
  secoes: readonly Secao[];
  totalDePaginas: number;
}): PaginaDoRelatorio[] {
  const slugs = atribuirSlugs(secoes);
  const cobertura = coberturaPorPagina(secoes, slugs);
  const porNumero = new Map(geometria.map((g) => [g.numero, g]));

  const manifesto: PaginaDoRelatorio[] = [];
  for (let numero = 1; numero <= totalDePaginas; numero += 1) {
    const g = porNumero.get(numero);
    manifesto.push({
      pagina: numero,
      /*
       * Sem geometria lida, a página entra com zero — e a conferência do
       * registrador recusa o manifesto como defeituoso, em vez de inventar A4
       * para uma página cujo tamanho não se mediu. Geometria errada não se
       * distingue de geometria certa depois de gravada.
       */
      largura_pt: g?.larguraPt ?? 0,
      altura_pt: g?.alturaPt ?? 0,
      rotacao: g?.rotacao ?? 0,
      tem_texto: (g?.caracteres ?? 0) > 0,
      caracteres: g?.caracteres ?? 0,
      secao_slug: cobertura.get(numero) ?? null,
    });
  }

  return manifesto;
}
