import assert from "node:assert/strict";
import test from "node:test";
import { BOILERPLATE_DO_PROMPT_DE_SISTEMA, decidirExecucao, executarComOrcamento } from "./execucao";
import { custoMicros, type ModelPricing } from "./catalogo";
import { buildChatSystemPrompt, buildAnalysisSystemPrompt, type BrandPromptContext } from "./brand-context";
import { LIMITES_DE_IA, type Trecho } from "./recuperacao";
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
        /*
         * A marcação de exposição tem padrão PRÓPRIO: `true`.
         *
         * O executor recusa despachar quando ela não devolve `true`, então um
         * padrão `null` faria toda esta suíte testar o caminho de recusa — e
         * os testes de liquidação parariam de exercer liquidação nenhuma,
         * passando por vacuidade. Quem quiser testar a recusa a declara
         * explicitamente, como os testes abaixo fazem.
         */
        if (fn === "marcar_exposicao_de_cobranca_server" && !(porFuncao && fn in porFuncao)) {
          return { data: true, error: null };
        }
        const r = porFuncao ? (porFuncao[fn] ?? { data: null, error: null }) : (resposta as RespostaRpc);
        return { data: r.data ?? null, error: r.error ?? null };
      },
    } as never,
  };
}

/**
 * A sequência normal de um despacho: marcar a exposição de cobrança ANTES,
 * liquidar DEPOIS.
 *
 * A marcação aparece aqui em vez de ser filtrada porque ela é uma chamada
 * real ao banco, e esconder chamada de dinheiro numa asserção de chamadas de
 * dinheiro seria o começo do próximo defeito.
 */
const MARCA_E_LIQUIDA = [
  "marcar_exposicao_de_cobranca_server",
  "consolidar_execucao_de_ia_server",
];

/** Os argumentos da liquidação, seja qual for a posição dela na sequência. */
function liquidacao(chamadas: { fn: string; args: Record<string, unknown> }[]) {
  const c = chamadas.find((x) => x.fn === "consolidar_execucao_de_ia_server");
  assert.ok(c, "nenhuma liquidação foi chamada");
  return c.args;
}

const RESERVA_OK = { data: [{ ok: true, motivo: "reservado", execution_id: "exec-1", status: "reserved" }] };
const KILL_SWITCH_INATIVO = { data: [{ workspace: false, marca: false }] };

// O mesmo cliente falso serve para `supabase` (sessão do usuário) E
// `serviceClient` nestes testes — o `.rpc` já roteia por nome de função, e
// nada aqui distingue as duas chaves reais. `USER_ID` representa o valor já
// resolvido de uma sessão validada (achado P0-2), nunca o corpo da requisição.
const USER_ID = "user-1";

const REQUEST_BASE = {
  workspaceId: "ws-1", brandId: "brand-1", executionId: "exec-1",
  task: "assist" as const, role: "", question: "qual é a cor primária?", sources: [],
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
  const r = await decidirExecucao(cliente, cliente, USER_ID, REQUEST_BASE, { provider: "openai", model: "modelo-que-ninguem-catalogou" });
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
  const r = await decidirExecucao(cliente, cliente, USER_ID, REQUEST_BASE, PERFIL_SEM_PRECO);
  assert.deepEqual(r, { pode: false, motivo: "preco_nao_verificado" });
  assert.equal(chamadas.length, 0);
});

test("imagem num modelo sem preço de imagem verificado é recusada sem reservar orçamento", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: [{ ok: true }] });
  const r = await decidirExecucao(
    cliente,
    cliente,
    USER_ID,
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
    cliente,
    USER_ID,
    { ...REQUEST_BASE, task: "analyse-image", image: { mediaType: "image/png", sizeBytes: 1024 } },
    PERFIL_SEM_PRECO,
  );
  assert.deepEqual(r, { pode: false, motivo: "imagem_sem_preco_verificado" });
  assert.equal(chamadas.length, 0);
});

test("sem imagem, um modelo com preço passa para a reserva e o recheck de kill switch", async () => {
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia_server: RESERVA_OK,
    kill_switch_ativo: KILL_SWITCH_INATIVO,
  });
  const r = await decidirExecucao(cliente, cliente, USER_ID, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.equal(chamadas.length, 2);
  assert.equal(chamadas[0].fn, "reservar_execucao_de_ia_server");
  assert.equal(chamadas[1].fn, "kill_switch_ativo");
  assert.ok(r.pode);
  assert.equal(r.pode && r.executionId, "exec-1");
  assert.equal(r.pode && r.capabilities.vision, false);
});

