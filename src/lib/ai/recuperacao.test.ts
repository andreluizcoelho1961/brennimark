import assert from "node:assert/strict";
import test from "node:test";
import {
  LIMITES_DE_IA,
  faixaDeTrecho,
  limitarMensagens,
  limitarPergunta,
  limitarTexto,
  montarContextoRecuperado,
  recortarTrecho,
  termosDaPergunta,
  semEvidencia,
  type Trecho,
} from "./recuperacao";

const ROTULOS: Record<string, string> = { ready: "PRONTO", draft: "RASCUNHO", pending: "PENDENTE" };

const trecho = (parcial: Partial<Trecho> = {}): Trecho => ({
  documentSlug: "cor",
  documentTitle: "Cor",
  groupName: "Fundamentos",
  section: null,
  status: "ready",
  pageStart: 12,
  pageEnd: 18,
  content: "A cor institucional é o vermelho #E1251B.",
  ...parcial,
});

test("o contexto nunca passa do número de fontes", () => {
  const muitos = Array.from({ length: 50 }, (_, i) => trecho({ documentSlug: `d${i}` }));
  const { usados } = montarContextoRecuperado(muitos, ROTULOS);
  assert.equal(usados.length, LIMITES_DE_IA.maxTrechos);
});

test("um trecho gigante não consome a cota dos outros", () => {
  // Sem o corte por trecho, um bloco de 50 mil caracteres entraria inteiro,
  // estouraria o orçamento e nenhuma outra fonte caberia — o modelo receberia
  // uma fonte só, e provavelmente a menos relevante.
  const gigante = trecho({ content: "x".repeat(50_000) });
  const { texto, usados } = montarContextoRecuperado([gigante, trecho({ documentSlug: "b" })], ROTULOS);
  assert.equal(usados.length, 2, "o segundo trecho não coube");
  assert.ok(texto.length < LIMITES_DE_IA.maxCaracteresDeContexto + 2_000);
});

test("o contexto inteiro respeita o teto de caracteres", () => {
  const varios = Array.from({ length: 8 }, () => trecho({ content: "y".repeat(1_200) }));
  const { texto } = montarContextoRecuperado(varios, ROTULOS);
  const conteudo = texto.match(/y+/g)?.join("").length ?? 0;
  assert.ok(conteudo <= LIMITES_DE_IA.maxCaracteresDeContexto, `${conteudo} caracteres de conteúdo`);
});

test("cada fonte carrega documento, seção, faixa de páginas e status", () => {
  const { texto } = montarContextoRecuperado(
    [trecho({ section: "Paleta primária", status: "draft" })],
    ROTULOS,
  );
  assert.match(texto, /TÍTULO: Cor/);
  assert.match(texto, /SEÇÃO: Paleta primária/);
  assert.match(texto, /PÁGINAS DO PDF: 12–18/);
  assert.match(texto, /status="RASCUNHO"/);
});

test("conteúdo provisório aparece, e aparece rotulado", () => {
  // Escondê-lo faria o assistente dizer "não há diretriz" sobre algo escrito.
  // Mostrá-lo sem rótulo transformaria rascunho em regra.
  const { texto, usados } = montarContextoRecuperado([trecho({ status: "draft" })], ROTULOS);
  assert.equal(usados.length, 1);
  assert.match(texto, /status="RASCUNHO"/);
  assert.doesNotMatch(texto, /status="PRONTO"/);
});

test("trecho sem procedência não inventa faixa de páginas", () => {
  const { texto } = montarContextoRecuperado([trecho({ pageStart: null, pageEnd: null })], ROTULOS);
  assert.doesNotMatch(texto, /PÁGINAS DO PDF/);
});

test("página única não vira intervalo", () => {
  assert.equal(faixaDeTrecho(trecho({ pageStart: 7, pageEnd: 7 }), false), "página 7");
  assert.equal(faixaDeTrecho(trecho({ pageStart: 7, pageEnd: 9 }), false), "páginas 7–9");
  assert.equal(faixaDeTrecho(trecho({ pageStart: null }), false), "");
});

