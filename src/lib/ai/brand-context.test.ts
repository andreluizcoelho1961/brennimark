import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnalysisSystemPrompt,
  buildAnalysisBrandContext,
  buildBrandContext,
  buildChatSystemPrompt,
  getBrandKnowledgeSources,
} from "./brand-context";
import type { BrandPromptContext } from "./brand-context";
import type { DocPageEntry } from "../../content/docs";
import { resolveStatusLabels } from "../../components/docs/status";
import { parseBrandCitations } from "./citations";

/** Uma marca de teste; o idioma e os papéis chegam por parâmetro. */
const MARCA: BrandPromptContext = {
  language: "pt-BR",
  chatRole: "Você é o guia da Marca A.",
  analysisRole: "Você avalia peças da Marca A.",
  statusLabels: undefined,
};

const PAGINAS: DocPageEntry[] = [
  {
    slug: "cores",
    group: "Visual",
    title: "Cores",
    status: "ready",
    body: ["A cor primária é aplicada em superfície, não em texto corrido."],
    blocks: [{ kind: "swatches", items: [{ name: "Primária", hex: "#2B6CB0" }] }],
  },
  { slug: "voz", group: "Verbal", title: "Tom de voz", status: "draft", body: ["Frase curta, sem adjetivo vazio."] },
  { slug: "pendente", group: "Verbal", title: "Assinatura", status: "pending", body: [] },
];

test("cada página vira uma fonte, e só o que a marca importou entra", () => {
  const sources = getBrandKnowledgeSources(PAGINAS);
  const ids = sources.map((source) => source.id);

  assert.equal(new Set(ids).size, ids.length, "ids de fonte precisam ser únicos");
  assert.equal(sources.length, PAGINAS.length, "nenhuma fonte além das páginas");
  assert.ok(sources.every((source) => source.kind === "guide-page"));
  assert.ok(!ids.some((id) => id.startsWith("structured:")), "não pode haver fonte fabricada pelo produto");
});

test("sem marca importada, o contexto é vazio em vez de inventado", () => {
  assert.deepEqual(getBrandKnowledgeSources([]), []);
  assert.equal(buildBrandContext([], MARCA).trim(), "");
});

test("a análise recebe só as páginas com bloco visual", () => {
  const context = buildAnalysisBrandContext(PAGINAS, MARCA);
  const fullContext = buildBrandContext(PAGINAS, MARCA);

  assert.match(context, /id="doc:cores"/);
  assert.doesNotMatch(context, /id="doc:voz"/, "página sem bloco visual não deveria entrar");
  assert.ok(context.length < fullContext.length);
});

test("guia sem nenhum bloco visual cai para o guia inteiro, em vez de mandar vazio", () => {
  const semBlocos = PAGINAS.filter((p) => !p.blocks);
  const context = buildAnalysisBrandContext(semBlocos, MARCA);
  assert.match(context, /id="doc:voz"/);
  assert.ok(buildAnalysisSystemPrompt(semBlocos, MARCA).includes(context), "o prompt de análise precisa embutir o contexto");
});

