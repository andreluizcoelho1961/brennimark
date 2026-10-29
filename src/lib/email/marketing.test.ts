import assert from "node:assert/strict";
import test from "node:test";
import { cabecalhosDeSaida, ehSaidaEmUmClique, lerAcaoDeEmail, TETO_POR_ENVIO } from "./marketing";

test("o teste aceita o idioma en e trata qualquer outro valor como pt-BR", () => {
  assert.deepEqual(lerAcaoDeEmail({ acao: "teste", campanha: "convite-fonts-beta", idioma: "en" }), { ok: true, acao: { acao: "teste", campanha: "convite-fonts-beta", idioma: "en" } });
  assert.deepEqual(lerAcaoDeEmail({ acao: "teste", campanha: "convite-fonts-beta", idioma: "fr" }), { ok: true, acao: { acao: "teste", campanha: "convite-fonts-beta", idioma: "pt-BR" } });
});

test("os cabeçalhos de saída seguem o RFC 8058: endereço https e o corpo de um clique", () => {
  const h = cabecalhosDeSaida("https://www.brennimark.com/api/sair/abc");
  assert.equal(h["List-Unsubscribe"], "<https://www.brennimark.com/api/sair/abc>");
  assert.equal(h["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

test("só o corpo exato do provedor conta como saída em um clique", () => {
  assert.equal(ehSaidaEmUmClique("List-Unsubscribe=One-Click"), true);
  assert.equal(ehSaidaEmUmClique(" List-Unsubscribe=One-Click\n"), true);
  assert.equal(ehSaidaEmUmClique("a=1&List-Unsubscribe=One-Click"), true);
  assert.equal(ehSaidaEmUmClique(""), false);
  assert.equal(ehSaidaEmUmClique("List-Unsubscribe=Other"), false);
  assert.equal(ehSaidaEmUmClique("x-List-Unsubscribe=One-Click"), false);
});

test("o pedido do Console exige campanha que existe, e lê cargos e equipes só da lista", () => {
  assert.equal(lerAcaoDeEmail({ acao: "resumo", campanha: "nao-existe" }).ok, false);
  assert.equal(lerAcaoDeEmail(null).ok, false);
  assert.equal(lerAcaoDeEmail({ acao: "x", campanha: "convite-fonts-beta" }).ok, false);

  assert.deepEqual(lerAcaoDeEmail({ acao: "resumo", campanha: "convite-fonts-beta" }), { ok: true, acao: { acao: "resumo", campanha: "convite-fonts-beta", cargos: [], equipes: [] } });
  assert.deepEqual(
    lerAcaoDeEmail({ acao: "resumo", campanha: "convite-fonts-beta", cargos: ["designer", "designer"], equipes: ["so-eu"] }),
    { ok: true, acao: { acao: "resumo", campanha: "convite-fonts-beta", cargos: ["designer"], equipes: ["so-eu"] } },
  );
  assert.equal(lerAcaoDeEmail({ acao: "resumo", campanha: "convite-fonts-beta", cargos: ["rei"] }).ok, false);
  assert.equal(lerAcaoDeEmail({ acao: "resumo", campanha: "convite-fonts-beta", equipes: "so-eu" }).ok, false);
  assert.deepEqual(lerAcaoDeEmail({ acao: "teste", campanha: "convite-fonts-beta" }), { ok: true, acao: { acao: "teste", campanha: "convite-fonts-beta", idioma: "pt-BR" } });
});

test("enviar pede de 1 ao teto por clique, inteiro", () => {
  const base = { acao: "enviar", campanha: "convite-fonts-beta" };
  assert.equal(lerAcaoDeEmail({ ...base, limite: 1 }).ok, true);
  assert.equal(lerAcaoDeEmail({ ...base, limite: TETO_POR_ENVIO }).ok, true);
  for (const ruim of [0, -1, TETO_POR_ENVIO + 1, 1.5, "abc", null, undefined]) {
    assert.equal(lerAcaoDeEmail({ ...base, limite: ruim }).ok, false, `limite ${String(ruim)}`);
  }
});
