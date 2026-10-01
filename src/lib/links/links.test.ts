import assert from "node:assert/strict";
import test from "node:test";
import {
  MAXIMO_DE_ARQUIVOS, PRAZO_PADRAO_DIAS, codigoValido, gerarCodigo, identificacaoValida,
  lerPedidoDeLink, mensagemDaRecusa, resumoDoCodigo, situacaoDoLink,
} from "./links";

const ID = "d87b93f3-81d8-49f1-a8ef-9371ba05464c";
const ID2 = "a64d5be5-7c7e-4595-9b88-eedc618b3d56";

test("o código tem 256 bits, forma fixa, e nunca se repete", () => {
  const a = gerarCodigo();
  const b = gerarCodigo();
  assert.equal(a.length, 43);
  assert.ok(codigoValido(a));
  assert.notEqual(a, b);
  assert.equal(codigoValido("curto"), false);
  assert.equal(codigoValido(`${a}/`), false);
});

test("o resumo é o SHA-256 em hexadecimal — a forma que o banco exige", () => {
  assert.equal(resumoDoCodigo("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.match(resumoDoCodigo(gerarCodigo()), /^[0-9a-f]{64}$/);
});

test("situação: revogado vence; depois, o prazo", () => {
  const agora = new Date("2026-09-30T12:00:00Z");
  assert.equal(situacaoDoLink({ expira_em: "2026-10-07T12:00:00Z", revogado_em: null }, agora), "ativo");
  assert.equal(situacaoDoLink({ expira_em: "2026-09-30T12:00:00Z", revogado_em: null }, agora), "expirado");
  assert.equal(situacaoDoLink({ expira_em: "2026-10-07T12:00:00Z", revogado_em: "2026-09-30T11:00:00Z" }, agora), "revogado");
});

test("o pedido de link: nome, prazo de 1 a 30 (7 por padrão) e de 1 a 60 arquivos distintos", () => {
  const ok = lerPedidoDeLink({ nome: "  Gráfica Pampa ", arquivos: [ID, ID2] });
  assert.deepEqual(ok, { ok: true, pedido: { nome: "Gráfica Pampa", destinatario: "", dias: PRAZO_PADRAO_DIAS, arquivos: [ID, ID2] } });
  assert.equal(lerPedidoDeLink({ nome: "x", dias: 30, arquivos: [ID] }).ok, true);

  const recusas: [unknown, RegExp][] = [
    [{ arquivos: [ID] }, /nome/],
    [{ nome: "x", dias: 31, arquivos: [ID] }, /1 a 30/],
    [{ nome: "x", dias: 0, arquivos: [ID] }, /1 a 30/],
    [{ nome: "x", dias: 2.5, arquivos: [ID] }, /1 a 30/],
    [{ nome: "x", arquivos: [] }, /pelo menos um/],
    [{ nome: "x", arquivos: [ID, ID] }, /inválida/],
    [{ nome: "x", arquivos: ["nao-e-id"] }, /inválida/],
    [{ nome: "x", arquivos: Array.from({ length: MAXIMO_DE_ARQUIVOS + 1 }, () => ID) }, /até 60.*61/],
    [{ nome: "x".repeat(121), arquivos: [ID] }, /120/],
  ];
  for (const [corpo, esperado] of recusas) {
    const r = lerPedidoDeLink(corpo);
    assert.equal(r.ok, false, JSON.stringify(corpo).slice(0, 80));
    if (!r.ok) assert.match(r.mensagem, esperado);
  }
});

test("identificação: nome e e-mail com forma de e-mail", () => {
  assert.equal(identificacaoValida("Carla", "carla@grafica.com"), true);
  assert.equal(identificacaoValida("", "carla@grafica.com"), false);
  assert.equal(identificacaoValida("Carla", "carla"), false);
  assert.equal(identificacaoValida("Carla", "carla@grafica"), false);
});

test("a recusa do banco vira frase, e o desconhecido vira a genérica — nunca o texto do banco", () => {
  assert.match(mensagemDaRecusa("arquivos_do_link_sem_fonte"), /Fonte não vai por link/);
  assert.match(mensagemDaRecusa("arquivos_do_link_em_uso"), /saiu de uso/);
  assert.match(mensagemDaRecusa("links_de_entrega_prazo_maximo"), /1 a 30/);
  assert.equal(mensagemDaRecusa("qualquer coisa"), "Não foi possível criar o link. Tente de novo.");
  assert.equal(mensagemDaRecusa(null), "Não foi possível criar o link. Tente de novo.");
});
