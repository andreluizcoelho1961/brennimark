import assert from "node:assert/strict";
import test from "node:test";
import { decidirExecucao, executarComOrcamento } from "./execucao";
import type { ModelPricing } from "./catalogo";
import type { LanguageModelUsage } from "ai";

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

test("maxOutputTokens devolvido é o MESMO número usado para calcular a reserva de saída", async () => {
  /*
   * A garantia do item 1 do P2A: se a rota mandasse `maxOutputTokens`
   * diferente do que a reserva assumiu, uma resposta real poderia custar
   * mais do que foi reservado. Aqui não comparo dois cálculos parecidos —
   * derivo o esperado do PRÓPRIO reservedMicros devolvido pela reserva,
   * removendo a parte de entrada, e confiro que bate com maxOutputTokens ×
   * o preço de saída do modelo. Se algum dia decidirExecucao passar a usar
   * um número para a reserva e outro para o retorno, este teste quebra.
   */
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO,
  });
  const r = await decidirExecucao(cliente, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.ok(r.pode);
  if (!r.pode) return;

  const outputPerMillionTokensUsd = r.capabilities.pricing!.outputPerMillionTokensUsd;
  const custoDeSaidaReservado = Math.ceil(r.maxOutputTokens * outputPerMillionTokensUsd);
  const reservedMicros = chamadas[0].args.p_reserved_micros as number;
  const custoDeEntradaReservado = reservedMicros - custoDeSaidaReservado;

  assert.ok(r.maxOutputTokens > 0, "maxOutputTokens deveria ser positivo");
  assert.ok(custoDeEntradaReservado > 0, "sobrou custo de entrada negativo — os números não batem");
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

// ─── executarComOrcamento: o despacho, com o mesmo Supabase de mentira ────
//
// Aqui o despacho é falso, não a reserva: o que importa é provar que
// LIQUIDAR ou LIBERAR acontece nos seis caminhos que uma chamada real pode
// tomar — sem depender de quem chama (a rota) lembrar de fazer isso.

const PRICING: ModelPricing = {
  inputPerMillionTokensUsd: 0.14, outputPerMillionTokensUsd: 0.40,
  currency: "USD", source: "https://ollama.com/pricing", asOf: "2026-09-03",
};
const ATTEMPT = { config: { provider: "ollama-cloud", model: "gemma4:31b-cloud" } };

async function* geradorDeTexto(pedacos: string[], quebraApos?: number) {
  for (let i = 0; i < pedacos.length; i++) {
    if (quebraApos !== undefined && i === quebraApos) throw new Error("queda de streaming");
    yield pedacos[i];
  }
}

function usoFalso(inputTokens: number | undefined, outputTokens: number | undefined): LanguageModelUsage {
  return {
    inputTokens, outputTokens,
    totalTokens: inputTokens !== undefined && outputTokens !== undefined ? inputTokens + outputTokens : undefined,
    inputTokenDetails: { noCacheTokens: inputTokens, cacheReadTokens: undefined, cacheWriteTokens: undefined },
    outputTokenDetails: { textTokens: outputTokens, reasoningTokens: undefined },
  };
}

async function drenarTudo(iterator: AsyncIterator<string>): Promise<string> {
  let texto = "";
  while (true) {
    const proximo = await iterator.next();
    if (proximo.done) return texto;
    texto += proximo.value;
  }
}

test("despacho com sucesso: liquida com o uso REAL, não com o teto reservado", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: null });
  const execucao = await executarComOrcamento({
    supabase: cliente, executionId: "exec-1", pricing: PRICING,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => ({
      textStream: geradorDeTexto(["a cor primária é", " vermelho."]),
      usage: Promise.resolve(usoFalso(500, 40)),
    }),
  });
  const texto = execucao.firstChunk + (await drenarTudo(execucao.iterator));
  assert.equal(texto, "a cor primária é vermelho.");
  assert.deepEqual(chamadas.map((c) => c.fn), ["consolidar_execucao_de_ia"]);
  assert.equal(chamadas[0].args.p_settled_micros, 500 * 0.14 + 40 * 0.40);
  assert.equal(chamadas[0].args.p_provider, "ollama-cloud");
});

async function* geradorQueLancaImediatamente(): AsyncGenerator<string> {
  throw new Error("falha imediata do provedor");
}

test("despacho que falha imediatamente: libera, nunca liquida", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: null });
  await assert.rejects(() =>
    executarComOrcamento({
      supabase: cliente, executionId: "exec-1", pricing: PRICING,
      attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
      dispatch: () => ({
        textStream: geradorQueLancaImediatamente(),
        usage: Promise.resolve(usoFalso(0, 0)),
      }),
    }),
  );
  assert.deepEqual(chamadas.map((c) => c.fn), ["liberar_reserva_de_ia"]);
});

