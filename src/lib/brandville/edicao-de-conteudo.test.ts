import assert from "node:assert/strict";
import test from "node:test";

import {
  criarPedidoDeEdicao, interpretarEdicao, LIMITE_DA_REQUISICAO_EM_BYTES, LIMITE_DO_TITULO,
} from "./edicao-de-conteudo";
import type { DocPageEntry } from "../../content/docs";

/**
 * O item 3: uma seção que a importação aceita precisa ser editável.
 *
 * O defeito tinha duas metades. A rota exigia o corpo inteiro em toda edição,
 * então renomear obrigava a reenviar o texto; e recusava mais de 40 parágrafos
 * ou qualquer parágrafo acima de 4.000 caracteres, limites que a importação
 * não impõe. Juntas, tornavam uma seção de 41 linhas impossível de alterar —
 * inclusive no título, que nem é texto do manual.
 */

const GRUPOS = ["Manual", "Aplicações"];
const bytes = (o: unknown) => Buffer.byteLength(JSON.stringify(o));

function interpretar(entrada: Record<string, unknown>) {
  return interpretarEdicao(entrada, { gruposValidos: GRUPOS, bytesDaRequisicao: bytes(entrada) });
}

/** Uma seção como a importação produz: mais de 40 linhas, uma delas enorme. */
function secaoImportada() {
  const linhas = Array.from({ length: 41 }, (_, i) => `Parágrafo ${i + 1} do manual importado.`);
  linhas[7] = "A".repeat(4500);
  return linhas;
}

// ─── Atualização parcial ───────────────────────────────────────────────────

test("campo omitido fica intocado — não vem na atualização", () => {
  const r = interpretar({ slug: "cores", title: "Cores da marca" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.campos, { title: "Cores da marca" });
  assert.equal("body" in r.campos, false, "corpo omitido não pode aparecer na atualização");
  assert.equal("status" in r.campos, false);
  assert.equal("group" in r.campos, false);
});

test("renomear NÃO exige reenviar o corpo — é o caso que dava 400", () => {
  /*
   * O caminho exato do defeito: a pessoa abre a administração de uma seção de
   * 41 linhas, muda só o título e salva. Antes, o editor reenviava o corpo
   * inteiro e a rota reprovava o corpo — uma alteração que nem tocava no texto
   * exigia reduzir o manual do cliente.
   */
  const r = interpretar({ slug: "cores", title: "Cores institucionais" });
  assert.equal(r.ok, true);
});

test("mudar grupo e status sem corpo funciona", () => {
  const r = interpretar({ slug: "cores", group: "Aplicações", status: "ready" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.campos, { group: "Aplicações", status: "ready" });
});

test("uma alteração que não muda nada é recusada", () => {
  // Sem isto, um PUT só com o slug faria um UPDATE vazio que ainda assim
  // mexeria em updated_at e no histórico de versões.
  const r = interpretar({ slug: "cores" });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.status, 400);
});

test("sem slug não há o que editar", () => {
  const r = interpretar({ title: "Cores" });
  assert.equal(r.ok, false);
});

// ─── O conteúdo que a importação aceita continua editável ──────────────────

test("41 parágrafos, um deles com 4.500 caracteres, é aceito", () => {
  // Os dois limites antigos de uma vez: contagem acima de 40 e parágrafo acima
  // de 4.000. A importação produz isto; a edição precisa aceitar.
  const body = secaoImportada();
  const r = interpretar({ slug: "cores", body });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.campos.body?.length, 41);
  assert.equal(r.campos.body?.[7].length, 4500);
});

test("nada é truncado — o texto que entra é o texto que sai", () => {
  /*
   * A guarda contra a "correção" tentadora: aceitar o corpo grande e cortá-lo
   * para caber. Truncar conteúdo de terceiro para contornar um limite nosso é
   * perda silenciosa, e pior que a recusa que existia antes.
   */
  const body = secaoImportada();
  const r = interpretar({ slug: "cores", body });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.campos.body, body);
});

test("alterar só o título preserva o corpo integralmente", () => {
  // A prova da metade parcial: o corpo não vem, logo não pode ser alterado
  // nem por acidente. O que a rota não recebe, ela não grava.
  const r = interpretar({ slug: "cores", title: "Outro título" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.campos.body, undefined);
});

test("corpo é preservado exatamente — inclusive espaços e entradas vazias", () => {
  const body = [" primeira ", "   ", "", "segunda"];
  const r = interpretar({ slug: "cores", body });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.campos.body, body);
});

// ─── O teto passa a ser de requisição ──────────────────────────────────────

test("payload abusivo é recusado com 413, não com 400", () => {
  /*
   * 413 e não 400 porque a distinção importa para quem recebe: 400 diz "seu
   * conteúdo está errado" e leva a pessoa a mexer no manual; 413 diz "isto não
   * cabe numa requisição", que é problema de transporte, não de conteúdo.
   */
  const r = interpretarEdicao(
    { slug: "cores", body: ["x"] },
    { gruposValidos: GRUPOS, bytesDaRequisicao: LIMITE_DA_REQUISICAO_EM_BYTES + 1 },
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.status, 413);
});

