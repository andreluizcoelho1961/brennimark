import assert from "node:assert/strict";
import test from "node:test";
import {
  consolidarExecucao, expirarReservasAntigas, killSwitchAtivo, liberarReserva,
  mensagemDeOrcamento, reservarExecucao, type SnapshotDePreco,
} from "./orcamento";

/**
 * Um Supabase de mentira, com a mesma forma do usado em buscar.test.ts.
 *
 * A CORREÇÃO da aritmética de orçamento — o teto, a soma por status, o kill
 * switch, a atomicidade — é provada no banco, por teste transacional
 * revertido (registrado no commit da migração). O que este arquivo garante é
 * outra coisa: que o módulo TypeScript traduz o resultado da RPC certo, e
 * que ele NUNCA finge sucesso quando a chamada falha.
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

const SNAPSHOT_DE_PRECO: SnapshotDePreco = {
  catalogVersion: "2026-09-03", provider: "ollama-cloud", model: "gemma4:31b-cloud",
  inputPerMillionTokensUsd: 0.14, outputPerMillionTokensUsd: 0.40,
  currency: "USD", source: "https://ollama.com/pricing", asOf: "2026-09-03",
};

const PARAMS = {
  workspaceId: "ws-1", brandId: "brand-1", executionId: "exec-1",
  task: "assist" as const, reservedMicros: 4000, currency: "USD",
  priceSnapshot: SNAPSHOT_DE_PRECO,
};

// O user_id de quem pede — nas três mutações financeiras, resolvido pelo
// CHAMADOR de uma sessão já validada, nunca do corpo da requisição (achado
// P0-2). Aqui só representa esse valor já resolvido.
const USER_ID = "user-1";

test("reserva aceita: devolve ok e o execution_id", async () => {
  const { cliente } = supabaseFalso({
    data: [{ ok: true, motivo: "reservado", execution_id: "exec-1", status: "reserved" }],
  });
  const r = await reservarExecucao(cliente, USER_ID, PARAMS);
  assert.deepEqual(r, { ok: true, executionId: "exec-1", jaExistia: false, status: "reserved" });
});

test("a RPC chamada é a _server, com p_user_id — nunca a antiga exposta à Data API", async () => {
  const { cliente, chamadas } = supabaseFalso({
    data: [{ ok: true, motivo: "reservado", execution_id: "exec-1", status: "reserved" }],
  });
  await reservarExecucao(cliente, USER_ID, PARAMS);
  assert.equal(chamadas[0].fn, "reservar_execucao_de_ia_server");
  assert.equal(chamadas[0].args.p_user_id, USER_ID);
});

test("o snapshot de preço atravessa como p_price_snapshot, sem alteração", async () => {
  const { cliente, chamadas } = supabaseFalso({
    data: [{ ok: true, motivo: "reservado", execution_id: "exec-1", status: "reserved" }],
  });
  await reservarExecucao(cliente, USER_ID, PARAMS);
  assert.deepEqual(chamadas[0].args.p_price_snapshot, SNAPSHOT_DE_PRECO);
});

test("reserva idempotente: motivo ja_reservado vira jaExistia true, com o status real", async () => {
  const { cliente } = supabaseFalso({
    data: [{ ok: true, motivo: "ja_reservado", execution_id: "exec-1", status: "settled" }],
  });
  const r = await reservarExecucao(cliente, USER_ID, PARAMS);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.jaExistia, true);
  // O status não é decorativo: é o que decidirExecucao usa para decidir se
  // um id repetido pode autorizar um segundo despacho (nunca pode).
  assert.equal(r.ok && r.status, "settled");
});

test("reserva nova: status vem 'reserved', jaExistia false", async () => {
  const { cliente } = supabaseFalso({
    data: [{ ok: true, motivo: "reservado", execution_id: "exec-1", status: "reserved" }],
  });
  const r = await reservarExecucao(cliente, USER_ID, PARAMS);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.jaExistia, false);
  assert.equal(r.ok && r.status, "reserved");
});

test("reserva recusada: o motivo específico atravessa, não um genérico", async () => {
  const { cliente } = supabaseFalso({
    data: [{ ok: false, motivo: "orcamento_do_workspace_esgotado", execution_id: "exec-1", status: null }],
  });
  const r = await reservarExecucao(cliente, USER_ID, PARAMS);
  assert.deepEqual(r, { ok: false, motivo: "orcamento_do_workspace_esgotado" });
});

test("erro de rede/banco NUNCA vira sucesso — falha fechada", async () => {
  /*
   * A regressão que este teste existe para impedir: um `catch` engolindo o
   * erro e devolvendo "reservado" por engano transformaria uma falha de
   * infraestrutura em permissão para gastar. É a mesma classe de defeito do
   * A1 — falha de busca virando "não há evidência" em vez de "não sei".
   */
  const { cliente } = supabaseFalso({ error: { code: "PGRST000", message: "connection refused" } });
  const r = await reservarExecucao(cliente, USER_ID, PARAMS);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.motivo, "erro_de_consulta");
});

