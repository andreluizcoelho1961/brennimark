import assert from "node:assert/strict";
import test from "node:test";
import {
  TETO_DA_FATIA,
  contentRange,
  contentRangeForaDoAlcance,
  ifRangeAutoriza,
  resolverRange,
  totalDoContentRange,
} from "./range";

const TAMANHO = 11_844_340; // o tamanho medido do manual da sondagem

test("sem cabeçalho Range, o arquivo inteiro", () => {
  assert.deepEqual(resolverRange(null, TAMANHO), { tipo: "completo" });
});

test("intervalo inicial: bytes=0-1023", () => {
  assert.deepEqual(resolverRange("bytes=0-1023", TAMANHO), {
    tipo: "parcial",
    inicio: 0,
    fim: 1023,
  });
});

/**
 * O teste que justifica o módulo.
 *
 * O PDF.js lê o FIM do arquivo primeiro, atrás da tabela de referências
 * cruzadas. Um servidor que interprete `bytes=-1024` como "do 0 ao 1024"
 * devolve 206 com os bytes errados — sucesso aparente, documento corrompido.
 * A sondagem mediu o valor esperado: 11843316-11844339/11844340.
 */
test("intervalo-sufixo devolve os ÚLTIMOS bytes, nunca os primeiros", () => {
  const r = resolverRange("bytes=-1024", TAMANHO);
  assert.deepEqual(r, { tipo: "parcial", inicio: 11_843_316, fim: 11_844_339 });
  assert.equal(
    contentRange(11_843_316, 11_844_339, TAMANHO),
    "bytes 11843316-11844339/11844340",
  );
});

test("sufixo maior que o arquivo encurta para o arquivo inteiro, e não é erro", () => {
  assert.deepEqual(resolverRange("bytes=-999", 100), { tipo: "parcial", inicio: 0, fim: 99 });
});

test("bytes=100- vai até o fim", () => {
  assert.deepEqual(resolverRange("bytes=100-", 1000), { tipo: "parcial", inicio: 100, fim: 999 });
});

test("fim além do arquivo é aparado, não recusado", () => {
  assert.deepEqual(resolverRange("bytes=900-5000", 1000), {
    tipo: "parcial",
    inicio: 900,
    fim: 999,
  });
});

test("começar em ou depois do fim é 416", () => {
  assert.deepEqual(resolverRange("bytes=1000-1100", 1000), { tipo: "fora-do-alcance" });
  assert.deepEqual(resolverRange("bytes=1000-", 1000), { tipo: "fora-do-alcance" });
});

test("intervalo invertido é 416", () => {
  assert.deepEqual(resolverRange("bytes=500-100", 1000), { tipo: "fora-do-alcance" });
});

test("sufixo de zero bytes é 416", () => {
  assert.deepEqual(resolverRange("bytes=-0", 1000), { tipo: "fora-do-alcance" });
});

test("arquivo vazio não satisfaz intervalo nenhum", () => {
  assert.deepEqual(resolverRange("bytes=0-10", 0), { tipo: "fora-do-alcance" });
});

test("416 informa só o tamanho", () => {
  assert.equal(contentRangeForaDoAlcance(1000), "bytes */1000");
});

/**
 * Ignorar, e não recusar, é o que a RFC 9110 §14.2 permite — e é o que evita
 * que um cabeçalho estranho posto por um intermediário vire falha de leitura
 * do documento.
 */
test("malformado é ignorado e vira arquivo inteiro", () => {
  for (const ruim of ["bytes=abc-def", "items=0-10", "bytes 0-10", "", "bytes=-"]) {
    assert.deepEqual(resolverRange(ruim, TAMANHO), { tipo: "completo" }, `falhou em: ${ruim}`);
  }
});

test("multi-intervalo é ignorado, nunca atendido pela metade", () => {
  // Atender só o primeiro entregaria MENOS bytes do que o cliente pediu, com
  // status de sucesso. Nenhum cliente que servimos pede multi-intervalo.
  assert.deepEqual(resolverRange("bytes=0-99,200-299", TAMANHO), { tipo: "completo" });
});

