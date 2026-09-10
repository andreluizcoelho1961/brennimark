import { MAXIMO_DE_CAMINHOS, type EventoDeRastro } from "./rastro";

/**
 * A metade do navegador do rastro de arquivo sem destino.
 *
 * Duas coisas, nesta ordem, e as duas sempre:
 *
 *   1. o `console.error` de antes, para quem estiver com o console aberto;
 *   2. o aviso à rota do servidor, que é o que chega a um log consultável.
 *
 * `keepalive` porque este aviso nasce justamente quando uma publicação falhou,
 * e quem vê a falha costuma fechar a aba ou importar de novo. Sem ele, o
 * navegador cancela o pedido na saída da página e o rastro morre com ela.
 *
 * NUNCA lança. Um aviso que falha não pode transformar uma falha de limpeza
 * numa falha da tela: o importador segue mostrando a mensagem ao usuário, e o
 * que se perde, no pior caso, é o próprio aviso — que já estava perdido antes.
 */
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

  /*
   * Em lotes, pelo mesmo teto que a rota aceita. Um aviso com mais caminhos
   * seria recusado inteiro por ela — e perder todos para não mandar alguns
   * seria o pior dos dois.
   */
  let tudoChegou = true;
  for (let i = 0; i < evento.caminhos.length; i += MAXIMO_DE_CAMINHOS) {
    const lote = { ...evento, caminhos: evento.caminhos.slice(i, i + MAXIMO_DE_CAMINHOS) };
    try {
      const resposta = await buscar("/api/importacao/rastro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(lote),
        keepalive: true,
      });
      if (!resposta.ok) tudoChegou = false;
    } catch {
      tudoChegou = false;
    }
  }
  return tudoChegou;
}
