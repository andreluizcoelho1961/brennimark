import assert from "node:assert/strict";
import test from "node:test";
import { DESTINO_PADRAO, destinoDeRetorno } from "./destino-de-retorno";

test("caminho interno passa, com query e âncora", () => {
  assert.equal(destinoDeRetorno("/w/conta/b/marca/docs"), "/w/conta/b/marca/docs");
  assert.equal(destinoDeRetorno("/docs/analise?repeat=1"), "/docs/analise?repeat=1");
  assert.equal(destinoDeRetorno("/docs/cor#paleta"), "/docs/cor#paleta");
});

test("URL absoluta para outro domínio é recusada", () => {
  // O vetor: a pessoa confere que está no domínio certo, entra, e o navegador
  // a leva para fora já logada. O login ter dado certo é o que torna isso
  // convincente.
  assert.equal(destinoDeRetorno("https://sitedele.exemplo"), DESTINO_PADRAO);
  assert.equal(destinoDeRetorno("http://sitedele.exemplo/docs"), DESTINO_PADRAO);
});

test("relativo a protocolo é recusado, apesar de começar com barra", () => {
  // `//host` passa em toda validação que só checa `startsWith("/")`.
  assert.equal(destinoDeRetorno("//sitedele.exemplo"), DESTINO_PADRAO);
  assert.equal(destinoDeRetorno("/\\sitedele.exemplo"), DESTINO_PADRAO);
});

test("barra invertida em qualquer posição é recusada", () => {
  // Alguns navegadores normalizam a barra invertida, o que reintroduz o caso
  // acima no meio do caminho.
  assert.equal(destinoDeRetorno("/docs\\@sitedele.exemplo"), DESTINO_PADRAO);
});

test("escape codificado é decodificado ANTES de validar", () => {
  assert.equal(destinoDeRetorno("%2f%2fsitedele.exemplo"), DESTINO_PADRAO);
  assert.equal(destinoDeRetorno("%2F%2Fsitedele.exemplo"), DESTINO_PADRAO);
});

test("escape inválido é recusado em vez de adivinhado", () => {
  assert.equal(destinoDeRetorno("/docs%"), DESTINO_PADRAO);
});

test("caractere de controle é recusado", () => {
  assert.equal(destinoDeRetorno("/docs\nLocation: https://sitedele.exemplo"), DESTINO_PADRAO);
  assert.equal(destinoDeRetorno("/docs "), DESTINO_PADRAO);
});

test("javascript: e data: são recusados", () => {
  assert.equal(destinoDeRetorno("javascript:alert(1)"), DESTINO_PADRAO);
  assert.equal(destinoDeRetorno("data:text/html,<script>"), DESTINO_PADRAO);
});

test("ausente, vazio ou não-texto cai no padrão", () => {
  assert.equal(destinoDeRetorno(null), DESTINO_PADRAO);
  assert.equal(destinoDeRetorno(undefined), DESTINO_PADRAO);
  assert.equal(destinoDeRetorno(""), DESTINO_PADRAO);
});

test("o padrão é /docs, que resolve o contexto", () => {
  // E não "/", que só redirecionaria de novo.
  assert.equal(DESTINO_PADRAO, "/docs");
});

test("caminho relativo sem barra é recusado", () => {
  // `docs` resolveria contra a página atual e poderia sair de onde se espera.
  assert.equal(destinoDeRetorno("docs/cor"), DESTINO_PADRAO);
});
