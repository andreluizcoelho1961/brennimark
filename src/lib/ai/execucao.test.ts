import assert from "node:assert/strict";
import test from "node:test";
import { decidirExecucao } from "./execucao";

/**
 * O mesmo Supabase de mentira de buscar.test.ts e orcamento.test.ts — aqui
 * ele serve para provar uma coisa específica: a ORDEM das checagens.
 * `chamadas.length` depois de `decidirExecucao` diz se a reserva de
 * orçamento (a única checagem que custa uma escrita no banco) foi tentada.
 * Um bloqueio de catálogo ou de visão que ainda assim reserva orçamento é o
 * defeito que este arquivo existe para pegar — dinheiro de demonstração
 * gasto numa chamada que já ia ser recusada.
 */
function supabaseFalso(resposta: { data?: unknown; error?: { code?: string; message: string } | null }) {
  const chamadas: { fn: string; args: Record<string, unknown> }[] = [];
  return {
    chamadas,
    cliente: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        chamadas.push({ fn, args });
        return { data: resposta.data ?? null, error: resposta.error ?? null };
      },
    } as never,
  };
}

const REQUEST_BASE = {
  workspaceId: "ws-1", brandId: "brand-1", executionId: "exec-1",
  task: "assist" as const, question: "qual é a cor primária?", sources: [],
};

test("modelo fora do catálogo é recusado sem reservar orçamento", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: [{ ok: true }] });
  const r = await decidirExecucao(
    cliente,
    REQUEST_BASE,
    { provider: "openai", model: "modelo-que-ninguem-catalogou" },
    4000, "USD",
  );
  assert.deepEqual(r, { pode: false, motivo: "modelo_nao_catalogado" });
  assert.equal(chamadas.length, 0);
});

test("imagem num modelo sem preço verificado é recusada sem reservar orçamento", async () => {
  /*
   * Nenhum modelo do catálogo real tem `imagePricingVerified: true` hoje —
   * é a garantia provada em catalogo.test.ts. Então qualquer modelo de
   * visão catalogado serve para provar este bloqueio, mesmo um que aceita
   * imagem tecnicamente (claude-sonnet-5): a permissão TÉCNICA não é
   * permissão de EXECUÇÃO enquanto o preço não for confirmado.
   */
  const { cliente, chamadas } = supabaseFalso({ data: [{ ok: true }] });
  const r = await decidirExecucao(
    cliente,
    { ...REQUEST_BASE, image: { mediaType: "image/png", sizeBytes: 1024 } },
    { provider: "anthropic", model: "claude-sonnet-5" },
    4000, "USD",
  );
  assert.deepEqual(r, { pode: false, motivo: "imagem_sem_preco_verificado" });
  assert.equal(chamadas.length, 0);
});

test("imagem num modelo sem visão nenhuma também é recusada, sem reservar", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: [{ ok: true }] });
  const r = await decidirExecucao(
    cliente,
    { ...REQUEST_BASE, image: { mediaType: "image/png", sizeBytes: 1024 } },
    { provider: "groq", model: "openai/gpt-oss-20b" },
    4000, "USD",
  );
  assert.deepEqual(r, { pode: false, motivo: "imagem_sem_preco_verificado" });
  assert.equal(chamadas.length, 0);
});

test("sem imagem, um modelo catalogado passa para a reserva de orçamento", async () => {
  const { cliente, chamadas } = supabaseFalso({
    data: [{ ok: true, motivo: "reservado", execution_id: "exec-1", status: "reserved" }],
  });
  const r = await decidirExecucao(
    cliente, REQUEST_BASE,
    { provider: "groq", model: "openai/gpt-oss-20b" },
    4000, "USD",
  );
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].fn, "reservar_execucao_de_ia");
  assert.ok(r.pode);
  assert.equal(r.pode && r.executionId, "exec-1");
  assert.equal(r.pode && r.capabilities.vision, false);
});

test("orçamento recusado no banco vira o motivo específico, não uma recusa genérica", async () => {
  const { cliente } = supabaseFalso({
    data: [{ ok: false, motivo: "orcamento_da_marca_esgotado", execution_id: "exec-1", status: null }],
  });
  const r = await decidirExecucao(
    cliente, REQUEST_BASE,
    { provider: "groq", model: "openai/gpt-oss-20b" },
    4000, "USD",
  );
  assert.deepEqual(r, { pode: false, motivo: "orcamento_da_marca_esgotado" });
});

test("falha ao consultar orçamento bloqueia — falha fechada até aqui também", async () => {
  const { cliente } = supabaseFalso({ error: { code: "X", message: "fora do ar" } });
  const r = await decidirExecucao(
    cliente, REQUEST_BASE,
    { provider: "groq", model: "openai/gpt-oss-20b" },
    4000, "USD",
  );
  assert.deepEqual(r, { pode: false, motivo: "erro_de_consulta" });
});
