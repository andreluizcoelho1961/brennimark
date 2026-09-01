import assert from "node:assert/strict";
import test from "node:test";
import { classificarErroDoParser, diagnosticar, temAssinaturaDePdf } from "./pdf-erros";

const bytes = (texto: string) => new TextEncoder().encode(texto).buffer;

test("a assinatura e o conteudo, nao a extensao", () => {
  assert.ok(temAssinaturaDePdf(bytes("%PDF-1.7 ...")));
  // Um .pdf que na verdade e outra coisa: o caso que a extensao nao pega.
  assert.ok(!temAssinaturaDePdf(bytes("<!doctype html>")));
  assert.ok(!temAssinaturaDePdf(bytes("PK")));
  assert.ok(!temAssinaturaDePdf(bytes("%PD")));
  assert.ok(!temAssinaturaDePdf(new ArrayBuffer(0)));
});

test("cada falha do parser vira uma acao diferente", () => {
  assert.equal(classificarErroDoParser({ name: "PasswordException" }), "protegido-por-senha");
  assert.equal(classificarErroDoParser({ name: "InvalidPDFException" }), "corrompido");
  assert.equal(classificarErroDoParser({ message: "xref table is broken" }), "corrompido");
  assert.equal(classificarErroDoParser(new Error("algo estranho")), "desconhecida");
});

test("o nome do erro e comparado por texto, nao por instancia", () => {
  // O PDF.js entra por import dinamico; `instanceof` quebra quando a classe
  // vem de outra instancia do modulo.
  assert.equal(classificarErroDoParser({ name: "PasswordException" }), "protegido-por-senha");
  assert.equal(classificarErroDoParser({ message: "No password given" }), "protegido-por-senha");
});

test("toda falha tem mensagem nos dois idiomas, e nenhuma e generica demais", () => {
  for (const falha of [
    "assinatura-invalida", "protegido-por-senha", "corrompido",
    "grande-demais", "paginas-demais", "sem-texto",
  ] as const) {
    const d = diagnosticar(falha);
    assert.ok(d.pt.length > 20, `${falha} precisa dizer o que fazer, nao so que falhou`);
    assert.ok(d.en.length > 20);
    assert.notEqual(d.pt, diagnosticar("desconhecida").pt);
  }
});
