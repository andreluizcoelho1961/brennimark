import assert from "node:assert/strict";
import test from "node:test";
import { comAlvo } from "./alvo";

test("os dois presentes viram w e b, como sempre", () => {
  assert.equal(
    comAlvo("/api/ai/settings", { workspaceSlug: "agencia-norte", brandKey: "padaria" }),
    "/api/ai/settings?w=agencia-norte&b=padaria",
  );
});

test("nenhum dos dois presentes devolve a URL intocada", () => {
  assert.equal(comAlvo("/api/ai/settings", {}), "/api/ai/settings");
});

test("só a conta, sem marca, ainda anexa w", () => {
  // A regressão que este teste tranca: faltar UM dos dois descartava os DOIS.
  // Uma tela escopada só na conta chamando uma API de conta sairia sem `w`, e
  // `workspaceDaRota` cairia no palpite de "resolve se houver só uma conta" —
  // 409 workspace_ambiguo para quem tem duas. Nenhuma tela assim existe hoje;
  // o teste existe para que a primeira delas já nasça certa.
  assert.equal(
    comAlvo("/api/ai/settings", { workspaceSlug: "agencia-norte" }),
    "/api/ai/settings?w=agencia-norte",
  );
});

test("só a marca, sem conta, anexa b — meio alvo continua não virando alvo", () => {
  // `alvoDaRota` exige os dois para montar um Alvo, então isto não faz rota de
  // marca nenhuma resolver por engano; só evita descartar informação boa.
  assert.equal(comAlvo("/api/assets", { brandKey: "padaria" }), "/api/assets?b=padaria");
});

test("query existente é preservada, não substituída", () => {
  assert.equal(
    comAlvo("/api/assets?category=logo", { workspaceSlug: "agencia-norte", brandKey: "padaria" }),
    "/api/assets?category=logo&w=agencia-norte&b=padaria",
  );
});
