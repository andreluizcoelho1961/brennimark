import assert from "node:assert/strict";
import test from "node:test";
import { ESPERA_PADRAO_MS, montarRotas, type LinhaDeRota } from "./rotas-da-plataforma";

/**
 * As rotas da plataforma: o que o Console escolhe, com as chaves da Vercel.
 * As chaves aqui são de mentira — o teste só confere que cada provedor recebe
 * a SUA variável e que nada inventa uma chave que falta.
 */
const AMBIENTE = { BRENNIMARK_CHAVE_GOOGLE: "chave-google-de-teste", BRENNIMARK_CHAVE_GROQ: "chave-groq-de-teste" };

const LINHAS: LinhaDeRota[] = [
  { tarefa: "chat", ordem: 2, provider: "groq", model: "qwen/qwen3.8-27b", espera_ms: 20000 },
  { tarefa: "chat", ordem: 1, provider: "google", model: "gemini-3.6-flash", espera_ms: 20000 },
  { tarefa: "analysis", ordem: 1, provider: "google", model: "gemini-3.6-flash", espera_ms: 30000 },
];

test("as tentativas seguem a ordem do Console, cada uma com a chave do seu provedor", () => {
  const r = montarRotas(LINHAS, "chat", AMBIENTE);
  assert.deepEqual(
    r.attempts.map((a) => [a.config.provider, a.config.model, a.config.apiKey]),
    [
      ["google", "gemini-3.6-flash", "chave-google-de-teste"],
      ["groq", "qwen/qwen3.8-27b", "chave-groq-de-teste"],
    ],
  );
  assert.equal(r.timeoutMs, 20000);
  // Reserva de outro provedor é escolha da Brennimark, não de uma conta.
  assert.equal(r.allowCrossProvider, true);
  assert.deepEqual(r.descartadas, []);
});

test("só entram as rotas da tarefa pedida", () => {
  const r = montarRotas(LINHAS, "analysis", AMBIENTE);
  assert.deepEqual(r.attempts.map((a) => a.config.provider), ["google"]);
  assert.equal(r.timeoutMs, 30000);
});

test("provedor sem chave na Vercel é pulado, e dito — a reserva assume", () => {
  const r = montarRotas(LINHAS, "chat", { BRENNIMARK_CHAVE_GROQ: "chave-groq-de-teste" });
  assert.deepEqual(r.attempts.map((a) => a.config.provider), ["groq"]);
  assert.deepEqual(r.descartadas, [{ provider: "google", model: "gemini-3.6-flash", motivo: "sem-chave" }]);
});

test("chave só com espaços conta como ausente", () => {
  const r = montarRotas(LINHAS, "analysis", { BRENNIMARK_CHAVE_GOOGLE: "   " });
  assert.deepEqual(r.attempts, []);
  assert.equal(r.descartadas[0].motivo, "sem-chave");
});

test("modelo fora do catálogo não é usado, mesmo com chave", () => {
  const r = montarRotas(
    [{ tarefa: "chat", ordem: 1, provider: "google", model: "modelo-inventado", espera_ms: 20000 }],
    "chat",
    AMBIENTE,
  );
  assert.deepEqual(r.attempts, []);
  assert.deepEqual(r.descartadas, [{ provider: "google", model: "modelo-inventado", motivo: "fora-do-catalogo" }]);
});

test("sem rota nenhuma, nenhuma tentativa — e a espera padrão da tarefa", () => {
  const r = montarRotas([], "chat", AMBIENTE);
  assert.deepEqual(r.attempts, []);
  assert.equal(r.timeoutMs, ESPERA_PADRAO_MS.chat);
});

test("nenhuma tentativa é marcada como demonstração", () => {
  assert.ok(montarRotas(LINHAS, "chat", AMBIENTE).attempts.every((a) => a.isDemo === false));
});
