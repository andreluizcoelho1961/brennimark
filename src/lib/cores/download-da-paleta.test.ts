import assert from "node:assert/strict";
import test from "node:test";
import { arquivoDaPaleta, lerPedidoDeDownloadDaPaleta } from "./download-da-paleta";

test("aceita só formato da lista e contagem inteira entre 1 e 200", () => {
  assert.deepEqual(lerPedidoDeDownloadDaPaleta({ formato: "ase", cores: 4 }), { formato: "ase", cores: 4 });
  assert.deepEqual(lerPedidoDeDownloadDaPaleta({ formato: "png", cores: 200 }), { formato: "png", cores: 200 });
  for (const ruim of [null, "ase", {}, { formato: "exe", cores: 3 }, { formato: "ase", cores: 0 }, { formato: "ase", cores: 201 },
    { formato: "ase", cores: 2.5 }, { formato: "ase", cores: "3" }, { formato: 7, cores: 3 }]) {
    assert.equal(lerPedidoDeDownloadDaPaleta(ruim), null, JSON.stringify(ruim));
  }
});

test("o pedido não carrega mais nada que o formato e a contagem", () => {
  const lido = lerPedidoDeDownloadDaPaleta({ formato: "css", cores: 3, pessoa: "outra", brand_id: "x", workspace_id: "y" });
  assert.deepEqual(lido, { formato: "css", cores: 3 });
});

test("o nome do arquivo segue o que a ferramenta gera", () => {
  assert.equal(arquivoDaPaleta("Brennimark", "ase"), "paleta-brennimark.ase");
  assert.equal(arquivoDaPaleta("Acme & Filhos", "css"), "paleta-acme-filhos.css");
});

import { registrarDownloadDaPaleta } from "./registrar-download-da-paleta";

test("registrar devolve vazio quando a linha nasceu e o motivo quando não", async () => {
  const corpos: string[] = [];
  const ok = async (_e: string, i: RequestInit) => { corpos.push(String(i.body)); return { ok: true, json: async () => ({}) }; };
  assert.equal(await registrarDownloadDaPaleta({ endereco: "/x", formato: "ase", cores: 4, padrao: "p", buscar: ok }), "");
  assert.deepEqual(JSON.parse(corpos[0]), { formato: "ase", cores: 4 });
  const recusa = async () => ({ ok: false, json: async () => ({ message: "não registrou" }) });
  assert.equal(await registrarDownloadDaPaleta({ endereco: "/x", formato: "css", cores: 2, padrao: "p", buscar: recusa }), "não registrou");
  const rede = async () => { throw new Error("offline"); };
  assert.equal(await registrarDownloadDaPaleta({ endereco: "/x", formato: "png", cores: 2, padrao: "p", buscar: rede }), "p");
});