/**
 * A regressão mais cara desta rota, e ela era de DESENHO.
 *
 * O teto recusava com 413 em vez de aparar. O PDF.js pede o documento inteiro
 * num único intervalo em algumas situações, recebia a recusa, e caía numa
 * sequência de tentativas — um manual de 4,07 MiB, apenas 70 KB acima do teto,
 * abria "super lento" em produção.
 *
 * Aparar não entrega menos do que se promete: promete menos. O `Content-Range`
 * descreve exatamente os bytes enviados.
 */
test("pedido acima do teto é APARADO ao teto, não recusado", () => {
  const r = resolverRange(`bytes=0-${TETO_DA_FATIA}`, TAMANHO);
  assert.deepEqual(r, { tipo: "parcial", inicio: 0, fim: TETO_DA_FATIA - 1 });
});

test("o documento inteiro pedido de uma vez vira a primeira fatia", () => {
  // O caso exato do manual real: 4,07 MiB pedidos num intervalo só.
  const quaseQuatroEMeio = 4_263_503;
  const r = resolverRange(`bytes=0-${quaseQuatroEMeio - 1}`, quaseQuatroEMeio);
  assert.deepEqual(r, { tipo: "parcial", inicio: 0, fim: TETO_DA_FATIA - 1 });
});

test("aparar preserva o INÍCIO pedido, nunca o desloca", () => {
  // Aparar pelo fim entrega um prefixo do que foi pedido, que o cliente
  // consegue continuar. Aparar pelo início entregaria outro pedaço.
  const r = resolverRange(`bytes=1000-${1000 + TETO_DA_FATIA + 500}`, 50_000_000);
  assert.deepEqual(r, { tipo: "parcial", inicio: 1000, fim: 1000 + TETO_DA_FATIA - 1 });
});

test("um intervalo sem Range continua sendo o arquivo inteiro, mesmo acima do teto", () => {
  // Sem `Range` não há o que aparar: a resposta é 200 e o cliente aborta ao
  // ler os cabeçalhos. Foi recusar ISTO que fechou a porta para todo manual
  // acima de 4 MiB.
  assert.deepEqual(resolverRange(null, 100_000_000), { tipo: "completo" });
});

test("exatamente no teto ainda passa", () => {
  const r = resolverRange(`bytes=0-${TETO_DA_FATIA - 1}`, TAMANHO);
  assert.deepEqual(r, { tipo: "parcial", inicio: 0, fim: TETO_DA_FATIA - 1 });
});

test("espaço em volta do cabeçalho não muda o resultado", () => {
  assert.deepEqual(resolverRange("  bytes=0-10  ", 1000), { tipo: "parcial", inicio: 0, fim: 10 });
});

test("If-Range ausente autoriza o intervalo", () => {
  assert.equal(ifRangeAutoriza(null, '"abc"'), true);
});

test("If-Range igual autoriza, com ou sem aspas e prefixo fraco", () => {
  assert.equal(ifRangeAutoriza('"abc"', '"abc"'), true);
  assert.equal(ifRangeAutoriza("abc", '"abc"'), true);
  assert.equal(ifRangeAutoriza('W/"abc"', '"abc"'), true);
});

test("If-Range diferente NÃO autoriza — o arquivo mudou sob o leitor", () => {
  // Sem isto, dois pedaços de arquivos diferentes seriam colados sem erro.
  assert.equal(ifRangeAutoriza('"antigo"', '"novo"'), false);
});

test("If-Range sem etag conhecido não autoriza", () => {
  assert.equal(ifRangeAutoriza('"abc"', null), false);
});

test("o total sai do Content-Range de uma resposta 206", () => {
  assert.equal(totalDoContentRange("bytes 0-1023/11844340"), 11_844_340);
  assert.equal(totalDoContentRange("bytes 11843316-11844339/11844340"), 11_844_340);
});

test("o total sai também do Content-Range de um 416", () => {
  assert.equal(totalDoContentRange("bytes */1000"), 1000);
});

test("Content-Range ausente ou sem total devolve null, nunca NaN", () => {
  // NaN disfarçado de número passaria por `Number.isFinite` como falso e
  // desligaria a conferência em silêncio — que é o oposto do que ela existe
  // para fazer.
  assert.equal(totalDoContentRange(null), null);
  assert.equal(totalDoContentRange("bytes 0-1023/*"), null);
  assert.equal(totalDoContentRange("lixo"), null);
});