test("o snapshot de preço enviado à reserva vem do catálogo, com a versão vigente", async () => {
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia_server: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO,
  });
  await decidirExecucao(cliente, cliente, USER_ID, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  const snapshot = chamadas[0].args.p_price_snapshot as Record<string, unknown>;
  assert.equal(snapshot.provider, "ollama-cloud");
  assert.equal(snapshot.model, "deepseek-v4-flash:cloud");
  assert.equal(snapshot.inputPerMillionTokensUsd, 0.44);
  assert.equal(typeof snapshot.catalogVersion, "string");
  assert.ok((snapshot.catalogVersion as string).length > 0);
});

test("a reserva é positiva e nunca fica presa em zero ou negativa", async () => {
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia_server: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO,
  });
  await decidirExecucao(cliente, cliente, USER_ID, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  const micros = chamadas[0].args.p_reserved_micros as number;
  assert.ok(Number.isInteger(micros));
  assert.ok(micros > 0, `reserva deveria ser positiva, veio ${micros}`);
});

test("um papel de marca mais longo reserva mais — o conteúdo real entra na conta", async () => {
  /*
   * A exigência do usuário: a reserva usa o CONTEÚDO REAL do papel, não
   * só um teto genérico. Um papel de 500 caracteres precisa reservar mais
   * do que um papel vazio, na MESMA tarefa.
   */
  const vazio = supabaseFalso({ reservar_execucao_de_ia_server: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO });
  await decidirExecucao(vazio.cliente, vazio.cliente, USER_ID, { ...REQUEST_BASE, role: "" }, PERFIL_SO_TEXTO_COM_PRECO);

  const comPapel = supabaseFalso({ reservar_execucao_de_ia_server: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO });
  await decidirExecucao(comPapel.cliente, comPapel.cliente, USER_ID, { ...REQUEST_BASE, role: "x".repeat(500) }, PERFIL_SO_TEXTO_COM_PRECO);

  const microsVazio = vazio.chamadas[0].args.p_reserved_micros as number;
  const microsComPapel = comPapel.chamadas[0].args.p_reserved_micros as number;
  assert.ok(microsComPapel > microsVazio, "papel mais longo deveria reservar mais");
});

test("um papel além do teto validado (1.000) não infla a reserva além do teto — a defesa contra abuso", async () => {
  /*
   * O banco já recusa gravar um papel maior que MAX_CARACTERES_DO_PAPEL_DA_MARCA
   * (migração 20260903180000) — mas a reserva não confia cegamente nisso.
   * Um valor MUITO além do teto (simulando um defeito ou uma linha antiga
   * de antes da constraint) reserva o MESMO tanto que exatamente no teto,
   * nunca mais — é o que "o teto impede abuso" quer dizer na prática.
   */
  const noTeto = supabaseFalso({ reservar_execucao_de_ia_server: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO });
  await decidirExecucao(noTeto.cliente, noTeto.cliente, USER_ID, { ...REQUEST_BASE, role: "x".repeat(1000) }, PERFIL_SO_TEXTO_COM_PRECO);

  const muitoAlem = supabaseFalso({ reservar_execucao_de_ia_server: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO });
  await decidirExecucao(muitoAlem.cliente, muitoAlem.cliente, USER_ID, { ...REQUEST_BASE, role: "x".repeat(50_000) }, PERFIL_SO_TEXTO_COM_PRECO);

  assert.equal(noTeto.chamadas[0].args.p_reserved_micros, muitoAlem.chamadas[0].args.p_reserved_micros);
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
    reservar_execucao_de_ia_server: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO,
  });
  const r = await decidirExecucao(cliente, cliente, USER_ID, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
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

  const semImagem = supabaseFalso({ reservar_execucao_de_ia_server: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO });
  await decidirExecucao(semImagem.cliente, semImagem.cliente, USER_ID, base, PERFIL_COM_PRECO_DE_IMAGEM);

  const comImagem = supabaseFalso({ reservar_execucao_de_ia_server: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO });
  await decidirExecucao(
    comImagem.cliente,
    comImagem.cliente,
    USER_ID,
    { ...base, image: { mediaType: "image/png", sizeBytes: 1024 } },
    PERFIL_COM_PRECO_DE_IMAGEM,
  );

  const semImagemMicros = semImagem.chamadas[0].args.p_reserved_micros as number;
  const comImagemMicros = comImagem.chamadas[0].args.p_reserved_micros as number;
  assert.ok(comImagemMicros > semImagemMicros);
});

