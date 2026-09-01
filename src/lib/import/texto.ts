/**
 * O texto de um PDF, com a geometria preservada.
 *
 * Um extrator que devolve só strings joga fora o que distingue um título de um
 * parágrafo: onde ele está na página, que tamanho tem, e se ele se repete em
 * todas as folhas. Sem isso, "linha curta" é o único sinal disponível — e ele
 * confunde título com número de página, com cabeçalho, e com a última linha de
 * um parágrafo.
 *
 * Este módulo é puro: nada de PDF.js aqui. O que ele recebe é o que o parser
 * entrega, e o que ele devolve é o que o agrupamento do I1.2 vai usar.
 */

export interface ItemDeTexto {
  texto: string;
  /** Origem no sistema de coordenadas da página: x cresce à direita, y para cima. */
  x: number;
  y: number;
  /** Altura da caixa do glifo, em pontos. É o sinal de destaque mais confiável. */
  altura: number;
  fonte: string;
}

export interface PaginaExtraida {
  numero: number;
  /** Altura da página em pontos, para saber o que é topo e o que é rodapé. */
  alturaDaPagina: number;
  itens: ItemDeTexto[];
}

export interface Linha {
  texto: string;
  y: number;
  /** A maior altura entre os itens da linha. */
  altura: number;
  fonte: string;
}

/** Itens na mesma altura são a mesma linha. A tolerância acompanha o corpo. */
const TOLERANCIA_DE_LINHA = 2;

export function linhasDe(pagina: PaginaExtraida): Linha[] {
  const ordenados = [...pagina.itens]
    .filter((item) => item.texto.trim().length > 0)
    .sort((a, b) => (Math.abs(a.y - b.y) <= TOLERANCIA_DE_LINHA ? a.x - b.x : b.y - a.y));

  const linhas: Linha[] = [];
  for (const item of ordenados) {
    const atual = linhas[linhas.length - 1];
    if (atual && Math.abs(atual.y - item.y) <= TOLERANCIA_DE_LINHA) {
      atual.texto = `${atual.texto} ${item.texto.trim()}`.replace(/\s+/g, " ").trim();
      atual.altura = Math.max(atual.altura, item.altura);
      continue;
    }
    linhas.push({
      texto: item.texto.trim(),
      y: item.y,
      altura: item.altura,
      fonte: item.fonte,
    });
  }
  return linhas;
}

/**
 * Cabeçalhos e rodapés, achados por repetição.
 *
 * "Brand Guidelines" no topo de cada folha e o número da página no pé são
 * exatamente o que a heurística de "linha curta no alto" elegeria como título
 * — e são o oposto: eles se repetem justamente porque NÃO marcam seção.
 *
 * O sinal é a repetição em faixa vertical constante. Um número de página muda
 * de texto a cada folha, então também se compara o formato: linha que é só
 * dígitos, na mesma altura, conta como repetida.
 *
 * A margem é 8% da altura — cerca de 63pt numa página A4/Letter, que é a
 * ordem de grandeza de uma margem de impressão. Com 12%, texto de corpo no
 * alto da mancha caía na faixa e era descartado como cabeçalho: o teste de
 * integração pegou isso, com uma linha a 88% da altura sendo engolida.
 */
export function detectarRepetidos(
  paginas: readonly PaginaExtraida[],
  { limiar = 0.6, margem = 0.08 }: { limiar?: number; margem?: number } = {},
): Set<string> {
  if (paginas.length < 3) return new Set();

  const ocorrencias = new Map<string, number>();
  for (const pagina of paginas) {
    const alturaDaPagina = pagina.alturaDaPagina || 1;
    const naMargem = linhasDe(pagina).filter((linha) => {
      const proporcao = linha.y / alturaDaPagina;
      return proporcao > 1 - margem || proporcao < margem;
    });
    // Uma vez por página, mesmo que a linha apareça duas vezes nela.
    for (const chave of new Set(naMargem.map((l) => chaveDeRepeticao(l.texto)))) {
      ocorrencias.set(chave, (ocorrencias.get(chave) ?? 0) + 1);
    }
  }

  const minimo = Math.max(3, Math.ceil(paginas.length * limiar));
  return new Set(
    [...ocorrencias.entries()].filter(([, vezes]) => vezes >= minimo).map(([chave]) => chave),
  );
}

/**
 * A forma da linha, não o conteúdo.
 *
 * "12" e "13" são a mesma coisa — o número da folha — e precisam colidir na
 * mesma chave para que a repetição seja percebida.
 */
export function chaveDeRepeticao(texto: string): string {
  return texto
    .trim()
    .toLocaleLowerCase()
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ");
}

export function ehRepetido(texto: string, repetidos: ReadonlySet<string>): boolean {
  return repetidos.has(chaveDeRepeticao(texto));
}

/** As linhas da página, sem cabeçalho nem rodapé. */
export function linhasUteis(
  pagina: PaginaExtraida,
  repetidos: ReadonlySet<string>,
): Linha[] {
  return linhasDe(pagina).filter((linha) => !ehRepetido(linha.texto, repetidos));
}
