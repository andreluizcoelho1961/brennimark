import assert from "node:assert/strict";
import test from "node:test";
import {
  CARACTERES_POR_TOKEN,
  LIMITE_DO_MANUAL_INTEIRO_TOKENS,
  caracteresDoManual,
  lerManualInteiro,
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

/**
 * Um banco falso com o limite REAL da API do Supabase: nenhuma consulta
 * devolve mais de 1.000 linhas, peça o intervalo que pedir.
 */
function bancoComTrechos(total: number, falhaNaPagina?: number) {
  const pedidos: [number, number][] = [];
  const linhas = Array.from({ length: total }, (_, i) => ({
    slug: `doc-${String(i).padStart(5, "0")}`, title: "Manual", group_name: "Marca", section: null,
    status: "ready", page_start: i + 1, page_end: i + 1, content: `regra ${i + 1}`,
  }));
  const consulta = {
    select: () => consulta, eq: () => consulta, order: () => consulta,
    range: async (de: number, ate: number) => {
      pedidos.push([de, ate]);
      if (falhaNaPagina !== undefined && pedidos.length === falhaNaPagina) return { data: null, error: { code: "57014" } };
      return { data: linhas.slice(de, Math.min(ate + 1, de + 1000)), error: null };
    },
  };
  return { cliente: { from: () => consulta } as unknown as Parameters<typeof lerManualInteiro>[0], pedidos };
}

test("manual com mais de 1.000 trechos chega inteiro ao Vini, até a última regra", async () => {
  // Achado da revisão de 30/09/2026: 1.001 trechos, 1.000 lidos, e a regra
  // final sumia com `ok: true`.
  const { cliente } = bancoComTrechos(1001);
  const leitura = await lerManualInteiro(cliente, "marca");
  assert.equal(leitura.ok, true);
  if (!leitura.ok) return;
  assert.equal(leitura.trechos.length, 1001);
  assert.equal(leitura.trechos.at(-1)?.content, "regra 1001");
});

test("a leitura pede páginas seguidas, sem buraco nem sobreposição", async () => {
  const { cliente, pedidos } = bancoComTrechos(2500);
  const leitura = await lerManualInteiro(cliente, "marca");
  assert.equal(leitura.ok && leitura.trechos.length, 2500);
  assert.deepEqual(pedidos, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test("exatamente 1.000 trechos: confere a página seguinte, vazia, e para", async () => {
  const { cliente, pedidos } = bancoComTrechos(1000);
  const leitura = await lerManualInteiro(cliente, "marca");
  assert.equal(leitura.ok && leitura.trechos.length, 1000);
  assert.equal(pedidos.length, 2);
});

test("falha no meio da leitura é falha, nunca meio manual com ok", async () => {
  const { cliente } = bancoComTrechos(2500, 2);
  assert.deepEqual(await lerManualInteiro(cliente, "marca"), { ok: false, motivo: "57014" });
});