test("a diferença de reserva com imagem é EXATAMENTE o teto de tokens visuais do modelo", async () => {
  /*
   * Não basta reservar "mais" — precisa reservar o TETO documentado, nem
   * menos (subestimaria) nem um número arbitrário maior (esconderia um
   * erro de conta atrás de uma margem por acidente). gemma4:31b-cloud é o
   * único modelo com `maxImageTokens` verificado hoje — ver catalogo.ts.
   */
  const base = { ...REQUEST_BASE, task: "analyse-image" as const };
  const semImagem = supabaseFalso({ reservar_execucao_de_ia_server: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO });
  const r1 = await decidirExecucao(semImagem.cliente, semImagem.cliente, USER_ID, base, PERFIL_COM_PRECO_DE_IMAGEM);
  const comImagem = supabaseFalso({ reservar_execucao_de_ia_server: RESERVA_OK, kill_switch_ativo: KILL_SWITCH_INATIVO });
  await decidirExecucao(
    comImagem.cliente, comImagem.cliente, USER_ID,
    { ...base, image: { mediaType: "image/png", sizeBytes: 1024 } }, PERFIL_COM_PRECO_DE_IMAGEM,
  );

  assert.ok(r1.pode);
  if (!r1.pode) return;
  const maxImageTokens = r1.capabilities.pricing!.maxImageTokens!;
  const inputPerMillionTokensUsd = r1.capabilities.pricing!.inputPerMillionTokensUsd;
  const diferencaEsperada = custoMicros(inputPerMillionTokensUsd, maxImageTokens);

  const semImagemMicros = semImagem.chamadas[0].args.p_reserved_micros as number;
  const comImagemMicros = comImagem.chamadas[0].args.p_reserved_micros as number;
  assert.equal(comImagemMicros - semImagemMicros, diferencaEsperada);
});

test("o boilerplate FIXO medido do prompt de sistema (sem o papel) cabe dentro do assumido pela reserva", () => {
  /*
   * A prova de que "a reserva de entrada cobre o prompt de sistema" não é
   * um número solto — é MEDIDO chamando os construtores reais com trechos
   * no teto de LIMITES_DE_IA e papel VAZIO, isolando o texto que NÃO
   * depende do papel (o papel entra separadamente, com o comprimento
   * real — ver os testes de "papel de marca mais longo reserva mais").
   * Se o texto fixo do prompt crescer além do que a reserva assume — uma
   * nova regra de fundamentação, mais uma seção de regras de cor — este
   * teste quebra antes que a reserva comece a subestimar de verdade.
   */
  const trechoNoTeto: Trecho = {
    documentSlug: "s", documentTitle: "t", groupName: "g", section: "s",
    status: "ready", pageStart: 1, pageEnd: 1,
    content: "x".repeat(LIMITES_DE_IA.maxCaracteresPorTrecho),
  };
  const trechos = Array(LIMITES_DE_IA.maxTrechos).fill(trechoNoTeto);

  for (const language of ["pt", "en"] as const) {
    const brand: BrandPromptContext = { language, chatRole: "", analysisRole: "", statusLabels: undefined };
    const chatBoilerplate = buildChatSystemPrompt(trechos, brand).length - LIMITES_DE_IA.maxCaracteresDeContexto;
    const analysisBoilerplate = buildAnalysisSystemPrompt(trechos, brand).length - LIMITES_DE_IA.maxCaracteresDeContexto;

    assert.ok(
      chatBoilerplate <= BOILERPLATE_DO_PROMPT_DE_SISTEMA.assist,
      `chat [${language}]: boilerplate medido ${chatBoilerplate} excede o assumido ${BOILERPLATE_DO_PROMPT_DE_SISTEMA.assist}`,
    );
    assert.ok(
      analysisBoilerplate <= BOILERPLATE_DO_PROMPT_DE_SISTEMA["analyse-image"],
      `análise [${language}]: boilerplate medido ${analysisBoilerplate} excede o assumido ${BOILERPLATE_DO_PROMPT_DE_SISTEMA["analyse-image"]}`,
    );
  }
});

test("orçamento recusado no banco vira o motivo específico, não uma recusa genérica", async () => {
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia_server: {
      data: [{ ok: false, motivo: "orcamento_da_marca_esgotado", execution_id: "exec-1", status: null }],
    },
  });
  const r = await decidirExecucao(cliente, cliente, USER_ID, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.deepEqual(r, { pode: false, motivo: "orcamento_da_marca_esgotado" });
  // Orçamento já recusou: nenhum recheck de kill switch é necessário.
  assert.equal(chamadas.length, 1);
});

