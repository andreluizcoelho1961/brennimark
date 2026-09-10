import assert from "node:assert/strict";
import test from "node:test";
import { TETO_DA_FATIA } from "./range";
import { servirDocumentoFonte, type PortasDoDocumento } from "./servir";

/**
 * A rota REAL do transporte, com Storage e banco controlados.
 *
 * Por que existe: a única cobertura anterior vinha de `/dev/fixture`, que é
 * OUTRA rota — sem sessão, sem RLS, sem conferência de caminho canônico.
 * Testar a rota de desenvolvimento e chamar isso de teste do transporte foi a
 * lacuna apontada na revisão de 10/09.
 *
 * Aqui o objeto de teste é a rota de produção. As portas são falsas para que
 * os casos que importam — fatia acima do teto, caminho adulterado, sessão
 * ausente, 416, 304 — não dependam de rede nem de banco de pé.
 */

const CONTA = "11111111-1111-4111-8111-111111111111";
const IMPORT = "22222222-2222-4222-8222-222222222222";
const HASH = "a".repeat(64);
const ID = "33333333-3333-4333-8333-333333333333";
const CANONICO = `${CONTA}/${IMPORT}/${HASH}.pdf`;
const TAMANHO = 10 * 1024 * 1024; // 10 MiB: bem acima do teto de fatia

/** O que a origem recebeu, para o teste poder afirmar sobre o PEDIDO. */
type Registro = { url: string; range: string | null; metodo: string };

function portas(
  opcoes: {
    linha?: Partial<{ import_id: string; storage_path: string; pdf_sha256: string; workspace_id: string }> | null;
    erro?: unknown;
    token?: string | undefined;
    resposta?: (pedido: Registro) => Response;
  } = {},
): { portas: PortasDoDocumento; recebido: Registro[] } {
  const recebido: Registro[] = [];

  const linha =
    opcoes.linha === null
      ? null
      : {
          import_id: IMPORT,
          storage_path: CANONICO,
          pdf_sha256: HASH,
          workspace_id: CONTA,
          ...(opcoes.linha ?? {}),
        };

  return {
    recebido,
    portas: {
      async documento() {
        return { linha, error: opcoes.erro ?? null };
      },
      async token() {
        return "token" in opcoes ? opcoes.token : "jwt-de-teste";
      },
      endereco: (caminho) => `https://storage.exemplo/${caminho}`,
      apikey: "chave-anon",
      async buscar(url, init) {
        const cabecalhos = new Headers(init.headers as HeadersInit);
        const pedido: Registro = {
          url,
          range: cabecalhos.get("range"),
          metodo: String(init.method ?? "GET"),
        };
        recebido.push(pedido);
        return opcoes.resposta ? opcoes.resposta(pedido) : respostaDeFatia(pedido);
      },
    },
  };
}

/** Uma origem que honra `Range` corretamente, como o Storage faz. */
function respostaDeFatia(pedido: Registro): Response {
  if (!pedido.range) {
    return new Response(new Uint8Array(0), {
      status: 200,
      headers: { "content-length": String(TAMANHO), "accept-ranges": "bytes" },
    });
  }
  const casou = /^bytes=(\d*)-(\d*)$/.exec(pedido.range)!;
  const inicio = casou[1] === "" ? TAMANHO - Number(casou[2]) : Number(casou[1]);
  const fim = casou[1] === "" ? TAMANHO - 1 : Math.min(Number(casou[2]), TAMANHO - 1);
  const quantos = fim - inicio + 1;
  return new Response(new Uint8Array(Math.max(quantos, 0)), {
    status: 206,
    headers: {
      "content-range": `bytes ${inicio}-${fim}/${TAMANHO}`,
      "content-length": String(quantos),
      "accept-ranges": "bytes",
    },
  });
}

const pedir = (range?: string, metodo: "GET" | "HEAD" = "GET") =>
  new Request(`https://app.exemplo/api/documento-fonte/${ID}?b=marca`, {
    method: metodo,
    headers: range ? { Range: range } : undefined,
  });

// ─── O caso que o briefing exige explicitamente ────────────────────────────

/**
 * Um pedido acima do teto devolve 206 com fatia aparada — NUNCA 502.
 *
 * A regressão: a rota repassava o `Range` original ao Storage e só conferia o
 * tamanho depois. A origem devolvia mais que o teto, a conferência acusava
 * divergência, e a resposta era 502.
 */
test("pedido acima do teto devolve 206 aparado, nunca 502", async () => {
  const { portas: p, recebido } = portas();
  const r = await servirDocumentoFonte(pedir("bytes=0-9999999"), { id: ID, metodo: "GET" }, p);

  assert.equal(r.status, 206);
  assert.equal(r.headers.get("content-range"), `bytes 0-${TETO_DA_FATIA - 1}/${TAMANHO}`);
  assert.equal(r.headers.get("content-length"), String(TETO_DA_FATIA));
  // E a origem recebeu o pedido JÁ APARADO: é isso que evita o corpo grande.
  assert.equal(recebido[0].range, `bytes=0-${TETO_DA_FATIA - 1}`);
});

