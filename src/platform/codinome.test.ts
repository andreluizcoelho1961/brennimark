import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

/**
 * O codinome legado foi aposentado em 25/09/2026. Ele só pode continuar onde
 * reescrever mudaria o histórico conferido com o ledger de produção.
 */
const PERMITIDOS = [
  /^supabase\/migrations\//,
  /^supabase\/historico-remoto\.txt$/,
  /^supabase\/RECONCILIACAO\.md$/,
  /^CLAUDE\.md$/, // o parágrafo que registra a aposentadoria
  /^src\/platform\/codinome\.test\.ts$/,
];

const CODINOME = ["brand", "ville"].join("");

test("o codinome legado não volta ao repositório", () => {
  let saida = "";
  try {
    saida = execFileSync("git", ["grep", "-il", CODINOME], { encoding: "utf8" });
  } catch (erro) {
    // git grep sai com 1 quando não acha nada.
    if ((erro as { status?: number }).status !== 1) throw erro;
  }
  const arquivos = saida.split("\n").filter(Boolean);
  const fora = arquivos.filter((a) => !PERMITIDOS.some((p) => p.test(a)));
  assert.deepEqual(fora, [], `o codinome legado reapareceu em: ${fora.join(", ")}`);

  const nomes = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter((a) => a.toLowerCase().includes(CODINOME) && !/^supabase\/migrations\//.test(a));
  assert.deepEqual(nomes, [], `arquivo com o codinome no nome: ${nomes.join(", ")}`);
});
