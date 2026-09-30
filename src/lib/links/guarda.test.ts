import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

/**
 * As duas funções do link público (`abrir_link_de_entrega` e
 * `registrar_acesso_ao_link`) só existem para quem NÃO tem conta, e só a chave
 * de serviço as chama. Cada chamada precisa conferir o código do link antes —
 * por isso só a página pública e a rota de download podem usá-las. Uma terceira
 * chamada, em outro lugar, seria um caminho de entrega que ninguém revisou.
 */
const PERMITIDOS = [
  "src/app/receber/[codigo]/page.tsx",
  "src/app/api/receber/[codigo]/baixar/route.ts",
];

function quemChama(funcao: string): string[] {
  try {
    return execFileSync("git", ["grep", "-l", `"${funcao}"`, "--", "src"], { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch (erro) {
    if ((erro as { status?: number }).status === 1) return [];
    throw erro;
  }
}

test("só a página pública e a rota de download chamam as funções do link", () => {
  for (const funcao of ["abrir_link_de_entrega", "registrar_acesso_ao_link"]) {
    const fora = quemChama(funcao).filter((arquivo) => !PERMITIDOS.includes(arquivo) && !arquivo.endsWith(".test.ts"));
    assert.deepEqual(fora, [], `${funcao} chamada fora da entrega pública: ${fora.join(", ")}`);
  }
  // O contraponto: sem ele, a guarda passaria se o nome da função mudasse.
  assert.ok(quemChama("registrar_acesso_ao_link").includes(PERMITIDOS[1]));
  assert.ok(quemChama("abrir_link_de_entrega").includes(PERMITIDOS[0]));
});
