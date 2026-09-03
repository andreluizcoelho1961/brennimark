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
import { shellSections } from "./navigation";

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

// ─── A navegação não oferece o que a marca não contratou ───────────────────

test("marca sem utilidades não ganha destino de utilidade", () => {
  // A contrapartida na moldura do que `podeUsar` decide no servidor: com
  // `[]`, a seção "Inteligência" não existe — e não existe vazia, existe
  // ausente, porque cabeçalho sem nada embaixo é ruído.
  const semNada = shellSections({
    capabilities: ["consultar", "editar", "aprovar", "administrar"],
    locale: "pt-BR",
    utilityLinks: [],
  });
  const destinos = semNada.flatMap((s) => s.destinations.map((d) => d.href));
  for (const rota of ["/docs/chat", "/docs/analise", "/docs/historico", "/docs/configuracoes/ia"]) {
    assert.ok(!destinos.includes(rota), `${rota} apareceu com lista vazia`);
  }
  // Nenhuma seção fica vazia: cabeçalho sem nada embaixo é ruído.
  assert.ok(semNada.every((s) => s.destinations.length > 0));
});

test("a navegação oferece exatamente o que a marca contratou", () => {
  const soChat = shellSections({
    capabilities: ["consultar"],
    locale: "pt-BR",
    utilityLinks: ["chat"],
  });
  const destinos = soChat.flatMap((s) => s.destinations.map((d) => d.href));
  assert.ok(destinos.includes("/docs/chat"));
  assert.ok(!destinos.includes("/docs/analise"));
});

// ─── A ordem da navegação ──────────────────────────────────────────────────

test("o manual vem antes das ferramentas, e a conta por último", () => {
  /*
   * A ordem anterior punha oito destinos de produto acima do conteúdo. Num
   * produto cujo trabalho é consultar o manual, o manual estava no fim.
   *
   * O teste fixa a SEQUÊNCIA das áreas, e não os rótulos: mudar "Consultar"
   * para outro nome é decisão editorial; mudar a ordem é decisão de produto, e
   * deve exigir mexer aqui.
   */
  const secoes = shellSections({
    capabilities: ["consultar", "editar", "aprovar", "administrar"],
    locale: "pt-BR",
    utilityLinks: ["chat", "analysis", "history", "ai-settings"],
  });
  assert.deepEqual(secoes.map((s) => s.id), ["manual", "consultar", "library", "account"]);
});

test("provedores de IA ficam na conta, não na marca", () => {
  // `ai_settings` é por workspace. Deixá-lo na hierarquia da marca sugeria que
  // configurar IA fosse configurar AQUELA marca — e trocar de marca não troca
  // de provedor nem de fatura.
  const secoes = shellSections({
    capabilities: ["consultar", "editar", "aprovar", "administrar"],
    locale: "pt-BR",
    utilityLinks: ["chat", "ai-settings"],
  });
  const conta = secoes.find((s) => s.id === "account");
  assert.ok(conta?.destinations.some((d) => d.href === "/docs/configuracoes/ia"));
  const consultar = secoes.find((s) => s.id === "consultar");
  assert.ok(!consultar?.destinations.some((d) => d.href === "/docs/configuracoes/ia"));
});

test("quem só consulta não vê a área de conta", () => {
  // Importar, administrar e configurar IA exigem `administrar`. Sem ela a área
  // inteira desaparece — não fica vazia nem com botão desabilitado.
  const secoes = shellSections({
    capabilities: ["consultar"],
    locale: "pt-BR",
    utilityLinks: ["chat", "ai-settings"],
  });
  assert.ok(!secoes.some((s) => s.id === "account"));
});

test("o rótulo dos provedores de IA cabe na coluna", () => {
  // O anterior — "Configurações — Conecte sua IA" — era cortado no meio pela
  // largura da barra, e um destino cujo nome não se lê não é um destino.
  const secoes = shellSections({
    capabilities: ["consultar", "editar", "aprovar", "administrar"],
    locale: "pt-BR",
    utilityLinks: ["ai-settings"],
  });
  const rotulo = secoes
    .flatMap((s) => s.destinations)
    .find((d) => d.href === "/docs/configuracoes/ia")?.label;
  assert.ok((rotulo?.length ?? 99) <= 20, `rótulo longo demais: ${rotulo}`);
});