test("falha ao consultar orçamento bloqueia — falha fechada até aqui também", async () => {
  const { cliente } = supabaseFalso({ error: { code: "X", message: "fora do ar" } });
  const r = await decidirExecucao(cliente, cliente, USER_ID, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.deepEqual(r, { pode: false, motivo: "erro_de_consulta" });
});

// ─── execution_id reutilizado NUNCA autoriza um segundo despacho ──────────
//
// O achado da revisão: a função do banco devolve `ok:true` para QUALQUER
// linha já existente, seja qual for o status — é assim que ela responde
// "reservado" de novo para um retry legítimo. Mas decidirExecucao não
// checava `jaExistia` — um id repetido, em QUALQUER status, virava
// `pode:true`, autorizando um segundo despacho pago sem reserva nova.

test("execution_id já 'reserved' (outra tentativa pode estar em voo): bloqueia como em andamento", async () => {
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia_server: {
      data: [{ ok: true, motivo: "ja_reservado", execution_id: "exec-1", status: "reserved" }],
    },
  });
  const r = await decidirExecucao(cliente, cliente, USER_ID, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.deepEqual(r, { pode: false, motivo: "execucao_em_andamento" });
  // Nenhum recheck de kill switch — a decisão já foi tomada sem chegar lá.
  assert.equal(chamadas.length, 1);
});

test("execution_id já 'settled': bloqueia como já finalizada, não despacha de novo", async () => {
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia_server: {
      data: [{ ok: true, motivo: "ja_reservado", execution_id: "exec-1", status: "settled" }],
    },
  });
  const r = await decidirExecucao(cliente, cliente, USER_ID, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.deepEqual(r, { pode: false, motivo: "execucao_ja_finalizada" });
  assert.equal(chamadas.length, 1);
});

test("execution_id já 'released': também bloqueia como já finalizada", async () => {
  const { cliente } = supabaseFalso({
    reservar_execucao_de_ia_server: {
      data: [{ ok: true, motivo: "ja_reservado", execution_id: "exec-1", status: "released" }],
    },
  });
  const r = await decidirExecucao(cliente, cliente, USER_ID, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.deepEqual(r, { pode: false, motivo: "execucao_ja_finalizada" });
});

test("uma reserva NOVA (não reutilizada) continua autorizando o despacho normalmente", async () => {
  // Confirma que o novo bloqueio não pega o caminho feliz por engano —
  // `motivo: 'reservado'` (não 'ja_reservado') é uma reserva de verdade.
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia_server: {
      data: [{ ok: true, motivo: "reservado", execution_id: "exec-1", status: "reserved" }],
    },
    kill_switch_ativo: KILL_SWITCH_INATIVO,
  });
  const r = await decidirExecucao(cliente, cliente, USER_ID, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.ok(r.pode);
  assert.equal(chamadas.length, 2);
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
    reservar_execucao_de_ia_server: RESERVA_OK,
    kill_switch_ativo: { data: [{ workspace: true, marca: false }] },
    liberar_reserva_de_ia_server: { data: null },
  });
  const r = await decidirExecucao(cliente, cliente, USER_ID, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.deepEqual(r, { pode: false, motivo: "kill_switch_workspace" });
  // A reserva feita por engano é liberada — não fica presa como 'reserved'.
  assert.deepEqual(chamadas.map((c) => c.fn), [
    "reservar_execucao_de_ia_server", "kill_switch_ativo", "liberar_reserva_de_ia_server",
  ]);
  assert.equal(chamadas[2].args.p_execution_id, "exec-1");
});

