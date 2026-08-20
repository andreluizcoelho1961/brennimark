import assert from "node:assert/strict";
import test from "node:test";
import { FirstChunkTimeoutError, prepareStreamWithFallback } from "./stream-fallback";
import { evaluateChatInitialText } from "./chat-quality";

async function* chunks(values: string[]) {
  for (const value of values) yield value;
}

test("mantém a rota principal quando ela inicia a resposta no prazo", async () => {
  const prepared = await prepareStreamWithFallback({
    attempts: ["principal", "reserva"],
    firstChunkTimeoutMs: 30,
    start: (attempt) => chunks([attempt]),
  });

  assert.equal(prepared.attempt, "principal");
  assert.equal(prepared.fallbackUsed, false);
  assert.equal(prepared.firstChunk, "principal");
  prepared.cleanup();
});

test("troca para a reserva quando a principal demora antes do primeiro texto", async () => {
  let primaryWasAborted = false;
  const prepared = await prepareStreamWithFallback({
    attempts: ["principal", "reserva"],
    firstChunkTimeoutMs: 10,
    start: (attempt, signal) => {
      if (attempt === "reserva") return chunks(["resposta"]);
      return (async function* () {
        await new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => {
            primaryWasAborted = true;
            resolve();
          });
        });
      })();
    },
  });

  assert.equal(primaryWasAborted, true);
  assert.equal(prepared.attempt, "reserva");
  assert.equal(prepared.fallbackUsed, true);
  assert.equal(prepared.firstChunk, "resposta");
  prepared.cleanup();
});

test("troca para a reserva quando a principal falha imediatamente", async () => {
  const starts: string[] = [];
  const failures: string[] = [];
  const prepared = await prepareStreamWithFallback({
    attempts: ["principal", "reserva"],
    firstChunkTimeoutMs: 30,
    start: (attempt) => {
      if (attempt === "principal") throw new Error("indisponível");
      return chunks(["ok"]);
    },
    onAttemptStart: (attempt) => starts.push(attempt),
    onAttemptFailure: (attempt) => failures.push(attempt),
  });

  assert.equal(prepared.attempt, "reserva");
  assert.equal(prepared.fallbackUsed, true);
  assert.deepEqual(starts, ["principal", "reserva"]);
  assert.deepEqual(failures, ["principal"]);
  prepared.cleanup();
});

test("troca para a reserva quando a principal retorna apenas um rótulo de segurança", async () => {
  const prepared = await prepareStreamWithFallback({
    attempts: ["principal", "reserva"],
    firstChunkTimeoutMs: 30,
    validateInitialText: evaluateChatInitialText,
    start: (attempt) => attempt === "principal"
      ? chunks(["User ", "Safety: ", "safe"])
      : chunks(["Resposta fundamentada."]),
  });

  assert.equal(prepared.attempt, "reserva");
  assert.equal(prepared.fallbackUsed, true);
  assert.equal(prepared.firstChunk, "Resposta fundamentada.");
  prepared.cleanup();
});

test("não tenta outra rota depois que o usuário cancela", async () => {
  const parent = new AbortController();
  let attempts = 0;
  setTimeout(() => parent.abort(), 5);

  await assert.rejects(
    prepareStreamWithFallback({
      attempts: ["principal", "reserva"],
      firstChunkTimeoutMs: 50,
      parentSignal: parent.signal,
      start: (_attempt, signal) => {
        attempts += 1;
        return (async function* () {
          await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
        })();
      },
    }),
    (error) => error instanceof DOMException && error.name === "AbortError"
  );

  assert.equal(attempts, 1);
});

test("expõe um erro específico quando não existe reserva", async () => {
  await assert.rejects(
    prepareStreamWithFallback({
      attempts: ["principal"],
      firstChunkTimeoutMs: 5,
      start: (_attempt, signal) =>
        (async function* () {
          await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
        })(),
    }),
    (error) => error instanceof AggregateError && error.errors[0] instanceof FirstChunkTimeoutError
  );
});
