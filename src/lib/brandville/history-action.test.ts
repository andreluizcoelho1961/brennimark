import assert from "node:assert/strict";
import test from "node:test";
import { historyActionLabel } from "./history-action";

/**
 * O rótulo do histórico precisa dizer o que aconteceu.
 *
 * Estes testes existem por causa de um defeito real: a interface tratava tudo
 * que não fosse `restored_to_matrix` como "Publicada". Um valor novo — como
 * `deleted` — apareceria como publicação, e o histórico mentiria sobre a
 * exclusão de uma página.
 */

test("cada ação tem rótulo próprio, e nenhum se repete", () => {
  const acoes = ["published", "deleted", "restored_from_version", "restored_to_matrix"] as const;
  const selos = acoes.map((acao) => historyActionLabel(acao).badge);
  assert.equal(new Set(selos).size, acoes.length, `selos repetidos: ${selos.join(", ")}`);
});

test("exclusão nunca é apresentada como publicação", () => {
  const excluida = historyActionLabel("deleted");
  assert.notEqual(excluida.badge, historyActionLabel("published").badge);
  assert.match(excluida.badge, /Excluí/);
});

test("ação desconhecida é dita desconhecida, não publicação", () => {
  // A regressão que isto impede: o banco ganha um valor de ação, a interface
  // ainda não sabe dele, e a linha do tempo o exibe como publicação.
  const desconhecida = historyActionLabel("algo_que_ainda_nao_existe");
  assert.notEqual(desconhecida.badge, historyActionLabel("published").badge);
  assert.match(desconhecida.badge, /desconhecida/i);
});

test("exclusão e recuperação substituem a lista de campos alterados", () => {
  // Comparar campo a campo não descreve o que houve nesses dois casos.
  assert.equal(historyActionLabel("deleted").replacesFieldList, true);
  assert.equal(historyActionLabel("restored_from_version").replacesFieldList, true);
  assert.equal(historyActionLabel("published").replacesFieldList, false);
});

test("recuperar não é ação apagada; excluir é", () => {
  // Recuperação é publicação de conteúdo e recebe selo cheio; exclusão e
  // legado ficam discretos.
  assert.equal(historyActionLabel("restored_from_version").muted, false);
  assert.equal(historyActionLabel("deleted").muted, true);
  assert.equal(historyActionLabel("restored_to_matrix").muted, true);
});