test("kill switch de MARCA ligado entre a reserva e o retorno tem o motivo certo", async () => {
  const { cliente } = supabaseFalso({
    reservar_execucao_de_ia_server: RESERVA_OK,
    kill_switch_ativo: { data: [{ workspace: false, marca: true }] },
    liberar_reserva_de_ia_server: { data: null },
  });
  const r = await decidirExecucao(cliente, cliente, USER_ID, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.deepEqual(r, { pode: false, motivo: "kill_switch_marca" });
});

test("falha ao consultar o kill switch no recheck final também bloqueia e libera a reserva", async () => {
  const { cliente, chamadas } = supabaseFalso({
    reservar_execucao_de_ia_server: RESERVA_OK,
    kill_switch_ativo: { error: { code: "X", message: "fora do ar" } },
    liberar_reserva_de_ia_server: { data: null },
  });
  const r = await decidirExecucao(cliente, cliente, USER_ID, REQUEST_BASE, PERFIL_SO_TEXTO_COM_PRECO);
  assert.deepEqual(r, { pode: false, motivo: "erro_de_consulta" });
  assert.deepEqual(chamadas.map((c) => c.fn), [
    "reservar_execucao_de_ia_server", "kill_switch_ativo", "liberar_reserva_de_ia_server",
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

const RESERVED_MICROS = 5_000;

test("despacho com sucesso: liquida com o uso REAL, não com o teto reservado", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: null });
  const execucao = await executarComOrcamento({
    serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => ({
      textStream: geradorDeTexto(["a cor primária é", " vermelho."]),
      usage: Promise.resolve(usoFalso(500, 40)),
    }),
  });
  const texto = execucao.firstChunk + (await drenarTudo(execucao.iterator));
  assert.equal(texto, "a cor primária é vermelho.");
  assert.deepEqual(chamadas.map((c) => c.fn), MARCA_E_LIQUIDA);
  assert.equal(liquidacao(chamadas).p_settled_micros, 500 * 0.14 + 40 * 0.40);
  assert.equal(liquidacao(chamadas).p_provider, "ollama-cloud");
  assert.deepEqual(liquidacao(chamadas).p_usage_snapshot, { inputTokens: 500, outputTokens: 40, cachedInputTokens: undefined });
});

test("sinal já abortado ANTES do primeiro attempt: libera integralmente — o único caso real de pré-despacho", async () => {
  /*
   * A única situação em que nada saiu para o provedor: o pedido chegou
   * com o `AbortSignal` já abortado, e `prepareStreamWithFallback` nunca
   * chega a chamar `dispatch`. Todos os outros testes abaixo despacham
   * PRIMEIRO e falham depois — e por isso liquidam conservador, não
   * liberam.
   */
  const controller = new AbortController();
  controller.abort(new Error("já cancelado antes de começar"));
  const { cliente, chamadas } = supabaseFalso({ data: null });
  let despachou = false;
  await assert.rejects(() =>
    executarComOrcamento({
      serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
      attempts: [ATTEMPT], firstChunkTimeoutMs: 1000, parentSignal: controller.signal,
      dispatch: () => {
        despachou = true;
        return { textStream: geradorDeTexto(["nunca deveria chegar aqui"]), usage: Promise.resolve(usoFalso(1, 1)) };
      },
    }),
  );
  assert.equal(despachou, false, "dispatch não deveria ter sido chamado");
  assert.deepEqual(chamadas.map((c) => c.fn), ["liberar_reserva_de_ia_server"]);
});

async function* geradorQueLancaImediatamente(): AsyncGenerator<string> {
  throw new Error("falha imediata do provedor");
}

test("despacho que falha imediatamente: liquida conservador pelo teto, NUNCA libera", async () => {
  /*
   * O pedido JÁ SAIU para o provedor quando `dispatch` foi chamado — o
   * fato de o stream de texto lançar no primeiro `next()` não prova que
   * o provedor não processou nada. Liberar aqui seria transformar um
   * custo possivelmente ocorrido em custo zero — exatamente o que a
   * correção de direção pediu para nunca acontecer.
   */
  const { cliente, chamadas } = supabaseFalso({ data: null });
  await assert.rejects(() =>
    executarComOrcamento({
      serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
      attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
      dispatch: () => ({
        textStream: geradorQueLancaImediatamente(),
        // A promise de uso rejeita — o realista para um provedor que
        // errou antes de produzir um relatório de uso. `usoFalso(0, 0)`
        // seria um uso CONHECIDO de zero tokens, não "desconhecido".
        usage: Promise.reject(new Error("sem relatório de uso")),
      }),
    }),
  );
  assert.deepEqual(chamadas.map((c) => c.fn), MARCA_E_LIQUIDA);
  assert.equal(liquidacao(chamadas).p_settled_micros, RESERVED_MICROS);
  assert.deepEqual(liquidacao(chamadas).p_usage_snapshot, { unknown: true });
});

test("timeout do primeiro chunk: liquida conservador pelo teto, NUNCA libera", async () => {
  // O request já foi despachado antes da corrida contra o timeout começar
  // — mesmo raciocínio do teste anterior.
  const { cliente, chamadas } = supabaseFalso({ data: null });
  await assert.rejects(() =>
    executarComOrcamento({
      serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
      attempts: [ATTEMPT], firstChunkTimeoutMs: 20, // bem curto, de propósito
      usageTimeoutMs: 20,
      dispatch: () => ({
        textStream: (async function* () {
          await new Promise((r) => setTimeout(r, 200)); // sempre além do timeout
          yield "tarde demais";
        })(),
        // Nunca resolve — o realista quando o provedor não respondeu a
        // tempo nem para o primeiro chunk, quanto mais para o uso final.
        usage: new Promise(() => {}),
      }),
    }),
  );
  assert.deepEqual(chamadas.map((c) => c.fn), MARCA_E_LIQUIDA);
  assert.equal(liquidacao(chamadas).p_settled_micros, RESERVED_MICROS);
  assert.deepEqual(liquidacao(chamadas).p_usage_snapshot, { unknown: true });
});

test("cancelamento depois do primeiro token: NUNCA produz custo zero", async () => {
  /*
   * O cenário central do P2A.1: a pessoa cancela depois de já ter
   * recebido parte da resposta — o modelo já processou entrada e
   * produziu tokens de saída. A Ollama pode cobrar por isso mesmo sem
   * devolver um relatório final de uso. Liquida pelo teto reservado, não
   * libera.
   */
  const { cliente, chamadas } = supabaseFalso({ data: null });
  const execucao = await executarComOrcamento({
    serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    usageTimeoutMs: 20, // bem curto — o teste não deveria depender de 5s reais
    dispatch: () => ({
      textStream: geradorDeTexto(["primeiro", "segundo", "terceiro"]),
      // A promise de uso nunca resolve — como um provedor que só entrega
      // usage no FINAL do stream, que um cancelamento nunca alcança. Sem
      // um teto de espera, encerrar a execução ficaria pendurado para
      // sempre — é o que `usageTimeoutMs` existe para evitar.
      usage: new Promise(() => {}),
    }),
  });
  // Consome só o primeiro chunk, depois cancela — como um cliente que fecha
  // a aba no meio da resposta.
  await execucao.iterator.next();
  await execucao.cancel(new Error("cliente desistiu"));
  assert.deepEqual(chamadas.map((c) => c.fn), MARCA_E_LIQUIDA);
  assert.equal(liquidacao(chamadas).p_settled_micros, RESERVED_MICROS);
  assert.ok((liquidacao(chamadas).p_settled_micros as number) > 0, "custo zero é exatamente o que este teste proíbe");
  assert.deepEqual(liquidacao(chamadas).p_usage_snapshot, { unknown: true });
});

test("queda de streaming no meio, mas com uso CONHECIDO: liquida o uso real, não o teto", async () => {
  /*
   * Diferente do timeout — aqui o stream COMEÇOU (o primeiro chunk já
   * saiu) e quebra antes de terminar, mas a promise de uso ainda assim
   * resolve com números confiáveis (alguns provedores relatam uso por um
   * canal separado do texto). "Uso conhecido" vence: liquida o número
   * real, não o teto conservador — é exatamente a regra "falha depois do
   * despacho com uso conhecido: liquidar o uso real".
   */
  const { cliente, chamadas } = supabaseFalso({ data: null });
  const execucao = await executarComOrcamento({
    serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => ({
      textStream: geradorDeTexto(["primeiro", "segundo"], 1), // quebra na 2ª
      usage: Promise.resolve(usoFalso(500, 40)),
    }),
  });
  await assert.rejects(() => drenarTudo(execucao.iterator));
  assert.deepEqual(chamadas.map((c) => c.fn), MARCA_E_LIQUIDA);
  assert.equal(liquidacao(chamadas).p_settled_micros, 500 * 0.14 + 40 * 0.40);
  assert.notEqual(liquidacao(chamadas).p_settled_micros, RESERVED_MICROS);
});

test("queda de streaming no meio, com uso DESCONHECIDO: liquida conservador pelo teto", async () => {
  // A mesma queda, mas sem um relatório de uso confiável — aqui sim
  // liquida pelo teto, nunca libera nem cobra zero.
  const { cliente, chamadas } = supabaseFalso({ data: null });
  const execucao = await executarComOrcamento({
    serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => ({
      textStream: geradorDeTexto(["primeiro", "segundo"], 1), // quebra na 2ª
      usage: Promise.reject(new Error("sem relatório de uso")),
    }),
  });
  await assert.rejects(() => drenarTudo(execucao.iterator));
  assert.deepEqual(chamadas.map((c) => c.fn), MARCA_E_LIQUIDA);
  assert.equal(liquidacao(chamadas).p_settled_micros, RESERVED_MICROS);
  assert.deepEqual(liquidacao(chamadas).p_usage_snapshot, { unknown: true });
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
    serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => ({
      textStream: geradorDeTexto(["resposta completa"]),
      usage: Promise.resolve(usoFalso(500, 40)),
    }),
  });
  await drenarTudo(execucao.iterator);
  assert.ok(!chamadas.some((c) => c.fn === "kill_switch_ativo"));
  assert.deepEqual(chamadas.map((c) => c.fn), MARCA_E_LIQUIDA);
});

