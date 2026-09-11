import assert from "node:assert/strict";
import test from "node:test";
import {
  lerSecoesDaMarca,
  TAMANHO_DA_PAGINA,
  type LeitorDeFaixa,
  type PaginaDeSecoes,
} from "./secoes-da-marca";
import { slugify } from "../import/draft";

/**
 * A leitura das seções de uma marca, por páginas.
 *
 * O que estes testes protegem não é desempenho: é a diferença entre um mapa
 * COMPLETO e um mapa que parece completo. Um slug ausente do mapa vira página
 * sem seção, o vínculo fecha, e a idempotência por `sha256` impede qualquer
 * repetição de corrigir. Mapa parcial é estrutura errada gravada para sempre.
 */

/** Um banco de seções, e um leitor que pagina de verdade sobre ele. */
function bancoDeSecoes(quantas: number, nomeDaSecao: (i: number) => string) {
  const linhas: PaginaDeSecoes[] = Array.from({ length: quantas }, (_, i) => ({
    id: `id-${String(i).padStart(6, "0")}`,
    slug: nomeDaSecao(i),
  }));

  const idas: [number, number][] = [];
  const ler: LeitorDeFaixa = async (de, ate) => {
    idas.push([de, ate]);
    // `range` é fechado dos dois lados, como o do Supabase.
    return { dados: linhas.slice(de, ate + 1), erro: null };
  };

  return { linhas, ler, idas };
}

// ─── A escala real ─────────────────────────────────────────────────────────

/**
 * 300 seções com slugs no comprimento máximo.
 *
 * `slugify` corta em 60 caracteres, e `agrupar` permite até 500 seções. Este
 * é o caso que motivou a mudança: num `.in(...)`, 300 slugs de 60 caracteres
 * passam de 18 KB só de slugs na query string, antes do escapamento — e o
 * teto de linha de requisição varia por proxy, balanceador e servidor.
 */
test("300 seções com slugs longos são todas resolvidas", async () => {
  const longo = (i: number) =>
    slugify(`Seção ${i} de aplicações da marca em suportes impressos e digitais`);
  const { linhas, ler, idas } = bancoDeSecoes(300, longo);

  // O pior caso é real: o slug bate no corte de 60 de `slugify`.
  assert.equal(linhas[0].slug.length, 60, "o slug precisa estar no comprimento máximo");

  const { dados, erro } = await lerSecoesDaMarca(ler);

  assert.equal(erro, null);
  assert.ok(dados);
  assert.equal(dados.size, 300, "nenhuma seção pode ficar de fora");
  for (const linha of linhas) assert.equal(dados.get(linha.slug), linha.id);
  // 300 cabe numa página; a segunda ida não é feita porque a primeira veio
  // curta, que é o sinal de fim.
  assert.equal(idas.length, 1);
});

/**
 * O teto do produto: 500 seções é exatamente `MAXIMO_DE_SECOES`, e cai na
 * fronteira do tamanho da página — a primeira volta CHEIA, então o laço não
 * pode concluir que terminou.
 */
test("500 seções, na fronteira exata da página, vêm completas", async () => {
  const { linhas, ler, idas } = bancoDeSecoes(TAMANHO_DA_PAGINA, (i) => `secao-${i}`);
  const { dados, erro } = await lerSecoesDaMarca(ler);

  assert.equal(erro, null);
  assert.equal(dados?.size, TAMANHO_DA_PAGINA);
  assert.equal(dados?.get(linhas[499].slug), linhas[499].id);
  assert.equal(idas.length, 2, "página cheia obriga a confirmar com outra ida");
  assert.deepEqual(idas[1], [TAMANHO_DA_PAGINA, TAMANHO_DA_PAGINA * 2 - 1]);
});

/**
 * Acima de `max_rows` do PostgREST — 1000 nesta instalação.
 *
 * Buscar todas as seções numa ida só resolveria o tamanho da URL e traria
 * outro silêncio: o PostgREST TRUNCA em `max_rows` sem erro. O teto de 500 da
 * importação não protege disto, porque a curadoria acrescenta documentos
 * depois e nada promete que o total continue abaixo.
 */
test("mais seções que max_rows continuam completas, pela paginação", async () => {
  const quantas = 1300;
  const { linhas, ler, idas } = bancoDeSecoes(quantas, (i) => `secao-${i}`);
  const { dados, erro } = await lerSecoesDaMarca(ler);

  assert.equal(erro, null);
  assert.equal(dados?.size, quantas);
  assert.equal(dados?.get("secao-1299"), linhas[1299].id);
  assert.equal(idas.length, 3);
});

test("marca sem nenhuma seção devolve mapa vazio, e não erro", async () => {
  const { ler } = bancoDeSecoes(0, (i) => `secao-${i}`);
  const { dados, erro } = await lerSecoesDaMarca(ler);

  assert.equal(erro, null);
  assert.equal(dados?.size, 0);
});

