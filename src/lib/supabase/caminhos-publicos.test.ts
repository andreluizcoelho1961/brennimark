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
