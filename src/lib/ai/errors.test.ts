import assert from "node:assert/strict";
import test from "node:test";
import { classifyAIError } from "./errors";

/**
 * O erro do provedor não chega à tela.
 *
 * Do primeiro ciclo autenticado: o chat exibiu "No AI provider configured and
 * GROQ_API_KEY is not set. Add GROQ_API_KEY to .env.local…" para quem só
 * queria fazer uma pergunta ao manual. Isso ensina a configuração do servidor
 * a quem não administra, e contradiz a política de fronteiras de erro.
 */
const CRU =
  "No AI provider configured and GROQ_API_KEY is not set. Add GROQ_API_KEY to .env.local for the free-tier demo fallback.";

test("a mensagem do provedor não vira a mensagem da tela", () => {
  const { message } = classifyAIError(new Error(CRU));
  for (const vazamento of ["GROQ_API_KEY", ".env.local", "fallback"]) {
    assert.ok(!message.includes(vazamento), `"${vazamento}" chegou à tela`);
  }
});

test("o detalhe técnico existe, e vem separado", () => {
  // Ele precisa continuar disponível — para o log. O que não pode é sair na
  // mesma chave que a interface renderiza.
  const { message, detalheTecnico } = classifyAIError(new Error(CRU));
  assert.equal(detalheTecnico, CRU);
  assert.notEqual(message, detalheTecnico);
});

test("provedor ausente tem mensagem própria, e ela diz a quem pedir", () => {
  // "Erro desconhecido" mandaria a pessoa tentar de novo para sempre. O estado
  // é do produto, não do provedor: falta configuração, e quem configura é quem
  // administra a conta.
  const erro = new Error("nenhum provedor de IA configurado para esta conta");
  erro.name = "SemProvedorDeIA";
  const { code, message } = classifyAIError(erro);
  assert.equal(code, "no_provider");
  assert.match(message, /administra|administers/i);
  assert.doesNotMatch(message, /GROQ|env|API_KEY/i);
});

test("erro desconhecido não expõe a mensagem original", () => {
  const { message, detalheTecnico } = classifyAIError(
    new Error("connect ECONNREFUSED 10.0.0.5:5432 while querying manual_do_cliente"),
  );
  assert.ok(!message.includes("ECONNREFUSED"));
  assert.ok(!message.includes("manual_do_cliente"));
  assert.ok(detalheTecnico?.includes("ECONNREFUSED"));
});

test("o que não é Error também não vaza", () => {
  const { message } = classifyAIError({ segredo: "hunter2" });
  assert.ok(!message.includes("hunter2"));
});