test("intervalo aberto vai à origem com fim explícito no teto", async () => {
  const { portas: p, recebido } = portas();
  const r = await servirDocumentoFonte(pedir("bytes=1000-"), { id: ID, metodo: "GET" }, p);

  assert.equal(r.status, 206);
  assert.equal(recebido[0].range, `bytes=1000-${1000 + TETO_DA_FATIA - 1}`);
});

test("sufixo acima do teto vira sufixo do teto", async () => {
  const { portas: p, recebido } = portas();
  const r = await servirDocumentoFonte(pedir("bytes=-9999999"), { id: ID, metodo: "GET" }, p);

  assert.equal(r.status, 206);
  assert.equal(recebido[0].range, `bytes=-${TETO_DA_FATIA}`);
});

/**
 * A garantia ABSOLUTA que o briefing exige: nenhuma resposta acima do teto.
 *
 * Inclui o caso sem `Range`, que é o que matava a função em produção — a rota
 * começava a repassar 10 MiB e a função morria no meio, entregando corpo
 * truncado com `content-length` cheio: um PDF corrompido sem aviso.
 */
test("nenhuma resposta desta rota passa do teto de fatia", async () => {
  for (const range of ["bytes=0-9999999", "bytes=-9999999", "bytes=500-", undefined]) {
    const { portas: p } = portas();
    const r = await servirDocumentoFonte(pedir(range), { id: ID, metodo: "GET" }, p);
    const corpo = Number(r.headers.get("content-length") ?? 0);
    assert.ok(
      corpo <= TETO_DA_FATIA,
      `range ${range} devolveu ${corpo}, acima do teto de ${TETO_DA_FATIA}`,
    );
  }
});

test("GET sem Range num documento grande é recusado, e diz o que fazer", async () => {
  const { portas: p } = portas();
  const r = await servirDocumentoFonte(pedir(), { id: ID, metodo: "GET" }, p);

  assert.equal(r.status, 413);
  const corpo = (await r.json()) as { error: string; detalhe: string };
  assert.equal(corpo.error, "peca_por_intervalo");
  // A mensagem nomeia o remédio: sem isso, quem integra fica sem saída.
  assert.match(corpo.detalhe, /HEAD/);
  assert.match(corpo.detalhe, /Range/);
});

/**
 * Documento ABAIXO do teto continua sendo servido inteiro numa requisição só.
 * Proibir isso encareceria o manual pequeno sem ganho nenhum.
 */
test("documento pequeno sem Range é servido inteiro", async () => {
  const PEQUENO = 1024 * 512;
  const { portas: p } = portas({
    resposta: () =>
      new Response(new Uint8Array(PEQUENO), {
        status: 200,
        headers: { "content-length": String(PEQUENO), "accept-ranges": "bytes" },
      }),
  });
  const r = await servirDocumentoFonte(pedir(), { id: ID, metodo: "GET" }, p);

  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-length"), String(PEQUENO));
});

// ─── Semântica de intervalo preservada ─────────────────────────────────────

test("intervalo dentro do teto atravessa intacto", async () => {
  const { portas: p, recebido } = portas();
  const r = await servirDocumentoFonte(pedir("bytes=0-1023"), { id: ID, metodo: "GET" }, p);

  assert.equal(r.status, 206);
  assert.equal(r.headers.get("content-range"), `bytes 0-1023/${TAMANHO}`);
  assert.equal(recebido[0].range, "bytes=0-1023");
  assert.equal(r.headers.get("accept-ranges"), "bytes");
});

test("416 da origem atravessa com Content-Range", async () => {
  const { portas: p } = portas({
    resposta: () =>
      new Response(null, {
        status: 416,
        headers: { "content-range": `bytes */${TAMANHO}` },
      }),
  });
  const r = await servirDocumentoFonte(pedir("bytes=99999999-"), { id: ID, metodo: "GET" }, p);

  assert.equal(r.status, 416);
  assert.equal(r.headers.get("content-range"), `bytes */${TAMANHO}`);
});

/**
 * 304 é SUCESSO e atravessa sem corpo. Já foi tratado como 502 uma vez, e o
 * defeito só aparecia no SEGUNDO carregamento.
 */
test("304 atravessa com os validadores", async () => {
  const { portas: p } = portas({
    resposta: () => new Response(null, { status: 304, headers: { etag: '"abc"' } }),
  });
  const r = await servirDocumentoFonte(pedir(), { id: ID, metodo: "GET" }, p);

  assert.equal(r.status, 304);
  assert.equal(r.headers.get("etag"), '"abc"');
});