test("o erro do banco não vaza para o resultado", async () => {
  const { cliente } = supabaseFalso({
    error: { code: "X", message: "detalhe interno com possível segredo" },
  });
  const r = await reservarExecucao(cliente, USER_ID, PARAMS);
  assert.ok(!JSON.stringify(r).includes("detalhe interno"));
});

test("consolidar e liberar chamam a RPC _server certa, com p_user_id e os parâmetros certos", async () => {
  const consolidacao = supabaseFalso({ data: null });
  await consolidarExecucao(consolidacao.cliente, USER_ID, {
    executionId: "exec-1", settledMicros: 3500, provider: "openrouter", model: "qwen/qwen3-vl-32b-instruct",
    usageSnapshot: { inputTokens: 3000, outputTokens: 480 },
  });
  assert.equal(consolidacao.chamadas[0].fn, "consolidar_execucao_de_ia_server");
  assert.equal(consolidacao.chamadas[0].args.p_user_id, USER_ID);
  assert.equal(consolidacao.chamadas[0].args.p_settled_micros, 3500);
  assert.deepEqual(consolidacao.chamadas[0].args.p_usage_snapshot, { inputTokens: 3000, outputTokens: 480 });

  const liberacao = supabaseFalso({ data: null });
  await liberarReserva(liberacao.cliente, USER_ID, "exec-2");
  assert.equal(liberacao.chamadas[0].fn, "liberar_reserva_de_ia_server");
  assert.equal(liberacao.chamadas[0].args.p_user_id, USER_ID);
  assert.equal(liberacao.chamadas[0].args.p_execution_id, "exec-2");
});

test("consolidar sem usageSnapshot envia null, não undefined perdido", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: null });
  await consolidarExecucao(cliente, USER_ID, { executionId: "e", settledMicros: 1, provider: "p", model: "m" });
  assert.equal(chamadas[0].args.p_usage_snapshot, null);
});

test("consolidar e liberar não lançam quando a RPC falha", async () => {
  // São chamadas de ENCERRAMENTO — depois que a resposta já foi decidida (ou
  // a falha já aconteceu). Lançar aqui derrubaria uma resposta que a pessoa
  // já ia receber, por causa de um problema de contabilidade que é dela do
  // produto resolver depois, não dela ver agora.
  const { cliente } = supabaseFalso({ error: { code: "X", message: "falhou" } });
  await assert.doesNotReject(() =>
    consolidarExecucao(cliente, USER_ID, { executionId: "e", settledMicros: 1, provider: "p", model: "m" }),
  );
  await assert.doesNotReject(() => liberarReserva(cliente, USER_ID, "e"));
});

test("a mensagem de orçamento é sempre de produto, nunca o código do motivo", () => {
  for (const motivo of [
    "sem_orcamento_configurado", "orcamento_do_workspace_esgotado",
    "orcamento_da_marca_esgotado", "erro_de_consulta",
  ] as const) {
    const msg = mensagemDeOrcamento(motivo, false);
    assert.ok(!msg.includes(motivo), `a mensagem repete o código técnico: ${motivo}`);
  }
});

