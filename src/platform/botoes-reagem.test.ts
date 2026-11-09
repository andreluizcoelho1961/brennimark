import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * Todo botão da plataforma reage (22/10/2026, pedido do André): mãozinha ao
 * passar, tom no hover, "afundar" no clique e sinal de trabalho em andamento.
 * O Tailwind 4 tirou o cursor de mão dos botões; sem esta regra ele some de
 * novo sem ninguém notar até alguém clicar e achar que nada aconteceu.
 */
const css = readFileSync(join(process.cwd(), "src/app/acabamento.css"), "utf8");

test("botão habilitado mostra a mãozinha; desabilitado e ocupado dizem por quê", () => {
  assert.match(css, /:is\(button, \[role="button"\][^{]*\):not\(:disabled, \[aria-disabled="true"\]\) \{\s*cursor: pointer;/);
  assert.match(css, /:is\(:disabled, \[aria-disabled="true"\]\) \{\s*cursor: not-allowed;/);
  assert.match(css, /\[aria-busy="true"\] \{\s*cursor: progress;/);
});

test("o botão leve ganha hover abaixo das utilidades, e afunda no clique", () => {
  const camada = css.slice(css.indexOf("@layer base {"));
  assert.match(camada, /border-platform-border[^{]*:hover \{[^}]*background-color/);
  assert.match(css, /border-platform-border[^{]*:active \{\s*transform: scale\(0\.97\);/);
});
