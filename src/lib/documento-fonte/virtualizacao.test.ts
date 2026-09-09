import assert from "node:assert/strict";
import test from "node:test";
import {
  TETO_DE_PIXELS,
  dentroDaJanela,
  escalaLimitada,
  escalaParaLargura,
  janelaMontada,
  rotacaoNormalizada,
  tamanhoNaTela,
} from "./virtualizacao";

const A4 = { largura: 595, altura: 842 };
const PRANCHA = { largura: 3370, altura: 2384 }; // A0 deitada

test("a janela é a página visível mais as vizinhas dos dois lados", () => {
  assert.deepEqual(janelaMontada(10, 743), [8, 9, 10, 11, 12]);
});

test("no começo do documento a janela não pede página zero nem negativa", () => {
  assert.deepEqual(janelaMontada(1, 743), [1, 2, 3]);
  assert.deepEqual(janelaMontada(2, 743), [1, 2, 3, 4]);
});

test("no fim do documento a janela não passa da última página", () => {
  assert.deepEqual(janelaMontada(743, 743), [741, 742, 743]);
  assert.deepEqual(janelaMontada(742, 743), [740, 741, 742, 743]);
});

test("documento menor que a janela monta o documento inteiro", () => {
  assert.deepEqual(janelaMontada(1, 3), [1, 2, 3]);
});

test("documento vazio não monta nada", () => {
  assert.deepEqual(janelaMontada(1, 0), []);
});

test("página fora do intervalo é presa dentro dele, e não devolve janela vazia", () => {
  // Um campo de página com 9999 digitado não pode desmontar o documento.
  assert.deepEqual(janelaMontada(9999, 743), [741, 742, 743]);
  assert.deepEqual(janelaMontada(-5, 743), [1, 2, 3]);
});

/**
 * O teste que protege a memória.
 *
 * 743 páginas montadas são 743 canvases. A garantia não é "montamos poucas por
 * educação": é que a janela tem tamanho FIXO, independente do documento.
 */
test("a janela não cresce com o documento", () => {
  assert.equal(janelaMontada(400, 743).length, 5);
  assert.equal(janelaMontada(400, 10_000).length, 5);
});

test("dentroDaJanela concorda com janelaMontada", () => {
  assert.equal(dentroDaJanela(12, 10, 743), true);
  assert.equal(dentroDaJanela(13, 10, 743), false);
  // A página que sai da janela é a que precisa ser cancelada e zerada.
  assert.equal(dentroDaJanela(700, 10, 743), false);
});

test("ajuste à largura preserva a proporção", () => {
  const escala = escalaParaLargura(A4, 1190);
  assert.equal(escala, 2);
  assert.deepEqual(tamanhoNaTela(A4, escala), { largura: 1190, altura: 1684 });
});

test("abaixo do teto, a escala pedida é a entregue", () => {
  // 595 × 842 × 2² = 2.004.  ... milhões? não: 2.004.396 pixels. Cabe.
  assert.equal(escalaLimitada(A4, 2), 2);
});

/**
 * O teto é por PIXELS, não por multiplicador.
 *
 * O mesmo zoom de 2× cabe numa A4 e estoura numa prancha A0 — que é exatamente
 * o motivo de o limite não poder ser "zoom máximo 3×". Um manual de identidade
 * tem as duas coisas no mesmo arquivo.
 */
test("o mesmo zoom cabe numa A4 e é reduzido numa prancha", () => {
  assert.equal(escalaLimitada(A4, 2), 2);

  const reduzida = escalaLimitada(PRANCHA, 2);
  assert.ok(reduzida < 2, `esperava redução, veio ${reduzida}`);

  const pixels = PRANCHA.largura * PRANCHA.altura * reduzida * reduzida;
  assert.ok(pixels <= TETO_DE_PIXELS + 1, `estourou o teto: ${pixels}`);
});

test("a redução usa a raiz, porque os pixels crescem com o quadrado", () => {
  const pagina = { largura: 1000, altura: 1000 };
  // Pedir 4× seriam 16 milhões de pixels, quatro vezes o teto de 4 milhões.
  // A escala que cabe é 2×, não 1× — a raiz de 4 é 2.
  assert.equal(escalaLimitada(pagina, 4, 4_000_000), 2);
});

test("zoom absurdo continua devolvendo escala finita e dentro do teto", () => {
  const escala = escalaLimitada(A4, 1000);
  assert.ok(Number.isFinite(escala) && escala > 0);
  assert.ok(A4.largura * A4.altura * escala * escala <= TETO_DE_PIXELS + 1);
});

test("página ou escala degenerada devolve zero, nunca NaN nem Infinity", () => {
  // NaN chegando a `canvas.width` vira 0 em silêncio e a página some sem erro.
  for (const caso of [
    escalaLimitada({ largura: 0, altura: 842 }, 2),
    escalaLimitada({ largura: 595, altura: 0 }, 2),
    escalaLimitada(A4, 0),
    escalaLimitada(A4, -3),
    escalaParaLargura(A4, 0),
    escalaParaLargura({ largura: 0, altura: 0 }, 500),
  ]) {
    assert.equal(caso, 0);
  }
});

test("rotação é normalizada para os quatro valores que o PDF permite", () => {
  assert.equal(rotacaoNormalizada(0), 0);
  assert.equal(rotacaoNormalizada(90), 90);
  assert.equal(rotacaoNormalizada(270), 270);
  // Negativa e acima de 360 são legais no PDF, e uma página girada exibida
  // sem girar é a página do cliente deitada na tela.
  assert.equal(rotacaoNormalizada(-90), 270);
  assert.equal(rotacaoNormalizada(450), 90);
  assert.equal(rotacaoNormalizada(360), 0);
  // Valor fora do múltiplo de 90 desce para o múltiplo abaixo, em vez de
  // virar NaN e girar a página para lugar nenhum.
  assert.equal(rotacaoNormalizada(45), 0);
});
