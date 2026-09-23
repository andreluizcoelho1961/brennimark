import assert from "node:assert/strict";
import test from "node:test";
import { executarEmFila, FalhaDeExposicaoDeCobranca } from "./execucao";
import type { ModelPricing } from "./catalogo";
import type { LanguageModelUsage } from "ai";

/**
 * A fila de IAs — decisão do André, 23/09/2026: principal e reserva de outro
 * provedor, em fila. O que estes testes trancam:
 *
 * - a reserva só entra quando a principal falha ANTES de responder;
 * - cada tentativa tem execução própria no razão, reservada pelo preço DELA;
 * - a tentativa que falhou é liquidada, nunca esquecida como `reserved`;
 * - orçamento e pausa param a fila; modelo sem preço só pula a vez;
 * - cancelamento e falha do razão não trocam de IA.
 */
type Chamada = { fn: string; args: Record<string, unknown> };
type RespostaRpc = { data?: unknown; error?: { message: string } | null };

function razaoFalso(respostas: Record<string, RespostaRpc | ((args: Record<string, unknown>) => RespostaRpc)> = {}) {
  const chamadas: Chamada[] = [];
  return {
    chamadas,
    cliente: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        chamadas.push({ fn, args });
        const r = respostas[fn];
        const resposta = typeof r === "function" ? r(args) : r;
        if (resposta) return { data: resposta.data ?? null, error: resposta.error ?? null };
        if (fn === "marcar_exposicao_de_cobranca_server") return { data: true, error: null };
        if (fn === "reservar_execucao_de_ia_server") {
          return { data: [{ ok: true, motivo: "reservado", execution_id: args.p_execution_id, status: "reserved" }], error: null };
        }
        if (fn === "kill_switch_ativo") return { data: [{ workspace: false, marca: false }], error: null };
        return { data: null, error: null };
      },
    } as never,
  };
}

const PRINCIPAL = { config: { provider: "google", model: "gemini-3.6-flash" } };
const RESERVA = { config: { provider: "groq", model: "qwen/qwen3.8-27b" } };
const SEM_PRECO = { config: { provider: "groq", model: "openai/gpt-oss-20b" } };

const PRECO_DA_PRINCIPAL: ModelPricing = {
  inputPerMillionTokensUsd: 0.75, outputPerMillionTokensUsd: 3.75, currency: "USD", source: "teste", asOf: "2026-09-23",
};

const PEDIDO = {
  workspaceId: "ws-1", brandId: "brand-1", executionId: "exec-principal",
  task: "assist" as const, role: "", question: "qual é a cor primária?", sources: [],
};

function uso(entrada: number, saida: number): LanguageModelUsage {
  return {
    inputTokens: entrada, outputTokens: saida, totalTokens: entrada + saida,
    inputTokenDetails: { noCacheTokens: entrada, cacheReadTokens: undefined, cacheWriteTokens: undefined },
    outputTokenDetails: { textTokens: saida, reasoningTokens: undefined },
  };
}

async function* texto(pedacos: string[]) {
  for (const p of pedacos) yield p;
}

async function* sobrecarga(): AsyncGenerator<string> {
  throw Object.assign(new Error("503 UNAVAILABLE: model overloaded"), { statusCode: 503 });
}

async function drenar(iterator: AsyncIterator<string>) {
  let t = "";
  for (let n = await iterator.next(); !n.done; n = await iterator.next()) t += n.value;
  return t;
}

function parametros(cliente: never, dispatch: Parameters<typeof executarEmFila>[0]["dispatch"], extra: Partial<Parameters<typeof executarEmFila>[0]> = {}) {
  let n = 0;
  return {
    supabase: cliente, serviceClient: cliente, userId: "user-1", request: PEDIDO,
    attempts: [PRINCIPAL, RESERVA],
    primeira: { pricing: PRECO_DA_PRINCIPAL, reservedMicros: 7_000, maxOutputTokens: 2_000 },
    firstChunkTimeoutMs: 1_000, usageTimeoutMs: 20,
    novoId: () => `exec-reserva-${++n}`,
    dispatch,
    ...extra,
  };
}

const liquidacoes = (chamadas: Chamada[]) => chamadas.filter((c) => c.fn === "consolidar_execucao_de_ia_server").map((c) => c.args);

test("a principal responde: a reserva nem é consultada, e nada se reserva de novo", async () => {
  const { cliente, chamadas } = razaoFalso();
  const tentadas: string[] = [];
  const execucao = await executarEmFila(parametros(cliente, (a) => {
    tentadas.push(a.config.provider);
    return { textStream: texto(["azul", " cobalto"]), usage: Promise.resolve(uso(100, 10)) };
  }));
  assert.equal(execucao.firstChunk + (await drenar(execucao.iterator)), "azul cobalto");
  assert.deepEqual(tentadas, ["google"]);
  assert.equal(execucao.fallbackUsed, false);
  assert.equal(execucao.executionId, "exec-principal");
  assert.equal(chamadas.filter((c) => c.fn === "reservar_execucao_de_ia_server").length, 0);
});

