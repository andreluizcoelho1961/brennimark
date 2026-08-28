import assert from "node:assert/strict";
import test from "node:test";
import type { DocStatus } from "../../content/docs";
import { STATUS_CLASSES, resolveStatusLabels } from "./status";

const STATUSES: DocStatus[] = ["ready", "draft", "pending"];

test("o selo editorial nunca veste token da marca", () => {
  for (const status of STATUSES) {
    const classes = STATUS_CLASSES[status];
    assert.doesNotMatch(classes, /release-analog-/, `${status} usa token de release`);
    assert.doesNotMatch(classes, /\bbrand-/, `${status} usa token da marca`);
  }
});

test("o selo editorial usa apenas tokens da plataforma", () => {
  for (const status of STATUSES) {
    const tokens = STATUS_CLASSES[status].split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      assert.match(token, /platform-/, `${status}: classe sem token de plataforma — ${token}`);
    }
  }
});

test("o selo carrega o próprio fundo, para ficar legível sobre qualquer marca", () => {
  for (const status of STATUSES) {
    assert.match(STATUS_CLASSES[status], /bg-platform-/, `${status} não pinta o próprio fundo`);
  }
});

test("os três status têm rótulo em português e inglês", () => {
  for (const language of ["pt-BR", "en"]) {
    const labels = resolveStatusLabels({ language });
    for (const status of STATUSES) {
      assert.ok(labels[status]?.length, `${language}/${status} sem rótulo`);
    }
  }
  assert.notDeepEqual(resolveStatusLabels({ language: "pt-BR" }), resolveStatusLabels({ language: "en" }));
});

test("uma instância pode redefinir os rótulos sem o core saber quem ela é", () => {
  const override = { ready: "Documented", draft: "Case synthesis", pending: "In progress" };
  assert.deepEqual(resolveStatusLabels({ language: "en", override }), override);
});
