import { MAXIMO_DE_CAMINHOS, MAXIMO_DO_CAMINHO, type EventoDeRastro } from "./rastro";

/**
 * A metade do navegador do rastro de arquivo sem destino.
 *
 * Duas coisas, nesta ordem, e as duas sempre:
 *
 *   1. o `console.error` de antes, com TODOS os caminhos, para quem estiver
 *      com o console aberto;
 *   2. o aviso à rota do servidor, que é o que chega a um log consultável.
 *
 * O aviso nasce justamente quando uma publicação falhou, e quem vê a falha
 * costuma fechar a aba ou importar de novo. `keepalive` é o que deixa um
 * pedido sobreviver à saída da página — e ele tem um teto que decide o
 * desenho inteiro deste módulo.
 *
 * ─── O teto do keepalive é da SOMA, não do pedido ──────────────────────
 *
 * Fetch Standard, no passo de rede: "If the sum of contentLength and
 * inflightKeepaliveBytes is greater than 64 kibibytes, then return a network
 * error", onde `inflightKeepaliveBytes` soma os corpos de TODOS os pedidos
 * keepalive ainda em voo no mesmo grupo. Lotes de até 64 KiB disparados juntos
 * estourariam o teto no segundo ou no terceiro, e esses seriam recusados.
 *
 * Então:
 *
 *   - os lotes são medidos em BYTES UTF-8 do JSON, e não em quantidade de
 *     caminhos — 200 caminhos de 512 caracteres dariam ~100 KiB num lote só;
 *   - o aviso inteiro gasta no máximo `ORCAMENTO_KEEPALIVE_BYTES` de keepalive,
 *     com margem para outro pedido keepalive que a página tenha em voo;
 *   - lote que não cabe no orçamento sai SEM keepalive: nasce junto e chega se
 *     a página continuar viva. Mandar com keepalive seria garantir que falhe.
 *
 * ─── Todos nascem antes de qualquer espera ─────────────────────────────
 *
 * Os pedidos são criados todos antes do primeiro `await`. Se o segundo lote
 * esperasse a resposta do primeiro, fechar a aba no meio impediria o segundo
 * de sequer existir — e keepalive só protege o pedido que já nasceu.
 *
 * NUNCA lança. Uma falha do aviso não pode virar falha da tela de importação.
 */

/** Teto de um lote. Pequeno, para que um lote recusado perca pouco. */
export const LIMITE_DO_LOTE_BYTES = 16 * 1024;

/**
 * Quanto do teto de 64 KiB do keepalive este aviso pode ocupar. Os 8 KiB que
 * sobram são margem para outro pedido keepalive que a página tenha em voo —
 * o teto é do grupo inteiro, não deste módulo.
 */
export const ORCAMENTO_KEEPALIVE_BYTES = 56 * 1024;

const codificador = new TextEncoder();
const bytesDe = (texto: string) => codificador.encode(texto).length;

/**
 * Os corpos dos lotes, já serializados, na ordem dos caminhos.
 *
 * Cada lote respeita os dois tetos da rota — `MAXIMO_DE_CAMINHOS` e
 * `LIMITE_DO_LOTE_BYTES` — medindo o corpo JSON de verdade, com escapes e
 * caracteres de vários bytes. Um caminho acima de `MAXIMO_DO_CAMINHO` fica de
 * fora do envio: a rota o recusaria e levaria o lote inteiro junto. Ele
 * continua no console.
 */
export function montarLotes(evento: EventoDeRastro): string[] {
  const corpo = (caminhos: string[]) =>
    JSON.stringify({
      origem: evento.origem,
      caminhos,
      ...(evento.sqlstate ? { sqlstate: evento.sqlstate } : {}),
    });

  const lotes: string[] = [];
  let atual: string[] = [];
  for (const caminho of evento.caminhos) {
    if (typeof caminho !== "string" || caminho.length > MAXIMO_DO_CAMINHO) continue;
    const tentativa = [...atual, caminho];
    const estoura =
      tentativa.length > MAXIMO_DE_CAMINHOS || bytesDe(corpo(tentativa)) > LIMITE_DO_LOTE_BYTES;
    if (estoura && atual.length > 0) {
      lotes.push(corpo(atual));
      atual = [caminho];
    } else {
      atual = tentativa;
    }
  }
  if (atual.length > 0) lotes.push(corpo(atual));
  return lotes;
}

export async function relatarObjetoSemDestino(
  evento: EventoDeRastro,
  buscar: typeof fetch = fetch,
): Promise<boolean> {
  console.error(
    JSON.stringify({
      level: "error",
      msg: "importacao_deixou_objeto_sem_destino",
      origem: evento.origem,
      caminhos: evento.caminhos,
      ...(evento.sqlstate ? { sqlstate: evento.sqlstate } : {}),
    }),
  );

  const lotes = montarLotes(evento);
  if (lotes.length === 0) return false;

  // Todos os pedidos nascem aqui, antes do primeiro `await`.
  let gasto = 0;
  const pedidos = lotes.map((corpo) => {
    const tamanho = bytesDe(corpo);
    const keepalive = gasto + tamanho <= ORCAMENTO_KEEPALIVE_BYTES;
    if (keepalive) gasto += tamanho;
    try {
      return Promise.resolve(
        buscar("/api/importacao/rastro", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: corpo,
          keepalive,
        }),
      ).then(
        (resposta) => resposta.ok,
        () => false,
      );
    } catch {
      // `fetch` pode lançar de forma síncrona; o aviso nunca lança.
      return Promise.resolve(false);
    }
  });

  const chegaram = await Promise.all(pedidos);
  return chegaram.every(Boolean);
}
