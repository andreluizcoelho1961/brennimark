import assert from "node:assert/strict";
import test from "node:test";
import { decidirExecucao } from "./execucao";

/**
 * O mesmo Supabase de mentira de buscar.test.ts e orcamento.test.ts — aqui
 * ele serve para provar uma coisa específica: a ORDEM das checagens.
 * `chamadas.length` depois de `decidirExecucao` diz se a reserva de
 * orçamento (a única checagem que custa uma escrita no banco) foi tentada.
 * Um bloqueio de catálogo, visão ou preço que ainda assim reserva orçamento
 * é o defeito que este arquivo existe para pegar — dinheiro de demonstração
 * gasto numa chamada que já ia ser recusada.
 */
type RespostaRpc = { data?: unknown; error?: { code?: string; message: string } | null };

function supabaseFalso(resposta: RespostaRpc | Record<string, RespostaRpc>) {
  const chamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const porFuncao = "data" in resposta || "error" in resposta ? null : (resposta as Record<string, RespostaRpc>);
  return {
    chamadas,
    cliente: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        chamadas.push({ fn, args });
        const r = porFuncao ? (porFuncao[fn] ?? { data: null, error: null }) : (resposta as RespostaRpc);
        return { data: r.data ?? null, error: r.error ?? null };
      },
    } as never,
  };
}

const RESERVA_OK = { data: [{ ok: true, motivo: "reservado", execution_id: "exec-1", status: "reserved" }] };
const KILL_SWITCH_INATIVO = { data: [{ workspace: false, marca: false }] };

const REQUEST_BASE = {
  workspaceId: "ws-1", brandId: "brand-1", executionId: "exec-1",
  task: "assist" as const, question: "qual é a cor primária?", sources: [],
};

// Único par do catálogo com preço de TEXTO e de IMAGEM verificados hoje —
// ver catalogo.test.ts. Os testes de caminho feliz usam este par de
// propósito: é o único que existe.
const PERFIL_COM_PRECO_DE_IMAGEM = { provider: "ollama-cloud", model: "gemma4:31b-cloud" };
// Preço de texto verificado, SEM maxImageTokens — o caso do MiniMax M3 e de
// todo modelo "vision:true" que ainda não tem orçamento de imagem publicado.
const PERFIL_SO_TEXTO_COM_PRECO = { provider: "ollama-cloud", model: "deepseek-v4-flash:cloud" };
// Catalogado, mas SEM `pricing` nenhum — o estado de todo modelo herdado
// (groq/anthropic/openai/google/openrouter) até alguém verificar um preço.
const PERFIL_SEM_PRECO = { provider: "groq", model: "openai/gpt-oss-20b" };

test("modelo fora do catálogo é recusado sem reservar orçamento", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: [{ ok: true }] });
  const r = await decidirExecucao(cliente, REQUEST_BASE, { provider: "openai", model: "modelo-que-ninguem-catalogou" });
  assert.deepEqual(r, { pode: false, motivo: "modelo_nao_catalogado" });
  assert.equal(chamadas.length, 0);
});

test("modelo catalogado mas SEM preço verificado é recusado sem reservar orçamento", async () => {
  /*
   * O estado real de todo modelo herdado do catálogo antes deste commit:
   * `modeloAutorizado` continua true (ele PODE ser configurado), mas
   * `decidirExecucao` não consegue calcular quanto reservar sem um preço
   * citado — e reservar um número inventado é exatamente o que este
   * produto rejeita em todo outro lugar.
   */
  const { cliente, chamadas } = supabaseFalso({ data: [{ ok: true }] });
  const r = await decidirExecucao(cliente, REQUEST_BASE, PERFIL_SEM_PRECO);
  assert.deepEqual(r, { pode: false, motivo: "preco_nao_verificado" });
  assert.equal(chamadas.length, 0);
});

test("imagem num modelo sem preço de imagem verificado é recusada sem reservar orçamento", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: [{ ok: true }] });
  const r = await decidirExecucao(
    cliente,
    { ...REQUEST_BASE, task: "analyse-image", image: { mediaType: "image/png", sizeBytes: 1024 } },
    PERFIL_SO_TEXTO_COM_PRECO,
  );
  assert.deepEqual(r, { pode: false, motivo: "imagem_sem_preco_verificado" });
  assert.equal(chamadas.length, 0);
});

test("imagem num modelo sem visão nenhuma também é recusada, sem reservar", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: [{ ok: true }] });
  const r = await decidirExecucao(
    cliente,
    { ...REQUEST_BASE, task: "analyse-image", image: { mediaType: "image/png", sizeBytes: 1024 } },
    PERFIL_SEM_PRECO,
  );
  assert.deepEqual(r, { pode: false, motivo: "imagem_sem_preco_verificado" });
  assert.equal(chamadas.length, 0);
});

test("sem imagem, um modelo com preço passa para a reserva e o recheck de kill switch", async () => {
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia: RESERVA_OK,
    kill_switch_ativo: KILL_SWITCH_INATIVO,
  });
  const r = await decidirExecucao(cliente, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.equal(chamadas.length, 2);
  assert.equal(chamadas[0].fn, "reservar_execucao_de_ia");
  assert.equal(chamadas[1].fn, "kill_switch_ativo");
  assert.ok(r.pode);
  assert.equal(r.pode && r.executionId, "exec-1");
  assert.equal(r.pode && r.capabilities.vision, false);
});

