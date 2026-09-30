import assert from "node:assert/strict";
import test from "node:test";
import { caminhosDeExibicao, vistaDaEntrega, type AbertoAtivo } from "./vista";

const aberto: AbertoAtivo = {
  estado: "ativo",
  link: { id: "l1", nome: "Gráfica Pampa", destinatario: "Carla", expira_em: "2026-10-07T12:00:00Z", workspace_id: "w1", brand_id: "b1", marca: "Marca A" },
  arquivos: [
    { id: "a1", atual_id: "a3", retirado: false, atualizado_em: "2026-10-01T10:00:00Z", label: "Seta nova", file_name: "seta-nova.svg", mime_type: "image/svg+xml", size_bytes: 100,
      miniatura_path: "w1/b1/miniatura-1.png", storage_path: "w1/b1/seta-nova.svg", item_id: "i1", item_nome: "Ícones", item_tipo: "icone", regra_paginas: [9, 12] },
    { id: "a2", atual_id: null, retirado: true, atualizado_em: null, label: "Casa", file_name: "casa.svg", mime_type: "image/svg+xml", size_bytes: 100,
      miniatura_path: null, storage_path: null, item_id: "i1", item_nome: "Ícones", item_tipo: "icone", regra_paginas: [9, 12] },
    { id: "a4", atual_id: "a4", retirado: false, atualizado_em: null, label: "Logo", file_name: "logo.svg", mime_type: "image/svg+xml", size_bytes: 200,
      miniatura_path: null, storage_path: "w1/b1/logo.svg", item_id: "i2", item_nome: "Logo", item_tipo: "logo", regra_paginas: [] },
  ],
  paginas: [
    { pagina: 9, titulo: " Área de proteção ", status: "ready", imagem_path: "w1/b1/pagina-d-9.jpg" },
    { pagina: 12, titulo: null, status: null, imagem_path: null },
  ],
};

const enderecos = new Map([
  ["w1/b1/miniatura-1.png", "https://x/miniatura"],
  ["w1/b1/pagina-d-9.jpg", "https://x/pagina-9"],
]);

test("pede endereço só para miniaturas e imagens de página", () => {
  assert.deepEqual(caminhosDeExibicao(aberto), ["w1/b1/miniatura-1.png", "w1/b1/pagina-d-9.jpg"]);
});

test("agrupa por item na ordem do link e cola as páginas que regem", () => {
  const v = vistaDaEntrega(aberto, enderecos);
  assert.deepEqual(v.itens.map((i) => [i.nome, i.arquivos.map((a) => a.label)]), [["Ícones", ["Seta nova", "Casa"]], ["Logo", ["Logo"]]]);
  assert.deepEqual(v.itens[0].regra, [
    { pagina: 9, titulo: "Área de proteção", status: "ready", imagem: "https://x/pagina-9" },
    { pagina: 12, titulo: null, status: "sem-secao", imagem: null },
  ]);
  assert.equal(v.itens[0].arquivos[0].miniatura, "https://x/miniatura");
  assert.equal(v.itens[0].arquivos[1].retirado, true);
  assert.equal(v.itens[0].arquivos[0].atualizado_em, "2026-10-01T10:00:00Z");
});

test("o caminho de Storage nunca atravessa para o navegador", () => {
  const json = JSON.stringify(vistaDaEntrega(aberto, enderecos));
  assert.doesNotMatch(json, /storage_path|seta-nova\.svg"?,"?storage|w1\/b1\/seta-nova\.svg|w1\/b1\/logo\.svg|workspace_id|brand_id/);
});
