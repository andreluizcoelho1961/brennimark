import assert from "node:assert/strict";
import test from "node:test";
import { linhasDaTroca } from "./guardar-conversa";

/**
 * O defeito de 23/09: a pergunta ia sem `paginas`, `regras` e `incompleta`, o
 * cliente do Supabase preencheu com `null` no lote, e o `not null` derrubou as
 * duas mensagens. Nenhuma troca foi guardada em produção. Reproduzido contra o
 * banco local: `23502 null value in column "paginas"`.
 */
test("as duas linhas da troca têm exatamente as mesmas colunas", () => {
  const [pergunta, resposta] = linhasDaTroca({
    conversaId: "c", brandId: "b", autor: "a", pergunta: "foto de escritório",
    resposta: { conteudo: "Commercial product photograph…", tipo: "prompt" },
  });
  assert.deepEqual(Object.keys(pergunta).sort(), Object.keys(resposta).sort());
});

test("nenhuma coluna com default no banco vai como null ou ausente", () => {
  for (const linha of linhasDaTroca({
    conversaId: "c", brandId: "b", autor: "a", pergunta: "p",
    resposta: { conteudo: "r", tipo: "resposta" },
  })) {
    assert.deepEqual(linha.paginas, {});
    assert.deepEqual(linha.regras, []);
    assert.equal(linha.incompleta, false);
  }
});

test("a resposta leva páginas, regras e o aviso de incompleta que recebeu", () => {
  const [, resposta] = linhasDaTroca({
    conversaId: "c", brandId: "b", autor: "a", pergunta: "p",
    resposta: { conteudo: "r", tipo: "prompt", paginas: { cores: 12 }, regras: [{ slug: "cores" }], incompleta: true },
  });
  assert.deepEqual(resposta.paginas, { cores: 12 });
  assert.deepEqual(resposta.regras, [{ slug: "cores" }]);
  assert.equal(resposta.incompleta, true);
});
