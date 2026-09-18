import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOGO, capacidadesDe, custoDeReservaMicros, custoMicros, modelosDe,
  modeloAutorizado, podeAnalisarImagem, type ModelPricing,
} from "./catalogo";
import { PROVIDERS, PROVIDER_MODELS } from "./provider";

test("modelo fora do catálogo é recusado", () => {
  // O briefing é explícito: não aceitar qualquer string de modelo enviada pelo
  // cliente. Antes, só o provedor era validado.
  assert.equal(modeloAutorizado("openai", "gpt-5.1"), true);
  assert.equal(modeloAutorizado("openai", "modelo-que-nao-existe"), false);
  assert.equal(modeloAutorizado("openai", ""), false);
});

test("o PAR provedor+modelo é que autoriza, não o nome solto", () => {
  /*
   * `anthropic/claude-sonnet-5` é um modelo do OpenRouter; `claude-sonnet-5` é
   * da Anthropic. Autorizar pelo nome deixaria configurar um com as
   * credenciais do outro — e a chave de um provedor não funciona no outro, o
   * que vira erro caro em vez de recusa clara.
   */
  assert.equal(modeloAutorizado("openrouter", "anthropic/claude-sonnet-5"), true);
  assert.equal(modeloAutorizado("anthropic", "anthropic/claude-sonnet-5"), false);
  assert.equal(modeloAutorizado("anthropic", "claude-sonnet-5"), true);
  assert.equal(modeloAutorizado("openrouter", "claude-sonnet-5"), false);
});

test("modelo desconhecido devolve null, e não capacidade zerada", () => {
  // `null` é "não sei"; um objeto com tudo `false` seria "sei, e ele não faz
  // nada". As duas coisas pedem respostas diferentes de quem chama.
  assert.equal(capacidadesDe("openai", "inexistente"), null);
  assert.notEqual(capacidadesDe("openai", "gpt-5.1"), null);
});

test("todo modelo do catálogo declara texto, visão e streaming", () => {
  // Os três são obrigatórios porque a interface decide com eles. Opcionais são
  // contexto, limite de imagem e saída estruturada — ausentes quando o
  // provedor não publica, e ausência é honesta; um número inventado não é.
  for (const m of CATALOGO) {
    for (const chave of ["text", "vision", "streaming"] as const) {
      assert.equal(typeof m.capabilities[chave], "boolean", `${m.model}: ${chave}`);
    }
  }
});

test("quem tem visão sem limite de imagem está na lista, e ela é curta", () => {
  /*
   * A regra não é "todo modelo com visão declara limite" — alguns provedores
   * não publicam um. A regra é que a ausência seja DELIBERADA: acrescentar um
   * modelo sem limite exige mexer nesta lista, e mexer exige saber por quê.
   *
   * Todos os casos atuais são do OpenRouter, onde ou o modelo efetivo varia a
   * cada chamada, ou o limite não é publicado por rota. Inventar um número
   * seria pior que não ter: uma imagem recusada depois do upload é um erro
   * claro; uma aceita além do limite real é uma falha do provedor traduzida
   * como falha nossa.
   */
  const semLimite = CATALOGO.filter(
    (m) => m.capabilities.vision && m.capabilities.maxImageBytes === undefined,
  ).map((m) => `${m.provider}:${m.model}`);

  assert.deepEqual(semLimite.sort(), [
    "ollama-cloud:gemma4:31b-cloud",
    "ollama-cloud:minimax-m3:cloud",
    "openrouter:google/gemma-4-26b-a4b-it:free",
    "openrouter:nvidia/nemotron-3-ultra-550b-a55b:free",
    "openrouter:openrouter/free",
    "openrouter:qwen/qwen3.5-flash-02-23",
  ]);
  // E nenhum deles é de provedor com credencial direta (anthropic/openai/
  // google), onde o limite é sempre publicado em bytes. Os dois grupos aqui
  // documentam o limite de outro jeito: OpenRouter por rota variável, Ollama
  // Cloud por orçamento de TOKENS visuais (ver `maxImageTokens`).
  assert.ok(semLimite.every((m) => m.startsWith("openrouter:") || m.startsWith("ollama-cloud:")));
});

test("não há modelo repetido no mesmo provedor", () => {
  const pares = CATALOGO.map((m) => `${m.provider}:${m.model}`);
  assert.equal(new Set(pares).size, pares.length);
});

test("todo provedor oferecido tem ao menos um modelo catalogado", () => {
  // Um provedor sem modelo é uma opção que leva a um formulário sem saída.
  for (const p of PROVIDERS) {
    assert.ok(modelosDe(p.value).length > 0, `${p.value} sem modelo`);
  }
});

