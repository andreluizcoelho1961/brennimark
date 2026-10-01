import assert from "node:assert/strict";
import test from "node:test";
import {
  ehAcao, lerTextoDoComplemento, mensagemDaRecusa, situacao, tituloVisivel, trechoDoComplemento,
} from "./complementos";
import { buildChatSystemPrompt, type BrandPromptContext } from "../ai/brand-context";
import { parseBrandCitations } from "../ai/citations";
import { destinoDaCitacao } from "../ai/paginas-citadas";
import { montarContextoRecuperado, type Trecho } from "../ai/recuperacao";
import { promptStatusLabels, resolveStatusLabels } from "../../components/docs/status";

const MARCA: BrandPromptContext = {
  language: "pt-BR",
  chatRole: "Você é o guia da Marca A.",
  analysisRole: "Você avalia peças da Marca A.",
  statusLabels: undefined,
};
const ROTULOS = resolveStatusLabels({ language: "pt-BR" });

const DO_MANUAL: Trecho = {
  documentSlug: "area-de-protecao", documentTitle: "Área de proteção", groupName: "Marca", section: null,
  status: "ready", pageStart: 9, pageEnd: 9, content: "O símbolo pede área de proteção igual a x.",
};
const COMPLEMENTO = trechoDoComplemento({
  slug: "simbolo-sobre-foto", titulo: "Símbolo sobre foto", secao: "Fundo", conteudo: "Sempre sobre área escura.",
});

test("situação: arquivado vence; nunca publicado é rascunho; publicado com edição pendente se distingue", () => {
  const base = { versao: 1, arquivado_em: null, rascunho: null };
  const rascunho = { titulo: "x", texto: "y", atualizado_em: "2026-10-01T10:00:00Z", atualizado_por_email: "a@b.c" };
  assert.equal(situacao({ ...base, versao: 0, rascunho }), "rascunho");
  assert.equal(situacao(base), "publicado");
  assert.equal(situacao({ ...base, rascunho }), "publicado-com-rascunho");
  assert.equal(situacao({ ...base, arquivado_em: "2026-10-01T11:00:00Z", rascunho }), "arquivado");
  assert.equal(tituloVisivel({ titulo: null, rascunho }), "x");
  assert.equal(tituloVisivel({ titulo: "Publicado", rascunho }), "Publicado");
});

test("o texto: título obrigatório até 120; texto até 20 mil; quebra de linha do Windows normalizada", () => {
  assert.deepEqual(lerTextoDoComplemento({ titulo: "  Foto ", texto: "a\r\nb" }), { ok: true, titulo: "Foto", texto: "a\nb" });
  assert.equal(lerTextoDoComplemento({ texto: "x" }).ok, false);
  assert.equal(lerTextoDoComplemento({ titulo: "x".repeat(121), texto: "" }).ok, false);
  const longo = lerTextoDoComplemento({ titulo: "x", texto: "a".repeat(20_001) });
  assert.equal(longo.ok, false);
  if (!longo.ok) assert.match(longo.mensagem, /20\.000.*20\.001/);
  assert.equal(ehAcao("publicar"), true);
  assert.equal(ehAcao("apagar"), false);
});

test("a recusa do banco vira frase; o desconhecido vira a genérica", () => {
  assert.match(mensagemDaRecusa("complementos_arquivado"), /arquivado/);
  assert.match(mensagemDaRecusa("complementos_sem_rascunho"), /Não há alteração/);
  assert.equal(mensagemDaRecusa("outra"), "Não foi possível concluir. Tente de novo.");
});

test("no contexto do Vini, o complemento é fonte própria — nunca página do manual", () => {
  const { texto } = montarContextoRecuperado([COMPLEMENTO], promptStatusLabels(ROTULOS), "foto", "trechos");
  assert.match(texto, /<source id="complemento:simbolo-sobre-foto" status="PRONTO" kind="supplement">/);
  assert.match(texto, /CAMINHO: \/complementos\/simbolo-sobre-foto\nSEÇÃO: Fundo/);
  assert.doesNotMatch(texto, /PÁGINAS DO PDF|\/docs\//);
});

test("o prompt traz a regra do complemento só quando há complemento", () => {
  const sem = buildChatSystemPrompt([DO_MANUAL], MARCA, "foto");
  assert.doesNotMatch(sem, /kind="supplement"|COMPLEMENTOS/);
  const com = buildChatSystemPrompt([DO_MANUAL], MARCA, "foto", "trechos", [], [COMPLEMENTO]);
  assert.match(com, /kind="guide-page"[\s\S]*kind="supplement"/);
  assert.match(com, /O manual é a referência\. Se um complemento e o manual falarem do mesmo assunto, cite OS DOIS/);
  assert.match(com, /nunca apresente complemento como se fosse o manual/);
});

test("a citação de complemento é reconhecida e abre o complemento, não o PDF", () => {
  const [, citacao] = parseBrandCitations("Use fundo escuro. [Fonte: Símbolo sobre foto — PRONTO · /complementos/simbolo-sobre-foto]", ROTULOS);
  assert.equal(citacao.type, "citation");
  if (citacao.type !== "citation") return;
  assert.equal(citacao.path, "/complementos/simbolo-sobre-foto");
  assert.deepEqual(destinoDaCitacao(citacao.path, {}, "/w/a/b/m/docs", "1"), {
    href: "/w/a/b/m/docs/complementos#simbolo-sobre-foto", pagina: null, complemento: true,
  });
  // A citação do manual segue indo ao PDF.
  assert.deepEqual(destinoDaCitacao("/docs/area-de-protecao", { "/docs/area-de-protecao": 9 }, "/w/a/b/m/docs", "1"), {
    href: "/w/a/b/m/docs/original?pagina=9&ir=1", pagina: 9,
  });
});
