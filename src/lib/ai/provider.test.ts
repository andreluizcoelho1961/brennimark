import assert from "node:assert/strict";
import test from "node:test";
import { getAnalysisProviderOptions, getChatProviderOptions, getModelCommercialInfo, PROVIDER_MODELS, requiresBillingConsent, supportsVision } from "./provider";

test("offers the stable OpenRouter free router as the first suggestion", () => {
  assert.equal(PROVIDER_MODELS.openrouter[0], "openrouter/free");
});

test("accepts the configured OpenRouter routes for image analysis", () => {
  assert.equal(supportsVision({ model: "openrouter/free" }), true);
  assert.equal(supportsVision({ model: "google/gemma-4-26b-a4b-it:free" }), true);
  assert.equal(supportsVision({ model: "nvidia/nemotron-3-ultra-550b-a55b:free" }), true);
  assert.equal(supportsVision({ model: "qwen/qwen3.5-flash-02-23" }), true);
});

test("marks the fast visual model as paid and free routes as free", () => {
  const fast = getModelCommercialInfo("openrouter", "qwen/qwen3.5-flash-02-23");
  assert.equal(fast.billing, "paid");
  assert.match(fast.pricing ?? "", /US\$/);
  assert.equal(requiresBillingConsent("openrouter", "qwen/qwen3.5-flash-02-23"), true);
  assert.equal(requiresBillingConsent("openrouter", "google/gemma-4-26b-a4b-it:free"), false);
});

test("continues rejecting a known text-only model", () => {
  assert.equal(supportsVision({ model: "openai/gpt-oss-20b" }), false);
});

test("Gemini 3 pensa pouco no chat e na análise — a espera passava de 30 s", () => {
  const gemini = { provider: "google" as const, model: "gemini-3.6-flash", apiKey: "x" };
  const esperado = { google: { thinkingConfig: { thinkingLevel: "low" } } };
  assert.deepEqual(getChatProviderOptions(gemini), esperado);
  assert.deepEqual(getAnalysisProviderOptions(gemini), esperado);
});

test("Gemini 2.5 e outros provedores não ganham o controle do Gemini 3", () => {
  assert.equal(getChatProviderOptions({ provider: "google", model: "gemini-2.5-flash", apiKey: "x" }), undefined);
  assert.equal(getAnalysisProviderOptions({ provider: "anthropic", model: "claude-sonnet-5", apiKey: "x" }), undefined);
  // O controle do Groq continua o de antes.
  assert.deepEqual(getChatProviderOptions({ provider: "groq", model: "openai/gpt-oss-20b", apiKey: "x" }),
    { groq: { reasoningFormat: "hidden", reasoningEffort: "low" } });
});
