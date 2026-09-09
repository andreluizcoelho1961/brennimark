/**
 * O Safari não itera `ReadableStream` com `for await`. O pdf.js precisa disso.
 *
 * ─── O defeito, medido ───────────────────────────────────────────────────
 *
 * `PDFPageProxy.getTextContent()` — o caminho central do importador — faz:
 *
 *     const readableStream = this.streamTextContent(params);
 *     for await (const value of readableStream) { … }
 *
 * `for await` exige `Symbol.asyncIterator` no protótipo do stream. Chrome e
 * Firefox implementam; **o Safari não**. Em Safari 26.6.2 o resultado é
 * `TypeError: undefined is not a function (near '...value of readableStream...')`,
 * lançado de dentro do `getTextContent`.
 *
 * Consequência: **nenhum PDF jamais importou em Safari**. Não era limite de
 * tamanho, PDF corrompido, MIME do worker nem versão do navegador — todas
 * essas hipóteses foram levantadas e derrubadas por medição antes desta.
 *
 * ─── Por que aqui, e não trocando de build ───────────────────────────────
 *
 * A saída óbvia seria o build `legacy` do pdf.js, que existe para navegadores
 * mais velhos. Não serve: o corpo de `getTextContent` é **byte a byte idêntico**
 * nos dois builds. O legacy transpila sintaxe; isto é lacuna de API em tempo de
 * execução, e nenhuma transpilação a preenche.
 *
 * ─── Por que o protótipo, e não só o nosso ponto de uso ──────────────────
 *
 * Dá para contornar só no importador, lendo `streamTextContent()` com
 * `getReader()` à mão. Corrigiria o ponto que estourou — e deixaria de pé o
 * outro `for await` sobre stream que a biblioteca tem, ainda não exercitado
 * porque aquele caminho não roda no Safari até aqui passar.
 *
 * Preencher a lacuna na plataforma corrige a classe do problema. O custo está
 * declarado: isto altera um protótipo global, e passa a valer para toda a
 * página. É aceitável porque o que se instala é **exatamente o comportamento
 * que a especificação já define** e que os outros navegadores já têm — não um
 * comportamento nosso — e só quando ele falta.
 */

/**
 * Instala `Symbol.asyncIterator` no protótipo, se faltar.
 *
 * Recebe o protótipo em vez de buscá-lo sozinho para poder ser testado sem
 * navegador: em Node o `ReadableStream` já itera, então um teste que dependesse
 * do global passaria por vacuidade — provaria o ambiente, não o código.
 *
 * Devolve `true` quando instalou, `false` quando não era preciso. Nunca
 * sobrescreve uma implementação existente: onde o navegador cumpre a
 * especificação, quem manda é ele.
 */
export function tornarStreamIteravel(prototipo: unknown): boolean {
  if (prototipo === null || typeof prototipo !== "object") return false;

  const alvo = prototipo as Record<symbol, unknown> & {
    getReader?: () => {
      read(): Promise<{ done: boolean; value?: unknown }>;
      cancel(motivo?: unknown): Promise<void>;
      releaseLock(): void;
    };
  };

  if (typeof alvo.getReader !== "function") return false;
  if (alvo[Symbol.asyncIterator]) return false;

  alvo[Symbol.asyncIterator] = function (this: typeof alvo) {
    const leitor = this.getReader!();
    let liberado = false;

    // A trava do leitor precisa sair em TODAS as saídas — fim natural, `break`
    // e exceção. Um stream que fica travado não pode ser lido de novo, e o
    // pdf.js relê o mesmo documento para renderizar página como imagem.
    const liberar = () => {
      if (liberado) return;
      liberado = true;
      try {
        leitor.releaseLock();
      } catch {
        // Já liberado ou já encerrado: não há o que fazer, e propagar aqui
        // mascararia o erro real que motivou a saída do laço.
      }
    };

    return {
      async next() {
        const { done, value } = await leitor.read();
        if (done) {
          liberar();
          return { done: true as const, value: undefined };
        }
        return { done: false as const, value };
      },
      // `for await` chama isto ao sair antes do fim: `break`, `return` ou
      // exceção no corpo do laço.
      async return(valor?: unknown) {
        try {
          await leitor.cancel();
        } finally {
          liberar();
        }
        return { done: true as const, value: valor };
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  };

  return true;
}

/**
 * Aplica o remendo ao `ReadableStream` do ambiente, quando existe.
 *
 * Chamado antes de carregar o pdf.js, não no topo do módulo: o custo é uma
 * verificação de propriedade, e amarrar isso ao carregamento do módulo faria
 * um efeito colateral global acontecer em qualquer import — inclusive no
 * servidor, onde não é preciso.
 */
export function prepararAmbienteDePdf(): void {
  if (typeof ReadableStream === "undefined") return;
  tornarStreamIteravel(ReadableStream.prototype);
}
