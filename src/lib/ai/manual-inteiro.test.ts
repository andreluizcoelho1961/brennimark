import assert from "node:assert/strict";
import test from "node:test";
import {
  CARACTERES_POR_TOKEN,
  LIMITE_DO_MANUAL_INTEIRO_TOKENS,
  caracteresDoManual,
  manualCabeNoModelo,
  tokensEstimados,
} from "./manual-inteiro";
import { capacidadesDe } from "./catalogo";
import { montarContextoRecuperado, type Trecho } from "./recuperacao";

// Os tamanhos medidos no ensaio de 26/09/2026 (texto do índice de trechos).
const BRADESCO = 42_177;
const SONY = 13_021;

const gemini = capacidadesDe("google", "gemini-3.6-flash") ?? undefined;
const groq = capacidadesDe("groq", "qwen/qwen3.8-27b") ?? undefined;

test("a estimativa de tokens é conservadora: 3 caracteres por token", () => {
  assert.equal(CARACTERES_POR_TOKEN, 3);
  assert.equal(tokensEstimados(3_000), 1_000);
  assert.equal(tokensEstimados(-5), 0);
});

test("o Bradesco e a Sony cabem inteiros na IA principal (Gemini)", () => {
  assert.equal(manualCabeNoModelo(BRADESCO, gemini), true);
  assert.equal(manualCabeNoModelo(SONY, gemini), true);
});

test("na reserva gratuita (Groq, ~8 mil tokens/min) o Bradesco vai pela busca", () => {
  assert.ok(groq?.maxInputTokensPerMinute, "o catálogo precisa declarar o teto por minuto do Groq");
  assert.equal(manualCabeNoModelo(BRADESCO, groq), false);
});

test("manual gigante vai pela busca em qualquer modelo", () => {
  const gigante = (LIMITE_DO_MANUAL_INTEIRO_TOKENS + 1) * CARACTERES_POR_TOKEN;
  assert.equal(manualCabeNoModelo(gigante, gemini), false);
  assert.equal(manualCabeNoModelo(gigante, undefined), false);
});

test("modelo de contexto pequeno: metade do contexto é o teto", () => {
  const pequeno = { text: true, vision: false, streaming: true, maxContextTokens: 8_000 };
  assert.equal(manualCabeNoModelo(4_000 * CARACTERES_POR_TOKEN, pequeno), true);
  assert.equal(manualCabeNoModelo(4_001 * CARACTERES_POR_TOKEN, pequeno), false);
});

test("manual vazio não é 'manual inteiro'", () => {
  assert.equal(manualCabeNoModelo(0, gemini), false);
  assert.equal(caracteresDoManual([]), 0);
});

const pagina = (n: number, conteudo: string): Trecho => ({
  documentSlug: `p${n}`, documentTitle: `Página ${n}`, groupName: "Manual", section: null,
  status: "draft", pageStart: n, pageEnd: n, content: conteudo,
});

test("no modo inteiro, nenhum trecho é cortado nem descartado", () => {
  const longo = "Paleta: vermelho #CC092F. ".repeat(400); // ~10 mil caracteres, acima do teto de um trecho
  const manual = Array.from({ length: 12 }, (_, i) => pagina(i + 1, i === 11 ? longo : `Texto da página ${i + 1}.`));
  const { usados, texto } = montarContextoRecuperado(manual, {}, "", "inteiro");
  assert.equal(usados.length, 12, "o modo trechos parava em 6; o inteiro leva todas");
  assert.ok(texto.includes(longo), "o trecho longo vai inteiro, sem reticência");
  const { usados: recortados } = montarContextoRecuperado(manual, {}, "", "trechos");
  assert.ok(recortados.length < 12);
});