test("a lista sugerida não oferece o que o catálogo recusa", () => {
  /*
   * `PROVIDER_MODELS` alimenta o menu da tela. Se ele oferecesse um modelo
   * fora do catálogo, a pessoa escolheria da lista e receberia 400 — o produto
   * recusando o que ele mesmo sugeriu.
   */
  const forasteiros: string[] = [];
  for (const [provider, modelos] of Object.entries(PROVIDER_MODELS)) {
    for (const model of modelos) {
      if (!modeloAutorizado(provider, model)) forasteiros.push(`${provider}:${model}`);
    }
  }
  assert.deepEqual(forasteiros, []);
});

test("todo modelo do catálogo faz texto", () => {
  // Um modelo só-visão não serve ao produto: toda tarefa começa por uma
  // pergunta ou uma instrução em texto.
  assert.ok(CATALOGO.every((m) => m.capabilities.text));
});

// ─── O portão de visão ──────────────────────────────────────────────────────

const PRECO_FICTICIO: ModelPricing = {
  inputPerMillionTokensUsd: 1, outputPerMillionTokensUsd: 2,
  currency: "USD", source: "https://example.test", asOf: "2026-01-01",
};

test("modelo sem preço nenhum não recebe imagem", () => {
  assert.equal(podeAnalisarImagem({ text: true, vision: true, streaming: true }), false);
});

test("modelo com preço de texto mas sem maxImageTokens não recebe imagem", () => {
  /*
   * O caso real do MiniMax M3: aceita imagem tecnicamente, tem preço de
   * TEXTO verificado, mas a Ollama não publica quantos tokens uma imagem
   * consome nele — sem esse número não há como calcular quanto reservar.
   * `vision: true` sozinho nunca basta.
   */
  assert.equal(
    podeAnalisarImagem({ text: true, vision: true, streaming: true, pricing: PRECO_FICTICIO }),
    false,
    "pricing sem maxImageTokens não deveria bastar",
  );
});

test("modelo com maxImageTokens documentado recebe imagem", () => {
  assert.equal(
    podeAnalisarImagem({
      text: true, vision: true, streaming: true,
      pricing: { ...PRECO_FICTICIO, maxImageTokens: 1000 },
    }),
    true,
  );
});

test("modelo sem visão nenhuma não recebe imagem, mesmo com maxImageTokens", () => {
  // Combinação que não deveria existir no catálogo, mas a função não confia
  // em dado incoerente — ela exige as DUAS condições, não uma só.
  assert.equal(
    podeAnalisarImagem({
      text: true, vision: false, streaming: true,
      pricing: { ...PRECO_FICTICIO, maxImageTokens: 1000 },
    }),
    false,
  );
});

test("os modelos do catálogo com imagem computável hoje", () => {
  /*
   * Este teste é sobre o ESTADO ATUAL, não sobre uma regra permanente — o
   * dia em que outro modelo ganhar um `maxImageTokens` com fonte oficial,
   * a lista muda JUNTO, no mesmo commit que traz a fonte. Mesma disciplina
   * do teste de seções exatas do aceite: mudar o número exige declarar o
   * motivo.
   */
  const comImagemComputavel = CATALOGO
    .filter((m) => podeAnalisarImagem(m.capabilities))
    .map((m) => `${m.provider}:${m.model}`);
  // 18/09/2026: entrou o Gemini 3.6 Flash, com a fonte oficial do teto de
  // imagem (https://ai.google.dev/gemini-api/docs/media-resolution, 2240
  // tokens no nível mais alto) — no mesmo commit, como este teste exige.
  assert.deepEqual(comImagemComputavel, ["google:gemini-3.6-flash", "ollama-cloud:gemma4:31b-cloud"]);
});