test("o snapshot de preço enviado à reserva vem do catálogo, com a versão vigente", async () => {
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO,
  });
  await decidirExecucao(cliente, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  const snapshot = chamadas[0].args.p_price_snapshot as Record<string, unknown>;
  assert.equal(snapshot.provider, "ollama-cloud");
  assert.equal(snapshot.model, "deepseek-v4-flash:cloud");
  assert.equal(snapshot.inputPerMillionTokensUsd, 0.44);
  assert.equal(typeof snapshot.catalogVersion, "string");
  assert.ok((snapshot.catalogVersion as string).length > 0);
});

test("a reserva é positiva e nunca fica presa em zero ou negativa", async () => {
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO,
  });
  await decidirExecucao(cliente, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  const micros = chamadas[0].args.p_reserved_micros as number;
  assert.ok(Number.isInteger(micros));
  assert.ok(micros > 0, `reserva deveria ser positiva, veio ${micros}`);
});

test("uma tarefa de imagem reserva mais do que a mesma tarefa sem imagem", async () => {
  // MESMA task ("analyse-image") nos dois — só o campo `image` muda. Task
  // diferente mudaria também o teto de entrada (histórico de chat, no caso
  // de "assist"), e a comparação deixaria de ser sobre imagem.
  const base = { ...REQUEST_BASE, task: "analyse-image" as const };

  const semImagem = supabaseFalso({ reservar_execucao_de_ia: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO });
  await decidirExecucao(semImagem.cliente, base, PERFIL_COM_PRECO_DE_IMAGEM);

  const comImagem = supabaseFalso({ reservar_execucao_de_ia: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO });
  await decidirExecucao(
    comImagem.cliente,
    { ...base, image: { mediaType: "image/png", sizeBytes: 1024 } },
    PERFIL_COM_PRECO_DE_IMAGEM,
  );

  const semImagemMicros = semImagem.chamadas[0].args.p_reserved_micros as number;
  const comImagemMicros = comImagem.chamadas[0].args.p_reserved_micros as number;
  assert.ok(comImagemMicros > semImagemMicros);
});

test("orçamento recusado no banco vira o motivo específico, não uma recusa genérica", async () => {
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia: {
      data: [{ ok: false, motivo: "orcamento_da_marca_esgotado", execution_id: "exec-1", status: null }],
    },
  });
  const r = await decidirExecucao(cliente, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.deepEqual(r, { pode: false, motivo: "orcamento_da_marca_esgotado" });
  // Orçamento já recusou: nenhum recheck de kill switch é necessário.
  assert.equal(chamadas.length, 1);
});

test("falha ao consultar orçamento bloqueia — falha fechada até aqui também", async () => {
  const { cliente } = supabaseFalso({ error: { code: "X", message: "fora do ar" } });
  const r = await decidirExecucao(cliente, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.deepEqual(r, { pode: false, motivo: "erro_de_consulta" });
});

test("kill switch ligado ENTRE a reserva e o retorno bloqueia e libera a reserva já feita", async () => {
  /*
   * O cenário que este teste existe para provar: a reserva no banco já
   * checou o kill switch no início da MESMA chamada e não viu nada —
   * mas entre aquele instante e o retorno de decidirExecucao, alguém
   * pausou o uso. Sem este recheck, a execução seguiria autorizada mesmo
   * com o botão de pausa já acionado.
   */
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia: RESERVA_OK,
    kill_switch_ativo: { data: [{ workspace: true, marca: false }] },
    liberar_reserva_de_ia: { data: null },
  });
  const r = await decidirExecucao(cliente, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.deepEqual(r, { pode: false, motivo: "kill_switch_workspace" });
  // A reserva feita por engano é liberada — não fica presa como 'reserved'.
  assert.deepEqual(chamadas.map((c) => c.fn), [
    "reservar_execucao_de_ia", "kill_switch_ativo", "liberar_reserva_de_ia",
  ]);
  assert.equal(chamadas[2].args.p_execution_id, "exec-1");
});

test("kill switch de MARCA ligado entre a reserva e o retorno tem o motivo certo", async () => {
  const { cliente } = supabaseFalso({
    reservar_execucao_de_ia: RESERVA_OK,
    kill_switch_ativo: { data: [{ workspace: false, marca: true }] },
    liberar_reserva_de_ia: { data: null },
  });
  const r = await decidirExecucao(cliente, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.deepEqual(r, { pode: false, motivo: "kill_switch_marca" });
});

test("falha ao consultar o kill switch no recheck final também bloqueia e libera a reserva", async () => {
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia: RESERVA_OK,
    kill_switch_ativo: { error: { code: "X", message: "fora do ar" } },
    liberar_reserva_de_ia: { data: null },
  });
  const r = await decidirExecucao(cliente, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.deepEqual(r, { pode: false, motivo: "erro_de_consulta" });
  assert.deepEqual(chamadas.map((c) => c.fn), [
    "reservar_execucao_de_ia", "kill_switch_ativo", "liberar_reserva_de_ia",
  ]);
});
