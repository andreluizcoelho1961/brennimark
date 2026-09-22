import assert from "node:assert/strict";
import test from "node:test";
import { avisoDeInterrupcao, marcaDeFim, separarFim } from "./fim-da-resposta";

/**
 * Resposta pela metade não pode passar por inteira — ensaio de 19/09.
 */

test("terminou bem: nenhuma marca", () => {
  assert.equal(marcaDeFim("stop"), null);
});

test("qualquer outro motivo marca o fim — inclusive o desconhecido", () => {
  for (const motivo of ["length", "content-filter", "error", "other", undefined, null, ""]) {
    assert.ok(marcaDeFim(motivo as string), `motivo ${String(motivo)} passou como terminado`);
  }
});

test("a marca sai do texto e vira o motivo", () => {
  const fluxo = "A decision needs to be made (such as the Sony" + marcaDeFim("content-filter");
  assert.deepEqual(separarFim(fluxo), {
    texto: "A decision needs to be made (such as the Sony",
    interrompida: "content-filter",
  });
});

test("texto sem marca fica como está", () => {
  assert.deepEqual(separarFim("Resposta inteira [Fonte: Cores — PRONTO · /docs/cores]"),
    { texto: "Resposta inteira [Fonte: Cores — PRONTO · /docs/cores]", interrompida: null });
});

test("pedaço da marca no meio do fluxo não pisca na tela", () => {
  const marca = marcaDeFim("length")!;
  for (let n = 1; n < marca.length; n++) {
    const parcial = separarFim("texto" + marca.slice(0, n));
    assert.equal(parcial.texto, "texto", `prefixo de ${n} caracteres apareceu`);
  }
});

test("colchetes que o modelo escreve não são confundidos com a marca", () => {
  assert.deepEqual(separarFim("veja [[nota]] e [[brennimark:incompleta:x]]"),
    { texto: "veja [[nota]] e [[brennimark:incompleta:x]]", interrompida: null });
});

test("motivo esquisito do provedor não vira texto arbitrário", () => {
  assert.equal(marcaDeFim("<script>")?.includes("<"), false);
});

test("o aviso diz o que faltou, sem jargão", () => {
  assert.match(avisoDeInterrupcao("content-filter"), /parou antes de terminar — o filtro de conteúdo/);
  assert.match(avisoDeInterrupcao("other"), /parou antes de terminar\. O que está acima pode estar incompleto/);
  assert.match(avisoDeInterrupcao("length", true), /stopped before finishing — the answer went past/);
});
