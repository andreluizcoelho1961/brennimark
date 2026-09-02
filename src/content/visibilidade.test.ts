import assert from "node:assert/strict";
import test from "node:test";
import { documentosVisiveis, podeVerDocumento } from "./visibilidade";
import { capabilitiesForRole } from "../platform/capabilities";
import type { DocPageEntry } from "./docs";

const OWNER = capabilitiesForRole("owner");
const MEMBER = capabilitiesForRole("member");
const VISITANTE = capabilitiesForRole(null);

const pagina = (status: DocPageEntry["status"], slug: string): DocPageEntry => ({
  slug, group: "Manual", title: slug, status, body: ["conteúdo"],
});

test("quem consulta vê rascunho, e essa é a decisão", () => {
  // Toda importação nasce inteira em `draft`. Se member só visse `ready`, um
  // manual recém-importado seria invisível para a equipe até alguém promover
  // as 152 seções uma a uma — e o produto entregaria uma conta vazia no dia
  // seguinte à importação.
  assert.equal(podeVerDocumento("draft", MEMBER), true);
});

test("pendente também aparece: ele diz que a regra falta", () => {
  // Uma página pendente encontrada é uma decisão que falta tomar. Escondida,
  // é uma pergunta que volta amanhã.
  assert.equal(podeVerDocumento("pending", MEMBER), true);
});

test("member e owner enxergam o mesmo manual", () => {
  const manual = [pagina("ready", "a"), pagina("draft", "b"), pagina("pending", "c")];
  assert.deepEqual(
    documentosVisiveis(manual, MEMBER).map((d) => d.slug),
    documentosVisiveis(manual, OWNER).map((d) => d.slug),
  );
});

test("sem capacidade de consultar, nenhuma página — nem as prontas", () => {
  assert.equal(podeVerDocumento("ready", VISITANTE), false);
  assert.deepEqual(documentosVisiveis([pagina("ready", "a")], VISITANTE), []);
});

test("a decisão é uma lista explícita, não a ausência de filtro", () => {
  // A diferença importa: um status novo no futuro precisa ser DECIDIDO, e não
  // aparecer sozinho porque ninguém filtrou.
  const inventado = { ...pagina("ready", "x"), status: "arquivado" as never };
  assert.equal(documentosVisiveis([inventado], OWNER).length, 0);
});