test("exatamente no teto ainda passa — o limite é inclusivo", () => {
  const r = interpretarEdicao(
    { slug: "cores", body: ["x"] },
    { gruposValidos: GRUPOS, bytesDaRequisicao: LIMITE_DA_REQUISICAO_EM_BYTES },
  );
  assert.equal(r.ok, true);
});

test("a referência observada cabe com margem, sem ser tratada como teto do produto", () => {
  /*
   * A fixture de escala mediu 388.006 caracteres de texto. É uma referência
   * concreta para regressão, não a afirmação de que nenhum PDF válido produzirá
   * mais conteúdo. O teto continua abaixo dos 4,5 MB da plataforma para que a
   * recusa tenha mensagem do produto.
   */
  const REFERENCIA_OBSERVADA = 388_006;
  const TETO_DA_PLATAFORMA = 4.5 * 1024 * 1024;
  assert.ok(LIMITE_DA_REQUISICAO_EM_BYTES > REFERENCIA_OBSERVADA * 2, "a fixture perdeu a margem observada");
  assert.ok(LIMITE_DA_REQUISICAO_EM_BYTES < TETO_DA_PLATAFORMA, "acima do teto da plataforma");
});

test("campo desconhecido é recusado em vez de produzir falso sucesso", () => {
  assert.equal(interpretar({ slug: "cores", title: "Cores", blocks: [] }).ok, false);
  assert.equal(interpretar({ slug: "cores", body: ["texto"], images: [] }).ok, false);
});

// ─── Contrato estreito do AdminPanel ───────────────────────────────────────

const PERSISTIDA: DocPageEntry = {
  slug: "cores",
  group: "Manual",
  title: "Cores",
  status: "draft",
  body: ["Texto original."],
  images: [{ src: "/imagem.jpg", alt: "Referência" }],
  blocks: [{ kind: "callout", text: "Regra estruturada." }],
};

test("painel envia só o título alterado — nunca imagens, blocos ou corpo", () => {
  const pedido = criarPedidoDeEdicao({ ...PERSISTIDA, title: "Cores institucionais" }, PERSISTIDA);
  assert.deepEqual(pedido, { slug: "cores", title: "Cores institucionais" });
  assert.equal("body" in pedido!, false);
  assert.equal("images" in pedido!, false);
  assert.equal("blocks" in pedido!, false);
});

test("painel envia conjuntamente somente os campos editáveis que mudaram", () => {
  const pedido = criarPedidoDeEdicao(
    { ...PERSISTIDA, group: "Aplicações", status: "ready", body: ["Texto novo."] },
    PERSISTIDA,
  );
  assert.deepEqual(pedido, {
    slug: "cores",
    group: "Aplicações",
    status: "ready",
    body: ["Texto novo."],
  });
});

test("painel não cria requisição quando nada editável mudou", () => {
  assert.equal(criarPedidoDeEdicao({ ...PERSISTIDA }, PERSISTIDA), null);
  // Campos visuais pertencem a outro editor; diferença neles não pode fazer
  // esta tela prometer uma persistência que sua API não oferece.
  assert.equal(criarPedidoDeEdicao({ ...PERSISTIDA, blocks: [] }, PERSISTIDA), null);
});

// ─── O que continua sendo validado ─────────────────────────────────────────

test("título vazio ou longo demais é recusado", () => {
  assert.equal(interpretar({ slug: "c", title: "" }).ok, false);
  assert.equal(interpretar({ slug: "c", title: "x".repeat(LIMITE_DO_TITULO + 1) }).ok, false);
  assert.equal(interpretar({ slug: "c", title: "x".repeat(LIMITE_DO_TITULO) }).ok, true);
});

test("grupo fora da navegação da marca é recusado", () => {
  // Seção válida é a da marca, não uma string qualquer do cliente.
  assert.equal(interpretar({ slug: "c", group: "Inventada" }).ok, false);
});

test("status fora do vocabulário é recusado", () => {
  assert.equal(interpretar({ slug: "c", status: "publicado" as never }).ok, false);
});

test("corpo que não é lista de texto é recusado", () => {
  assert.equal(interpretar({ slug: "c", body: "texto solto" }).ok, false);
  assert.equal(interpretar({ slug: "c", body: [1, 2] }).ok, false);
});

test("presença é diferente de tipo — null explícito não passa por ausência", () => {
  /*
   * `title: null` acompanhado de uma alteração VÁLIDA. É o par que separa as
   * duas leituras possíveis:
   *
   *   - por PRESENÇA (`"title" in e`): o título está presente e é inválido, e
   *     a alteração inteira é recusada;
   *   - por TIPO (`typeof e.title !== "undefined"`): o título é tratado como
   *     ausente, o corpo é gravado, e quem pediu para limpar o título recebe
   *     "salvo" sem que nada tenha acontecido com ele.
   *
   * A primeira versão deste teste mandava só `{slug, title: null}` — e passava
   * nas duas leituras, porque sem outro campo a alteração era recusada de
   * qualquer forma por não mudar nada. Passava pelo motivo errado.
   */
  const r = interpretar({ slug: "c", title: null, body: ["texto que seria gravado"] });
  assert.equal(r.ok, false, "título inválido não pode ser tratado como ausente");
});
