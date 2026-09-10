import assert from "node:assert/strict";
import test from "node:test";
import { registrarImportacao } from "./registrar-do-navegador";
import { relatarConclusao, relatarPendenciaDeSecao } from "./conclusao-da-publicacao";

/**
 * A classificação da resposta, do lado do navegador.
 *
 * Um único defeito importa aqui acima de todos: declarar sucesso quando o
 * manifesto não foi registrado. A interface fecha a tela e navega quando este
 * módulo diz `ok`, e a partir daí ninguém descobre que faltou algo.
 */

function respondendo(status: number, corpo: unknown): typeof fetch {
  return (async () =>
    new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

const PEDIDO = { marca: "padaria", importId: "88888888-8888-4888-8888-888888888888" };

test("o pedido leva duas cordas, e nada de manifesto", async () => {
  let corpoEnviado = "";
  const buscar = (async (_url: string, init?: RequestInit) => {
    corpoEnviado = String(init?.body ?? "");
    return new Response(JSON.stringify({ documentoId: "doc-1", paginas: 3 }), { status: 200 });
  }) as unknown as typeof fetch;

  await registrarImportacao(PEDIDO, buscar);
  assert.deepEqual(JSON.parse(corpoEnviado), {
    marca: "padaria",
    import_id: PEDIDO.importId,
  });
});

test("resposta completa é sucesso, com as contagens", async () => {
  const r = await registrarImportacao(
    PEDIDO,
    respondendo(200, { documentoId: "doc-1", paginas: 743, paginasSemSecao: 12, jaEstava: false }),
  );

  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.paginas, 743);
    assert.equal(r.paginasSemSecao, 12);
    assert.equal(r.jaEstava, false);
  }
});

/**
 * O defeito que este módulo existe para impedir: 200 sem `documentoId`.
 *
 * Um proxy que devolve página de erro com status 200, uma versão de servidor
 * que mudou o corpo, uma resposta truncada — todos chegariam como sucesso e a
 * interface navegaria para uma marca sem manifesto registrado.
 */
test("200 sem documentoId NÃO é sucesso", async () => {
  for (const corpo of [{}, { documentoId: "" }, { documentoId: 7 }, { paginas: 3 }]) {
    const r = await registrarImportacao(PEDIDO, respondendo(200, corpo));
    assert.equal(r.ok, false, JSON.stringify(corpo));
    if (!r.ok) assert.equal(r.repetivel, true);
  }
});

test("corpo ilegível com status bom não é sucesso", async () => {
  const r = await registrarImportacao(PEDIDO, respondendo(200, "<html>proxy</html>"));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.repetivel, true);
});

/**
 * Rede caída antes de haver resposta é o caso em que NÃO se sabe se a
 * transação aconteceu — e é a razão de a repetição precisar ser idempotente.
 */
test("rede caída é falha temporária e repetível", async () => {
  const buscar = (async () => {
    throw new TypeError("Failed to fetch");
  }) as unknown as typeof fetch;

  const r = await registrarImportacao(PEDIDO, buscar);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.codigo, "falha_temporaria");
    assert.equal(r.repetivel, true);
  }
});

test("o código e o repetível do servidor atravessam", async () => {
  const r = await registrarImportacao(
    PEDIDO,
    respondendo(403, { codigo: "sem_permissao", repetivel: false }),
  );

  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.codigo, "sem_permissao");
    assert.equal(r.repetivel, false);
  }
});

/**
 * Erro sem declaração de repetibilidade — um 502 de gateway, que nem chegou à
 * rota — é tratado como repetível: a operação é idempotente, e o erro seguro
 * entre os dois é oferecer a tentativa.
 */
test("erro sem corpo conhecido é repetível", async () => {
  const r = await registrarImportacao(PEDIDO, respondendo(502, {}));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.codigo, "falha_temporaria");
    assert.equal(r.repetivel, true);
  }
});

// ─── O relato na tela ──────────────────────────────────────────────────────

/**
 * Todo código do vocabulário fechado precisa de um relato nas duas línguas.
 * Um código sem entrada cairia no genérico, e o genérico oferece nova
 * tentativa — ou seja, um código permanente novo passaria a oferecer um botão
 * que falha sempre.
 */
test("todo código de falha tem relato nas duas línguas", () => {
  const codigos = [
    "nao_autenticado", "pedido_invalido", "marca_nao_encontrada",
    "importacao_nao_encontrada", "manifesto_ausente", "manifesto_invalido",
    "sem_permissao", "falha_ao_vincular", "falha_temporaria",
  ];

  for (const codigo of codigos) {
    const relato = relatarConclusao(codigo);
    assert.ok(relato.pt.length > 20, codigo);
    assert.ok(relato.en.length > 20, codigo);
    assert.notEqual(relato.pt, relato.en, codigo);
  }
});

/**
 * A interface diferencia repetível de permanente, e é este mapa que decide se
 * o botão aparece. Oferecer nova tentativa para "não administra a conta" faria
 * quem clica falhar de novo sem entender por quê.
 */
test("só as falhas repetíveis oferecem nova tentativa", () => {
  for (const codigo of ["falha_temporaria", "falha_ao_vincular"]) {
    assert.equal(relatarConclusao(codigo).ofereceNovaTentativa, true, codigo);
  }
  for (const codigo of [
    "sem_permissao", "nao_autenticado", "manifesto_ausente",
    "manifesto_invalido", "marca_nao_encontrada", "importacao_nao_encontrada",
    "pedido_invalido",
  ]) {
    assert.equal(relatarConclusao(codigo).ofereceNovaTentativa, false, codigo);
  }
});

test("código desconhecido cai no temporário, e não em texto vazio", () => {
  const relato = relatarConclusao("codigo_que_o_servidor_ganhou_depois");
  assert.equal(relato.ofereceNovaTentativa, true);
  assert.ok(relato.pt.length > 20);
});

/**
 * O relato nunca pode declarar que a marca não existe: neste ponto ela existe,
 * e é justamente o mal-entendido que faria alguém importar de novo e criar uma
 * segunda marca com a curadoria dividida entre as duas.
 */
test("nenhum relato sugere que a publicação falhou por inteiro", () => {
  const codigos = [
    "nao_autenticado", "marca_nao_encontrada", "importacao_nao_encontrada",
    "manifesto_ausente", "manifesto_invalido", "sem_permissao",
    "falha_ao_vincular", "falha_temporaria",
  ];
  for (const codigo of codigos) {
    const { pt } = relatarConclusao(codigo);
    assert.doesNotMatch(pt, /não foi publicad|falhou a publicação|tente publicar/i, codigo);
  }
});

test("pendência de seção só é relatada quando existe", () => {
  assert.equal(relatarPendenciaDeSecao(0, 100), null);
  assert.equal(relatarPendenciaDeSecao(-1, 100), null);

  const relato = relatarPendenciaDeSecao(12, 743);
  assert.ok(relato);
  assert.match(relato.pt, /12 de 743/);
  assert.match(relato.en, /12 of 743/);
});

/**
 * Páginas sem seção não são erro, e o texto não pode soar como um. Elas estão
 * registradas e medidas; o que falta é curadoria.
 */
test("a pendência de seção não é apresentada como perda", () => {
  const relato = relatarPendenciaDeSecao(5, 50);
  assert.ok(relato);
  assert.doesNotMatch(relato.pt, /perdid|erro|falh/i);
  assert.match(relato.pt, /registradas/);
});