test("a pergunta é limitada, e o corte é visível", () => {
  const longa = "palavra ".repeat(5_000);
  const cortada = limitarPergunta(longa);
  assert.ok(cortada.length <= LIMITES_DE_IA.maxCaracteresDaPergunta + 1);
  // Sem a reticência, o modelo responderia a uma pergunta que ninguém fez.
  assert.ok(cortada.endsWith("…"));
});

test("pergunta dentro do limite não é tocada", () => {
  assert.equal(limitarPergunta("  Qual é a cor?  "), "Qual é a cor?");
});

test("o histórico mantém as últimas mensagens, não as primeiras", () => {
  // Uma conversa longa perde o começo antes de perder o assunto atual.
  const mensagens = Array.from({ length: 40 }, (_, i) => ({ role: "user", content: `m${i}` }));
  const limitadas = limitarMensagens(mensagens);
  assert.equal(limitadas.length, LIMITES_DE_IA.maxMensagens);
  assert.equal(limitadas.at(-1)?.content, "m39");
});

test("uma mensagem colada não estoura o orçamento das outras", () => {
  const mensagens = [{ role: "user", content: "z".repeat(100_000) }];
  const [limitada] = limitarMensagens(mensagens);
  assert.ok((limitada.content as string).length <= LIMITES_DE_IA.maxCaracteresPorMensagem + 1);
});

test("parte de imagem é descartada — o histórico de chat não é multimodal", () => {
  /*
   * Achado da revisão de segurança pós-P2A: este teste antes esperava que
   * uma parte de imagem "atravessasse intacta" — mas essa era exatamente a
   * lacuna estrutural que deixava conteúdo estruturado escapar do limite.
   * A análise de imagem tem sua PRÓPRIA rota e seu próprio limite de
   * tamanho; `limitarMensagens` só alimenta o histórico do CHAT, que não
   * deveria carregar imagem nenhuma. Uma parte que não é texto é
   * descartada, não repassada sem limite.
   */
  const comImagem = [{ role: "user", content: [{ type: "image" }] as unknown }];
  assert.deepEqual(limitarMensagens(comImagem), [{ role: "user", content: [] }]);
});

test("conteúdo em partes de texto é cortado pelo TOTAL da mensagem, não por parte", () => {
  // Muitas partes pequenas, cada uma dentro do limite isoladamente, mas a
  // SOMA estoura — o corte precisa olhar o total, não cada parte sozinha.
  const partes = Array(10).fill({ type: "text", text: "x".repeat(1000) }); // soma: 10.000
  const mensagens = [{ role: "user", content: partes as unknown }];
  const [limitada] = limitarMensagens(mensagens);
  const conteudo = limitada.content as { type: string; text: string }[];
  const totalCortado = conteudo.reduce((soma, parte) => soma + parte.text.length, 0);
  assert.ok(totalCortado <= LIMITES_DE_IA.maxCaracteresPorMensagem,
    `total cortado (${totalCortado}) deveria caber em maxCaracteresPorMensagem (${LIMITES_DE_IA.maxCaracteresPorMensagem})`);
});

test("partes de texto e imagem misturadas: o texto é cortado, a imagem é descartada", () => {
  const mensagens = [{
    role: "user",
    content: [
      { type: "text", text: "x".repeat(LIMITES_DE_IA.maxCaracteresPorMensagem * 2) },
      { type: "image", image: "dados-que-nao-interessam-aqui" },
    ] as unknown,
  }];
  const [limitada] = limitarMensagens(mensagens);
  const conteudo = limitada.content as { type: string }[];
  assert.equal(conteudo.length, 1, "só a parte de texto deveria sobrar");
  assert.equal(conteudo[0].type, "text");
});

test("sem evidência há instrução explícita, não bloco vazio", () => {
  // Um bloco vazio é pior que ausente: o modelo preenche silêncio, e o
  // silêncio aqui é indistinguível de "a marca não documentou isso".
  const { texto } = montarContextoRecuperado([], ROTULOS);
  assert.equal(texto, "");
  assert.match(semEvidencia(false), /não há diretriz documentada/i);
  assert.match(semEvidencia(true), /no documented guidance/i);
});

