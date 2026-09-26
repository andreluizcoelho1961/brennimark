/**
 * Quais páginas ficam montadas, e em que resolução.
 *
 * Um manual de 743 páginas não cabe montado. Cada página é um `<canvas>`, e um
 * canvas custa `largura × altura × 4` bytes de memória de vídeo — que
 * `performance.memory` **não vê**. Por isso as decisões de memória moram aqui,
 * como aritmética testável, e não espalhadas por efeitos de um componente:
 * medir vazamento de canvas exige aparelho físico, e o que dá para provar em
 * teste é a regra que impede o vazamento de existir.
 */

/**
 * Teto de pixels por página renderizada.
 *
 * Por PIXELS, e não por multiplicador de zoom. Um zoom de 3× sobre uma página
 * A4 e o mesmo 3× sobre uma prancha de 1189 mm produzem contagens de pixels
 * incomparáveis — o multiplicador limita a intenção, não o consumo. Só o
 * produto largura × altura limita o consumo.
 *
 * 4 milhões de pixels são ~16 MB por canvas. Com a janela de montagem abaixo,
 * o pior caso fica em ~80 MB de canvas — alto, e limitado.
 */
export const TETO_DE_PIXELS = 4_000_000;

/** Quantas vizinhas de cada lado permanecem montadas junto da página visível. */
export const VIZINHAS = 2;

/**
 * As páginas que devem estar montadas agora.
 *
 * Tudo fora deste conjunto é desmontado — e desmontar, aqui, é mais que tirar
 * do DOM: é cancelar o render em curso, zerar `width` e `height` do canvas
 * (um canvas removido com dimensões preservadas continua ocupando memória de
 * vídeo em vários navegadores) e soltar as referências do PDF.js.
 *
 * A janela é pequena de propósito. Cache ilimitado de páginas renderizadas é o
 * jeito mais fácil de fazer um leitor de 743 páginas derrubar a aba, e ele não
 * aparece em teste curto: aparece depois de vinte minutos de rolagem.
 */
export function janelaMontada(
  paginaAtual: number,
  total: number,
  vizinhas: number = VIZINHAS,
): number[] {
  if (total <= 0) return [];
  const atual = Math.min(Math.max(Math.trunc(paginaAtual), 1), total);
  const inicio = Math.max(1, atual - vizinhas);
  const fim = Math.min(total, atual + vizinhas);

  const janela: number[] = [];
  for (let n = inicio; n <= fim; n += 1) janela.push(n);
  return janela;
}

/** Esta página deve continuar montada, dada a página visível? */
export function dentroDaJanela(
  pagina: number,
  paginaAtual: number,
  total: number,
  vizinhas: number = VIZINHAS,
): boolean {
  return janelaMontada(paginaAtual, total, vizinhas).includes(pagina);
}

export type Dimensao = { largura: number; altura: number };

/**
 * A escala de renderização de uma página, já limitada pela memória.
 *
 * `escalaPedida` é o que a pessoa quer: ajuste à largura, ou um zoom que ela
 * escolheu. O retorno é o que pode ser entregue sem estourar o teto.
 *
 * A página NUNCA é recortada nem reenquadrada para caber: uma escala menor
 * mostra a página inteira, menor. Recortar seria o produto decidindo o que da
 * página do cliente merece ser visto.
 */
export function escalaLimitada(
  pagina: Dimensao,
  escalaPedida: number,
  teto: number = TETO_DE_PIXELS,
): number {
  const escala = Math.max(escalaPedida, 0);
  if (pagina.largura <= 0 || pagina.altura <= 0 || escala === 0) return 0;

  const pixels = pagina.largura * pagina.altura * escala * escala;
  if (pixels <= teto) return escala;

  // Reduz pela raiz porque os pixels crescem com o QUADRADO da escala: para
  // cortar os pixels pela metade, a escala cai por √2, não por 2.
  return Math.sqrt(teto / (pagina.largura * pagina.altura));
}

/** Até 3×: acima disso o olho não distingue, e a memória paga. */
export const DENSIDADE_MAXIMA = 3;

/**
 * A escala do DESENHO de uma página — a do canvas, não a da tela.
 *
 * Tela de alta densidade (Retina do Mac, iPhone) tem 2 ou 3 pixels físicos por
 * pixel de CSS. Desenhar na escala da tela entregava um terço dos pixels que o
 * iPhone mostra, e o navegador esticava: texto macio no Mac, borrado no
 * celular (ensaio de 26/09/2026). O tamanho NA TELA continua `escalaPedida`
 * (`tamanhoNaTela`); só o desenho ganha a densidade.
 *
 * O teto de pixels continua valendo: se a densidade o estourar, a página sai
 * menos nítida — inteira, nunca recortada.
 */
export function escalaDoDesenho(
  pagina: Dimensao,
  escalaPedida: number,
  densidade: number,
  teto: number = TETO_DE_PIXELS,
): number {
  const d = Number.isFinite(densidade) ? Math.min(Math.max(densidade, 1), DENSIDADE_MAXIMA) : 1;
  return escalaLimitada(pagina, escalaPedida * d, teto);
}

/**
 * A escala que faz a página caber na largura disponível.
 *
 * Ajuste à largura é o modo de leitura padrão de manual: a página inteira,
 * ocupando a coluna, com a proporção original intacta.
 */
export function escalaParaLargura(pagina: Dimensao, larguraDisponivel: number): number {
  if (pagina.largura <= 0 || larguraDisponivel <= 0) return 0;
  return larguraDisponivel / pagina.largura;
}

/**
 * A dimensão em CSS de uma página, na escala dada.
 *
 * Devolvida em separado da escala do canvas porque as duas divergem quando o
 * teto de pixels age: o canvas passa a ter menos pixels que o espaço na tela, e
 * a página é ampliada pelo navegador — mais borrada, e inteira. A alternativa
 * seria cortar, e cortar é o que o produto não pode fazer.
 */
export function tamanhoNaTela(pagina: Dimensao, escalaPedida: number): Dimensao {
  return {
    largura: pagina.largura * escalaPedida,
    altura: pagina.altura * escalaPedida,
  };
}

/**
 * A rotação declarada pela página, normalizada.
 *
 * O PDF permite `/Rotate` em qualquer múltiplo de 90, inclusive negativo e
 * acima de 360. Uma página girada e exibida sem girar é a página do cliente
 * deitada na tela.
 */
export function rotacaoNormalizada(bruta: number): 0 | 90 | 180 | 270 {
  const normal = ((Math.trunc(bruta) % 360) + 360) % 360;
  return (normal - (normal % 90)) as 0 | 90 | 180 | 270;
}
