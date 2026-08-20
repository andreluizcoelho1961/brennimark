import assert from "node:assert/strict";
import test from "node:test";
import { getModelCommercialInfo, PROVIDER_MODELS, requiresBillingConsent, supportsVision } from "./provider";

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