// ─── Erro nunca vira mapa parcial ──────────────────────────────────────────

/**
 * A regra que dá sentido ao módulo: um erro no meio da paginação NÃO devolve o
 * que já foi lido. Um mapa parcial é indistinguível de uma marca com menos
 * seções, e a diferença entre os dois é uma publicação com a estrutura errada
 * gravada para sempre.
 */
test("erro na segunda página descarta o que já tinha sido lido", async () => {
  const banco = bancoDeSecoes(1300, (i) => `secao-${i}`);
  let ida = 0;
  const ler: LeitorDeFaixa = async (de, ate) => {
    ida += 1;
    if (ida === 2) return { dados: null, erro: { code: "08006", message: "caiu" } };
    return banco.ler(de, ate);
  };

  const { dados, erro } = await lerSecoesDaMarca(ler);

  assert.equal(dados, null, "nada de mapa parcial");
  assert.equal((erro as { code?: string })?.code, "08006");
});

test("erro na primeira página é erro, e não mapa vazio", async () => {
  const { dados, erro } = await lerSecoesDaMarca(async () => ({
    dados: null,
    erro: { code: "08006" },
  }));

  assert.equal(dados, null);
  assert.ok(erro);
});

/**
 * Porta que devolve `{ dados: null, erro: null }` — um `select` que retornou
 * nada sem se explicar. Não é mapa vazio: mapa vazio é uma AFIRMAÇÃO sobre a
 * marca, e aqui não há afirmação nenhuma.
 */
test("dados nulos sem erro declarado ainda são erro", async () => {
  const { dados, erro } = await lerSecoesDaMarca(async () => ({ dados: null, erro: null }));

  assert.equal(dados, null);
  assert.ok(erro);
});

/**
 * Uma porta que ignora o `range` e sempre devolve página cheia giraria para
 * sempre. O teto do laço a interrompe — e devolve ERRO, não o mapa acumulado,
 * porque um mapa que não se sabe completo é o desfecho que este módulo existe
 * para impedir.
 */
test("porta que nunca devolve página curta termina em erro, não em mapa", async () => {
  let idas = 0;
  const { dados, erro } = await lerSecoesDaMarca(async (de) => {
    idas += 1;
    return {
      dados: Array.from({ length: TAMANHO_DA_PAGINA }, (_, i) => ({
        id: `id-${de + i}`,
        slug: `secao-${de + i}`,
      })),
      erro: null,
    };
  });

  assert.equal(dados, null);
  assert.match(String((erro as Error)?.message), /não terminou/);
  assert.ok(idas < 1000, "o laço tem que parar sozinho");
});

// ─── Detalhes que a paginação exige ────────────────────────────────────────

test("as faixas pedidas são contíguas e fechadas dos dois lados", async () => {
  const { idas } = bancoDeSecoes(1300, (i) => `s-${i}`);
  const banco = bancoDeSecoes(1300, (i) => `s-${i}`);
  await lerSecoesDaMarca(banco.ler);

  assert.deepEqual(banco.idas, [
    [0, TAMANHO_DA_PAGINA - 1],
    [TAMANHO_DA_PAGINA, TAMANHO_DA_PAGINA * 2 - 1],
    [TAMANHO_DA_PAGINA * 2, TAMANHO_DA_PAGINA * 3 - 1],
  ]);
  assert.equal(idas.length, 0, "o banco de controle não foi lido");
});

/**
 * `brand_documents` garante slug único por marca, mas depender disso aqui
 * seria depender de uma garantia que vive em outro arquivo. Se duas linhas
 * chegarem com o mesmo slug, a primeira vence — e o resultado não depende de
 * qual página terminou por último.
 */
test("slug repetido entre páginas não sobrescreve o primeiro", async () => {
  const primeira: PaginaDeSecoes[] = Array.from({ length: TAMANHO_DA_PAGINA }, (_, i) => ({
    id: `a-${i}`,
    slug: i === 0 ? "cores" : `secao-${i}`,
  }));
  const segunda: PaginaDeSecoes[] = [{ id: "b-0", slug: "cores" }];

  let ida = 0;
  const { dados } = await lerSecoesDaMarca(async () => {
    ida += 1;
    return { dados: ida === 1 ? primeira : segunda, erro: null };
  });

  assert.equal(dados?.get("cores"), "a-0");
});

test("linha sem slug é ignorada, e não entra como chave vazia", async () => {
  const { dados } = await lerSecoesDaMarca(async () => ({
    dados: [
      { id: "a", slug: "cores" },
      { id: "b", slug: "" },
    ] as PaginaDeSecoes[],
    erro: null,
  }));

  assert.equal(dados?.size, 1);
  assert.equal(dados?.has(""), false);
});
