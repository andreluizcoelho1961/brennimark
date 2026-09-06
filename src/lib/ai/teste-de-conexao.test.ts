import assert from "node:assert/strict";
import test from "node:test";
import type { LanguageModelUsage } from "ai";
import {
  testarConexaoComOrcamento,
  validarConfiguracaoDoTeste,
} from "./teste-de-conexao";

type RespostaRpc = { data?: unknown; error?: { code?: string; message: string } | null };

function supabaseFalso(respostas: Record<string, RespostaRpc>) {
  const chamadas: { fn: string; args: Record<string, unknown> }[] = [];
  return {
    chamadas,
    cliente: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        chamadas.push({ fn, args });
        const resposta = respostas[fn] ?? { data: null, error: null };
        return { data: resposta.data ?? null, error: resposta.error ?? null };
      },
    } as never,
  };
}

async function* texto(...pedacos: string[]) {
  for (const pedaco of pedacos) yield pedaco;
}

function uso(inputTokens: number, outputTokens: number): LanguageModelUsage {
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    inputTokenDetails: { noCacheTokens: inputTokens, cacheReadTokens: undefined, cacheWriteTokens: undefined },
    outputTokenDetails: { textTokens: outputTokens, reasoningTokens: undefined },
  };
}

test("a configuração do teste autoriza o par, não só o provedor", () => {
  assert.deepEqual(
    validarConfiguracaoDoTeste({ provider: "ollama-cloud", model: "modelo-inventado", apiKey: "segredo" }),
    { ok: false, motivo: "modelo_nao_catalogado" },
  );
  assert.equal(
    validarConfiguracaoDoTeste({ provider: "ollama-cloud", model: "deepseek-v4-flash:cloud", apiKey: "segredo" }).ok,
    true,
  );
});

test("chave vazia ou tipos incorretos são recusados antes do provedor", () => {
  for (const body of [null, {}, { provider: "ollama-cloud", model: "deepseek-v4-flash:cloud", apiKey: "" }]) {
    assert.deepEqual(validarConfiguracaoDoTeste(body), { ok: false, motivo: "invalid_input" });
  }
});

test("modelo sem preço não despacha nem reserva o teste", async () => {
  const { cliente, chamadas } = supabaseFalso({});
  let despachou = false;
  const resultado = await testarConexaoComOrcamento({
    supabase: cliente,
    serviceClient: cliente,
    userId: "user-1",
    workspaceId: "ws-1",
    brandId: "brand-1",
    executionId: "exec-1",
    config: { provider: "groq", model: "openai/gpt-oss-20b", apiKey: "segredo" },
    firstChunkTimeoutMs: 1_000,
    dispatch: () => {
      despachou = true;
      return { textStream: texto("ok"), usage: Promise.resolve(uso(1, 1)) };
    },
  });
  assert.deepEqual(resultado, { ok: false, motivo: "preco_nao_verificado" });
  assert.equal(despachou, false);
  assert.equal(chamadas.length, 0);
});

test("teste pago reserva, respeita o teto e liquida com o uso real", async () => {
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia_server: {
      data: [{ ok: true, motivo: "reservado", execution_id: "exec-1", status: "reserved" }],
    },
    kill_switch_ativo: { data: [{ workspace: false, marca: false }] },
    consolidar_execucao_de_ia_server: { data: null },
  });
  let tetoRecebido = 0;
  const resultado = await testarConexaoComOrcamento({
    supabase: cliente,
    serviceClient: cliente,
    userId: "user-1",
    workspaceId: "ws-1",
    brandId: "brand-1",
    executionId: "exec-1",
    config: { provider: "ollama-cloud", model: "deepseek-v4-flash:cloud", apiKey: "segredo" },
    firstChunkTimeoutMs: 1_000,
    dispatch: (_config, _signal, maxOutputTokens) => {
      tetoRecebido = maxOutputTokens;
      return { textStream: texto("o", "k"), usage: Promise.resolve(uso(12, 1)) };
    },
  });

  assert.deepEqual(resultado, { ok: true, executionId: "exec-1" });
  assert.equal(tetoRecebido, 2_000, "o despacho precisa receber o teto que a reserva calculou");
  assert.deepEqual(chamadas.map((chamada) => chamada.fn), [
    "reservar_execucao_de_ia_server",
    "kill_switch_ativo",
    "consolidar_execucao_de_ia_server",
  ]);
  assert.equal(chamadas[0].args.p_workspace_id, "ws-1");
  assert.equal(chamadas[0].args.p_brand_id, "brand-1");
  assert.equal(chamadas[0].args.p_task, "prompt");
  assert.equal(chamadas[2].args.p_execution_id, "exec-1");
  assert.deepEqual(chamadas[2].args.p_usage_snapshot, {
    inputTokens: 12,
    outputTokens: 1,
    cachedInputTokens: undefined,
  });
});
