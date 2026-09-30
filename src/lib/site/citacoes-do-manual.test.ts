import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * O site cita páginas do manual do Brennimark, e o manual de exemplo dentro da
 * plataforma é a edição de demonstração, de 33 páginas (30/09/2026). Quem
 * visita o site e abre o manual precisa achar a regra na página citada.
 *
 * A versão completa (v0.2) tem 64 páginas e numeração diferente: uma citação
 * copiada dela aponta para outra página, ou para uma que não existe.
 */
const PAGINAS_DA_DEMONSTRACAO = 33;
const PASTA = path.join(process.cwd(), "src/components/site");

function arquivosDoSite(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const caminho = path.join(pasta, e.name);
    if (e.isDirectory()) return arquivosDoSite(caminho);
    return e.name.endsWith(".tsx") || e.name.endsWith(".ts") ? [caminho] : [];
  });
}

const fontes = arquivosDoSite(PASTA).map((arquivo) => ({
  arquivo: path.relative(process.cwd(), arquivo),
  texto: readFileSync(arquivo, "utf8"),
}));

test("toda página citada existe na edição de demonstração", () => {
  const fora: string[] = [];
  let citacoes = 0;
  for (const { arquivo, texto } of fontes) {
    for (const m of texto.matchAll(/\b[pP]\.\s?(\d+)(?:\s?[–-]\s?(\d+))?/g)) {
      citacoes++;
      const ultima = Number(m[2] ?? m[1]);
      if (ultima > PAGINAS_DA_DEMONSTRACAO) fora.push(`${arquivo}: "${m[0]}"`);
    }
  }
  assert.ok(citacoes > 10, `a busca de citações não achou quase nada (${citacoes}); o padrão mudou?`);
  assert.deepEqual(fora, [], "página além da edição de demonstração");
});

test("o fólio e a contagem do manual são os da edição de demonstração", () => {
  const folios = fontes.flatMap(({ arquivo, texto }) =>
    [...texto.matchAll(/<span>(\d+) \/ (\d+)<\/span>/g)].map((m) => ({ arquivo, total: Number(m[2]) })),
  );
  assert.ok(folios.length >= 2, "o fólio do visualizador sumiu do site");
  for (const f of folios) assert.equal(f.total, PAGINAS_DA_DEMONSTRACAO, `fólio em ${f.arquivo}`);

  for (const { arquivo, texto } of fontes) {
    assert.doesNotMatch(texto, /manual v0\.2|64 páginas|\b00 Fundamentos\b/, `resto da v0.2 em ${arquivo}`);
  }
});
