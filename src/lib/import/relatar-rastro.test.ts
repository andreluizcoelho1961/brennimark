import assert from "node:assert/strict";
import test from "node:test";
import {
  LIMITE_DO_LOTE_BYTES,
  ORCAMENTO_KEEPALIVE_BYTES,
  montarLotes,
  relatarObjetoSemDestino,
} from "./relatar-rastro";
import { MAXIMO_DE_CAMINHOS, MAXIMO_DO_CAMINHO } from "./rastro";

const CONTA = "55555555-5555-4555-8555-555555555555";
const bytes = (s: string) => new TextEncoder().encode(s).length;

/** Um caminho de exatamente `MAXIMO_DO_CAMINHO` caracteres — o pior caso que a rota aceita. */
const caminhoMaximo = (i: number, recheio = "x") => {
  const prefixo = `${CONTA}/${String(i).padStart(4, "0")}/`;
  return (prefixo + recheio.repeat(MAXIMO_DO_CAMINHO)).slice(0, MAXIMO_DO_CAMINHO);
};

type Pedido = { url: string; init: RequestInit };

function capturar(status = 202, falhar = false) {
  const pedidos: Pedido[] = [];
  const buscar = (async (url: string, init: RequestInit) => {
    pedidos.push({ url, init });
    if (falhar) throw new TypeError("Failed to fetch");
    return new Response("{}", { status });
  }) as unknown as typeof fetch;
  return { buscar, pedidos };
}

/**
 * Um `fetch` que só responde quando mandado — é o que simula a aba fechando
 * com pedidos ainda em voo. O que importa medir é quantos pedidos NASCERAM
 * antes de qualquer resposta.
 */
function emVoo() {
  const pedidos: Pedido[] = [];
  const liberar: (() => void)[] = [];
  const buscar = ((url: string, init: RequestInit) => {
    pedidos.push({ url, init });
    return new Promise<Response>((resolve) =>
      liberar.push(() => resolve(new Response("{}", { status: 202 }))),
    );
  }) as unknown as typeof fetch;
  return { buscar, pedidos, liberarTodos: () => liberar.forEach((f) => f()) };
}

/** O console de antes continua; o teste o silencia para não sujar a saída. */
function semConsole<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  return fn().finally(() => {
    console.error = original;
  });
}

// ─── O caminho feliz ───────────────────────────────────────────────────────

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

