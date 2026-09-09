import assert from "node:assert/strict";
import test from "node:test";
import {
  LIMITES_DE_IMPORTACAO,
  TETO_DO_PRODUTO_BYTES,
  motivoDeRecusaPorTamanho,
} from "./limites";

const MB = 1024 * 1024;
const TETO_DO_PLANO = 50 * MB;

test("dentro do teto não há recusa", () => {
  assert.equal(motivoDeRecusaPorTamanho(10 * MB, TETO_DO_PLANO), null);
});

test("exatamente no teto passa — o limite é `>`, não `>=`", () => {
  // Um erro aqui recusaria o arquivo que cabe exatamente, e o sintoma seria
  // um manual válido rejeitado sem explicação plausível.
  assert.equal(motivoDeRecusaPorTamanho(TETO_DO_PLANO, TETO_DO_PLANO), null);
});

/**
 * A distinção que este módulo existe para fazer.
 *
 * Um manual de 80 MB passa do que a instalação aguenta (50 MB) e NÃO passa do
 * que o produto suporta (100 MiB). Chamar isso de "grande demais" faria uma
 * agência concluir que o Brennimark não serve para manuais grandes — sobre um
 * limite de hospedagem provisório.
 */
test("acima do plano e abaixo do produto é recusa DA INSTALAÇÃO", () => {
  assert.equal(motivoDeRecusaPorTamanho(80 * MB, TETO_DO_PLANO), "acima-do-plano");
});

test("acima do produto é recusa do PRODUTO", () => {
  assert.equal(
    motivoDeRecusaPorTamanho(TETO_DO_PRODUTO_BYTES + 1, TETO_DO_PLANO),
    "grande-demais",
  );
});

test("no teto do produto ainda não é recusa do produto", () => {
  assert.equal(
    motivoDeRecusaPorTamanho(TETO_DO_PRODUTO_BYTES, TETO_DO_PRODUTO_BYTES),
    null,
  );
});

/**
 * Com o teto do plano igual ao do produto — o cenário pós-migração para o Pro
 * — só a recusa do produto pode acontecer, e a mensagem sobre a instalação
 * deixa de aparecer sozinha.
 */
test("com plano igual ao produto, só existe a recusa do produto", () => {
  assert.equal(
    motivoDeRecusaPorTamanho(TETO_DO_PRODUTO_BYTES + 1, TETO_DO_PRODUTO_BYTES),
    "grande-demais",
  );
});

test("o teto efetivo nunca passa do teto do produto", () => {
  // A variável de ambiente pode ser configurada para qualquer coisa; o produto
  // não passa a aceitar mais do que declara suportar por causa dela.
  assert.ok(LIMITES_DE_IMPORTACAO.maxBytes <= TETO_DO_PRODUTO_BYTES);
});

test("o teto efetivo é positivo — valor inválido cai no padrão do plano", () => {
  // `NaN` como teto faria `bytes > NaN` ser falso e o limite deixaria de
  // existir em silêncio, que é o defeito histórico deste módulo.
  assert.ok(Number.isFinite(LIMITES_DE_IMPORTACAO.maxBytes));
  assert.ok(LIMITES_DE_IMPORTACAO.maxBytes > 0);
});
