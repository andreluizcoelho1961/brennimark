import assert from "node:assert/strict";
import test from "node:test";
import { alcanceDaPessoa, conferirConcessao, normalizarEmail, ordenarPessoas, textoDoResultado, type Pessoa } from "./pessoas";

/**
 * A forma da concessão, do lado da tela.
 *
 * O banco recusa do mesmo jeito (`scripts/prova-conceder-e-revogar.sh`, 35
 * casos). Estes testes existem para a recusa chegar ANTES, dizendo o que
 * corrigir, e para a tela e o banco não divergirem sem ninguém perceber.
 */

test("e-mail entra normalizado, como o banco exige", () => {
  assert.equal(normalizarEmail("  Maria@Agencia.COM "), "maria@agencia.com");
  assert.equal(normalizarEmail(null), "");
});

test("administrador não se concede marca a marca", () => {
  // Ele alcança todas as marcas da conta, inclusive as que nascerem depois.
  const r = conferirConcessao({ email: "a@b.co", papel: "administrador", marcas: ["m1"] });
  assert.deepEqual(r, { ok: false, motivo: "administrador-com-marca" });
});

test("consulta sem marca nenhuma é recusada", () => {
  const r = conferirConcessao({ email: "a@b.co", papel: "consulta", marcas: [] });
  assert.deepEqual(r, { ok: false, motivo: "consulta-sem-marca" });
});

test("consulta pode receber uma, várias ou todas — quem escolhe é quem administra", () => {
  const r = conferirConcessao({ email: "a@b.co", papel: "consulta", marcas: ["m1", "m2", "m1"] });
  assert.equal(r.ok, true);
  // Marca repetida no clique é ruído, não erro: sai em silêncio.
  assert.deepEqual(r.ok && r.concessao.marcas, ["m1", "m2"]);
});

test("e-mail obviamente errado e papel fora do vocabulário são recusados", () => {
  assert.deepEqual(conferirConcessao({ email: "naoeemail", papel: "consulta", marcas: ["m"] }), { ok: false, motivo: "email" });
  assert.deepEqual(conferirConcessao({ email: "a@b.co", papel: "dono", marcas: ["m"] }), { ok: false, motivo: "papel" });
});

const pessoa = (over: Partial<Pessoa>): Pessoa => ({
  email: "z@x.co", papel: "consulta", marcas: [], pendente: false, desde: null, ...over,
});

test("quem está esperando para entrar aparece primeiro", () => {
  // É a linha sobre a qual alguém precisa agir.
  const lista = ordenarPessoas([
    pessoa({ email: "c@x.co" }),
    pessoa({ email: "a@x.co", papel: "administrador" }),
    pessoa({ email: "b@x.co", pendente: true }),
  ]);
  assert.deepEqual(lista.map((p) => p.email), ["b@x.co", "a@x.co", "c@x.co"]);
});

test("administrador não lista marcas, porque a lista mentiria amanhã", () => {
  const p = pessoa({ papel: "administrador", marcas: [{ id: "1", nome: "Solara" }] });
  assert.equal(alcanceDaPessoa(p, 3), "Todas as marcas da conta");
});

test("quem consulta mostra as marcas que recebeu, e diz quando são todas", () => {
  const duas = pessoa({ marcas: [{ id: "1", nome: "Solara" }, { id: "2", nome: "Ferro" }] });
  assert.equal(alcanceDaPessoa(duas, 3), "Solara, Ferro");
  assert.equal(alcanceDaPessoa(duas, 2), "As 2 marcas (concedidas uma a uma)");
  assert.equal(alcanceDaPessoa(pessoa({}), 2), "Nenhuma marca ainda");
});

test("o texto do resultado vem do mapa, e o desconhecido não vira frase inventada", () => {
  assert.match(textoDoResultado("pendente"), /primeiro login/);
  assert.equal(textoDoResultado("coisa-nova"), "Pronto.");
  assert.equal(textoDoResultado("aplicada", true), "Access granted.");
});
