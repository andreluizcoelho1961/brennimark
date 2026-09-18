import assert from "node:assert/strict";
import test from "node:test";
import { colunaDaPlataforma, destinosDoVini, gruposDaGaveta, itemAtivo, segmentadoDaMarca } from "./coluna";

/**
 * A coluna da plataforma — plano da interface §2.
 *
 * O que se tranca aqui é a REGRA de quem vê o quê. O desenho é de navegador;
 * a regra é dado, e dado se testa sem navegador.
 */

test("Marcas aparece para todos, e leva à tela inicial da conta", () => {
  const [plataforma] = colunaDaPlataforma({ contaSlug: "agencia", administraConta: false });
  assert.equal(plataforma.itens[0].rotulo, "Marcas");
  assert.equal(plataforma.itens[0].href, "/w/agencia");
});

test("sem conta escolhida, Marcas leva ao resolvedor e a gestão não aparece", () => {
  const grupos = colunaDaPlataforma({ administraConta: true });
  assert.equal(grupos[0].itens[0].href, "/docs");
  assert.equal(grupos.some((g) => g.id === "gestao"), false, "gestão sem conta seria gestão de qual conta?");
});

test("quem só consulta não vê a gestão", () => {
  const grupos = colunaDaPlataforma({ contaSlug: "agencia", administraConta: false });
  assert.deepEqual(grupos.map((g) => g.id), ["plataforma"]);
});

test("quem administra vê Pessoas funcionando e o resto como 'em breve', sem link", () => {
  const gestao = colunaDaPlataforma({ contaSlug: "agencia", administraConta: true })
    .find((g) => g.id === "gestao")!;
  const pessoas = gestao.itens.find((i) => i.id === "pessoas")!;
  assert.equal(pessoas.href, "/w/agencia/pessoas");
  for (const id of ["links", "registros", "configuracoes"]) {
    const item = gestao.itens.find((i) => i.id === id)!;
    assert.equal(item.emBreve, true, `${id} deveria estar em breve`);
    assert.equal(item.href, undefined, `${id} não pode levar a uma tela que não existe`);
  }
});

test("Manual e Materiais saem da coluna: moram na barra de cima", () => {
  const grupos = colunaDaPlataforma({
    contaSlug: "agencia", administraConta: true,
    marca: { destinos: [
      { href: "/w/agencia/b/solara/docs/original", label: "Manual" },
      { href: "/w/agencia/b/solara/docs/biblioteca", label: "Materiais" },
      { href: "/w/agencia/b/solara/docs/admin", label: "Administração" },
      { href: "/w/agencia/importar", label: "Importar manual" },
    ] },
  });
  const marca = grupos.find((g) => g.id === "marca")!;
  assert.deepEqual(marca.itens.map((i) => i.rotulo), ["Administração"]);
});

test("o reconhecimento independe do prefixo do endereço", () => {
  // A primeira versão casava por `/docs/original` e só acertava em produção.
  // Na bancada, com prefixo `/dev/marcas`, o manual aparecia na coluna e todo
  // ícone saía igual — foi a captura de tela que mostrou (18/09).
  const grupos = colunaDaPlataforma({
    contaSlug: "dev", administraConta: true,
    marca: { destinos: [
      { href: "/dev/marcas/original", label: "Manual" },
      { href: "/dev/marcas/biblioteca", label: "Materiais" },
      { href: "/dev/marcas/chat", label: "Chat" },
      { href: "/dev/marcas/analise", label: "Análise" },
      { href: "/dev/marcas/configuracoes/ia", label: "IA" },
    ] },
  });
  const marca = grupos.find((g) => g.id === "marca")!;
  // Chat e análise são do Vini; na coluna sobra o que é de configuração.
  assert.deepEqual(marca.itens.map((i) => i.rotulo), ["IA"]);
  assert.deepEqual(marca.itens.map((i) => i.icone), ["ia"]);
});

test("sem destinos da marca, o grupo da marca não aparece vazio", () => {
  const grupos = colunaDaPlataforma({
    contaSlug: "agencia", administraConta: false,
    marca: { destinos: [{ href: "/w/agencia/b/solara/docs/original", label: "Manual" }] },
  });
  assert.equal(grupos.some((g) => g.id === "marca"), false);
});

test("Marcas acende só no endereço exato; os outros, também nas rotas filhas", () => {
  const [plataforma, gestao] = colunaDaPlataforma({ contaSlug: "agencia", administraConta: true });
  const marcas = plataforma.itens[0];
  assert.equal(itemAtivo(marcas, "/w/agencia"), true);
  assert.equal(itemAtivo(marcas, "/w/agencia/pessoas"), false, "Marcas acenderia junto com Pessoas");
  const pessoas = gestao.itens[0];
  assert.equal(itemAtivo(pessoas, "/w/agencia/pessoas"), true);
  assert.equal(itemAtivo(gestao.itens[1], "/qualquer"), false, "item em breve nunca acende");
});

test("o segmentado só tem endereço com marca aberta", () => {
  assert.deepEqual(segmentadoDaMarca(undefined), {});
  assert.deepEqual(segmentadoDaMarca("/w/a/b/solara/docs"), {
    manual: "/w/a/b/solara/docs/original",
    materiais: "/w/a/b/solara/docs/biblioteca",
  });
});

test("os rótulos seguem o idioma da interface", () => {
  const grupos = colunaDaPlataforma({ contaSlug: "a", administraConta: true, ingles: true });
  assert.equal(grupos[0].itens[0].rotulo, "Brands");
  assert.equal(grupos[1].itens[0].rotulo, "People & access");
});

test("no celular, a gaveta traz o manual da marca aberta — senão ele é inalcançável", () => {
  const coluna = colunaDaPlataforma({ contaSlug: "a", administraConta: false });
  const gaveta = gruposDaGaveta(coluna, segmentadoDaMarca("/w/a/b/solara/docs"));
  assert.equal(gaveta[0].id, "conteudo");
  assert.deepEqual(gaveta[0].itens.map((i) => i.href), ["/w/a/b/solara/docs/original", "/w/a/b/solara/docs/biblioteca"]);
  // Sem marca aberta, nada é inventado: a gaveta é a própria coluna.
  assert.deepEqual(gruposDaGaveta(coluna, {}), coluna);
});

test("todo contato com a marca por IA é o Vini, e sai da coluna", () => {
  // Decisão do André, reafirmada em 18/09: o Vini, no canto inferior direito,
  // é onde se pergunta, analisa peça e (depois) gera prompt.
  const destinos = [
    { href: "/w/a/b/s/docs/historico", label: "Histórico e calibração" },
    { href: "/w/a/b/s/docs/chat", label: "Chat da marca" },
    { href: "/w/a/b/s/docs/analise", label: "Análise de aplicações" },
    { href: "/w/a/b/s/docs/configuracoes/ia", label: "Provedores de IA" },
  ];
  const marca = colunaDaPlataforma({ contaSlug: "a", administraConta: true, marca: { destinos } })
    .find((g) => g.id === "marca")!;
  assert.deepEqual(marca.itens.map((i) => i.rotulo), ["Provedores de IA"]);
  // E o Vini os recebe na ordem da janela: perguntar, analisar, histórico.
  assert.deepEqual(destinosDoVini(destinos).map((d) => d.label),
    ["Chat da marca", "Análise de aplicações", "Histórico e calibração"]);
});