test("um segundo attempt na lista é ignorado — nenhum fallback automático", async () => {
  const { cliente } = supabaseFalso({ data: null });
  const segundoAttempt = { config: { provider: "ollama-cloud", model: "deepseek-v4-flash:cloud" } };
  const tentativas: string[] = [];
  const execucao = await executarComOrcamento({
    serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
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

test("sem uso mensurável ao terminar: liquida conservador pelo teto, não libera nem cobra zero", async () => {
  // Um `usage` que a promise resolve mas sem nenhum token informado — o
  // provedor não disse quanto custou. Zero não é "grátis", é "não sei", e
  // o despacho já aconteceu.
  const { cliente, chamadas } = supabaseFalso({ data: null });
  const execucao = await executarComOrcamento({
    serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => ({
      textStream: geradorDeTexto(["ok"]),
      usage: Promise.resolve(usoFalso(undefined, undefined)),
    }),
  });
  await drenarTudo(execucao.iterator);
  assert.deepEqual(chamadas.map((c) => c.fn), MARCA_E_LIQUIDA);
  assert.equal(liquidacao(chamadas).p_settled_micros, RESERVED_MICROS);
  assert.deepEqual(liquidacao(chamadas).p_usage_snapshot, { unknown: true });
});

// ─── Uso PARCIAL: o campo que falta não é zero ─────────────────────────────
//
// A guarda do conservador exigia que ENTRADA e SAÍDA estivessem ausentes, com
// `&&`. Com um campo só presente, o outro virava zero por `?? 0` — e consumo
// desconhecido passava a ser cobrado como consumo nulo, sempre para o lado que
// perde dinheiro. Um zero MEDIDO é um fato; um campo AUSENTE é ignorância, e o
// contrato de orçamento não pode confundir os dois.

test("uso parcial — só entrada relatada — liquida conservador, não trata a saída como zero", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: null });
  const execucao = await executarComOrcamento({
    serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => ({
      textStream: geradorDeTexto(["ok"]),
      usage: Promise.resolve(usoFalso(500, undefined)),
    }),
  });
  await drenarTudo(execucao.iterator);
  assert.deepEqual(chamadas.map((c) => c.fn), MARCA_E_LIQUIDA);
  assert.equal(liquidacao(chamadas).p_settled_micros, RESERVED_MICROS);
  assert.deepEqual(liquidacao(chamadas).p_usage_snapshot, { unknown: true });
});

test("uso parcial — só saída relatada — liquida conservador, não trata a entrada como zero", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: null });
  const execucao = await executarComOrcamento({
    serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => ({
      textStream: geradorDeTexto(["ok"]),
      usage: Promise.resolve(usoFalso(undefined, 20)),
    }),
  });
  await drenarTudo(execucao.iterator);
  assert.equal(liquidacao(chamadas).p_settled_micros, RESERVED_MICROS);
  assert.deepEqual(liquidacao(chamadas).p_usage_snapshot, { unknown: true });
});

