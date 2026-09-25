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
  assert.equal(caminhoPublico("/"), false);
});