test("todo modelo com preço verificado cita fonte, data e moeda", () => {
  for (const m of CATALOGO) {
    const p = m.capabilities.pricing;
    if (!p) continue;
    assert.match(p.source, /^https?:\/\//, `${m.model}: fonte não é URL`);
    assert.match(p.asOf, /^\d{4}-\d{2}-\d{2}$/, `${m.model}: data mal formada`);
    assert.equal(p.currency, "USD", `${m.model}: moeda`);
    assert.ok(p.inputPerMillionTokensUsd > 0, `${m.model}: entrada não positiva`);
    assert.ok(p.outputPerMillionTokensUsd > 0, `${m.model}: saída não positiva`);
  }
});

test("os quatro modelos da Ollama Cloud estão catalogados, mas não configuráveis por acaso", () => {
  // "Estar no catálogo" não é "estar ativo": nenhum tem ai_settings real.
  // Este teste só confirma que os PARES existem e têm o formato certo —
  // não que algum está em uso.
  for (const par of [
    "ollama-cloud:gemma4:31b-cloud", "ollama-cloud:minimax-m3:cloud",
    "ollama-cloud:deepseek-v4-flash:cloud", "ollama-cloud:nemotron-3-ultra:cloud",
  ]) {
    const [provider, ...resto] = par.split(":");
    assert.equal(modeloAutorizado(provider, resto.join(":")), true, par);
  }
});

test("DeepSeek e Nemotron da Ollama Cloud são texto, não candidatos de visão", () => {
  const deepseek = capacidadesDe("ollama-cloud", "deepseek-v4-flash:cloud");
  const nemotron = capacidadesDe("ollama-cloud", "nemotron-3-ultra:cloud");
  assert.equal(deepseek?.vision, false);
  assert.equal(nemotron?.vision, false);
});

// ─── Custo, a partir do preço ───────────────────────────────────────────────

test("custoMicros: microUSD = tokens × preço por milhão, sem escala extra", () => {
  // 0,14 USD/milhão × 1.000.000 tokens = 0,14 USD = 140.000 microUSD.
  assert.equal(custoMicros(0.14, 1_000_000), 140_000);
  // 1 token a 1 USD/milhão = 1 microUSD.
  assert.equal(custoMicros(1, 1), 1);
});

test("custoMicros arredonda para cima — nunca subestima", () => {
  assert.equal(custoMicros(0.33, 1), 1); // 0.33 arredondaria para 0 sem o ceil
});

test("custoDeReservaMicros soma entrada (+imagem) e saída, nos preços certos", () => {
  const preco: ModelPricing = {
    inputPerMillionTokensUsd: 0.14, outputPerMillionTokensUsd: 0.40,
    currency: "USD", source: "https://example.test", asOf: "2026-01-01",
  };
  // 3000 tokens de entrada + 500 de saída, sem imagem.
  const semImagem = custoDeReservaMicros(preco, { entrada: 3000, saida: 500 });
  assert.equal(semImagem, custoMicros(0.14, 3000) + custoMicros(0.40, 500));

  // Com imagem: o teto de imagem entra pelo preço de ENTRADA, somado ao resto.
  const comImagem = custoDeReservaMicros(preco, { entrada: 3000, saida: 500, imagem: 1120 });
  assert.equal(comImagem, custoMicros(0.14, 3000 + 1120) + custoMicros(0.40, 500));
  assert.ok(comImagem > semImagem);
});

test("Gemini 2.5 Flash tem preço verificado para texto, e análise de imagem continua bloqueada", () => {
  /*
   * 18/09/2026: o ensaio usa a camada gratuita do Google. Sem preço no
   * catálogo, a trava de orçamento recusava até o chat. O preço registrado é o
   * da camada paga, com fonte e data — o custo que este uso TERIA.
   *
   * Imagem continua bloqueada: o Google não publica teto de tokens por imagem
   * (imagem grande é cortada em blocos sem limite), e o produto ainda não reduz
   * a imagem antes de enviar. Reservar sem teto seria reservar um chute.
   */
  const flash = capacidadesDe("google", "gemini-2.5-flash");
  assert.ok(flash?.pricing, "o Flash precisa ter preço verificado");
  assert.equal(flash!.pricing!.inputPerMillionTokensUsd, 0.30);
  assert.equal(flash!.pricing!.outputPerMillionTokensUsd, 2.50);
  assert.match(flash!.pricing!.source, /ai\.google\.dev/);
  assert.equal(podeAnalisarImagem(flash!), false, "sem teto de tokens por imagem, a análise não pode reservar");
});

test("Gemini 3.6 Flash: preço verificado e custo de imagem com teto documentado", () => {
  /*
   * 18/09/2026: o Google fechou o 2.5 Flash para contas novas e indicou o 3.6.
   * No Gemini 3 a imagem tem custo fixo por nível de resolução, com teto
   * documentado de 2240 tokens — então, ao contrário do 2.5, a análise de
   * peça pode reservar o custo e é liberada.
   */
  const flash = capacidadesDe("google", "gemini-3.6-flash");
  assert.ok(flash?.pricing, "o 3.6 Flash precisa ter preço verificado");
  assert.equal(flash!.pricing!.inputPerMillionTokensUsd, 0.75);
  assert.equal(flash!.pricing!.outputPerMillionTokensUsd, 3.75);
  assert.equal(flash!.pricing!.maxImageTokens, 2240);
  assert.equal(podeAnalisarImagem(flash!), true);
  assert.ok(modeloAutorizado("google", "gemini-3.6-flash"));
});