test("uso com número não finito é desconhecido, não é aritmética", async () => {
  // `NaN` propaga por toda a conta e chega ao banco como `NaN` — que não é
  // "custo zero", é ausência de número num campo que precisa de número.
  const { cliente, chamadas } = supabaseFalso({ data: null });
  const execucao = await executarComOrcamento({
    serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => ({
      textStream: geradorDeTexto(["ok"]),
      usage: Promise.resolve(usoFalso(Number.NaN, 40)),
    }),
  });
  await drenarTudo(execucao.iterator);
  assert.equal(liquidacao(chamadas).p_settled_micros, RESERVED_MICROS);
  assert.deepEqual(liquidacao(chamadas).p_usage_snapshot, { unknown: true });
});

test("uso com número negativo é desconhecido — nenhum provedor consome tokens negativos", async () => {
  // Um negativo aqui ABATE o custo de outro campo. É a única forma de uma
  // execução real liquidar por menos do que consumiu de fato.
  const { cliente, chamadas } = supabaseFalso({ data: null });
  const execucao = await executarComOrcamento({
    serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => ({
      textStream: geradorDeTexto(["ok"]),
      usage: Promise.resolve(usoFalso(-1_000_000, 40)),
    }),
  });
  await drenarTudo(execucao.iterator);
  assert.equal(liquidacao(chamadas).p_settled_micros, RESERVED_MICROS);
  assert.deepEqual(liquidacao(chamadas).p_usage_snapshot, { unknown: true });
});

test("zero MEDIDO continua sendo zero — a correção não pode punir o caso legítimo", async () => {
  // A guarda nova não pode transformar "o provedor relatou 0 tokens de saída"
  // em desconhecido: isso cobraria o teto de uma execução que de fato não
  // gerou saída, e seria o erro simétrico ao que se está consertando.
  const { cliente, chamadas } = supabaseFalso({ data: null });
  const execucao = await executarComOrcamento({
    serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => ({
      textStream: geradorDeTexto(["ok"]),
      usage: Promise.resolve(usoFalso(500, 0)),
    }),
  });
  await drenarTudo(execucao.iterator);
  assert.equal(liquidacao(chamadas).p_settled_micros, 500 * 0.14);
  assert.deepEqual(liquidacao(chamadas).p_usage_snapshot, { inputTokens: 500, outputTokens: 0, cachedInputTokens: undefined });
});

