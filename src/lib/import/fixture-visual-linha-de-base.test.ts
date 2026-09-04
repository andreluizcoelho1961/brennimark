import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { detectarRepetidos } from "./texto";
import type { PaginaExtraida } from "./texto";
import { agrupar, paginasDe } from "./secoes";
import type { ItemDeOutline } from "./tipos";

/**
 * LINHA DE BASE — este arquivo afirma o comportamento ERRADO, de propósito.
 *
 * Ele não descreve o que o produto deve fazer. Ele trava, em número, o que o
 * produto FAZ hoje: das nove páginas da fixture visual, **três somem** — a
 * imagem achatada, a arte em cor sólida e a tipografia em curvas. As três são
 * identidade visual pura, e são descartadas porque não têm texto extraível
 * (`secoes.ts`, ramo de página sem linhas úteis).
 *
 * Por que travar um defeito num teste em vez de corrigi-lo agora: a correção
 * é o manifesto por página, que é decisão de esquema e pertence à Fatia 2. Sem
 * este registro, a perda continuaria invisível — nenhum teste do produto
 * chegava a olhar para páginas de arte, porque o manual real não tem nenhuma.
 *
 * **Quando o manifesto existir, este arquivo é substituído** por sua afirmação
 * oposta: nove entradas no manifesto, uma por página do PDF, e nenhuma
 * ausência silenciosa — uma página só sai do manual com tratamento declarado
 * (`blank` ou `excluded`) e motivo registrado.
 */
const CAMINHO = path.join(process.cwd(), "e2e", "fixtures", "manual-visual.pdf");

/** Réplica da extração de `lerPdf`, que não roda fora do navegador. */
async function extrair(): Promise<{ paginas: PaginaExtraida[]; outline: ItemDeOutline[] }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(CAMINHO)),
  }).promise;

  const paginas: PaginaExtraida[] = [];
  for (let numero = 1; numero <= doc.numPages; numero += 1) {
    const pagina = await doc.getPage(numero);
    const conteudo = await pagina.getTextContent();
    const [, , , alturaDaPagina] = pagina.view;
    paginas.push({
      numero,
      alturaDaPagina,
      itens: conteudo.items.flatMap((item) => {
        if (!("str" in item) || !item.str.trim()) return [];
        const [, , , escalaY, x, y] = item.transform;
        return [{
          texto: item.str,
          x,
          y,
          altura: Math.abs(escalaY) || item.height || 0,
          fonte: item.fontName ?? "",
        }];
      }),
    });
  }

  const bruto = (await doc.getOutline().catch(() => null)) as
    | { title?: string; dest?: unknown; items?: unknown[] }[]
    | null;

  const paginaDe = async (dest: unknown): Promise<number | null> => {
    try {
      const destino = typeof dest === "string" ? await doc.getDestination(dest) : dest;
      if (!Array.isArray(destino) || destino.length === 0) return null;
      return (await doc.getPageIndex(destino[0])) + 1;
    } catch {
      return null;
    }
  };

  const converter = async (
    itens: { title?: string; dest?: unknown; items?: unknown[] }[],
    nivel: number,
  ): Promise<ItemDeOutline[]> => {
    const saida: ItemDeOutline[] = [];
    for (const item of itens) {
      const titulo = (item.title ?? "").trim();
      if (!titulo) continue;
      saida.push({
        titulo,
        pagina: await paginaDe(item.dest),
        nivel,
        filhos: item.items?.length
          ? await converter(item.items as { title?: string; dest?: unknown; items?: unknown[] }[], nivel + 1)
          : [],
      });
    }
    return saida;
  };

  return { paginas, outline: bruto ? await converter(bruto, 0) : [] };
}

test("LINHA DE BASE (defeito): o pipeline atual perde 3 das 9 páginas da fixture", async () => {
  const { paginas, outline } = await extrair();
  const resultado = agrupar({ paginas, outline, repetidos: detectarRepetidos(paginas) });

  const cobertas = new Set<number>();
  for (const secao of resultado.secoes) {
    for (const numero of paginasDe(secao)) cobertas.add(numero);
  }
  const perdidas = paginas.map((p) => p.numero).filter((n) => !cobertas.has(n));

  assert.equal(paginas.length, 9, "a fixture deveria ter nove páginas");
  assert.equal(
    perdidas.length,
    3,
    `linha de base mudou: agora somem ${perdidas.length} páginas (${perdidas.join(", ")})`,
  );
  // Toda página perdida é descartada pelo mesmo motivo, e ele é registrado.
  assert.ok(
    resultado.ignoradas.every((i) => i.motivo === "sem-texto"),
    "apareceu um motivo de descarte diferente de sem-texto",
  );
});

test("LINHA DE BASE (defeito): a hierarquia de três níveis do índice é achatada", async () => {
  const { paginas, outline } = await extrair();

  const profundidade = (nos: readonly ItemDeOutline[]): number =>
    nos.length === 0 ? 0 : 1 + Math.max(...nos.map((no) => profundidade(no.filhos)));

  // A árvore CHEGA correta na fronteira do agrupamento…
  assert.equal(profundidade(outline), 3, "o índice do PDF deveria ter três níveis");

  // …e sai plana: seções não têm pai, nível nem qualquer vestígio da árvore.
  const resultado = agrupar({ paginas, outline, repetidos: detectarRepetidos(paginas) });
  const temHierarquia = resultado.secoes.some(
    (secao) => "nivel" in secao || "pai" in secao || "filhos" in secao,
  );
  assert.equal(
    temHierarquia,
    false,
    "surgiu hierarquia nas seções — se foi de propósito, esta linha de base venceu",
  );
});

test("LINHA DE BASE: o índice aponta para uma página que o pipeline descartou", async () => {
  const { paginas, outline } = await extrair();
  const resultado = agrupar({ paginas, outline, repetidos: detectarRepetidos(paginas) });

  const cobertas = new Set<number>();
  for (const secao of resultado.secoes) {
    for (const numero of paginasDe(secao)) cobertas.add(numero);
  }

  const destinos: number[] = [];
  const visitar = (nos: readonly ItemDeOutline[]) => {
    for (const no of nos) {
      if (no.pagina) destinos.push(no.pagina);
      visitar(no.filhos);
    }
  };
  visitar(outline);

  const orfaos = destinos.filter((pagina) => !cobertas.has(pagina));
  assert.ok(
    orfaos.length >= 1,
    "nenhum destino do índice ficou órfão — se o descarte acabou, esta linha de base venceu",
  );
});
