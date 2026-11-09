import assert from "node:assert/strict";
import test from "node:test";
import { PASSOS_DO_TOUR, jaFoiVisto, passoAnterior, posicaoDoBalao, proximoPasso } from "./passos-do-tour";

const JANELA = { largura: 1200, altura: 800 };
const BALAO = { largura: 320, altura: 180 };

test("todo passo tem título e texto nos dois idiomas, e os ids não se repetem", () => {
  const ids = new Set<string>();
  for (const p of PASSOS_DO_TOUR) {
    for (const lg of ["pt-BR", "en"] as const) {
      assert.ok(p.titulo[lg].length > 2, `${p.id} título ${lg}`);
      assert.ok(p.texto[lg].length > 20, `${p.id} texto ${lg}`);
    }
    assert.ok(!ids.has(p.id), p.id);
    ids.add(p.id);
  }
  assert.equal(PASSOS_DO_TOUR[0].id, "boas-vindas");
  assert.equal(PASSOS_DO_TOUR.at(-1)?.id, "fim");
});

test("o tour ensina as ferramentas da coluna: Kit, Cores e Grids, cada uma com a opção de abrir", () => {
  const ids = PASSOS_DO_TOUR.map((p) => p.id);
  for (const id of ["complementos", "kit", "cores", "grids"]) assert.ok(ids.includes(id as never), id);
  for (const id of ["kit", "cores", "grids"]) {
    const p = PASSOS_DO_TOUR.find((x) => x.id === id)!;
    assert.equal(p.abrir, true, id);
    assert.match(p.seletor ?? "", new RegExp(`/docs/${id}"\\]$`), id);
    // Explica COMO funciona, e não só o nome: o texto passa de uma frase curta.
    assert.ok(p.texto["pt-BR"].length > 100 && p.texto.en.length > 100, id);
  }
  // Só ferramenta se abre; o resto é explicação.
  assert.deepEqual(PASSOS_DO_TOUR.filter((p) => p.abrir).map((p) => p.id), ["kit", "cores", "grids"]);
});

test("o tour começa, fecha e para na assinatura sem alvo (centro); os demais apontam para algo", () => {
  const semAlvo = PASSOS_DO_TOUR.filter((p) => !p.seletor).map((p) => p.id);
  assert.deepEqual(semAlvo, ["boas-vindas", "assinatura", "fim"]);
});

test("avançar chega ao fim; voltar nunca fica abaixo de zero", () => {
  assert.equal(proximoPasso(0, 5), 1);
  assert.equal(proximoPasso(3, 5), 4);
  assert.equal(proximoPasso(4, 5), "fim");
  assert.equal(passoAnterior(0), 0);
  assert.equal(passoAnterior(3), 2);
});

test("sem alvo, o balão vai ao centro", () => {
  const p = posicaoDoBalao(null, JANELA, BALAO);
  assert.equal(p.modo, "centro");
  assert.equal(p.esquerda, 440);
  assert.equal(p.topo, 310);
});

test("alvo no topo: o balão fica abaixo, centrado no alvo", () => {
  const p = posicaoDoBalao({ topo: 20, esquerda: 500, largura: 100, altura: 32 }, JANELA, BALAO);
  assert.equal(p.modo, "abaixo");
  assert.equal(p.topo, 20 + 32 + 12);
  assert.equal(p.esquerda, 500 + 50 - 160);
});

test("alvo embaixo (o botão do Vini): o balão sobe", () => {
  const p = posicaoDoBalao({ topo: 700, esquerda: 1100, largura: 80, altura: 60 }, JANELA, BALAO);
  assert.equal(p.modo, "acima");
  assert.equal(p.topo, 700 - 12 - 180);
});

test("alvo na coluna da esquerda: o balão abre à direita, na altura do alvo", () => {
  const p = posicaoDoBalao({ topo: 200, esquerda: 8, largura: 36, altura: 36 }, JANELA, BALAO);
  assert.equal(p.modo, "direita");
  assert.equal(p.esquerda, 8 + 36 + 12);
  assert.equal(p.topo, 200 + 18 - 90);
});

test("na coluna, o balão não passa do topo nem do rodapé", () => {
  const alto = posicaoDoBalao({ topo: 0, esquerda: 8, largura: 36, altura: 36 }, JANELA, BALAO);
  assert.equal(alto.modo, "direita");
  assert.equal(alto.topo, 12);
  const baixo = posicaoDoBalao({ topo: 780, esquerda: 8, largura: 36, altura: 36 }, JANELA, BALAO);
  assert.equal(baixo.topo, JANELA.altura - BALAO.altura - 12);
});

test("coluna numa tela estreita (não cabe à direita): cai para baixo ou acima, nunca some", () => {
  const p = posicaoDoBalao({ topo: 200, esquerda: 8, largura: 36, altura: 36 }, { largura: 340, altura: 800 }, BALAO);
  assert.notEqual(p.modo, "direita");
});

