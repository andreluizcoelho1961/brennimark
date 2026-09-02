import assert from "node:assert/strict";
import test from "node:test";
import {
  LOTE_POR_GRUPO,
  agruparDocumentos,
  recortarGrupo,
  trilha,
  vizinhos,
} from "./documentos";
import type { DocPageEntry } from "../../content/docs";

const pag = (slug: string, group = "Manual"): DocPageEntry => ({
  slug, group, title: slug.toUpperCase(), status: "ready", body: [],
});

const MANUAL = [
  pag("principio", "Fundamentos"),
  pag("missao", "Fundamentos"),
  pag("cor", "Visual"),
  pag("tipografia", "Visual"),
  pag("governanca", "Governança"),
];

test("os grupos saem na ordem em que a marca os declarou", () => {
  // Alfabética jogaria "Fundamentos" depois de "Governança" e "Aplicações"
  // para o começo — desfazendo a sequência que quem montou o manual escolheu.
  assert.deepEqual(
    agruparDocumentos(MANUAL).map((g) => g.nome),
    ["Fundamentos", "Visual", "Governança"],
  );
});

test("documento sem grupo cai num grupo nomeado, não num vazio", () => {
  const semGrupo = [{ ...pag("solto"), group: "" }];
  const [grupo] = agruparDocumentos(semGrupo);
  assert.equal(grupo.nome, "Manual");
});

test("o grupo diz quantos existem, mesmo mostrando menos", () => {
  const muitos = Array.from({ length: 40 }, (_, i) => pag(`p${i}`, "Visual"));
  const [grupo] = agruparDocumentos(muitos);
  assert.equal(grupo.total, 40);
  const { visiveis, restantes } = recortarGrupo(grupo, { expandido: false });
  assert.equal(visiveis.length, LOTE_POR_GRUPO);
  assert.equal(restantes, 40 - LOTE_POR_GRUPO);
});

test("grupo pequeno não ganha botão de ver mais", () => {
  const [grupo] = agruparDocumentos([pag("a"), pag("b")]);
  assert.deepEqual(recortarGrupo(grupo, { expandido: false }).restantes, 0);
});

test("o grupo da página aberta vem inteiro, mesmo passando do lote", () => {
  // Cortar a lista logo abaixo de onde a pessoa está esconde justamente o
  // contexto que ela veio procurar.
  const muitos = Array.from({ length: 40 }, (_, i) => pag(`p${i}`, "Visual"));
  const [grupo] = agruparDocumentos(muitos);
  const { visiveis, restantes } = recortarGrupo(grupo, {
    expandido: false, slugAtual: "p30",
  });
  assert.equal(visiveis.length, 40);
  assert.equal(restantes, 0);
});

test("um manual de 152 seções não renderiza 152 itens de uma vez", () => {
  const grande = Array.from({ length: 152 }, (_, i) => pag(`s${i}`, `Grupo ${i % 9}`));
  const grupos = agruparDocumentos(grande);
  const renderizados = grupos.reduce(
    (soma, g) => soma + recortarGrupo(g, { expandido: false }).visiveis.length,
    0,
  );
  assert.ok(renderizados < 152, `${renderizados} itens de uma vez`);
  // E nenhum some da contagem: o total continua sendo dito.
  assert.equal(grupos.reduce((s, g) => s + g.total, 0), 152);
});

// ─── anterior e próximo ────────────────────────────────────────────────────

test("anterior e próximo atravessam a fronteira do grupo", () => {
  // O fim de "Fundamentos" leva ao começo de "Visual". Parar no fim do grupo
  // faria a navegação sequencial terminar em becos.
  const { anterior, proximo } = vizinhos(MANUAL, "missao");
  assert.equal(anterior?.slug, "principio");
  assert.equal(proximo?.slug, "cor");
});

test("a primeira página não tem anterior, a última não tem próximo", () => {
  assert.equal(vizinhos(MANUAL, "principio").anterior, null);
  assert.equal(vizinhos(MANUAL, "governanca").proximo, null);
});

test("página que não existe no manual não inventa vizinhos", () => {
  assert.deepEqual(vizinhos(MANUAL, "inexistente"), { anterior: null, proximo: null });
});

// ─── trilha ────────────────────────────────────────────────────────────────

test("a trilha começa pela MARCA, porque o produto é multimarca", () => {
  // Sem ela, duas abas em marcas diferentes mostram "Manual › Cor" nas duas, e
  // a pessoa edita a marca errada achando que está na certa.
  const t = trilha({ marca: "Padaria", documento: pag("cor", "Visual"), base: "/w/a/b/padaria/docs" });
  assert.deepEqual(t.map((m) => m.rotulo), ["Padaria", "Visual", "COR"]);
  assert.equal(t[0].href, "/w/a/b/padaria/docs");
});

test("o grupo da trilha não é link, porque não existe página de grupo", () => {
  const t = trilha({ marca: "Padaria", documento: pag("cor", "Visual"), base: "/b" });
  assert.equal(t[1].href, undefined);
});

test("na visão geral a trilha é só a marca", () => {
  assert.deepEqual(trilha({ marca: "Padaria", base: "/b" }).map((m) => m.rotulo), ["Padaria"]);
});
