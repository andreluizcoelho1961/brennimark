import assert from "node:assert/strict";
import test from "node:test";
import { textoOuErro, type ParteDoFluxo } from "./texto-do-fluxo";

async function* fluxo(partes: ParteDoFluxo[]) {
  for (const p of partes) yield p;
}

async function ler(partes: ParteDoFluxo[]) {
  let texto = "";
  for await (const t of textoOuErro(fluxo(partes))) texto += t;
  return texto;
}

test("o texto passa; o resto do fluxo (raciocínio, etapas) fica de fora", async () => {
  assert.equal(await ler([
    { type: "start" },
    { type: "reasoning-delta", text: "pensando…" },
    { type: "text-delta", text: "O preto " },
    { type: "text-delta", text: "VAIO." },
    { type: "finish" },
  ]), "O preto VAIO.");
});

test("o erro do provedor é LANÇADO, e é o erro original — não um fluxo vazio", async () => {
  const doGoogle = Object.assign(new Error("This model is currently experiencing high demand."), { statusCode: 503 });
  await assert.rejects(ler([{ type: "start" }, { type: "error", error: doGoogle }]), (e) => e === doGoogle);
});

test("erro depois de texto também sobe — a resposta não termina calada pela metade", async () => {
  const falha = new Error("caiu");
  const lidos: string[] = [];
  await assert.rejects(async () => {
    for await (const t of textoOuErro(fluxo([{ type: "text-delta", text: "começo" }, { type: "error", error: falha }]))) lidos.push(t);
  }, (e) => e === falha);
  assert.deepEqual(lidos, ["começo"]);
});
