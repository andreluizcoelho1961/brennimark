import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { APICallError } from "ai";
import { CATALOGO, podeAnalisarImagem } from "./catalogo";
import { classifyAIError, semProvedorConfigurado } from "./errors";
import { montarRotasDaAgencia, type LinhaDaChave } from "./rotas-da-agencia";
import { ESPERA_PADRAO_MS } from "./rotas-da-plataforma";

/**
 * O roteamento da IA que a agência traz — ADR-0009, adendo de 07/11/2026.
 * As chaves aqui são de mentira; o que se prova é a regra: cada encaixe vira
 * uma tentativa com a SUA chave, e nada da Brennimark entra no lugar.
 */
const decifrar = (cifra: string) => {
  if (cifra.startsWith("ilegivel")) throw new Error("Unsupported state or unable to authenticate data");
  return `chave:${cifra}`;
};

const comVisao = CATALOGO.find((m) => podeAnalisarImagem(m.capabilities));
const semVisao = CATALOGO.find((m) => !podeAnalisarImagem(m.capabilities));
assert.ok(comVisao && semVisao, "o catálogo precisa ter um modelo com e um sem visão para este teste");

const linha = (encaixe: LinhaDaChave["encaixe"], m: { provider: string; model: string }, cifra: string = encaixe): LinhaDaChave =>
  ({ encaixe, provedor: m.provider, modelo: m.model, chave_cifrada: cifra, chave_iv: "iv" });

test("o chat usa o texto e depois a reserva, cada um com a sua chave", () => {
  const r = montarRotasDaAgencia(
    [linha("reserva", semVisao), linha("texto", comVisao), linha("imagem", comVisao)],
    "chat",
    decifrar,
  );
  assert.deepEqual(
    r.attempts.map((a) => [a.config.provider, a.config.model, a.config.apiKey]),
    [
      [comVisao.provider, comVisao.model, "chave:texto"],
      [semVisao.provider, semVisao.model, "chave:reserva"],
    ],
  );
  assert.equal(r.allowCrossProvider, true);
  assert.equal(r.timeoutMs, ESPERA_PADRAO_MS.chat);
  assert.deepEqual(r.descartadas, []);
});

test("a análise usa a imagem e depois a reserva — e pula quem não vê imagem", () => {
  const r = montarRotasDaAgencia([linha("texto", comVisao), linha("imagem", comVisao), linha("reserva", semVisao)], "analysis", decifrar);
  assert.deepEqual(r.attempts.map((a) => a.config.apiKey), ["chave:imagem"]);
  assert.deepEqual(r.descartadas.map((d) => [d.encaixe, d.motivo]), [["reserva", "sem-visao"]]);
});

test("sem chave nenhuma, não há tentativa — e não há outro lugar de onde tirar uma", () => {
  const r = montarRotasDaAgencia([], "chat", decifrar);
  assert.deepEqual(r.attempts, []);
});

test("chave que não decifra é descartada, dita, e a reserva assume", () => {
  const r = montarRotasDaAgencia([linha("texto", comVisao, "ilegivel"), linha("reserva", semVisao)], "chat", decifrar);
  assert.deepEqual(r.attempts.map((a) => a.config.apiKey), ["chave:reserva"]);
  assert.deepEqual(r.descartadas.map((d) => [d.encaixe, d.motivo]), [["texto", "chave-ilegivel"]]);
});

test("provedor fora da lista fechada e modelo fora do catálogo não viram tentativa", () => {
  const r = montarRotasDaAgencia(
    [
      { encaixe: "texto", provedor: "ollama-cloud", modelo: "qualquer", chave_cifrada: "a", chave_iv: "iv" },
      { encaixe: "reserva", provedor: comVisao.provider, modelo: "modelo-que-nao-existe", chave_cifrada: "b", chave_iv: "iv" },
    ],
    "chat",
    decifrar,
  );
  assert.deepEqual(r.attempts, []);
  assert.deepEqual(r.descartadas.map((d) => d.motivo), ["provedor-fora-da-lista", "fora-do-catalogo"]);
});

test("o descarte nunca carrega a chave", () => {
  const r = montarRotasDaAgencia([linha("texto", comVisao, "ilegivel-SEGREDO123")], "chat", decifrar);
  assert.equal(r.descartadas.length, 1);
  assert.doesNotMatch(JSON.stringify(r.descartadas), /SEGREDO123|chave:/);
});

// ─── as mensagens ──────────────────────────────────────────────────────────

test("sem IA na conta da agência, a mensagem manda ao administrador e diz que não há IA reserva nossa", () => {
  const pt = semProvedorConfigurado(false, "propria").message;
  assert.match(pt, /sua agência/);
  assert.match(pt, /não usa outra IA/);
  assert.doesNotMatch(pt, /suporte da Brennimark/);
  assert.match(semProvedorConfigurado(true, "propria").message, /does not switch to another AI/);
  // a conta da plataforma segue como antes
  assert.match(semProvedorConfigurado(false).message, /suporte da Brennimark/);
});

test("chave da agência recusada pelo provedor (401) diz de quem é o conserto", () => {
  const erro = new APICallError({ message: "bad key", url: "https://x", requestBodyValues: {}, statusCode: 401 });
  const propria = classifyAIError(erro, false, "propria");
  assert.equal(propria.code, "invalid_key");
  assert.match(propria.message, /chave de IA da sua agência/);
  assert.match(propria.message, /não usa outra IA/);
  assert.equal(classifyAIError(erro, false).message, "Chave de API inválida ou sem permissão para esse modelo.");
});

// ─── guardas de fonte: a fronteira que não se cruza ────────────────────────

const raiz = join(process.cwd(), "src");
const ler = (caminho: string) => readFileSync(join(raiz, caminho), "utf8");

test("as rotas da agência não importam nem leem as chaves da plataforma", () => {
  const fonte = ler("lib/ai/rotas-da-agencia.ts");
  assert.doesNotMatch(fonte, /chaves-da-plataforma|chaveDaPlataforma|process\.env|BRENNIMARK_CHAVE/);
});

test("conta que trouxe a sua IA sai antes de qualquer leitura das rotas da plataforma", () => {
  const fonte = ler("lib/ai/settings.ts");
  const corpo = fonte.slice(fonte.indexOf("export async function resolveFeatureRouting"), fonte.indexOf("export async function resolveChatRouting"));
  assert.ok(corpo.indexOf('modo === "propria"') > -1);
  assert.ok(corpo.indexOf("resolverRotaDaAgencia(") < corpo.indexOf("rotas_de_ia_da_plataforma"),
    "o modo próprio precisa retornar ANTES de olhar as rotas da plataforma");
  const agencia = fonte.slice(fonte.indexOf("async function resolverRotaDaAgencia"));
  assert.doesNotMatch(agencia, /rotas_de_ia_da_plataforma|montarRotas\(|chaveDaPlataforma/,
    "a rota da agência não pode cair nas rotas ou chaves da plataforma");
});

test("o portão das rotas de IA barra quem teve o Vini desligado, e erra para o lado fechado", () => {
  const fonte = ler("lib/brennimark/contexto-da-rota.ts");
  const portao = fonte.slice(fonte.indexOf("export async function portaoDeIA"));
  assert.match(portao, /posso_usar_o_vini/);
  assert.match(portao, /error \|\| pode !== true/, "falhar ao perguntar tem de recusar, não liberar");
  assert.match(portao, /vini_desligado/);
});
