import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * O site cita páginas do manual do Brennimark, e o manual de exemplo dentro da
 * plataforma é a edição de demonstração. Desde 22/10/2026 é a versão 0.3, de
 * 42 páginas (era a de 33, de 30/09/2026): o manual que inaugura a plataforma.
 * Quem visita o site e abre o manual precisa achar a regra na página citada.
 *
 * A versão completa (v0.2) tem 64 páginas e numeração diferente: uma citação
 * copiada dela aponta para outra página, ou para uma que não existe.
 */
const PAGINAS_DA_DEMONSTRACAO = 42;
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
  // Eram mais de dez quando as telas eram desenhadas em código; agora são capturas
  // reais (23/10/2026) e as citações moram dentro das imagens. Sobram as do texto.
  assert.ok(citacoes >= 3, `a busca de citações não achou quase nada (${citacoes}); o padrão mudou?`);
  assert.deepEqual(fora, [], "página além da edição de demonstração");
});

// Na v0.3 a área de proteção do logotipo e a do símbolo ficaram numa página só
// (a 10), e a paleta primária passou à 14. Citação com a numeração antiga leva a
// pessoa à página errada sem dar erro nenhum.
test("as citações usam a numeração da versão 0.3", () => {
  const tudo = fontes.map((f) => f.texto).join("\n");
  assert.doesNotMatch(tudo, /Manual, p\. 9\b|Área de proteção do símbolo · p\.|Cores, p\. 13|p\. 24–26|p\. 4–12/);
  // As citações "Manual, p. 10" e "Paleta de cores primárias · p. 14" moravam nas telas
  // desenhadas; agora são capturas reais. O que ainda se escreve usa a numeração nova.
  assert.match(tudo, /Área de proteção · p\. 10\b/);
  assert.match(tudo, /Cores, p\. 14\b/);
});

test("o fólio e a contagem do manual são os da edição de demonstração", () => {
  const folios = fontes.flatMap(({ arquivo, texto }) =>
    [...texto.matchAll(/<span>(\d+) \/ (\d+)<\/span>/g)].map((m) => ({ arquivo, total: Number(m[2]) })),
  );
  // O visualizador do manual agora é captura real (22–23/10/2026), com o fólio
  // dentro da própria imagem: não sobra fólio ESCRITO no código. Se um voltar,
  // tem de ser da edição de demonstração (42 páginas).
  for (const f of folios) assert.equal(f.total, PAGINAS_DA_DEMONSTRACAO, `fólio em ${f.arquivo}`);

  for (const { arquivo, texto } of fontes) {
    assert.doesNotMatch(texto, /manual v0\.2|64 páginas|\b00 Fundamentos\b/, `resto da v0.2 em ${arquivo}`);
  }
});