test("o corte preserva palavra quando dá, e nunca estoura o limite", () => {
  assert.equal(limitarTexto("abc", 10), "abc");
  const cortado = limitarTexto("uma frase razoavelmente longa aqui", 20);
  assert.ok(cortado.length <= 21);
  assert.ok(cortado.endsWith("…"));
});

// ─── A → B → A: nada atravessa ─────────────────────────────────────────────

/**
 * O teste que o contrato de A1 exige.
 *
 * A sequência importa: A, depois B, depois A DE NOVO. Um vazamento por cache
 * ou por estado de módulo não aparece em A→B — aparece na volta, quando a
 * segunda leitura de A traz junto o que B deixou. É por isso que a terceira
 * chamada existe, e é ela que compara.
 */
const trechoDeA: Trecho = {
  documentSlug: "cor", documentTitle: "Cor", groupName: "Fundamentos",
  section: "Paleta", status: "ready", pageStart: 12, pageEnd: 18,
  content: "A cor institucional da Marca A é o vermelho #E1251B.",
};

const trechoDeB: Trecho = {
  documentSlug: "cor", documentTitle: "Cor", groupName: "Fundamentos",
  section: "Paleta", status: "draft", pageStart: 3, pageEnd: 4,
  content: "A cor institucional da Marca B é o azul #0033A0.",
};

