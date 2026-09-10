import assert from "node:assert/strict";
import test from "node:test";
import { relatarObjetoSemDestino } from "./relatar-rastro";
import { MAXIMO_DE_CAMINHOS } from "./rastro";

const CONTA = "55555555-5555-4555-8555-555555555555";

function capturar(status = 202, falhar = false) {
  const pedidos: { url: string; init: RequestInit }[] = [];
  const buscar = (async (url: string, init: RequestInit) => {
    pedidos.push({ url, init });
    if (falhar) throw new TypeError("Failed to fetch");
    return new Response("{}", { status });
  }) as unknown as typeof fetch;
  return { buscar, pedidos };
}

/** O console de antes continua; o teste o silencia para não sujar a saída. */
function semConsole<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  return fn().finally(() => {
    console.error = original;
  });
}

test("o aviso vai à rota do servidor, com keepalive", async () => {
  const { buscar, pedidos } = capturar();
  const ok = await semConsole(() =>
    relatarObjetoSemDestino({ origem: "fila", caminhos: [`${CONTA}/a.pdf`], sqlstate: "42P10" }, buscar),
  );

  assert.equal(ok, true);
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].url, "/api/importacao/rastro");
  assert.equal(pedidos[0].init.method, "POST");
  // Sem keepalive, o navegador cancela o pedido quando a aba fecha — e o
  // aviso nasce justamente quando alguém está prestes a fechar a aba.
  assert.equal(pedidos[0].init.keepalive, true);
  assert.deepEqual(JSON.parse(String(pedidos[0].init.body)), {
    origem: "fila",
    caminhos: [`${CONTA}/a.pdf`],
    sqlstate: "42P10",
  });
});

test("o console de antes continua sendo escrito", async () => {
  const { buscar } = capturar();
  const escrito: string[] = [];
  const original = console.error;
  console.error = (m: string) => escrito.push(m);
  try {
    await relatarObjetoSemDestino({ origem: "imagens", caminhos: [`${CONTA}/x.png`] }, buscar);
  } finally {
    console.error = original;
  }
  assert.equal(escrito.length, 1);
  assert.match(escrito[0], /importacao_deixou_objeto_sem_destino/);
});

/**
 * Nunca lança. Uma falha do aviso não pode virar falha da tela de importação:
 * o que se perde no pior caso é o próprio aviso, que antes já se perdia.
 */
test("rede caída ou recusa da rota não lançam, e dizem que não chegou", async () => {
  const caida = capturar(202, true);
  assert.equal(
    await semConsole(() => relatarObjetoSemDestino({ origem: "envio", caminhos: [`${CONTA}/a`] }, caida.buscar)),
    false,
  );
  const recusada = capturar(401);
  assert.equal(
    await semConsole(() => relatarObjetoSemDestino({ origem: "envio", caminhos: [`${CONTA}/a`] }, recusada.buscar)),
    false,
  );
});

/**
 * A rota recusa inteiro um aviso acima do teto. Mandar em lotes evita perder
 * todos os caminhos para não mandar alguns.
 */
test("caminhos acima do teto vão em lotes, e nenhum se perde", async () => {
  const { buscar, pedidos } = capturar();
  const caminhos = Array.from({ length: MAXIMO_DE_CAMINHOS + 5 }, (_, i) => `${CONTA}/${i}.png`);
  await semConsole(() => relatarObjetoSemDestino({ origem: "imagens", caminhos }, buscar));

  assert.equal(pedidos.length, 2);
  const enviados = pedidos.flatMap((p) => JSON.parse(String(p.init.body)).caminhos as string[]);
  assert.deepEqual(enviados, caminhos);
});
