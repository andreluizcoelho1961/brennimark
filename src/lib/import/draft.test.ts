import assert from "node:assert/strict";
import test from "node:test";
import { construirRascunho, montarPrevia, slugify } from "./draft";

const pagina = (numero: number, ...linhas: string[]) => ({ numero, linhas });

test("todo documento importado nasce rascunho", () => {
  const { documentos } = construirRascunho([
    pagina(1, "Cores", "O vermelho institucional."),
    pagina(2, "Tipografia", "Uma família."),
  ]);
  // Extração automática não é aprovação. Não há opção para publicar direto:
  // o que saiu de heurística não pode aparecer como regra estabelecida.
  assert.ok(documentos.every((d) => d.status === "draft"));
});

test("página sem texto vira aviso, não documento vazio", () => {
  const previa = montarPrevia([pagina(1, "Cores", "texto"), pagina(2)]);
  assert.equal(previa.documentos.length, 1);
  assert.deepEqual(previa.ignoradas, [2]);
  assert.equal(previa.avisos[0].tipo, "sem-texto");
});

test("PDF inteiro sem texto é erro, e nada seria importado", () => {
  const previa = montarPrevia([pagina(1), pagina(2)]);
  assert.equal(previa.documentos.length, 0);
  assert.equal(previa.erros.length, 1);
  assert.match(previa.erros[0], /Nenhuma página/);
});

test("arquivo sem páginas é erro", () => {
  assert.match(montarPrevia([]).erros[0], /não tem páginas/);
});

test("títulos repetidos não se sobrescrevem", () => {
  // Comum num manual: duas páginas "Aplicações". Colidir os slugs perderia
  // uma delas em silêncio.
  const { documentos } = construirRascunho([
    pagina(1, "Aplicações", "primeira"),
    pagina(2, "Aplicações", "segunda"),
  ]);
  assert.equal(new Set(documentos.map((d) => d.slug)).size, 2);
});

test("o título vira slug estável, sem acento", () => {
  assert.equal(slugify("Território — Ação & Cor"), "territorio-acao-cor");
  assert.equal(slugify("   "), "");
});

test("página só com título avisa que precisa de revisão", () => {
  const previa = montarPrevia([pagina(1, "Cores")]);
  assert.equal(previa.documentos[0].body?.length, 0);
  assert.equal(previa.avisos[0].tipo, "texto-curto");
});

test("página sem linha curta ganha título honesto, não inventado", () => {
  const longa = "x".repeat(200);
  const { documentos, avisos } = construirRascunho([pagina(1, longa)]);
  assert.equal(documentos[0].title, "Página 1");
  assert.equal(avisos[0].tipo, "sem-titulo");
});

test("os limites do banco são respeitados antes de chegar nele", () => {
  const muitas = Array.from({ length: 60 }, (_, i) => `parágrafo ${i}`);
  const { documentos } = construirRascunho([pagina(1, "Título", ...muitas)]);
  assert.ok(documentos[0].body!.length <= 40);
  const gigante = "y".repeat(9000);
  const { documentos: d2 } = construirRascunho([pagina(1, "T", gigante)]);
  assert.ok(d2[0].body![0].length <= 4000);
});
