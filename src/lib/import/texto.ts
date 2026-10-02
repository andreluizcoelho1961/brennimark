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
  /**
   * A geometria do ORIGINAL, para o manifesto por página.
   *
   * Caixa NÃO rotacionada (`page.view`) mais a rotação declarada, e não o
   * viewport já rotacionado. O manifesto registra o que o PDF diz; girar é
   * conta do visualizador, que já a faz. Guardar o resultado rotacionado
   * perderia a informação de que houve rotação.
   */
  larguraPt: number;
  alturaPt: number;
  rotacao: number;
  itens: ItemDeTexto[];
}

export interface Linha {
  texto: string;
  y: number;
  /** A maior altura entre os itens da linha. */
  altura: number;
  fonte: string;
  /**
   * Os pedaços da linha separados por um VÃO largo — duas colunas na mesma
   * altura. O texto continua sendo a linha inteira (é o que a busca lê); os
   * pedaços servem ao título: "Logo horizontal" e "Logo vertical", lado a
   * lado, não são um título só (achado do ensaio de 26/09/2026).
   */
  segmentos?: string[];
}

/** Largura estimada de um pedaço de texto: o parser não entrega a largura. */
function larguraEstimada(item: ItemDeTexto): number {
  return item.texto.trim().length * (item.altura || 1) * 0.5;
}

/** Itens na mesma altura são a mesma linha. A tolerância acompanha o corpo. */
const TOLERANCIA_DE_LINHA = 2;

