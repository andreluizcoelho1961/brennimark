import assert from "node:assert/strict";
import test from "node:test";
import { caminhoPublico } from "./caminhos-publicos";

test("login e retorno da autenticação continuam abertos", () => {
  assert.equal(caminhoPublico("/login"), true);
  assert.equal(caminhoPublico("/auth/callback"), true);
});

test("a manutenção passa sem sessão — quem chama é o Cron, e a rota exige o segredo", () => {
  assert.equal(caminhoPublico("/api/manutencao/materiais-orfaos"), true);
});

test("só o prefixo exato: nada vizinho de manutenção passa", () => {
  assert.equal(caminhoPublico("/api/manutencao"), false);
  assert.equal(caminhoPublico("/api/manutencaox/qualquer"), false);
  assert.equal(caminhoPublico("/api/admin/assets"), false);
  assert.equal(caminhoPublico("/api/assets/kit"), false);
  assert.equal(caminhoPublico("/w/conta/b/marca/docs"), false);
});

test("o site passa sem sessão: a home e cada página pública", () => {
  assert.equal(caminhoPublico("/"), true);
  assert.equal(caminhoPublico("/vini"), true);
  assert.equal(caminhoPublico("/licenca-de-fontes"), true);
});

test("o site casa pelo caminho exato: a home não abre o produto", () => {
  // `/` como prefixo casaria com TUDO. Estes são o produto, e pedem sessão.
  assert.equal(caminhoPublico("/docs"), false);
  assert.equal(caminhoPublico("/console"), false);
  assert.equal(caminhoPublico("/api/console/ia"), false);
  assert.equal(caminhoPublico("/w/conta"), false);
  // Nem o que só começa como uma página do site.
  assert.equal(caminhoPublico("/vini/"), false);
  assert.equal(caminhoPublico("/vini/qualquer"), false);
  assert.equal(caminhoPublico("/vinix"), false);
  assert.equal(caminhoPublico("/manual-da-marca"), false);
});

test("o link de entrega passa sem sessão — a página e o download; a autorização é o código", () => {
  assert.equal(caminhoPublico("/receber/abc"), true);
  assert.equal(caminhoPublico("/api/receber/abc/baixar"), true);
});

test("só o prefixo exato do link público: a gestão dos links pede sessão", () => {
  assert.equal(caminhoPublico("/receber"), false);
  assert.equal(caminhoPublico("/receberx/abc"), false);
  assert.equal(caminhoPublico("/api/receber"), false);
  assert.equal(caminhoPublico("/api/links"), false);
  assert.equal(caminhoPublico("/api/links/x/revogar"), false);
  assert.equal(caminhoPublico("/w/conta/links"), false);
  // `/entrega` é a página do SITE que apresenta o recurso — casa exato, e só ela.
  assert.equal(caminhoPublico("/entrega"), true);
  assert.equal(caminhoPublico("/entrega/abc"), false);
});

test("o webhook do Stripe passa sem sessão — a autorização é a assinatura do aviso", () => {
  assert.equal(caminhoPublico("/api/cobranca/stripe"), true);
});

test("só o caminho exato do webhook: o resto da cobrança pede sessão", () => {
  assert.equal(caminhoPublico("/api/cobranca"), false);
  assert.equal(caminhoPublico("/api/cobranca/"), false);
  assert.equal(caminhoPublico("/api/cobranca/stripe/"), false);
  assert.equal(caminhoPublico("/api/cobranca/stripex"), false);
  assert.equal(caminhoPublico("/api/cobranca/portal"), false);
});

test("a compra passa sem sessão — quem compra ainda não tem conta", () => {
  assert.equal(caminhoPublico("/assinar"), true);
  assert.equal(caminhoPublico("/assinar/obrigado"), true);
  assert.equal(caminhoPublico("/api/cobranca/checkout"), true);
  assert.equal(caminhoPublico("/assinar/qualquer"), false);
  assert.equal(caminhoPublico("/assinarx"), false);
  assert.equal(caminhoPublico("/api/cobranca/checkoutx"), false);
});

test("a senha na volta do pagamento passa sem sessão, pelo caminho exato", () => {
  assert.equal(caminhoPublico("/api/cobranca/senha"), true);
  assert.equal(caminhoPublico("/api/cobranca/senha/"), false);
  assert.equal(caminhoPublico("/api/cobranca/senhax"), false);
});

test("o Esqueci a senha passa sem sessão; a troca, não", () => {
  assert.equal(caminhoPublico("/esqueci-senha"), true);
  assert.equal(caminhoPublico("/api/conta/esqueci-senha"), true);
  assert.equal(caminhoPublico("/nova-senha"), false);
  assert.equal(caminhoPublico("/api/conta/nova-senha"), false);
  assert.equal(caminhoPublico("/esqueci-senhax"), false);
});

test("o Kit gratuito é público pelo caminho exato, e só ele", () => {
  assert.equal(caminhoPublico("/ferramentas/kit"), true);
  assert.equal(caminhoPublico("/ferramentas"), false);
  assert.equal(caminhoPublico("/ferramentas/kitx"), false);
  assert.equal(caminhoPublico("/ferramentas/kit/qualquer"), false);
});

test("o Cores gratuito é público pelo caminho exato", () => {
  assert.equal(caminhoPublico("/ferramentas/cores"), true);
  assert.equal(caminhoPublico("/ferramentas/coresx"), false);
});
