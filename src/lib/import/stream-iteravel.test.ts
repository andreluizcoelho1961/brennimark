import assert from "node:assert/strict";
import test from "node:test";
import { tornarStreamIteravel } from "./stream-iteravel";

/**
 * O teste não pode usar o `ReadableStream` do Node.
 *
 * Node itera stream com `for await` desde sempre, então um teste contra o
 * global passaria mesmo com a função vazia — provaria o ambiente, não o
 * código. O que derruba o Safari é a AUSÊNCIA do iterador, e é ela que precisa
 * ser encenada aqui.
 *
 * `StreamSemIterador` é a menor peça que reproduz o Safari: tem `getReader()`
 * e não tem `Symbol.asyncIterator`.
 */
class StreamSemIterador {
  constructor(private readonly pedacos: unknown[]) {}

  liberado = false;
  cancelado = false;

  getReader() {
    let i = 0;
    // Arrow functions de propósito: `this` léxico dispensa alias e mantém o
    // duble legível.
    return {
      read: async () =>
        i >= this.pedacos.length
          ? { done: true, value: undefined }
          : { done: false, value: this.pedacos[i++] },
      cancel: async () => {
        this.cancelado = true;
      },
      releaseLock: () => {
        this.liberado = true;
      },
    };
  }
}

test("sem o remendo, `for await` sobre o stream quebra — é o defeito do Safari", async () => {
  const stream = new StreamSemIterador(["a", "b"]);
  await assert.rejects(
    async () => {
      // @ts-expect-error é exatamente o que o pdf.js faz, e o que o Safari recusa
      for await (const _ of stream) void _;
    },
    (erro: unknown) => erro instanceof TypeError,
    "sem `Symbol.asyncIterator` o laço precisa lançar TypeError; se não lançar, o teste não está encenando o Safari",
  );
});

test("com o remendo, o stream itera na ordem e por completo", async () => {
  const stream = new StreamSemIterador(["a", "b", "c"]);
  assert.equal(tornarStreamIteravel(Object.getPrototypeOf(stream)), true);

  const vistos: unknown[] = [];
  // @ts-expect-error o remendo instala o iterador em tempo de execução
  for await (const pedaco of stream) vistos.push(pedaco);

  assert.deepEqual(vistos, ["a", "b", "c"]);
  assert.equal(stream.liberado, true, "a trava do leitor precisa sair no fim natural");
});

test("sair do laço no meio cancela e libera — stream travado não é relido", async () => {
  // O pdf.js reabre o mesmo documento para renderizar página como imagem. Um
  // leitor que fica com a trava presa transforma uma saída antecipada num
  // defeito silencioso na próxima leitura.
  class Outro extends StreamSemIterador {}
  const stream = new Outro(["a", "b", "c"]);
  tornarStreamIteravel(Object.getPrototypeOf(stream));

  const vistos: unknown[] = [];
  // @ts-expect-error o remendo instala o iterador em tempo de execução
  for await (const pedaco of stream) {
    vistos.push(pedaco);
    break;
  }

  assert.deepEqual(vistos, ["a"]);
  assert.equal(stream.cancelado, true, "sair no meio precisa cancelar o stream");
  assert.equal(stream.liberado, true, "sair no meio precisa liberar a trava");
});

test("nunca sobrescreve quem já cumpre a especificação", () => {
  // Onde o navegador implementa, quem manda é ele. Substituir por uma versão
  // nossa trocaria a implementação testada da plataforma por 20 linhas.
  const proprio = async function* () {};
  const prototipo = { getReader: () => ({}), [Symbol.asyncIterator]: proprio };

  assert.equal(tornarStreamIteravel(prototipo), false);
  assert.equal(prototipo[Symbol.asyncIterator], proprio);
});

test("ignora o que não é stream", () => {
  // A função recebe um protótipo qualquer; instalar o iterador em algo sem
  // `getReader` criaria um objeto que se anuncia iterável e falha ao iterar.
  assert.equal(tornarStreamIteravel(null), false);
  assert.equal(tornarStreamIteravel(undefined), false);
  assert.equal(tornarStreamIteravel({}), false);
  assert.equal(tornarStreamIteravel({ getReader: "não é função" }), false);
});
