import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Os catálogos de tradução têm que ter EXATAMENTE as mesmas chaves.
 *
 * Chave que existe só em português aparece cru ("comum.salvar") para quem usa
 * em inglês, e esse defeito não aparece enquanto só a gente testa em português.
 * Esta prova roda a cada `verify`, então um idioma novo nunca nasce incompleto.
 */
const PASTA = path.join(process.cwd(), "src/i18n/mensagens");
const IDIOMAS = ["pt-BR", "en"];

function chaves(objeto: unknown, prefixo = ""): string[] {
  if (typeof objeto !== "object" || objeto === null) return [prefixo];
  return Object.entries(objeto).flatMap(([k, v]) => chaves(v, prefixo ? `${prefixo}.${k}` : k));
}

const catalogos = Object.fromEntries(
  IDIOMAS.map((i) => [i, JSON.parse(readFileSync(path.join(PASTA, `${i}.json`), "utf8"))]),
);

test("todo idioma tem as mesmas chaves do português", () => {
  const base = chaves(catalogos["pt-BR"]).sort();
  for (const idioma of IDIOMAS) {
    assert.deepEqual(chaves(catalogos[idioma]).sort(), base, `chaves de ${idioma} divergem de pt-BR`);
  }
});

test("nenhuma tradução está vazia", () => {
  for (const idioma of IDIOMAS) {
    const textos = (function achatar(o: unknown): string[] {
      return typeof o === "string" ? [o] : Object.values(o as object).flatMap(achatar);
    })(catalogos[idioma]);
    assert.ok(textos.every((t) => t.trim().length > 0), `${idioma} tem texto vazio`);
  }
});