test("If-None-Match NÃO atravessa quando há intervalo", async () => {
  // Ele podia render 304, e 304 não tem corpo: o cliente pede bytes e recebe
  // nada, e o PDF.js espera um pedaço que nunca chega.
  const { portas: p, recebido } = portas();
  const requisicao = new Request(`https://app.exemplo/api/documento-fonte/${ID}?b=marca`, {
    headers: { Range: "bytes=0-1023", "If-None-Match": '"abc"' },
  });
  await servirDocumentoFonte(requisicao, { id: ID, metodo: "GET" }, p);

  assert.equal(recebido.length, 1);
  assert.equal(recebido[0].range, "bytes=0-1023");
});

test("HEAD responde sem corpo e informa o tamanho", async () => {
  const { portas: p, recebido } = portas({
    resposta: () =>
      new Response(null, {
        status: 200,
        headers: { "content-length": String(TAMANHO), "accept-ranges": "bytes" },
      }),
  });
  const r = await servirDocumentoFonte(pedir(undefined, "HEAD"), { id: ID, metodo: "HEAD" }, p);

  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-length"), String(TAMANHO));
  assert.equal(recebido[0].metodo, "HEAD");
  assert.equal(await r.text(), "");
});

// ─── Autorização e procedência ─────────────────────────────────────────────

test("sem sessão, 401 e a origem NÃO é tocada", async () => {
  const { portas: p, recebido } = portas({ token: undefined });
  const r = await servirDocumentoFonte(pedir("bytes=0-1023"), { id: ID, metodo: "GET" }, p);

  assert.equal(r.status, 401);
  assert.equal(recebido.length, 0);
});

/**
 * "Não existe", "não é sua" e "sem sessão" respondem igual: responder
 * diferente confirmaria o endereço para quem está sondando.
 */
test("linha ausente é 404, sem tocar a origem", async () => {
  const { portas: p, recebido } = portas({ linha: null });
  const r = await servirDocumentoFonte(pedir(), { id: ID, metodo: "GET" }, p);

  assert.equal(r.status, 404);
  assert.equal(recebido.length, 0);
});

/**
 * A RLS protege a LINHA; ela não protege o objeto do Storage. Um
 * `storage_path` gravado errado — ou adulterado — leria o arquivo de outra
 * conta com a sessão de quem tem direito a esta.
 */
test("caminho fora do canônico é recusado, sem tocar a origem", async () => {
  const { portas: p, recebido } = portas({
    linha: { storage_path: "outra-conta/outro-import/deadbeef.pdf" },
  });
  const r = await servirDocumentoFonte(pedir("bytes=0-1023"), { id: ID, metodo: "GET" }, p);

  assert.equal(r.status, 409);
  assert.equal(recebido.length, 0);
});

test("id fora do formato é 404 antes de qualquer consulta", async () => {
  const { portas: p, recebido } = portas();
  const r = await servirDocumentoFonte(pedir(), { id: "nao-e-uuid", metodo: "GET" }, p);

  assert.equal(r.status, 404);
  assert.equal(recebido.length, 0);
});

test("sem marca na URL é 409", async () => {
  const { portas: p } = portas();
  const requisicao = new Request(`https://app.exemplo/api/documento-fonte/${ID}`);
  const r = await servirDocumentoFonte(requisicao, { id: ID, metodo: "GET" }, p);

  assert.equal(r.status, 409);
});

test("falha do banco é 500, e não 404 — a diferença importa para o cliente", async () => {
  const { portas: p } = portas({ erro: new Error("conexão caiu") });
  const r = await servirDocumentoFonte(pedir(), { id: ID, metodo: "GET" }, p);

  assert.equal(r.status, 500);
});

// ─── A tradução de credencial vencida ──────────────────────────────────────

test("400, 401 e 403 da origem viram 401, que o cliente sabe retomar", async () => {
  for (const status of [400, 401, 403]) {
    const { portas: p } = portas({ resposta: () => new Response(null, { status }) });
    const r = await servirDocumentoFonte(pedir("bytes=0-1023"), { id: ID, metodo: "GET" }, p);
    assert.equal(r.status, 401, `origem ${status} deveria virar 401`);
  }
});

test("500 da origem vira 502 — o defeito é de lá, não da sessão", async () => {
  const { portas: p } = portas({ resposta: () => new Response(null, { status: 500 }) });
  const r = await servirDocumentoFonte(pedir("bytes=0-1023"), { id: ID, metodo: "GET" }, p);

  assert.equal(r.status, 502);
});

// ─── Cabeçalhos de produto ─────────────────────────────────────────────────

test("ver não é baixar, e o cache não mente sobre a representação", async () => {
  const { portas: p } = portas();
  const r = await servirDocumentoFonte(pedir("bytes=0-1023"), { id: ID, metodo: "GET" }, p);

  assert.equal(r.headers.get("content-disposition"), "inline");
  // Sem `immutable`: esta URL serve intervalos diferentes, e `immutable`
  // descreve uma representação completa que não varia.
  assert.doesNotMatch(r.headers.get("cache-control") ?? "", /immutable/);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.match(r.headers.get("server-timing") ?? "", /autorizacao;dur=\d+/);
});