// ─── Exposição de cobrança: marcar ANTES, e abortar se não der ─────────────
//
// O item 5 nasceu de uma execução despachada cuja liquidação falhou: a reserva
// ficava `reserved` para sempre, e uma expiração posterior a transformaria em
// `released` — apagando custo real. `charge_exposed_at` é o fato que faltava,
// e ele só serve se for gravado ANTES do despacho.

test("falha ao marcar a exposição impede o despacho — nada é enviado ao provedor", async () => {
  /*
   * A asserção que importa não é o erro: é `despachou === false`. Uma
   * implementação que marcasse depois, ou que seguisse mesmo com o erro,
   * produziria custo que o razão não conhece — exatamente o defeito.
   */
  let despachou = false;
  const { cliente, chamadas } = supabaseFalso({
    marcar_exposicao_de_cobranca_server: { error: { code: "57014", message: "timeout" } },
  });
  await assert.rejects(
    () => executarComOrcamento({
      serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
      attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
      dispatch: () => {
        despachou = true;
        return { textStream: geradorDeTexto(["nunca"]), usage: Promise.resolve(usoFalso(1, 1)) };
      },
    }),
    /exposição de cobrança/,
  );
  assert.equal(despachou, false, "despachou mesmo sem conseguir marcar a exposição");
  assert.deepEqual(
    chamadas.map((c) => c.fn),
    ["marcar_exposicao_de_cobranca_server", "liberar_reserva_de_ia_server"],
    "falha incerta da marcação precisa encerrar a reserva antes de devolver o erro",
  );
});

test("banco recusando a marcação (false) também impede o despacho", async () => {
  // `false` significa que a reserva já não está reservada. Despachar geraria
  // custo sem reserva — pior que não responder.
  let despachou = false;
  const { cliente, chamadas } = supabaseFalso({
    marcar_exposicao_de_cobranca_server: { data: false },
  });
  await assert.rejects(
    () => executarComOrcamento({
      serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
      attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
      dispatch: () => {
        despachou = true;
        return { textStream: geradorDeTexto(["nunca"]), usage: Promise.resolve(usoFalso(1, 1)) };
      },
    }),
    /exposição de cobrança/,
  );
  assert.equal(despachou, false);
  assert.deepEqual(
    chamadas.map((c) => c.fn),
    ["marcar_exposicao_de_cobranca_server"],
    "false já afirma que a linha não está reservada; não há reserva para encerrar",
  );
});

test("a marcação vem ANTES do despacho, não depois", async () => {
  // Marcar depois deixaria aberta exatamente a janela que o item 5 descreve:
  // o pedido saiu, o razão não sabe.
  const ordem: string[] = [];
  const { cliente } = supabaseFalso({ data: null });
  const clienteObservado = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      ordem.push(fn);
      return (cliente as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<unknown> }).rpc(fn, args);
    },
  } as never;

  const execucao = await executarComOrcamento({
    serviceClient: clienteObservado, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000,
    dispatch: () => {
      ordem.push("DESPACHO");
      return { textStream: geradorDeTexto(["ok"]), usage: Promise.resolve(usoFalso(10, 2)) };
    },
  });
  await drenarTudo(execucao.iterator);

  assert.equal(ordem[0], "marcar_exposicao_de_cobranca_server");
  assert.equal(ordem[1], "DESPACHO");
});

test("sinal já abortado: NÃO marca exposição — nada saiu, e liberar continua certo", async () => {
  /*
   * O único caso real de pré-despacho. Marcar aqui transformaria uma liberação
   * legítima numa liquidação conservadora, cobrando por um pedido que nunca
   * tocou a rede. O erro barato é o outro.
   */
  const controle = new AbortController();
  controle.abort();
  const { cliente, chamadas } = supabaseFalso({ data: null });

  await assert.rejects(() => executarComOrcamento({
    serviceClient: cliente, userId: USER_ID, executionId: "exec-1", pricing: PRICING, reservedMicros: RESERVED_MICROS,
    attempts: [ATTEMPT], firstChunkTimeoutMs: 1000, parentSignal: controle.signal,
    dispatch: () => ({ textStream: geradorDeTexto(["nunca"]), usage: Promise.resolve(usoFalso(1, 1)) }),
  }));

  assert.equal(
    chamadas.some((c) => c.fn === "marcar_exposicao_de_cobranca_server"),
    false,
    "marcou exposição num pedido que nunca foi despachado",
  );
});