test("o valor de um bloco chega ao contexto, com o status da página que o contém", () => {
  const context = buildBrandContext(PAGINAS, MARCA);

  assert.match(context, /#2B6CB0/, "o hex do swatch precisa chegar à IA");
  assert.match(context, /PRONTO/, "a página aprovada precisa se anunciar como tal");
  assert.match(context, /RASCUNHO/, "rascunho não pode ser apresentado como regra");
});

test("preserva status e caminho para respostas verificáveis", () => {
  const sources = getBrandKnowledgeSources(PAGINAS);

  for (const source of sources) {
    assert.ok(source.title, "toda fonte precisa de título citável");
    assert.match(source.path, /^\/docs\//, "o caminho precisa levar de volta à página");
    assert.ok(["ready", "draft", "pending"].includes(source.status));
  }

  const pendente = sources.find((s) => s.status === "pending");
  assert.ok(pendente, "página em construção precisa continuar sendo uma fonte");
  assert.equal(pendente.facts.length, 0, "página sem conteúdo não pode ganhar fato inventado");
});

test("prompts exigem citação, incerteza e separação de interpretação", () => {
  const chatPrompt = buildChatSystemPrompt(PAGINAS, MARCA);
  const analysisPrompt = buildAnalysisSystemPrompt(PAGINAS, MARCA);

  for (const prompt of [chatPrompt, analysisPrompt]) {
    assert.match(prompt, /Toda afirmação material deve terminar.*com uma citação/);
    assert.match(prompt, /Não há uma diretriz documentada suficiente para responder isso/);
    assert.match(prompt, /Interpretação:/);
    assert.match(prompt, /<brand_knowledge>/);
    assert.match(prompt, /<\/brand_knowledge>/);
  }

  assert.match(analysisPrompt, /Veredito: alinhada, parcialmente alinhada ou desalinhada/);
  assert.match(analysisPrompt, /Confiança: alta, média ou baixa/);
  assert.match(analysisPrompt, /não permitem confirmar um valor hexadecimal exato/i);
  // A redação mudou no patch 3.1: a tolerância perceptual passou a apontar
  // para a paleta documentada da marca, e não para uma cor fixa.
  assert.match(analysisPrompt, /plausivelmente compatível com uma cor documentada não constitui violação/i);
  assert.match(analysisPrompt, /essa evidência documental prevalece/i);
});

// ─── Duas marcas opostas, no mesmo processo ─────────────────────────────────

/**
 * O defeito que estes testes protegem era grave e silencioso.
 *
 * O prompt de análise trazia, escrito por extenso, "Accent — Turquoise": a
 * paleta de um cliente específico dentro da regra universal de avaliação de
 * cor. Qualquer marca era julgada com tolerância calibrada para turquesa — um
 * tom próximo do turquesa passava, e a cor oficial da própria marca podia ser
 * apontada como não documentada.
 *
 * E idioma, papel de chat e papel de análise vinham da instância global, então
 * duas contas servidas pelo mesmo processo recebiam os documentos certos
 * dentro de um prompt orientado pela marca errada.
 */

const MARCA_VERMELHA: BrandPromptContext = {
  language: "pt-BR",
  chatRole: "Você é o guia da Vermelha, marca de varejo.",
  analysisRole: "Você avalia peças da Vermelha.",
  statusLabels: undefined,
};

const MARCA_AZUL: BrandPromptContext = {
  language: "en",
  chatRole: "You are the guide for Azure, an institutional brand.",
  analysisRole: "You review Azure applications.",
  statusLabels: undefined,
};

const PAGINAS_VERMELHA: DocPageEntry[] = [
  {
    slug: "cores", group: "Sistema", title: "Cores", status: "ready",
    body: ["O vermelho institucional é a cor de superfície."],
    blocks: [{ kind: "swatches", items: [{ name: "Vermelho", hex: "#E1251B" }] }],
  },
];

const PAGINAS_AZUL: DocPageEntry[] = [
  {
    slug: "colour", group: "System", title: "Colour", status: "ready",
    body: ["Institutional blue carries every surface."],
    blocks: [{ kind: "swatches", items: [{ name: "Blue", hex: "#0B4F9E" }] }],
  },
];

test("nenhuma cor de cliente sobrevive dentro da regra universal", () => {
  for (const [docs, marca] of [
    [PAGINAS_VERMELHA, MARCA_VERMELHA],
    [PAGINAS_AZUL, MARCA_AZUL],
  ] as const) {
    const prompt = buildAnalysisSystemPrompt(docs, marca);
    assert.doesNotMatch(prompt, /Turquoise/i, "o prompt julgava toda marca contra o turquesa de um cliente");
    assert.doesNotMatch(prompt, /turquesa/i);
    // "lançamento analisado" era o vocabulário de release de outro cliente.
    assert.doesNotMatch(prompt, /lançamento analisado|release being analyzed/i);
  }
});

test("a regra de cor aponta para a paleta daquela marca, não para uma fixa", () => {
  const vermelha = buildAnalysisSystemPrompt(PAGINAS_VERMELHA, MARCA_VERMELHA);
  assert.match(vermelha, /cores documentadas DESTA marca/);
  // Sem cor documentada, a resposta é não avaliar — não presumir referência.
  assert.match(vermelha, /Se esta marca não documenta cor nenhuma/);
});

test("nada atravessa de uma marca para a outra no mesmo processo", () => {
  const vermelha = buildAnalysisSystemPrompt(PAGINAS_VERMELHA, MARCA_VERMELHA);
  const azul = buildAnalysisSystemPrompt(PAGINAS_AZUL, MARCA_AZUL);

  // Conteúdo
  assert.match(vermelha, /#E1251B/);
  assert.doesNotMatch(vermelha, /#0B4F9E/, "a paleta da outra marca não pode aparecer");
  assert.match(azul, /#0B4F9E/);
  assert.doesNotMatch(azul, /#E1251B/);

  // Papel — o prompt de análise usa o papel de análise, não o de chat
  assert.match(vermelha, /Você avalia peças da Vermelha/);
  assert.doesNotMatch(vermelha, /Azure/);
  assert.match(azul, /You review Azure applications/);
  assert.doesNotMatch(azul, /Vermelha/);

  // Idioma do manual: cada prompt no idioma do seu, e os rótulos de status
  // junto. Antes um único idioma global valia para as duas.
  assert.match(vermelha, /Regras de fundamentação/);
  assert.match(vermelha, /status="PRONTO"/);
  assert.match(azul, /Grounding rules/);
  // "APPROVED", não "READY": o prompt passou a usar o mesmo vocabulário da
  // interface, que em inglês diz "Approved". Antes divergiam mesmo sem a marca
  // declarar rótulo próprio.
  assert.match(azul, /status="APPROVED"/);
  assert.doesNotMatch(azul, /Regras de fundamentação/);
});

test("o chat também não mistura papel nem idioma entre marcas", () => {
  const vermelha = buildChatSystemPrompt(PAGINAS_VERMELHA, MARCA_VERMELHA);
  const azul = buildChatSystemPrompt(PAGINAS_AZUL, MARCA_AZUL);

  assert.match(vermelha, /guia da Vermelha/);
  assert.match(vermelha, /Formato recomendado/);
  assert.match(azul, /guide for Azure/);
  assert.match(azul, /Recommended format/);
  assert.doesNotMatch(azul, /Vermelha|Formato recomendado/);
});

test("a ordem das chamadas não muda o resultado de nenhuma delas", () => {
  // A prova contra estado de módulo: se algo fosse memorizado no processo, a
  // segunda chamada herdaria a primeira.
  const azulPrimeiro = buildAnalysisSystemPrompt(PAGINAS_AZUL, MARCA_AZUL);
  buildAnalysisSystemPrompt(PAGINAS_VERMELHA, MARCA_VERMELHA);
  const azulDepois = buildAnalysisSystemPrompt(PAGINAS_AZUL, MARCA_AZUL);
  assert.equal(azulPrimeiro, azulDepois);
});

// ─── Vocabulário editorial próprio ──────────────────────────────────────────

/**
 * A marca pode nomear os próprios estados.
 *
 * A interface já respeitava `statusLabels`; o prompt não. O assistente citava
 * "PRONTO" enquanto a tela mostrava "Documentado" — a mesma página com dois
 * nomes, e a pessoa sem saber se estava vendo a mesma coisa. Em inglês
 * divergiam mesmo sem rótulo próprio: a tela dizia "Approved" e o prompt,
 * "READY".
 */
const MARCA_COM_VOCABULARIO: BrandPromptContext = {
  language: "pt-BR",
  chatRole: "Você é o guia da Editorial.",
  analysisRole: "Você avalia peças da Editorial.",
  statusLabels: {
    ready: "Documentado",
    draft: "Em validação",
    pending: "Sem diretriz",
  },
};

const PAGINAS_EDITORIAL: DocPageEntry[] = [
  { slug: "grade", group: "Sistema", title: "Grade", status: "ready", body: ["Doze colunas."] },
  { slug: "voz", group: "Verbal", title: "Voz", status: "draft", body: ["Frase curta."] },
  { slug: "selo", group: "Verbal", title: "Selo", status: "pending", body: [] },
];

test("o prompt usa o vocabulário que a marca declarou", () => {
  const prompt = buildChatSystemPrompt(PAGINAS_EDITORIAL, MARCA_COM_VOCABULARIO);

  // Nas fontes, marcando cada página.
  assert.match(prompt, /status="DOCUMENTADO"/);
  assert.match(prompt, /status="EM VALIDAÇÃO"/);
  assert.match(prompt, /status="SEM DIRETRIZ"/);

  // E nas regras, que explicam o que cada estado significa.
  assert.match(prompt, /DOCUMENTADO é regra estabelecida/);
  assert.match(prompt, /EM VALIDAÇÃO é orientação provisória/);
  assert.match(prompt, /SEM DIRETRIZ significa que ainda não há regra/);

  // A instrução de citação precisa listar os termos aceitos, senão o modelo
  // inventa um e a interface não reconhece a citação.
  assert.match(prompt, /STATUS é exatamente um destes: DOCUMENTADO, EM VALIDAÇÃO, SEM DIRETRIZ/);
});

test("sem o vocabulário da marca, o prompt não diria a mesma coisa", () => {
  // A prova de que o teste acima depende do override, e não passaria de graça.
  const semOverride: BrandPromptContext = {
    ...MARCA_COM_VOCABULARIO,
    statusLabels: undefined,
  };
  const prompt = buildChatSystemPrompt(PAGINAS_EDITORIAL, semOverride);

  assert.doesNotMatch(prompt, /DOCUMENTADO/);
  assert.match(prompt, /status="PRONTO"/, "sem override, valem os rótulos do produto");
});

test("o prompt e a interface leem o vocabulário da mesma função", () => {
  const daInterface = resolveStatusLabels({
    language: MARCA_COM_VOCABULARIO.language,
    override: MARCA_COM_VOCABULARIO.statusLabels,
  });
  const prompt = buildChatSystemPrompt(PAGINAS_EDITORIAL, MARCA_COM_VOCABULARIO);

  // O que a tela mostra tem que ser o que o assistente cita — em caixa alta,
  // que é a única diferença permitida entre os dois.
  for (const rotulo of Object.values(daInterface)) {
    assert.ok(
      prompt.includes(rotulo.toLocaleUpperCase()),
      `a tela mostra "${rotulo}" e o prompt não usa esse termo`,
    );
  }
});

test("o vocabulário de uma marca não vaza para a outra: azul, própria, azul", () => {
  const azulPrimeiro = buildChatSystemPrompt(PAGINAS_AZUL, MARCA_AZUL);
  const propria = buildChatSystemPrompt(PAGINAS_EDITORIAL, MARCA_COM_VOCABULARIO);
  const azulDepois = buildChatSystemPrompt(PAGINAS_AZUL, MARCA_AZUL);

  assert.equal(azulPrimeiro, azulDepois, "a chamada do meio não pode contaminar a terceira");
  assert.match(azulDepois, /status="APPROVED"/);
  assert.doesNotMatch(azulDepois, /DOCUMENTADO|EM VALIDAÇÃO|SEM DIRETRIZ/);
  assert.doesNotMatch(propria, /APPROVED|status="PRONTO"/);
});

test("a citação da interface reconhece o vocabulário da marca", () => {
  const labels = resolveStatusLabels({
    language: MARCA_COM_VOCABULARIO.language,
    override: MARCA_COM_VOCABULARIO.statusLabels,
  });
  const resposta = "A grade tem doze colunas. [Fonte: Grade — DOCUMENTADO · /docs/grade]";
  const segmentos = parseBrandCitations(resposta, labels);
  const citacao = segmentos.find((s) => s.type === "citation");

  // Sem isto o assistente citaria certo e a tela não reconheceria: o texto
  // viraria parágrafo solto, sem link e sem selo.
  assert.ok(citacao, "a citação com vocabulário próprio precisa ser reconhecida");
  assert.equal(citacao.status, "DOCUMENTADO");
  assert.equal(citacao.statusKey, "ready", "o estilo do selo vem da chave, não do texto");

  // E o vocabulário padrão não reconhece esse termo — a prova de que o
  // reconhecimento depende mesmo do que a marca declarou.
  const comPadrao = parseBrandCitations(resposta, resolveStatusLabels({ language: "pt-BR" }));
  assert.ok(!comPadrao.some((s) => s.type === "citation"));
});
