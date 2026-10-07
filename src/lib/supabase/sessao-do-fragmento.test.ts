import assert from "node:assert/strict";
import test from "node:test";
import { lerSessaoDoFragmento } from "./sessao-do-fragmento";

test("lê a sessão do fragmento do link; sem os dois tokens, não há sessão", () => {
  assert.deepEqual(
    lerSessaoDoFragmento("#access_token=aaa&expires_in=3600&refresh_token=bbb&token_type=bearer&type=recovery"),
    { access_token: "aaa", refresh_token: "bbb" },
  );
  assert.equal(lerSessaoDoFragmento(""), null);
  assert.equal(lerSessaoDoFragmento("#"), null);
  assert.equal(lerSessaoDoFragmento("#access_token=aaa"), null);
  assert.equal(lerSessaoDoFragmento("#error=access_denied&error_description=expired"), null);
});