test("A → B → A: nenhum trecho de B sobrevive na volta para A", () => {
  const primeiro = montarContextoRecuperado([trechoDeA], ROTULOS).texto;
  const doMeio = montarContextoRecuperado([trechoDeB], ROTULOS).texto;
  const segundo = montarContextoRecuperado([trechoDeA], ROTULOS).texto;

  assert.equal(segundo, primeiro, "a segunda leitura de A difere da primeira");
  assert.doesNotMatch(segundo, /#0033A0/, "o azul de B atravessou para A");
  assert.doesNotMatch(doMeio, /#E1251B/, "o vermelho de A atravessou para B");
});

test("A → B → A: a citação não muda de status entre as leituras", () => {
  // O status é o que separa regra de rascunho. Se ele viesse de estado
  // compartilhado, o `ready` de A apareceria como `draft` depois de passar por
  // B — e uma regra estabelecida seria apresentada como provisória.
  const primeiro = montarContextoRecuperado([trechoDeA], ROTULOS).texto;
  montarContextoRecuperado([trechoDeB], ROTULOS);
  const segundo = montarContextoRecuperado([trechoDeA], ROTULOS).texto;

  assert.match(primeiro, /status="PRONTO"/);
  assert.match(segundo, /status="PRONTO"/);
  assert.doesNotMatch(segundo, /status="RASCUNHO"/);
});

test("A → B → A: a faixa de páginas é a da marca lida, não a da anterior", () => {
  montarContextoRecuperado([trechoDeB], ROTULOS);
  const deA = montarContextoRecuperado([trechoDeA], ROTULOS).texto;
  assert.match(deA, /PÁGINAS DO PDF: 12–18/);
  assert.doesNotMatch(deA, /PÁGINAS DO PDF: 3–4/);
});

test("montar contexto não guarda nada entre chamadas", () => {
  // A prova direta: mil chamadas alternadas, e a milésima é idêntica à
  // primeira. Qualquer acúmulo — memo, array de módulo, cache — apareceria
  // aqui como diferença ou como crescimento.
  const primeiro = montarContextoRecuperado([trechoDeA], ROTULOS);
  for (let i = 0; i < 500; i += 1) {
    montarContextoRecuperado([trechoDeB], ROTULOS);
    montarContextoRecuperado([trechoDeA], ROTULOS);
  }
  const ultimo = montarContextoRecuperado([trechoDeA], ROTULOS);
  assert.equal(ultimo.texto, primeiro.texto);
  assert.equal(ultimo.usados.length, primeiro.usados.length);
});

test("a ordem das marcas não muda o resultado de nenhuma", () => {
  const aPrimeiro = montarContextoRecuperado([trechoDeA], ROTULOS).texto;
  const bDepois = montarContextoRecuperado([trechoDeB], ROTULOS).texto;

  const bPrimeiro = montarContextoRecuperado([trechoDeB], ROTULOS).texto;
  const aDepois = montarContextoRecuperado([trechoDeA], ROTULOS).texto;

  assert.equal(aPrimeiro, aDepois);
  assert.equal(bPrimeiro, bDepois);
});

// ─── O recorte onde a pergunta está (25/09/2026) ───────────────────────────
//
// O caso real: "quais as cores principais?" num manual cuja seção de cores
// abre com texto institucional e só depois do caractere 1.200 traz a tabela de
// códigos. O corte no começo entregava a abertura e deixava a tabela de fora.
// O conteúdo abaixo é fictício, com a mesma forma.

const ABERTURA = "Nossas cores. ".concat("A paleta da marca traz energia, contraste e harmonia para a comunicação. ".repeat(30));
const TABELA =
  "PRINCIPAIS SECUNDÁRIAS APOIO Códigos cromáticos Verde-claro Verde-escuro Vermelho " +
  "PANTONE 7732C PANTONE 346C PANTONE 485C C 90 M 10 Y 90 K 25 C 63 M 0 Y 55 K 0 " +
  "R 40 G 129 B 84 R 90 G 205 B 139 HEX #288154 #5ACD8B #FF2B00";
const FECHO = " Estratégia de cores para comunicação. ".concat("Peças com mais texto usam mais branco ao fundo. ".repeat(20));
const SECAO_DE_CORES = `${ABERTURA}${TABELA}${FECHO}`;

test("o recorte cai na tabela de códigos, não na abertura da seção", () => {
  assert.ok(SECAO_DE_CORES.indexOf("#FF2B00") > LIMITES_DE_IA.maxCaracteresPorTrecho, "a fixture precisa pôr a tabela além do teto");
  const recorte = recortarTrecho(SECAO_DE_CORES, "quais as cores principais?", LIMITES_DE_IA.maxCaracteresPorTrecho);
  assert.ok(recorte.length <= LIMITES_DE_IA.maxCaracteresPorTrecho);
  for (const valor of ["PANTONE 7732C", "C 63 M 0 Y 55 K 0", "#288154", "#5ACD8B", "#FF2B00"]) {
    assert.ok(recorte.includes(valor), `faltou ${valor} no recorte`);
  }
  assert.ok(recorte.startsWith("…"), "o corte do começo precisa ser avisado");
});

test("o contexto montado com a pergunta leva a tabela; sem a pergunta, também", () => {
  const trechoDeCores: Trecho = {
    documentSlug: "cores", documentTitle: "Cores", groupName: "Manual", section: null,
    status: "draft", pageStart: 34, pageEnd: 38, content: SECAO_DE_CORES,
  };
  const comPergunta = montarContextoRecuperado([trechoDeCores], ROTULOS, "quais as cores principais?").texto;
  assert.match(comPergunta, /#FF2B00/);
  // Sem pergunta, os valores técnicos ainda puxam o recorte para a tabela.
  const semPergunta = montarContextoRecuperado([trechoDeCores], ROTULOS).texto;
  assert.match(semPergunta, /#5ACD8B/);
});

test("trecho que cabe inteiro não é recortado", () => {
  assert.equal(recortarTrecho("Curto. #E1251B", "cores", 2_000), "Curto. #E1251B");
});

test("sem ocorrência de termo nem de valor, o recorte é o começo, como antes", () => {
  const texto = "palavra ".repeat(600);
  assert.equal(recortarTrecho(texto, "tipografia", 1_000), limitarTexto(texto, 1_000));
});

test("os termos da pergunta ignoram acento, caixa e palavras vazias", () => {
  assert.deepEqual(termosDaPergunta("Quais são as CÓDIGOS das cores principais?"), ["codig", "cores", "princ"]);
});
