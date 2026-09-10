import assert from "node:assert/strict";
import test from "node:test";
import { MAXIMO_DE_CAMINHOS, receberRastro, validarRastro, type PortasDoRastro } from "./rastro";

/**
 * A metade do servidor do rastro de arquivo sem destino.
 *
 * Duas propriedades decidem se o rastro vale alguma coisa: ele CHEGA ao log do
 * servidor, e ninguém escreve nesse log sobre a conta de outra pessoa.
 */

const CONTA = "55555555-5555-4555-8555-555555555555";
const OUTRA = "11111111-1111-4111-8111-111111111111";
const ATOR = "66666666-6666-4666-8666-666666666666";

const evento = (extra: Record<string, unknown> = {}) => ({
  origem: "fila",
  caminhos: [`${CONTA}/import/abc.pdf`],
  sqlstate: "42P10",
  ...extra,
});

function portas(opcoes: { ator?: { id: string } | null; membro?: boolean | null } = {}) {
  const linhas: Record<string, unknown>[] = [];
  const contasConsultadas: string[] = [];
  const p: PortasDoRastro = {
    async ator() {
      return "ator" in opcoes ? opcoes.ator! : { id: ATOR };
    },
    async membroDaConta(conta) {
      contasConsultadas.push(conta);
      return "membro" in opcoes ? opcoes.membro! : true;
    },
    registrar(linha) {
      linhas.push(linha);
    },
  };
  return { p, linhas, contasConsultadas };
}

// ─── O rastro chega ao log do servidor ─────────────────────────────────────

test("aviso válido de membro vira uma linha no log do servidor", async () => {
  const { p, linhas } = portas();
  const r = await receberRastro(evento(), p);

  assert.equal(r.status, 202);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].msg, "importacao_deixou_objeto_sem_destino");
  assert.equal(linhas[0].level, "error");
  assert.equal(linhas[0].origem, "fila");
  assert.equal(linhas[0].sqlstate, "42P10");
  assert.equal(linhas[0].conta, CONTA);
  assert.equal(linhas[0].conta_verificada, true);
  assert.deepEqual(linhas[0].caminhos, [`${CONTA}/import/abc.pdf`]);
});

/**
 * O ator vem da sessão. Um `ator` no corpo seria alguém declarando quem é —
 * e o log é o que se lê para saber quem estava importando quando o arquivo
 * ficou para trás.
 */
test("o ator da linha é o da sessão, e o corpo não influencia", async () => {
  const { p, linhas } = portas();
  await receberRastro(evento({ ator: OUTRA, conta_verificada: true }), p);
  assert.equal(linhas[0].ator, ATOR);
});

test("as três origens do importador são aceitas", async () => {
  for (const origem of ["envio", "fila", "imagens"]) {
    const { p, linhas } = portas();
    const r = await receberRastro(evento({ origem, sqlstate: null }), p);
    assert.equal(r.status, 202, origem);
    assert.equal(linhas[0].origem, origem);
  }
});

// ─── Ninguém escreve sobre a conta de outra pessoa ─────────────────────────

/**
 * O caso negativo que o CLAUDE.md exige de toda autorização: não basta provar
 * que o membro registra, é preciso provar que o não membro NÃO registra.
 */
test("quem não é membro da conta é recusado e nada é registrado", async () => {
  const { p, linhas } = portas({ membro: false });
  const r = await receberRastro(evento(), p);
  assert.equal(r.status, 404);
  assert.equal(linhas.length, 0);
});

test("sem sessão é 401, sem consultar a conta e sem registrar", async () => {
  const { p, linhas, contasConsultadas } = portas({ ator: null });
  const r = await receberRastro(evento(), p);
  assert.equal(r.status, 401);
  assert.equal(linhas.length, 0);
  assert.deepEqual(contasConsultadas, []);
});

test("a conta consultada é a do caminho, e não uma declarada", async () => {
  const { p, contasConsultadas } = portas();
  await receberRastro(evento({ conta: OUTRA }), p);
  assert.deepEqual(contasConsultadas, [CONTA]);
});

/**
 * Consulta de pertencimento que falhou: o rastro fica, marcado como não
 * verificado. Recusar perderia o aviso justamente quando o banco tropeça —
 * que é quando arquivos ficam sem destino.
 */
test("falha ao conferir a conta registra mesmo assim, marcado como não verificado", async () => {
  const { p, linhas } = portas({ membro: null });
  const r = await receberRastro(evento(), p);
  assert.equal(r.status, 202);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].conta_verificada, false);
});

// ─── A forma do aviso ──────────────────────────────────────────────────────

test("caminhos de contas diferentes no mesmo aviso são recusados", () => {
  const v = validarRastro(evento({ caminhos: [`${CONTA}/a.pdf`, `${OUTRA}/b.pdf`] }));
  assert.equal(v.ok, false);
});

test("caminho que não começa por uma conta, ou que tenta subir, é recusado", () => {
  for (const ruim of ["import/a.pdf", `/${CONTA}/a.pdf`, `${CONTA}/../${OUTRA}/a.pdf`, "", 7]) {
    assert.equal(validarRastro(evento({ caminhos: [ruim] })).ok, false, String(ruim));
  }
});

test("origem fora do vocabulário, lista vazia ou longa demais são recusadas", () => {
  assert.equal(validarRastro(evento({ origem: "outra" })).ok, false);
  assert.equal(validarRastro(evento({ caminhos: [] })).ok, false);
  const demais = Array.from({ length: MAXIMO_DE_CAMINHOS + 1 }, (_, i) => `${CONTA}/${i}.png`);
  assert.equal(validarRastro(evento({ caminhos: demais })).ok, false);
  assert.equal(validarRastro(null).ok, false);
  assert.equal(validarRastro("texto").ok, false);
});

/**
 * O SQLSTATE é diagnóstico, não autorização. Fora do formato, vira `null` — e
 * o aviso segue, porque os caminhos são o que importa.
 */
test("sqlstate fora do formato vira null, sem derrubar o aviso", () => {
  for (const ruim of ["drop table", "4", 42, undefined]) {
    const v = validarRastro(evento({ sqlstate: ruim }));
    assert.equal(v.ok, true, String(ruim));
    if (v.ok) assert.equal(v.evento.sqlstate, null);
  }
  const pgrst = validarRastro(evento({ sqlstate: "PGRST202" }));
  assert.equal(pgrst.ok && pgrst.evento.sqlstate, "PGRST202");
});

test("corpo inválido é 400 e não chega a consultar sessão nem conta", async () => {
  const { p, linhas, contasConsultadas } = portas();
  const r = await receberRastro({ origem: "fila" }, p);
  assert.equal(r.status, 400);
  assert.equal(linhas.length, 0);
  assert.deepEqual(contasConsultadas, []);
});