export function linhasDe(pagina: PaginaExtraida): Linha[] {
  /**
   * A altura vira faixa ANTES de ordenar.
   *
   * Comparar `Math.abs(a.y - b.y) <= tolerância` dentro do comparador não é uma
   * ordem válida: a relação não é transitiva, e itens a 1pt de distância em
   * cadeia acabavam ora na mesma linha, ora em linhas diferentes, dependendo da
   * ordem em que o `sort` os comparasse. Arredondar para uma faixa dá a cada
   * item uma posição estável.
   */
  const faixaDe = (y: number) => Math.round(y / TOLERANCIA_DE_LINHA);

  const ordenados = [...pagina.itens]
    .filter((item) => item.texto.trim().length > 0)
    .sort((a, b) => faixaDe(b.y) - faixaDe(a.y) || a.x - b.x);

  const linhas: Linha[] = [];
  let faixaAtual: number | null = null;
  let anterior: ItemDeTexto | null = null;
  for (const item of ordenados) {
    const faixa = faixaDe(item.y);
    const atual = linhas[linhas.length - 1];
    if (atual && faixa === faixaAtual) {
      atual.texto = `${atual.texto} ${item.texto.trim()}`.replace(/\s+/g, " ").trim();
      atual.altura = Math.max(atual.altura, item.altura);
      // Vão maior que ~3 corpos entre o fim estimado do pedaço anterior e este:
      // é outra coluna, e começa outro segmento.
      const segmentos = atual.segmentos ?? [atual.texto];
      const vao = anterior ? item.x - (anterior.x + larguraEstimada(anterior)) : 0;
      if (vao > 3 * Math.max(item.altura, anterior?.altura ?? 0, 1)) {
        segmentos.push(item.texto.trim());
      } else {
        segmentos[segmentos.length - 1] = `${segmentos[segmentos.length - 1]} ${item.texto.trim()}`.replace(/\s+/g, " ").trim();
      }
      atual.segmentos = segmentos;
      anterior = item;
      continue;
    }
    faixaAtual = faixa;
    anterior = item;
    linhas.push({
      texto: item.texto.trim(),
      y: item.y,
      altura: item.altura,
      fonte: item.fonte,
      segmentos: [item.texto.trim()],
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

/**
 * Texto que se repete NO MESMO LUGAR em quase todas as páginas — o menu
 * lateral do manual, as abas de capítulo, o nome da marca num canto.
 *
 * Achado do ensaio de 26/09/2026: o menu lateral entrava na busca e casava
 * com qualquer pergunta ("logotipo" trazia "Estilo fotográfico" no topo,
 * porque a palavra estava no menu daquela página). `detectarRepetidos` não o
 * pegava: ele só olha as margens de cima e de baixo, e o menu fica no meio da
 * altura.
 *
 * Duas escolhas, e o porquê:
 *
 * - **A peça de texto, não a linha.** O menu está na mesma altura do corpo, e
 *   `linhasDe` junta tudo o que está na mesma faixa numa linha só ("Logotipo
 *   Use o símbolo sobre…"). Filtrar linhas não separaria o menu do corpo; por
 *   isso o filtro age ANTES de montar as linhas.
 * - **Texto E posição.** O item "Logotipo" do menu se repete; o título
 *   "Logotipo" da página do logotipo, não — ele está em outro lugar. Comparar
 *   só o texto apagaria o título junto, e o título é o que separa as seções.
 *
 * A posição vira célula de 2% da página nos dois eixos: manual feito em
 * modelo põe o menu sempre no mesmo ponto. O limiar é o mesmo do cabeçalho
 * (60% das páginas, no mínimo 3). E o texto tem de ser idêntico — ver
 * `chaveDePosicao`.
 */
export function chaveDePosicao(item: ItemDeTexto, pagina: PaginaExtraida, celula = 0.02): string {
  const largura = pagina.larguraPt || 1;
  const altura = pagina.alturaDaPagina || 1;
  /*
   * O texto EXATO, sem trocar dígito por "#" como `chaveDeRepeticao` faz.
   * Menu repete o texto idêntico; o que varia de página para página no mesmo
   * lugar é título numerado ("Capítulo 1", "Capítulo 2") — conteúdo, que tem
   * de ficar. O número de página, que também varia, é da regra das margens.
   * A primeira versão usava a chave com "#" e apagava "Conteudo da pagina N"
   * dos PDFs de teste: o teste de navegador do importador pegou.
   */
  const texto = item.texto.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return `${texto}|${Math.round(item.x / (largura * celula))}|${Math.round(item.y / (altura * celula))}`;
}

export function detectarRepetidosPorPosicao(
  paginas: readonly PaginaExtraida[],
  { limiar = 0.6, celula = 0.02 }: { limiar?: number; celula?: number } = {},
): Set<string> {
  if (paginas.length < 3) return new Set();
  const ocorrencias = new Map<string, number>();
  for (const pagina of paginas) {
    const chaves = new Set(
      pagina.itens.filter((item) => item.texto.trim().length > 0).map((item) => chaveDePosicao(item, pagina, celula)),
    );
    for (const chave of chaves) ocorrencias.set(chave, (ocorrencias.get(chave) ?? 0) + 1);
  }
  const minimo = Math.max(3, Math.ceil(paginas.length * limiar));
  return new Set([...ocorrencias.entries()].filter(([, vezes]) => vezes >= minimo).map(([chave]) => chave));
}

/** As páginas sem as peças que se repetem no mesmo lugar. Não altera a entrada. */
export function semRepetidosPorPosicao(
  paginas: readonly PaginaExtraida[],
  repetidos: ReadonlySet<string>,
  celula = 0.02,
): PaginaExtraida[] {
  if (repetidos.size === 0) return [...paginas];
  return paginas.map((pagina) => ({
    ...pagina,
    itens: pagina.itens.filter((item) => !repetidos.has(chaveDePosicao(item, pagina, celula))),
  }));
}

/** O que saiu por posição, para a prévia e o manifesto: transparência, não perda. */
export function removidosPorPosicao(
  paginas: readonly PaginaExtraida[],
  repetidos: ReadonlySet<string>,
  celula = 0.02,
): { texto: string; ocorrencias: number }[] {
  if (repetidos.size === 0) return [];
  const contagem = new Map<string, { texto: string; paginas: Set<number> }>();
  for (const pagina of paginas) {
    for (const item of pagina.itens) {
      const texto = item.texto.trim();
      if (!texto || !repetidos.has(chaveDePosicao(item, pagina, celula))) continue;
      const atual = contagem.get(texto) ?? { texto, paginas: new Set<number>() };
      atual.paginas.add(pagina.numero);
      contagem.set(texto, atual);
    }
  }
  return [...contagem.values()]
    .map(({ texto, paginas: ps }) => ({ texto, ocorrencias: ps.size }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias);
}