test("kill switch tem mensagem distinta de orçamento esgotado", () => {
  // São estados diferentes para quem administra: um é limite normal de uso,
  // o outro é uma pausa deliberada. Confundir as duas mensagens esconderia
  // que alguém desligou o uso de propósito.
  const pausa = mensagemDeOrcamento("kill_switch_workspace", false);
  const esgotado = mensagemDeOrcamento("sem_orcamento_configurado", false);
  assert.notEqual(pausa, esgotado);
  assert.match(pausa, /pausad/i);
});

test("killSwitchAtivo traduz os dois escopos e chama a RPC certa", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: [{ workspace: true, marca: false }] });
  const r = await killSwitchAtivo(cliente, { workspaceId: "ws-1", brandId: "brand-1" });
  assert.deepEqual(r, { workspace: true, marca: false });
  assert.equal(chamadas[0].fn, "kill_switch_ativo");
  assert.equal(chamadas[0].args.p_workspace_id, "ws-1");
  assert.equal(chamadas[0].args.p_brand_id, "brand-1");
});

test("killSwitchAtivo falha fechada: erro de consulta não vira 'sem kill switch'", async () => {
  // O mesmo princípio de reservarExecucao: não saber não é o mesmo que "não
  // há pausa ativa". Devolver {workspace:false,marca:false} por engano aqui
  // deixaria uma execução passar durante uma falha de rede/banco.
  const { cliente } = supabaseFalso({ error: { code: "X", message: "fora do ar" } });
  const r = await killSwitchAtivo(cliente, { workspaceId: "ws-1", brandId: null });
  assert.deepEqual(r, { erro: true });
});

test("expirarReservasAntigas converte o limiar em minutos e devolve a contagem", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: 3 });
  const r = await expirarReservasAntigas(cliente, { workspaceId: "ws-1", maisVelhaQueMinutos: 30 });
  assert.deepEqual(r, { liberadas: 3 });
  assert.equal(chamadas[0].fn, "expirar_reservas_de_ia");
  assert.equal(chamadas[0].args.p_mais_velha_que, "30 minutes");
});

test("expirarReservasAntigas usa 15 minutos como padrão quando nenhum é dado", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: 0 });
  await expirarReservasAntigas(cliente, { workspaceId: "ws-1" });
  assert.equal(chamadas[0].args.p_mais_velha_que, "15 minutes");
});

test("expirarReservasAntigas não lança quando a RPC falha", async () => {
  const { cliente } = supabaseFalso({ error: { code: "X", message: "falhou" } });
  const r = await expirarReservasAntigas(cliente, { workspaceId: "ws-1" });
  assert.deepEqual(r, { erro: true });
});

test("mensagem em inglês existe e é diferente da portuguesa", () => {
  const pt = mensagemDeOrcamento("sem_orcamento_configurado", false);
  const en = mensagemDeOrcamento("sem_orcamento_configurado", true);
  assert.notEqual(pt, en);
  assert.match(en, /administer/i);
});

// ─── Contenção do item 7: o limiar tem piso ────────────────────────────────
//
// A garantia real está no banco (a função é `security definer` e alcançável
// pela Data API, então uma guarda só no cliente estaria do lado errado da
// fronteira). Estes testes cobrem o espelho em TypeScript, que existe para
// falhar cedo e com mensagem legível — e para que uma mudança que afrouxe o
// limiar aqui não passe silenciosa.

test("limiar abaixo do mínimo é recusado antes de chegar ao banco", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: 3 });
  const r = await expirarReservasAntigas(cliente, { workspaceId: "ws-1", maisVelhaQueMinutos: 0 });
  assert.deepEqual(r, { erro: true });
  assert.equal(chamadas.length, 0, "não pode ter chamado a RPC");
});

test("limiar negativo é recusado — liberaria reserva em voo", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: 3 });
  const r = await expirarReservasAntigas(cliente, { workspaceId: "ws-1", maisVelhaQueMinutos: -60 });
  assert.deepEqual(r, { erro: true });
  assert.equal(chamadas.length, 0);
});

test("exatamente o mínimo é aceito — o piso é inclusivo", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: 2 });
  const r = await expirarReservasAntigas(cliente, { workspaceId: "ws-1", maisVelhaQueMinutos: 15 });
  assert.deepEqual(r, { liberadas: 2 });
  assert.equal(chamadas[0].args.p_mais_velha_que, "15 minutes");
});
