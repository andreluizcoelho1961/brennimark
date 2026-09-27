import assert from "node:assert/strict";
import test from "node:test";
import type { ModelMessage } from "ai";
import { capacidadesDe } from "./catalogo";
import { MAXIMO_DE_PAGINAS_VISTAS, comPaginasVistas, modeloVePaginas, paginasParaVer } from "./paginas-para-ver";
import type { Trecho } from "./recuperacao";

const trecho = (inicio: number | null, fim: number | null): Trecho => ({
  documentSlug: `s${inicio}`, documentTitle: "t", groupName: "g", section: null,
  status: "draft", pageStart: inicio, pageEnd: fim, content: "x",
});

test("as páginas vêm na ordem da busca, sem repetir, até o máximo", () => {
  // O caso do ensaio: a busca traz a paleta (22, 21), cores (10), acessibilidade (11).
  assert.deepEqual(paginasParaVer([trecho(22, 22), trecho(21, 21), trecho(10, 10), trecho(11, 11), trecho(1, 3)]), [22, 21, 10, 11]);
  assert.equal(MAXIMO_DE_PAGINAS_VISTAS, 4);
  assert.deepEqual(paginasParaVer([trecho(5, 5), trecho(5, 5), trecho(6, 6)]), [5, 6]);
});

test("seção longa entra só pelas primeiras páginas; trecho sem página fica de fora", () => {
  assert.deepEqual(paginasParaVer([trecho(18, 25)]), [18, 19, 20]);
  assert.deepEqual(paginasParaVer([trecho(null, null), trecho(7, null)]), [7]);
});

test("o Gemini vê as páginas; o Groq gratuito não (teto por minuto)", () => {
  assert.equal(modeloVePaginas(capacidadesDe("google", "gemini-3.6-flash")), true);
  assert.equal(modeloVePaginas(capacidadesDe("groq", "qwen/qwen3.8-27b")), false);
  assert.equal(modeloVePaginas(null), false);
});

test("as imagens vão só na ÚLTIMA pergunta, com o aviso de que a imagem vale mais", () => {
  const mensagens: ModelMessage[] = [
    { role: "user", content: "primeira" },
    { role: "assistant", content: "resposta" },
    { role: "user", content: "Quantas cores tem a marca?" },
  ];
  const bytes = new Uint8Array([1, 2, 3]);
  const saida = comPaginasVistas(mensagens, [{ pagina: 22, bytes }, { pagina: 21, bytes }], false);
  assert.equal(saida.length, 3);
  assert.equal(saida[0].content, "primeira", "o histórico não recebe imagem");
  const partes = saida[2].content as { type: string; text?: string; image?: unknown }[];
  assert.equal(partes[0].text, "Quantas cores tem a marca?");
  assert.match(partes[1].text ?? "", /páginas 22, 21/);
  assert.match(partes[1].text ?? "", /vale a imagem/);
  assert.equal(partes.filter((p) => p.type === "image").length, 2);
  assert.equal(mensagens[2].content, "Quantas cores tem a marca?", "as mensagens originais não mudam");
});

test("sem páginas vistas, as mensagens seguem iguais", () => {
  const mensagens: ModelMessage[] = [{ role: "user", content: "oi" }];
  assert.deepEqual(comPaginasVistas(mensagens, [], false), mensagens);
});