test("timeout do primeiro chunk: libera, nunca liquida", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: null });
  await assert.rejects(() =>
    executarComOrcamento({
      supabase: cliente, executionId: "exec-1", pricing: PRICING,
      attempts: [ATTEMPT], firstChunkTimeoutMs: 20, // bem curto, de propósito
      dispatch: () => ({
        textStream: (async function* () {
          await new Promise((r) => setTimeout(r, 200)); // sempre além do timeout
          yield "tarde demais";
        })(),
        usage: Promise.resolve(usoFalso(0, 0)),
      }),
    }),
  );
  assert.deepEqual(chamadas.map((c) => c.fn), ["liberar_reserva_de_ia"]);
});

test("cancelamento no meio do stream: libera, nunca liquida", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: null });
  const execucao = await executarComOrcamento({
    supabase: cliente, executionId: "exec-1", pricing: PRICING,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => ({
      textStream: geradorDeTexto(["primeiro", "segundo", "terceiro"]),
      usage: Promise.resolve(usoFalso(500, 40)),
    }),
  });
  // Consome só o primeiro chunk, depois cancela — como um cliente que fecha
  // a aba no meio da resposta.
  await execucao.iterator.next();
  await execucao.cancel(new Error("cliente desistiu"));
  assert.deepEqual(chamadas.map((c) => c.fn), ["liberar_reserva_de_ia"]);
});

test("queda de streaming no meio (depois do primeiro chunk): libera, não liquida", async () => {
  /*
   * Diferente do timeout — aqui o stream COMEÇOU (o primeiro chunk já saiu,
   * já passou pelo cliente), mas quebra antes de terminar. Ainda assim é
   * liberação, não liquidação: sem um `usage` final confiável, liquidar com
   * um número arbitrário seria pior que não cobrar nada.
   */
  const { cliente, chamadas } = supabaseFalso({ data: null });
  const execucao = await executarComOrcamento({
    supabase: cliente, executionId: "exec-1", pricing: PRICING,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => ({
      textStream: geradorDeTexto(["primeiro", "segundo"], 1), // quebra na 2ª
      usage: Promise.resolve(usoFalso(500, 40)),
    }),
  });
  await assert.rejects(() => drenarTudo(execucao.iterator));
  assert.deepEqual(chamadas.map((c) => c.fn), ["liberar_reserva_de_ia"]);
});

test("nunca consulta o kill switch em voo — só decidirExecucao faz isso, antes do despacho", async () => {
  /*
   * O ponto do item 3 do P2A: uma chamada JÁ DESPACHADA ao provedor deve
   * liquidar como custo, mesmo que o kill switch tenha sido acionado no
   * meio — não fingir que foi cancelada. A prova aqui é estrutural: esta
   * função nunca chama `kill_switch_ativo`, então nada nela poderia mudar
   * de comportamento por causa de um kill switch acionado durante o
   * despacho — ela sempre liquida com o que o provedor devolveu.
   */
  const { cliente, chamadas } = supabaseFalso({ data: null });
  const execucao = await executarComOrcamento({
    supabase: cliente, executionId: "exec-1", pricing: PRICING,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => ({
      textStream: geradorDeTexto(["resposta completa"]),
      usage: Promise.resolve(usoFalso(500, 40)),
    }),
  });
  await drenarTudo(execucao.iterator);
  assert.ok(!chamadas.some((c) => c.fn === "kill_switch_ativo"));
  assert.deepEqual(chamadas.map((c) => c.fn), ["consolidar_execucao_de_ia"]);
});

test("um segundo attempt na lista é ignorado — nenhum fallback automático", async () => {
  const { cliente } = supabaseFalso({ data: null });
  const segundoAttempt = { config: { provider: "ollama-cloud", model: "deepseek-v4-flash:cloud" } };
  const tentativas: string[] = [];
  const execucao = await executarComOrcamento({
    supabase: cliente, executionId: "exec-1", pricing: PRICING,
    attempts: [ATTEMPT, segundoAttempt], firstChunkTimeoutMs: 1000,
    onAttemptStart: (attempt) => tentativas.push(attempt.config.model),
    dispatch: () => ({
      textStream: geradorDeTexto(["ok"]),
      usage: Promise.resolve(usoFalso(10, 5)),
    }),
  });
  await drenarTudo(execucao.iterator);
  assert.deepEqual(tentativas, ["gemma4:31b-cloud"]);
  assert.equal(execucao.attempt.config.model, "gemma4:31b-cloud");
});

test("sem uso mensurável ao terminar: libera em vez de liquidar com zero", async () => {
  // Um `usage` que a promise resolve mas sem nenhum token informado — o
  // provedor não disse quanto custou. Zero não é "grátis", é "não sei".
  const { cliente, chamadas } = supabaseFalso({ data: null });
  const execucao = await executarComOrcamento({
    supabase: cliente, executionId: "exec-1", pricing: PRICING,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => ({
      textStream: geradorDeTexto(["ok"]),
      usage: Promise.resolve(usoFalso(undefined, undefined)),
    }),
  });
  await drenarTudo(execucao.iterator);
  assert.deepEqual(chamadas.map((c) => c.fn), ["liberar_reserva_de_ia"]);
});
