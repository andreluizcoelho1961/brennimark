import assert from "node:assert/strict";
import test from "node:test";
import { CATALOGO, podeAnalisarImagem } from "../ai/catalogo";
import { TERMO, TERMO_VERSAO } from "./termo";
import { finalDaChave, pareceGratuito, validarCadastro } from "./validar";

const CHAVE = "sk-de-mentira-0123456789abcdef";
const comVisao = CATALOGO.find((m) => m.provider !== "openrouter" && podeAnalisarImagem(m.capabilities))!;
const semVisao = CATALOGO.find((m) => m.provider !== "openrouter" && !podeAnalisarImagem(m.capabilities))!;

test("um cadastro certo passa, com a chave aparada", () => {
  const r = validarCadastro({ encaixe: "texto", provedor: comVisao.provider, modelo: comVisao.model, chave: `  ${CHAVE}\n` });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.cadastro.chave, CHAVE);
});

test("encaixe, provedor e modelo fora da lista fechada são recusados pelo nome", () => {
  const base = { encaixe: "texto", provedor: comVisao.provider, modelo: comVisao.model, chave: CHAVE };
  assert.deepEqual(validarCadastro({ ...base, encaixe: "voz" }), { ok: false, erro: "encaixe_invalido" });
  // Provedor que existe no produto, mas não é oferecido ao plano "traga a sua".
  assert.deepEqual(validarCadastro({ ...base, provedor: "ollama-cloud" }), { ok: false, erro: "provedor_invalido" });
  assert.deepEqual(validarCadastro({ ...base, provedor: "https://outro.lugar" }), { ok: false, erro: "provedor_invalido" });
  assert.deepEqual(validarCadastro({ ...base, modelo: "modelo-inventado" }), { ok: false, erro: "modelo_invalido" });
});

test("o encaixe de imagem exige modelo que o produto usa com imagem", () => {
  const base = { encaixe: "imagem", chave: CHAVE };
  assert.equal(validarCadastro({ ...base, provedor: comVisao.provider, modelo: comVisao.model }).ok, true);
  assert.deepEqual(validarCadastro({ ...base, provedor: semVisao.provider, modelo: semVisao.model }), { ok: false, erro: "modelo_sem_visao" });
  // O texto e a reserva aceitam o modelo sem visão.
  assert.equal(validarCadastro({ encaixe: "reserva", provedor: semVisao.provider, modelo: semVisao.model, chave: CHAVE }).ok, true);
});

test("chave curta, longa ou com espaço no meio é recusada", () => {
  const base = { encaixe: "texto", provedor: comVisao.provider, modelo: comVisao.model };
  for (const chave of ["", "curta", "x".repeat(401), "com espaco no meio 123456", undefined, 42]) {
    assert.deepEqual(validarCadastro({ ...base, chave }), { ok: false, erro: "chave_invalida" });
  }
});

test("entrada que não é objeto não quebra", () => {
  assert.deepEqual(validarCadastro(null), { ok: false, erro: "encaixe_invalido" });
  assert.deepEqual(validarCadastro("texto"), { ok: false, erro: "encaixe_invalido" });
});

test("a tela mostra só os quatro últimos caracteres", () => {
  assert.equal(finalDaChave(CHAVE), "cdef");
});

test("modelo gratuito é reconhecido para o aviso", () => {
  assert.equal(pareceGratuito("openrouter", "openrouter/free"), true);
  assert.equal(pareceGratuito("openrouter", "x/y:free"), true);
  assert.equal(pareceGratuito("anthropic", "claude-sonnet-5"), false);
});

test("o termo existe nos dois idiomas, tem versão em data e diz o essencial", () => {
  assert.match(TERMO_VERSAO, /^\d{4}-\d{2}-\d{2}$/);
  for (const lingua of [TERMO.pt, TERMO.en]) {
    assert.ok(lingua.itens.length >= 4);
  }
  const pt = TERMO.pt.itens.join(" ");
  assert.match(pt, /gratuitos?/);
  assert.match(pt, /treinar/);
  assert.match(pt, /não oferece outra/);
});
