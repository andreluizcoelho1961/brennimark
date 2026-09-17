import assert from "node:assert/strict";
import test from "node:test";
import { conferirEvidencia, fingerprintImage } from "./evidencia";

/**
 * A conferência que faltava no relatório de conformidade (achado 1, 2ª metade).
 *
 * O caso que importa é o negativo: bytes trocados precisam ser detectados. Sem
 * ele, o relatório desenharia outra peça ao lado do veredito da original.
 */
const PECA = Buffer.from("a peça que foi analisada");
const OUTRA = Buffer.from("uma peça trocada depois");

test("os mesmos bytes conferem", () => {
  assert.equal(conferirEvidencia(fingerprintImage(PECA), PECA), "confere");
});

test("bytes trocados divergem", () => {
  assert.equal(conferirEvidencia(fingerprintImage(PECA), OUTRA), "diverge");
});

test("um byte a mais já diverge", () => {
  // Troca sutil é o caso realista: recortar, recomprimir, repor um pixel.
  assert.equal(conferirEvidencia(fingerprintImage(PECA), Buffer.concat([PECA, Buffer.from(" ")])), "diverge");
});

test("linha sem impressão digital NÃO é tratada como conferida", () => {
  // Ausência de prova não é prova. As linhas anteriores ao campo caem aqui, e
  // o relatório precisa dizer isso em vez de afirmar conformidade.
  assert.equal(conferirEvidencia(null, PECA), "sem-impressao");
  assert.equal(conferirEvidencia("", PECA), "sem-impressao");
});