test("controle dentro da janela do Vini (ponta direita): o balão abre à esquerda da janela, na altura do controle", () => {
  const janelaDoVini = { topo: 280, esquerda: 760, largura: 420, altura: 500 };
  const controle = { topo: 650, esquerda: 780, largura: 32, altura: 32 };
  const p = posicaoDoBalao(controle, JANELA, BALAO, janelaDoVini);
  assert.equal(p.modo, "esquerda");
  assert.equal(p.esquerda, 760 - 12 - 320);
  assert.equal(p.topo, 650 + 16 - 90);
});

test("sem espaço à esquerda da janela do Vini (celular), o balão não some: vai abaixo, acima ou ao centro", () => {
  const p = posicaoDoBalao({ topo: 700, esquerda: 20, largura: 32, altura: 32 }, { largura: 390, altura: 800 }, BALAO, { topo: 200, esquerda: 0, largura: 390, altura: 600 });
  assert.notEqual(p.modo, "esquerda");
  assert.ok(p.esquerda >= 12 && p.topo >= 12);
});

test("o tour do Vini tem três passos (conversa, prompts com o DNA da marca, avaliação de peça) e os dois últimos abrem a janela", () => {
  const ids = PASSOS_DO_TOUR.map((p) => p.id);
  assert.deepEqual(ids.filter((i) => i.startsWith("vini")), ["vini", "vini-prompt", "vini-peca"]);
  for (const id of ["vini-prompt", "vini-peca"]) {
    const p = PASSOS_DO_TOUR.find((x) => x.id === id)!;
    assert.equal(p.prepara, "abrir-vini", id);
    assert.equal(p.ancora, "[data-vini-janela]", id);
  }
  const prompt = PASSOS_DO_TOUR.find((x) => x.id === "vini-prompt")!;
  assert.match(prompt.texto["pt-BR"], /DNA|cores/);
  assert.match(prompt.texto.en, /brand's/);
  const peca = PASSOS_DO_TOUR.find((x) => x.id === "vini-peca")!;
  assert.match(peca.texto["pt-BR"], /refações/);
  assert.match(peca.texto.en, /rework/);
  // Ordem: o Vini, depois o que só o assinante enxerga, e por fim o convite.
  assert.deepEqual(ids.slice(-5), ["vini", "vini-prompt", "vini-peca", "assinatura", "fim"]);
});

test("o balão nunca sai da tela na horizontal", () => {
  const colado = posicaoDoBalao({ topo: 20, esquerda: 250, largura: 40, altura: 30 }, JANELA, BALAO);
  assert.ok(colado.esquerda >= 12);
  const naPonta = posicaoDoBalao({ topo: 20, esquerda: 1180, largura: 40, altura: 30 }, JANELA, BALAO);
  assert.equal(naPonta.esquerda, JANELA.largura - BALAO.largura - 12);
});

test("alvo sem tamanho ou gigante: cai no centro, nunca some", () => {
  assert.equal(posicaoDoBalao({ topo: 0, esquerda: 0, largura: 0, altura: 0 }, JANELA, BALAO).modo, "centro");
  assert.equal(posicaoDoBalao({ topo: 0, esquerda: 0, largura: 1200, altura: 800 }, JANELA, BALAO).modo, "centro");
});

test("só o valor '1' conta como tour já visto", () => {
  assert.equal(jaFoiVisto("1"), true);
  for (const v of [null, "", "0", "true", "sim"]) assert.equal(jaFoiVisto(v), false, String(v));
});

test("o passo da assinatura mostra o que o visitante não vê: importar, pessoas, links, registros e Fonts, nos dois idiomas", () => {
  const p = PASSOS_DO_TOUR.find((x) => x.id === "assinatura")!;
  assert.equal(p.seletor, undefined);
  assert.equal(p.itens?.["pt-BR"].length, p.itens?.en.length);
  assert.ok((p.itens?.en.length ?? 0) >= 5);
  const pt = p.itens!["pt-BR"].join(" ");
  for (const palavra of [/Importar/, /Pessoas e acesso/, /Links de entrega/, /Registros/, /Fonts/]) assert.match(pt, palavra);
  const en = p.itens!.en.join(" ");
  for (const palavra of [/Import/, /People and access/, /delivery links/, /Records/, /Fonts/]) assert.match(en, palavra);
});

test("depois do Vini, o tour recolhe a janela dele para o balão do centro não ficar por cima", () => {
  for (const id of ["assinatura", "fim"]) assert.equal(PASSOS_DO_TOUR.find((p) => p.id === id)?.prepara, "fechar-vini", id);
  // Só os passos dos controles do Vini pedem a janela aberta.
  assert.deepEqual(PASSOS_DO_TOUR.filter((p) => p.prepara === "abrir-vini").map((p) => p.id), ["vini-prompt", "vini-peca"]);
});
