import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { classificarPublicacao } from "./conclusao-da-publicacao";

/**
 * O manual original não pode oferecer uma retomada que o servidor vai recusar.
 *
 * Em produção, a importação do Marco A (09/09) é anterior ao manifesto: o
 * relatório não tem `paginas`, e a retomada responderia `manifesto_ausente`
 * para sempre. Tratar o nulo dela como "incompleta" poria na única marca de
 * produção um aviso falso com um botão que nunca funciona.
 */

test("com documento-fonte, a publicação está completa", () => {
  assert.equal(classificarPublicacao("doc-1", true), "completo");
  // O relatório não importa quando o manifesto já existe.
  assert.equal(classificarPublicacao("doc-1", false), "completo");
});

test("sem documento-fonte e COM páginas no relatório, a retomada consegue concluir", () => {
  assert.equal(classificarPublicacao(null, true), "incompleto");
});

test("sem documento-fonte e SEM páginas no relatório, é anterior ao manifesto — não incompleta", () => {
  assert.equal(classificarPublicacao(null, false), "anterior-ao-manifesto");
});

test("o manual original só oferece a retomada no estado incompleto", () => {
  /*
   * A classificação certa não serve se a página continuar decidindo pelo nulo.
   * Esta guarda lê o código da página: `ConclusaoPendente` — o botão de
   * retomada — só pode aparecer sob `estado === "incompleto"`, e a nota do
   * estado anterior precisa existir.
   */
  const pagina = fs.readFileSync(
    path.join(process.cwd(), "src/app/w/[workspaceSlug]/b/[brandKey]/docs/original/page.tsx"),
    "utf8",
  );
  assert.match(
    pagina,
    /estado === "incompleto"[^\n]*&&[^\n]*\n\s*<ConclusaoPendente/,
    "ConclusaoPendente precisa estar condicionada ao estado incompleto",
  );
  assert.equal(
    (pagina.match(/<ConclusaoPendente/g) ?? []).length,
    1,
    "ConclusaoPendente aparece em mais de um lugar da página",
  );
  assert.match(pagina, /estado === "anterior-ao-manifesto" && <AnteriorAoManifesto \/>/);
  assert.match(
    pagina,
    /primeira_pagina:report->paginas->0/,
    "a página precisa perguntar ao relatório se ele tem páginas",
  );
});
