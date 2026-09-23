import assert from "node:assert/strict";
import test from "node:test";
import { APICallError } from "ai";
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

test("sobrecarga do provedor tem mensagem própria — não é 'não foi possível falar'", () => {
  // A resposta literal do Google no ensaio de 23/09.
  const doGoogle = new APICallError({
    message: "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
    url: "https://generativelanguage.googleapis.com/", requestBodyValues: {}, statusCode: 503,
  });
  const r = classifyAIError(doGoogle);
  assert.equal(r.code, "overloaded");
  assert.match(r.message, /sobrecarregado/);
  assert.match(r.message, /alguns minutos/);
  // O texto do provedor fica para o log, não para a tela.
  assert.ok(!r.message.includes("high demand"));
  assert.match(r.detalheTecnico ?? "", /high demand/);
});

test("sobrecarga reconhecida pelo código, mesmo com texto diferente", () => {
  const anthropic = new APICallError({ message: "Overloaded", url: "x", requestBodyValues: {}, statusCode: 529 });
  assert.equal(classifyAIError(anthropic).code, "overloaded");
  const semTexto = new APICallError({ message: "", url: "x", requestBodyValues: {}, statusCode: 503 });
  assert.equal(classifyAIError(semTexto).code, "overloaded");
});

test("limite de uso não manda mais configurar 'modo demo'", () => {
  const r = classifyAIError(new APICallError({ message: "quota", url: "x", requestBodyValues: {}, statusCode: 429 }));
  assert.equal(r.code, "rate_limited");
  assert.doesNotMatch(r.message, /demo/i);
});

test("pedido grande demais para o plano (Groq 413) tem mensagem própria, e o detalhe fica no log", () => {
  // O texto real da recusa de 23/09/2026, no teste de conexão do Qwen 3.8.
  const doGroq = new APICallError({
    message: "Request too large for model `qwen/qwen3.8-27b` in organization `org_x` service tier `on_demand` on output tokens per minute (OTPM): Limit 1000, Requested 1281.",
    url: "https://api.groq.com/", requestBodyValues: {}, statusCode: 413,
  });
  const r = classifyAIError(doGroq);
  assert.equal(r.code, "request_too_large");
  assert.match(r.message, /por minuto/);
  assert.doesNotMatch(r.message, /org_x|qwen/);
  assert.match(r.detalheTecnico ?? "", /OTPM/);
});
