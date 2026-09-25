import assert from "node:assert/strict";
import test from "node:test";
import { ehContaRemovida, rotuloDaPessoa } from "./conta-removida";

test("o apelido de conta removida vira 'Conta removida · XXXXXX'", () => {
  assert.equal(rotuloDaPessoa("conta-removida-7f3a2c@removida.invalid"), "Conta removida · 7F3A2C");
  assert.equal(rotuloDaPessoa("conta-removida-7f3a2c@removida.invalid", true), "Removed account · 7F3A2C");
  assert.equal(ehContaRemovida("conta-removida-7f3a2c@removida.invalid"), true);
});

test("e-mail de verdade passa como está — inclusive um que só se parece", () => {
  assert.equal(rotuloDaPessoa("bia@agencia.com.br"), "bia@agencia.com.br");
  assert.equal(rotuloDaPessoa("conta-removida-7f3a2c@removida.com"), "conta-removida-7f3a2c@removida.com");
  assert.equal(rotuloDaPessoa("conta-removida-XYZ@removida.invalid"), "conta-removida-XYZ@removida.invalid");
  assert.equal(ehContaRemovida("bia@agencia.com.br"), false);
  assert.equal(rotuloDaPessoa(null), "");
});
