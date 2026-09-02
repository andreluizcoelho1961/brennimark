import type { DocPageEntry } from "../../content/docs";

/**
 * O manual, organizado para navegar.
 *
 * Módulo puro: a ordem dos grupos e o corte da lista decidem se alguém acha
 * uma página num manual de 152 seções, e isso precisa ser verificável sem
 * renderizar nada.
 */

export interface GrupoDeDocumentos {
  nome: string;
  documentos: readonly DocPageEntry[];
  /** Quantos existem no grupo, mesmo quando nem todos estão renderizados. */
  total: number;
}

/** Documentos por lote, dentro de cada grupo. Ver o comentário em agrupar. */
export const LOTE_POR_GRUPO = 12;

/**
 * Agrupa preservando a ordem que a marca declarou.
 *
 * A ordem dos GRUPOS é a da primeira aparição, não alfabética: quem montou o
 * manual escolheu começar por Fundamentos e terminar por Governança, e ordenar
 * por nome jogaria "Aplicações" para o início. Dentro do grupo, `sort_order`
 * já vem do banco.
 *
 * Grupo vazio não aparece. Um cabeçalho sem nada embaixo é ruído que ocupa a
 * mesma altura de um item útil.
 */
export function agruparDocumentos(
  docs: readonly DocPageEntry[],
): GrupoDeDocumentos[] {
  const porGrupo = new Map<string, DocPageEntry[]>();
  for (const doc of docs) {
    const nome = doc.group?.trim() || "Manual";
    const lista = porGrupo.get(nome) ?? [];
    lista.push(doc);
    porGrupo.set(nome, lista);
  }
  return [...porGrupo.entries()]
    .filter(([, lista]) => lista.length > 0)
    .map(([nome, lista]) => ({ nome, documentos: lista, total: lista.length }));
}

/**
 * O recorte visível de um grupo.
 *
 * Doze por grupo, e "ver mais" para o resto. Não é virtualização: uma
 * virtualização caseira desmonta elementos enquanto o teclado ou o leitor de
 * tela ainda os usa — o mesmo motivo pelo qual a prévia da importação é
 * paginada, e a mesma decisão.
 *
 * O grupo que contém a página aberta é expandido inteiro, independentemente do
 * lote: cortar a lista logo abaixo de onde a pessoa está é esconder justamente
 * o contexto que ela veio procurar.
 */
export function recortarGrupo(
  grupo: GrupoDeDocumentos,
  { expandido, slugAtual }: { expandido: boolean; slugAtual?: string },
): { visiveis: readonly DocPageEntry[]; restantes: number } {
  const contemOAtual = slugAtual !== undefined
    && grupo.documentos.some((doc) => doc.slug === slugAtual);

  if (expandido || contemOAtual || grupo.total <= LOTE_POR_GRUPO) {
    return { visiveis: grupo.documentos, restantes: 0 };
  }
  return {
    visiveis: grupo.documentos.slice(0, LOTE_POR_GRUPO),
    restantes: grupo.total - LOTE_POR_GRUPO,
  };
}

/**
 * A página anterior e a próxima, na ordem em que o manual foi montado.
 *
 * Atravessa grupos de propósito: o fim de "Cor" leva ao começo de
 * "Tipografia". Parar no fim do grupo faria a navegação sequencial terminar em
 * becos, e quem lê um manual do começo ao fim é exatamente quem mais precisa
 * dela.
 */
export function vizinhos(
  docs: readonly DocPageEntry[],
  slug: string,
): { anterior: DocPageEntry | null; proximo: DocPageEntry | null } {
  const indice = docs.findIndex((doc) => doc.slug === slug);
  if (indice === -1) return { anterior: null, proximo: null };
  return {
    anterior: indice > 0 ? docs[indice - 1] : null,
    proximo: indice < docs.length - 1 ? docs[indice + 1] : null,
  };
}

/**
 * A trilha até a página: marca › grupo › página.
 *
 * A MARCA entra na trilha porque o produto é multimarca. Sem ela, duas abas
 * abertas em marcas diferentes mostram trilhas idênticas — "Manual › Cor" nas
 * duas — e a pessoa edita a marca errada achando que está na certa.
 */
export interface Migalha {
  rotulo: string;
  href?: string;
}

export function trilha({
  marca,
  documento,
  base,
}: {
  marca: string;
  documento?: DocPageEntry;
  base: string;
}): Migalha[] {
  const trilhaDaMarca: Migalha[] = [{ rotulo: marca, href: base }];
  if (!documento) return trilhaDaMarca;
  return [
    ...trilhaDaMarca,
    // O grupo não é link: não existe página de grupo, e um link que leva ao
    // mesmo lugar que o anterior é uma promessa quebrada.
    { rotulo: documento.group?.trim() || "Manual" },
    { rotulo: documento.title },
  ];
}
