import assert from "node:assert/strict";
import test from "node:test";
import { dolaresEmMicros, lerMotivo, lerRotas, modelosOferecidos } from "./ia";
import { chaveDaPlataforma, chavesPresentes, VARIAVEL_DA_CHAVE } from "../ai/chaves-da-plataforma";

test("o Console só oferece modelos com preço verificado; a análise, só os que enxergam", () => {
  const chat = modelosOferecidos("chat");
  const analise = modelosOferecidos("analysis");
  assert.ok(chat.length > 0 && chat.every((m) => m.capabilities.pricing !== undefined));
  assert.ok(analise.every((m) => m.capabilities.vision && m.capabilities.pricing !== undefined));
  assert.ok(chat.some((m) => m.model === "gemini-3.6-flash"));
  assert.ok(chat.some((m) => m.model === "qwen/qwen3.8-27b"));
});

test("as rotas pedidas chegam conferidas", () => {
  const ok = lerRotas("chat", [{ provider: "google", model: "gemini-3.6-flash" }, { provider: "groq", model: "qwen/qwen3.8-27b" }], 20000);
  assert.deepEqual(ok, { ok: true, rotas: [{ provider: "google", model: "gemini-3.6-flash" }, { provider: "groq", model: "qwen/qwen3.8-27b" }], esperaMs: 20000 });
  assert.equal(lerRotas("resumo", [], 20000).ok, false);
  assert.equal(lerRotas("chat", [], 20000).ok, false);
  assert.equal(lerRotas("chat", Array(4).fill({ provider: "google", model: "gemini-3.6-flash" }), 20000).ok, false);
  assert.equal(lerRotas("chat", [{ provider: "google", model: "inventado" }], 20000).ok, false);
  assert.equal(lerRotas("chat", [{ provider: "google", model: "gemini-3.6-flash" }, { provider: "google", model: "gemini-3.6-flash" }], 20000).ok, false);
  assert.equal(lerRotas("chat", [{ provider: "google", model: "gemini-3.6-flash" }], 500).ok, false);
  assert.equal(lerRotas("chat", [{ provider: "google", model: "gemini-3.6-flash" }], 200000).ok, false);
  // Modelo que só lê texto não serve à análise de peça; o Qwen 3.8, que
  // enxerga, serve.
  const semVisao = modelosOferecidos("chat").find((m) => !m.capabilities.vision);
  assert.ok(semVisao, "o catálogo tem ao menos um modelo só de texto com preço");
  assert.equal(lerRotas("analysis", [{ provider: semVisao!.provider, model: semVisao!.model }], 30000).ok, false);
  assert.equal(lerRotas("analysis", [{ provider: "groq", model: "qwen/qwen3.8-27b" }], 30000).ok, true);
});

test("dólares digitados viram micros; torto vira nada", () => {
  assert.equal(dolaresEmMicros("5"), 5_000_000);
  assert.equal(dolaresEmMicros("5,50"), 5_500_000);
  assert.equal(dolaresEmMicros("US$ 60"), 60_000_000);
  assert.equal(dolaresEmMicros("0"), 0);
  for (const torto of ["", "-5", "cinco", "5,123456", "100001"]) assert.equal(dolaresEmMicros(torto), null, torto);
});

test("o motivo é obrigatório", () => {
  assert.equal(lerMotivo("  Gemini   em pico  "), "Gemini em pico");
  assert.equal(lerMotivo("ok"), null);
  assert.equal(lerMotivo(undefined), null);
  assert.equal(lerMotivo("x".repeat(501)), null);
});

test("as chaves da plataforma: só se existem, nunca o valor", () => {
  const ambiente = { BRENNIMARK_CHAVE_GOOGLE: "  abc  ", BRENNIMARK_CHAVE_GROQ: "   " };
  assert.equal(chaveDaPlataforma("google", ambiente), "abc");
  assert.equal(chaveDaPlataforma("groq", ambiente), null);
  const presentes = chavesPresentes(ambiente);
  assert.equal(presentes.google, true);
  assert.equal(presentes.groq, false);
  assert.equal(presentes.anthropic, false);
  assert.equal(VARIAVEL_DA_CHAVE.google, "BRENNIMARK_CHAVE_GOOGLE");
  // O que o Console recebe não carrega valor nenhum.
  assert.ok(Object.values(presentes).every((v) => typeof v === "boolean"));
});