test("a principal falha antes de responder: a reserva responde, com execução e reserva próprias", async () => {
  const { cliente, chamadas } = razaoFalso();
  const tetos: number[] = [];
  const execucao = await executarEmFila(parametros(cliente, (a, _s, teto) => {
    tetos.push(teto);
    return a === PRINCIPAL
      ? { textStream: sobrecarga(), usage: Promise.reject(new Error("sem uso")) }
      : { textStream: texto(["azul"]), usage: Promise.resolve(uso(100, 10)) };
  }));
  assert.equal(execucao.firstChunk + (await drenar(execucao.iterator)), "azul");
  assert.equal(execucao.fallbackUsed, true);
  assert.equal(execucao.attempt, RESERVA);
  assert.equal(execucao.executionId, "exec-reserva-1");

  // A reserva da segunda tentativa: id novo, preço do Groq no retrato.
  const reserva = chamadas.find((c) => c.fn === "reservar_execucao_de_ia_server");
  assert.ok(reserva, "a troca de IA não reservou orçamento de novo");
  assert.equal(reserva.args.p_execution_id, "exec-reserva-1");
  assert.equal((reserva.args.p_price_snapshot as { provider: string }).provider, "groq");

  // As duas execuções terminam liquidadas: a que falhou pelo teto (uso
  // desconhecido), a que respondeu pelo uso real ao preço do Groq.
  const [falhou, respondeu] = liquidacoes(chamadas);
  assert.equal(falhou.p_execution_id, "exec-principal");
  assert.equal(falhou.p_settled_micros, 7_000);
  assert.deepEqual(falhou.p_usage_snapshot, { unknown: true });
  assert.equal(respondeu.p_execution_id, "exec-reserva-1");
  assert.equal(respondeu.p_settled_micros, 100 * 0.8 + 10 * 4);
  assert.equal(respondeu.p_provider, "groq");
  // Cada tentativa com o teto de saída DELA: o Groq gratuito aceita 1.000.
  assert.deepEqual(tetos, [2_000, 1_000]);
});

test("as duas falham: o erro sai achatado, com a causa da ÚLTIMA por último", async () => {
  const { cliente, chamadas } = razaoFalso();
  await assert.rejects(
    executarEmFila(parametros(cliente, (a) => ({
      textStream: a === PRINCIPAL ? sobrecarga() : (async function* () { throw new Error("429 rate limit"); })(),
      usage: Promise.reject(new Error("sem uso")),
    }))),
    (erro: unknown) => {
      assert.ok(erro instanceof AggregateError);
      assert.ok(erro.errors.every((e) => !(e instanceof AggregateError)), "erro aninhado esconde a causa");
      assert.match(String((erro.errors.at(-1) as Error).message), /429/);
      return true;
    },
  );
  assert.equal(liquidacoes(chamadas).length, 2, "uma tentativa ficou presa como reservada");
});

test("orçamento esgotado na troca: a fila para, e o erro é o da principal", async () => {
  const { cliente, chamadas } = razaoFalso({
    reservar_execucao_de_ia_server: { data: [{ ok: false, motivo: "orcamento_da_marca_esgotado", execution_id: "x", status: null }] },
  });
  const recusas: string[] = [];
  let tentativas = 0;
  await assert.rejects(
    executarEmFila(parametros(cliente, () => {
      tentativas++;
      return { textStream: sobrecarga(), usage: Promise.reject(new Error("sem uso")) };
    }, { onReservaRecusada: (_a, _i, motivo) => recusas.push(motivo) })),
    (erro: unknown) => erro instanceof AggregateError && /overloaded/.test(String((erro.errors.at(-1) as Error).message)),
  );
  assert.equal(tentativas, 1, "a reserva foi despachada sem orçamento");
  assert.deepEqual(recusas, ["orcamento_da_marca_esgotado"]);
  assert.equal(liquidacoes(chamadas).length, 1);
});

test("reserva sem preço verificado pula a vez, e a próxima da fila responde", async () => {
  const { cliente } = razaoFalso();
  const tentadas: string[] = [];
  const recusas: string[] = [];
  const execucao = await executarEmFila(parametros(cliente, (a) => {
    tentadas.push(a.config.model);
    return a === PRINCIPAL
      ? { textStream: sobrecarga(), usage: Promise.reject(new Error("sem uso")) }
      : { textStream: texto(["ok"]), usage: Promise.resolve(uso(1, 1)) };
  }, { attempts: [PRINCIPAL, SEM_PRECO, RESERVA], onReservaRecusada: (_a, _i, m) => recusas.push(m) }));
  assert.equal(execucao.attempt, RESERVA);
  assert.deepEqual(tentadas, ["gemini-3.6-flash", "qwen/qwen3.8-27b"]);
  assert.deepEqual(recusas, ["preco_nao_verificado"]);
});

test("cancelamento de quem pediu não troca de IA", async () => {
  const { cliente } = razaoFalso();
  const controle = new AbortController();
  let tentativas = 0;
  await assert.rejects(executarEmFila(parametros(cliente, () => {
    tentativas++;
    controle.abort(new Error("a pessoa fechou a janela"));
    return { textStream: sobrecarga(), usage: Promise.reject(new Error("sem uso")) };
  }, { parentSignal: controle.signal })));
  assert.equal(tentativas, 1);
});

test("falha em registrar a cobrança não troca de IA — nada foi enviado", async () => {
  const { cliente } = razaoFalso({ marcar_exposicao_de_cobranca_server: { data: false } });
  let tentativas = 0;
  await assert.rejects(
    executarEmFila(parametros(cliente, () => {
      tentativas++;
      return { textStream: texto(["x"]), usage: Promise.resolve(uso(1, 1)) };
    })),
    FalhaDeExposicaoDeCobranca,
  );
  assert.equal(tentativas, 0);
});

test("falha DEPOIS da primeira palavra não troca de IA: o texto já está na tela", async () => {
  const { cliente } = razaoFalso();
  const tentadas: string[] = [];
  const execucao = await executarEmFila(parametros(cliente, (a) => {
    tentadas.push(a.config.provider);
    return {
      textStream: (async function* () { yield "azul"; throw new Error("queda no meio"); })(),
      usage: Promise.reject(new Error("sem uso")),
    };
  }));
  await assert.rejects(drenar(execucao.iterator), /queda no meio/);
  assert.deepEqual(tentadas, ["google"]);
});