test("o console de antes continua sendo escrito, com todos os caminhos", async () => {
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
test("rede caída, recusa da rota ou fetch que lança não lançam, e dizem que não chegou", async () => {
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
  const sincrono = (() => {
    throw new TypeError("síncrono");
  }) as unknown as typeof fetch;
  assert.equal(
    await semConsole(() => relatarObjetoSemDestino({ origem: "envio", caminhos: [`${CONTA}/a`] }, sincrono)),
    false,
  );
});

// ─── O teto do keepalive ───────────────────────────────────────────────────

/**
 * O pior caso que a rota aceita: `MAXIMO_DE_CAMINHOS` caminhos de
 * `MAXIMO_DO_CAMINHO` caracteres — ~100 KiB. Loteado por QUANTIDADE, isso
 * era um lote só, acima do teto de 64 KiB, e o pedido keepalive inteiro seria
 * recusado pelo navegador.
 */
test("caminhos máximos: todo lote fica abaixo do limite, em bytes e em quantidade", () => {
  const caminhos = Array.from({ length: MAXIMO_DE_CAMINHOS }, (_, i) => caminhoMaximo(i));
  assert.equal(caminhos[0].length, MAXIMO_DO_CAMINHO, "o caminho de teste está no teto");
  const lotes = montarLotes({ origem: "imagens", caminhos });

  assert.ok(lotes.length > 1, "o pior caso não cabe num lote só");
  for (const corpo of lotes) {
    assert.ok(bytes(corpo) <= LIMITE_DO_LOTE_BYTES, `lote de ${bytes(corpo)} bytes`);
    assert.ok(JSON.parse(corpo).caminhos.length <= MAXIMO_DE_CAMINHOS);
  }
  const enviados = lotes.flatMap((c) => JSON.parse(c).caminhos as string[]);
  assert.deepEqual(enviados, caminhos, "nenhum caminho perdido nem fora de ordem");
});

/**
 * Bytes, e não caracteres: "ç" são dois bytes em UTF-8, "€" três, e um
 * caractere fora do plano básico quatro. Medir `length` subestimaria o corpo.
 */
test("caracteres de vários bytes são medidos em bytes UTF-8", () => {
  for (const recheio of ["ç", "€", "𝄞"]) {
    const caminhos = Array.from({ length: 60 }, (_, i) => caminhoMaximo(i, recheio));
    const lotes = montarLotes({ origem: "envio", caminhos });
    for (const corpo of lotes) {
      assert.ok(bytes(corpo) <= LIMITE_DO_LOTE_BYTES, `${recheio}: lote de ${bytes(corpo)} bytes`);
    }
    const enviados = lotes.flatMap((c) => JSON.parse(c).caminhos as string[]);
    assert.deepEqual(enviados, caminhos, `${recheio}: nenhum caminho perdido`);
  }
});

/**
 * O teto é da SOMA dos keepalive em voo. Com todos os lotes disparados juntos,
 * a soma dos que vão com keepalive não pode passar do orçamento — senão o
 * navegador recusa os últimos. O excedente sai sem keepalive, mas sai.
 */
test("a soma dos lotes com keepalive cabe no orçamento, e o excedente ainda é enviado", async () => {
  const caminhos = Array.from({ length: MAXIMO_DE_CAMINHOS }, (_, i) => caminhoMaximo(i));
  const { buscar, pedidos } = capturar();
  await semConsole(() => relatarObjetoSemDestino({ origem: "imagens", caminhos }, buscar));

  const comKeepalive = pedidos.filter((p) => p.init.keepalive === true);
  const soma = comKeepalive.reduce((s, p) => s + bytes(String(p.init.body)), 0);
  assert.ok(soma <= ORCAMENTO_KEEPALIVE_BYTES, `keepalive somado: ${soma} bytes`);
  assert.ok(ORCAMENTO_KEEPALIVE_BYTES < 64 * 1024, "o orçamento deixa margem abaixo do teto da especificação");
  assert.ok(comKeepalive.length >= 1, "o primeiro lote sempre tem keepalive");
  assert.ok(pedidos.some((p) => p.init.keepalive === false), "o pior caso passa do orçamento");

  const enviados = pedidos.flatMap((p) => JSON.parse(String(p.init.body)).caminhos as string[]);
  assert.deepEqual(enviados, caminhos, "o excedente também é enviado");
});

// ─── Todos nascem antes de qualquer espera ─────────────────────────────────

/**
 * O descarregamento da página: se o segundo lote esperasse a resposta do
 * primeiro, fechar a aba no meio impediria o segundo de nascer — e keepalive
 * só protege pedido que já existe. Aqui nenhum pedido responde, e todos
 * precisam ter nascido mesmo assim.
 */
test("vários lotes: todos os pedidos nascem antes de qualquer resposta", async () => {
  const caminhos = Array.from({ length: MAXIMO_DE_CAMINHOS }, (_, i) => caminhoMaximo(i));
  const esperados = montarLotes({ origem: "imagens", caminhos }).length;
  assert.ok(esperados > 1, "o cenário precisa de vários lotes");
  const { buscar, pedidos, liberarTodos } = emVoo();

  const original = console.error;
  console.error = () => {};
  try {
    const promessa = relatarObjetoSemDestino({ origem: "imagens", caminhos }, buscar);
    // Nenhuma resposta chegou ainda, e nenhum `await` foi resolvido.
    assert.equal(pedidos.length, esperados, "todos os lotes em voo antes da primeira resposta");
    liberarTodos();
    assert.equal(await promessa, true);
  } finally {
    console.error = original;
  }
});

test("caminho acima do teto da rota fica fora do envio e não derruba o lote", () => {
  const longo = `${CONTA}/${"y".repeat(MAXIMO_DO_CAMINHO)}`;
  const lotes = montarLotes({ origem: "envio", caminhos: [`${CONTA}/a.pdf`, longo, `${CONTA}/b.pdf`] });
  assert.equal(lotes.length, 1);
  assert.deepEqual(JSON.parse(lotes[0]).caminhos, [`${CONTA}/a.pdf`, `${CONTA}/b.pdf`]);
});
