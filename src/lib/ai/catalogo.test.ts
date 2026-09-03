import assert from "node:assert/strict";
import test from "node:test";
import { CATALOGO, capacidadesDe, modelosDe, modeloAutorizado, podeAnalisarImagem } from "./catalogo";
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
    "openrouter:google/gemma-4-26b-a4b-it:free",
    "openrouter:nvidia/nemotron-3-ultra-550b-a55b:free",
    "openrouter:openrouter/free",
    "openrouter:qwen/qwen3.5-flash-02-23",
  ]);
  // E nenhum deles é de provedor com credencial direta: lá o limite é público.
  assert.ok(semLimite.every((m) => m.startsWith("openrouter:")));
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

test("modelo sem precificação de imagem verificada não recebe imagem", () => {
  /*
   * A alternativa que o briefing também permite — reservar um teto
   * conservador — exigiria um número que hoje não tenho de nenhuma fonte
   * oficial. Bloquear é a escolha mais honesta enquanto esse número não
   * existir: nenhuma reserva pode ser melhor que uma baseada em preço
   * confirmado.
   */
  assert.equal(
    podeAnalisarImagem({ text: true, vision: true, streaming: true }),
    false,
    "vision:true sem imagePricingVerified não deveria bastar",
  );
});

test("modelo com precificação de imagem verificada recebe", () => {
  assert.equal(
    podeAnalisarImagem({ text: true, vision: true, streaming: true, imagePricingVerified: true }),
    true,
  );
});

test("modelo sem visão nenhuma não recebe imagem, mesmo com preço marcado", () => {
  // Combinação que não deveria existir no catálogo, mas a função não confia
  // em dado incoerente — ela exige as DUAS condições, não uma só.
  assert.equal(
    podeAnalisarImagem({ text: true, vision: false, streaming: true, imagePricingVerified: true }),
    false,
  );
});

test("nenhum modelo do catálogo hoje tem preço de imagem verificado", () => {
  /*
   * Este teste é sobre o ESTADO ATUAL, não sobre uma regra permanente — o dia
   * em que alguém confirmar o preço de um modelo com fonte oficial, ele passa
   * a `imagePricingVerified: true` e este teste precisa ser atualizado
   * JUNTO, no mesmo commit que traz a fonte. É a mesma disciplina do teste de
   * seções exatas do aceite: mudar o número exige declarar o motivo.
   */
  const comPrecoVerificado = CATALOGO.filter((m) => m.capabilities.imagePricingVerified);
  assert.deepEqual(comPrecoVerificado, []);
});
