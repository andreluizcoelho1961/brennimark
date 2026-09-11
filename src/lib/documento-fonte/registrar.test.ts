import assert from "node:assert/strict";
import test from "node:test";
import {
  registrarDocumentoFonte,
  type PaginaDoRelatorio,
  type PortasDoRegistro,
  type RegistroDeImportacao,
} from "./registrar";

/**
 * O segundo passo da publicação, com banco e chave de serviço controlados.
 *
 * Dois testes decidem se a solução transitória é aceitável:
 *
 *   - o ciclo A passa / B falha / recarrega / repete / conclui, que é a
 *     condição imposta para aceitar duas transações não atômicas;
 *   - a distinção entre "consulta rodou e não achou" e "consulta não rodou",
 *     que era o defeito capaz de perder a estrutura de um manual em silêncio.
 */

const MARCA = "44444444-4444-4444-8444-444444444444";
const CONTA = "55555555-5555-4555-8555-555555555555";
const ATOR = "66666666-6666-4666-8666-666666666666";
const SECAO = "77777777-7777-4777-8777-777777777777";
const IMPORT = "88888888-8888-4888-8888-888888888888";
const HASH = "b".repeat(64);

type Chamada = Record<string, unknown>;

const pagina = (n: number, extra: Partial<PaginaDoRelatorio> = {}): PaginaDoRelatorio => ({
  pagina: n,
  largura_pt: 595,
  altura_pt: 842,
  tem_texto: true,
  ...extra,
});

/**
 * O BANCO, e não as portas.
 *
 * O ciclo com recarregamento só significa algo se o estado sobreviver do lado
 * do banco enquanto o do cliente é jogado fora. Por isso a linha de
 * `brand_imports` mora aqui, num objeto que as portas leem — e "recarregar a
 * página" é construir portas novas sobre o mesmo banco.
 *
 * O vínculo é feito pela RPC, dentro da transação: aqui a RPC escreve
 * `source_document_id` na linha, como a função de verdade faz.
 */
function bancoDeTeste(paginas: PaginaDoRelatorio[] = [pagina(1), pagina(2)]) {
  return {
    linha: {
      import_id: IMPORT,
      storage_path: "conta/import/hash.pdf",
      pdf_sha256: HASH,
      page_count: paginas.length,
      source_document_id: null as string | null,
      report: { paginas, bytes: 1234, arquivo: "manual.pdf" },
    } satisfies RegistroDeImportacao,
    /** Quantos documentos-fonte a RPC realmente criou. */
    documentos: [] as string[],
    /** Páginas gravadas, por documento. Prova que a repetição não duplica. */
    manifesto: new Map<string, number[]>(),
  };
}

type Banco = ReturnType<typeof bancoDeTeste>;

interface Opcoes {
  ator?: { id: string } | null;
  conta?: { id: string } | null;
  marca?: { id: string } | null;
  secoes?: Map<string, string>;
  /** Erros de LEITURA, por porta: a consulta não rodou. */
  erroDe?: Partial<Record<"ator" | "conta" | "marca" | "importacao" | "secoes", unknown>>;
  /** Recebe o número da tentativa GLOBAL desta bancada. */
  rpcFalha?: (n: number) => { code?: string; message?: string } | null;
}

function portas(
  banco: Banco,
  opcoes: Opcoes = {},
  contador: { rpc: number } = { rpc: 0 },
): { portas: PortasDoRegistro; chamadas: Chamada[] } {
  const chamadas: Chamada[] = [];
  const erro = (qual: keyof NonNullable<Opcoes["erroDe"]>) => opcoes.erroDe?.[qual] ?? null;

  return {
    chamadas,
    portas: {
      async ator() {
        if (erro("ator")) return { dados: null, erro: erro("ator") };
        return { dados: "ator" in opcoes ? opcoes.ator! : { id: ATOR }, erro: null };
      },
      async conta(slug) {
        if (erro("conta")) return { dados: null, erro: erro("conta") };
        if ("conta" in opcoes) return { dados: opcoes.conta!, erro: null };
        return { dados: slug === "padaria-sp" ? { id: CONTA } : null, erro: null };
      },
      async marca(contaId, chave) {
        if (erro("marca")) return { dados: null, erro: erro("marca") };
        if ("marca" in opcoes) return { dados: opcoes.marca!, erro: null };
        // O PAR exato, como a consulta real: chave sozinha não resolve.
        const achou = contaId === CONTA && chave === "padaria";
        return { dados: achou ? { id: MARCA } : null, erro: null };
      },
      async importacao(importId, brandId, workspaceId) {
        if (erro("importacao")) return { dados: null, erro: erro("importacao") };
        if (importId !== IMPORT || brandId !== MARCA || workspaceId !== CONTA) {
          return { dados: null, erro: null };
        }
        // Cópia, como um `select` devolveria: a lógica não pode mutar a linha.
        return {
          dados: JSON.parse(JSON.stringify(banco.linha)) as RegistroDeImportacao,
          erro: null,
        };
      },
      async secoes(brandId) {
        if (erro("secoes")) return { dados: null, erro: erro("secoes") };
        // A marca inteira, e não os slugs pedidos: é o que a rota faz desde
        // que o `.in(...)` saiu. Ver `secoes-da-marca.ts`.
        assert.equal(brandId, MARCA);
        return { dados: opcoes.secoes ?? new Map([["cores", SECAO]]), erro: null };
      },
      async registrar(argumentos) {
        chamadas.push(argumentos);
        contador.rpc += 1;
        const falha = opcoes.rpcFalha?.(contador.rpc);
        if (falha) return { id: null, erro: falha };

        /*
         * A idempotência de verdade é do banco, por `sha256`. Aqui ela é
         * imitada para que "não duplicou" seja uma afirmação sobre o estado
         * gravado, e não sobre quantas vezes a função foi chamada.
         */
        const chave = `${argumentos.p_pdf_sha256}`;
        if (!banco.documentos.includes(chave)) banco.documentos.push(chave);
        banco.manifesto.set(
          chave,
          (argumentos.p_paginas as { pagina: number }[]).map((p) => p.pagina),
        );
        // O vínculo acontece DENTRO da transação, como na RPC de verdade.
        if (argumentos.p_import_id === banco.linha.import_id) {
          banco.linha.source_document_id = chave;
        }
        return { id: chave, erro: null };
      },
    },
  };
}

const pedido = { workspace: "padaria-sp", marca: "padaria", import_id: IMPORT };

// ─── O ciclo que o Marco B exige ───────────────────────────────────────────

/**
 * A passa → B falha → recarrega → repete → conclui → nada perdido.
 *
 * O recarregamento é o passo que mais importa e o mais fácil de fingir: aqui
 * ele é honesto porque as portas da segunda tentativa são construídas de novo
 * e o pedido não carrega NADA além de conta, marca e importação. Se o payload
 * dependesse de estado do cliente, esta tentativa não teria o que enviar.
 */
test("ciclo completo: A passa, B falha, recarrega, repete e conclui sem perder página", async () => {
  const banco = bancoDeTeste([pagina(1), pagina(2), pagina(3)]);
  const contador = { rpc: 0 };

  const primeira = await registrarDocumentoFonte(
    pedido,
    portas(banco, { rpcFalha: (n) => (n === 1 ? { message: "conexão perdida" } : null) }, contador)
      .portas,
  );
  assert.equal(primeira.ok, false);
  if (!primeira.ok) {
    assert.equal(primeira.codigo, "falha_temporaria");
    assert.equal(primeira.repetivel, true, "queda de rede precisa oferecer nova tentativa");
  }
  assert.equal(
    banco.linha.source_document_id,
    null,
    "falha na segunda transação mantém a publicação visivelmente incompleta",
  );

  // ── recarregar a aba: portas novas, zero estado do cliente ──
  const segunda = await registrarDocumentoFonte(pedido, portas(banco, {}, contador).portas);

  assert.equal(segunda.ok, true);
  if (segunda.ok) {
    assert.equal(segunda.paginas, 3, "nenhuma página perdida no caminho");
    assert.equal(segunda.jaEstava, false);
  }
  assert.equal(banco.linha.source_document_id, HASH, "o vínculo fecha a publicação");
  assert.equal(banco.documentos.length, 1, "um documento, não dois");
  assert.deepEqual(banco.manifesto.get(HASH), [1, 2, 3]);
});

/**
 * A repetição precisa mandar o MESMO payload.
 *
 * A idempotência do banco é por `sha256`, então repetir é seguro — mas só se a
 * segunda chamada descrever o mesmo documento. Um payload que variasse (um
 * carimbo de tempo, uma ordem instável) faria o banco reconhecer o `sha256` e
 * ainda assim receber um manifesto diferente do que gravou.
 */
test("a repetição depois de recarregar monta um payload idêntico", async () => {
  const banco = bancoDeTeste([pagina(2, { secao_slug: "cores" }), pagina(1)]);
  const contador = { rpc: 0 };

  const a = portas(banco, { rpcFalha: (n) => (n === 1 ? { message: "queda" } : null) }, contador);
  await registrarDocumentoFonte(pedido, a.portas);

  const b = portas(banco, {}, contador);
  await registrarDocumentoFonte(pedido, b.portas);

  assert.equal(a.chamadas.length, 1);
  assert.equal(b.chamadas.length, 1);
  assert.deepEqual(a.chamadas[0], b.chamadas[0]);
});

/**
 * O relatório guarda um array jsonb, cuja ordem é a de gravação — não a
 * numérica. Sem ordenar, duas leituras da mesma linha poderiam produzir
 * payloads diferentes, e a asserção acima passaria por sorte.
 */
test("as páginas vão em ordem numérica, qualquer que seja a do relatório", async () => {
  const banco = bancoDeTeste([pagina(3), pagina(1), pagina(2)]);
  const { portas: p, chamadas } = portas(banco);
  await registrarDocumentoFonte(pedido, p);

  const enviadas = (chamadas[0].p_paginas as { pagina: number }[]).map((x) => x.pagina);
  assert.deepEqual(enviadas, [1, 2, 3]);
});

/**
 * O vínculo vai DENTRO da transação, por `p_import_id`.
 *
 * Ele era escrito depois, pela rota, com o cliente da sessão — e não podia
 * funcionar: `authenticated` tem `select` e `insert` em `brand_imports` e
 * nenhum `update`. Toda publicação falharia com 42501 no último passo, e a
 * rota chamaria isso de falha temporária, oferecendo eternamente uma nova
 * tentativa que jamais concluiria.
 */
test("o id da importação viaja para a RPC, e o vínculo não é escrito pela rota", async () => {
  const banco = bancoDeTeste();
  const { portas: p, chamadas } = portas(banco);
  const r = await registrarDocumentoFonte(pedido, p);

  assert.equal(r.ok, true);
  assert.equal(chamadas[0].p_import_id, IMPORT);
  // A porta de vínculo não existe mais: se existisse, haveria um caminho de
  // escrita em brand_imports fora da transação.
  assert.equal("vincular" in p, false);
});

/**
 * Recarregar depois de uma publicação que CONCLUIU é o caminho normal, não uma
 * exceção — e ele não pode gastar uma ida com a chave de serviço nem repetir a
 * gravação para descobrir o que a linha já dizia.
 */
test("importação já vinculada responde concluída sem chamar a RPC", async () => {
  const banco = bancoDeTeste();
  banco.linha.source_document_id = "doc-anterior";

  const { portas: p, chamadas } = portas(banco);
  const r = await registrarDocumentoFonte(pedido, p);

  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.jaEstava, true);
    assert.equal(r.documentoId, "doc-anterior");
  }
  assert.equal(chamadas.length, 0);
});

/**
 * A resposta idempotente nunca declara falsamente zero páginas sem seção.
 *
 * O aceite local de 10/09 pegou isto com dado real: a marca tinha 1 página
 * sem seção, e o atalho `jaEstava` respondia `paginasSemSecao: 0`. Zero é uma
 * afirmação — "não há pendência" —, e este caminho não conta nada. O teste
 * monta exatamente esse cenário: um manifesto COM páginas sem seção, já
 * vinculado, para que um zero só possa ser mentira.
 */
test("resposta idempotente nunca declara falsamente zero páginas sem seção", async () => {
  const banco = bancoDeTeste([pagina(1, { secao_slug: "cores" }), pagina(2), pagina(3)]);
  banco.linha.source_document_id = "doc-anterior";

  const r = await registrarDocumentoFonte(pedido, portas(banco).portas);

  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.jaEstava, true);
    assert.notStrictEqual(r.paginasSemSecao, 0, "zero seria afirmação sem medida");
    assert.strictEqual(r.paginasSemSecao, null);
  }
});

/**
 * O contraste: no caminho que GRAVA, o número é medido e chega como número —
 * inclusive o zero, quando o manifesto está todo coberto. `null` fica restrito
 * ao que não foi contado.
 */
test("no caminho que grava, a contagem é medida e sai como número", async () => {
  const coberto = bancoDeTeste([pagina(1, { secao_slug: "cores" })]);
  const rCoberto = await registrarDocumentoFonte(pedido, portas(coberto).portas);
  assert.equal(rCoberto.ok, true);
  if (rCoberto.ok) {
    assert.equal(rCoberto.jaEstava, false);
    assert.strictEqual(rCoberto.paginasSemSecao, 0, "zero medido é zero de verdade");
  }

  const comFalta = bancoDeTeste([pagina(1, { secao_slug: "cores" }), pagina(2)]);
  const rComFalta = await registrarDocumentoFonte(pedido, portas(comFalta).portas);
  assert.equal(rComFalta.ok, true);
  if (rComFalta.ok) assert.strictEqual(rComFalta.paginasSemSecao, 1);
});

// ─── Consulta que FALHOU não é consulta que não achou ──────────────────────

/**
 * O defeito mais perigoso desta rota, e o mais silencioso.
 *
 * A consulta de seções ignorava `error`. Uma queda de banco, uma URL longa
 * demais, um PostgREST recusando — qualquer um deles devolvia `data` nulo, e
 * as mil páginas eram gravadas como `sem-secao`. O vínculo fechava em seguida,
 * a idempotência por `sha256` impedia qualquer repetição de corrigir, e a
 * publicação ficava com aparência de limpa. Perda de estrutura permanente,
 * sem nenhum sinal.
 */
test("falha ao consultar seções é 503 repetível, e NADA é gravado", async () => {
  const banco = bancoDeTeste([pagina(1, { secao_slug: "cores" }), pagina(2)]);
  const { portas: p, chamadas } = portas(banco, {
    erroDe: { secoes: { code: "08006", message: "connection failure" } },
  });

  const r = await registrarDocumentoFonte(pedido, p);

  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.codigo, "falha_de_leitura");
    assert.equal(r.status, 503);
    assert.equal(r.repetivel, true);
  }
  assert.equal(chamadas.length, 0, "a RPC não pode ser chamada com seções desconhecidas");
  assert.equal(banco.documentos.length, 0);
  assert.equal(banco.linha.source_document_id, null);
});

/**
 * O contraste que dá sentido ao teste acima: a MESMA ausência de id, por
 * motivo diferente, tem desfecho oposto. Consulta que rodou e não achou o slug
 * é um fato sobre a extração, e a publicação segue.
 */
test("consulta que rodou sem achar o slug segue como sem-seção", async () => {
  const banco = bancoDeTeste([pagina(1, { secao_slug: "cores" }), pagina(2)]);
  const { portas: p, chamadas } = portas(banco, { secoes: new Map() });

  const r = await registrarDocumentoFonte(pedido, p);

  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.paginasSemSecao, 2);
  assert.equal(chamadas.length, 1);
});

test("falha de leitura em qualquer porta é 503 repetível, nunca 404", async () => {
  // A porta e o rótulo que ela usa no log. `ator` registra como `sessao`
  // porque é o que caiu do ponto de vista de quem lê o log: a leitura da
  // sessão, e não a existência de um ator.
  const portasEObservadas: [keyof NonNullable<Opcoes["erroDe"]>, string][] = [
    ["ator", "sessao"],
    ["conta", "conta"],
    ["marca", "marca"],
    ["importacao", "importacao"],
  ];

  for (const [qual, rotulo] of portasEObservadas) {
    const banco = bancoDeTeste();
    const { portas: p, chamadas } = portas(banco, {
      erroDe: { [qual]: { code: "08006", message: "db fora" } },
    });

    const r = await registrarDocumentoFonte(pedido, p);
    assert.equal(r.ok, false, qual);
    if (!r.ok) {
      assert.equal(r.codigo, "falha_de_leitura", qual);
      assert.equal(r.status, 503, qual);
      assert.equal(r.repetivel, true, qual);
      /*
       * QUAL leitura caiu fica no log. Sem isso, "falha_de_leitura" obrigaria
       * a adivinhar entre quatro consultas — e este código existe justamente
       * para não deixar um acidente virar diagnóstico por eliminação.
       */
      assert.match(r.tecnico ?? "", new RegExp(rotulo), qual);
    }
    assert.equal(chamadas.length, 0, qual);
  }
});

/**
 * Ausência de linha continua sendo 404 permanente. Sem este teste, a correção
 * acima poderia ter transformado todo 404 em 503 — e a interface passaria a
 * oferecer nova tentativa para uma marca que não existe.
 */
test("ausência de linha continua 404 permanente", async () => {
  const casos: [string, Opcoes | Record<string, never>, string][] = [
    ["conta", { conta: null }, "conta_nao_encontrada"],
    ["marca", { marca: null }, "marca_nao_encontrada"],
  ];

  for (const [rotulo, opcoes, codigo] of casos) {
    const banco = bancoDeTeste();
    const r = await registrarDocumentoFonte(pedido, portas(banco, opcoes as Opcoes).portas);
    assert.equal(r.ok, false, rotulo);
    if (!r.ok) {
      assert.equal(r.codigo, codigo, rotulo);
      assert.equal(r.status, 404, rotulo);
      assert.equal(r.repetivel, false, rotulo);
    }
  }
});

// ─── A marca é resolvida pelo PAR, não pela chave ──────────────────────────

/**
 * `brands` garante `unique (workspace_id, key)`: a chave é única dentro da
 * conta, e não globalmente. Quem participa de duas contas com uma marca
 * `padaria` em cada faria `maybeSingle` receber duas linhas e recusar — e a
 * rota responderia 404 para uma marca que existe.
 */
test("a marca é resolvida pelo par conta+chave", async () => {
  const banco = bancoDeTeste();
  const vistas: [string, string][] = [];

  const p = portas(banco).portas;
  const original = p.marca.bind(p);
  p.marca = async (contaId, chave) => {
    vistas.push([contaId, chave]);
    return original(contaId, chave);
  };

  const r = await registrarDocumentoFonte(pedido, p);
  assert.equal(r.ok, true);
  assert.deepEqual(vistas, [[CONTA, "padaria"]]);
});

test("a mesma chave em outra conta não resolve esta marca", async () => {
  const banco = bancoDeTeste();
  const r = await registrarDocumentoFonte(
    { workspace: "outra-conta", marca: "padaria", import_id: IMPORT },
    portas(banco).portas,
  );

  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.codigo, "conta_nao_encontrada");
});

test("pedido sem conta é recusado antes de qualquer consulta", async () => {
  const banco = bancoDeTeste();
  const { portas: p, chamadas } = portas(banco);

  for (const ruim of [
    { workspace: "", marca: "padaria", import_id: IMPORT },
    { workspace: "padaria-sp", marca: "", import_id: IMPORT },
    { workspace: "padaria-sp", marca: "padaria", import_id: "nao-e-uuid" },
    { workspace: "padaria-sp", marca: "padaria", import_id: "" },
  ]) {
    const r = await registrarDocumentoFonte(ruim, p);
    assert.equal(r.ok, false, JSON.stringify(ruim));
    if (!r.ok) {
      assert.equal(r.codigo, "pedido_invalido");
      assert.equal(r.repetivel, false);
    }
  }
  assert.equal(chamadas.length, 0);
});

// ─── Nada privilegiado vem do payload ──────────────────────────────────────

/**
 * O pedido tem três cordas. Um `created_by`, um `workspace_id` ou uma
 * geometria enviados pelo navegador seriam declaração de quem não pode
 * declará-la — e a RPC usa `p_created_by` para decidir se quem chama
 * administra a conta.
 */
test("o ator e a conta vêm da sessão e da resolução, e o corpo não influencia", async () => {
  const banco = bancoDeTeste();
  const { portas: p, chamadas } = portas(banco);

  await registrarDocumentoFonte(
    {
      ...pedido,
      // Um cliente tentando se declarar outro, e apontar para outra conta.
      p_created_by: "00000000-0000-4000-8000-000000000000",
      p_workspace_id: "11111111-1111-4111-8111-111111111111",
      p_paginas: [{ pagina: 1, largura_pt: 1, altura_pt: 1 }],
      p_import_id: "22222222-2222-4222-8222-222222222222",
    } as never,
    p,
  );

  assert.equal(chamadas[0].p_created_by, ATOR);
  assert.equal(chamadas[0].p_workspace_id, CONTA);
  assert.equal(chamadas[0].p_import_id, IMPORT, "o import_id vem da linha lida, não do corpo");
  assert.equal((chamadas[0].p_paginas as unknown[]).length, 2, "a geometria vem do relatório");
});

test("a geometria vem do relatório da transação A, não do cliente", async () => {
  const banco = bancoDeTeste([pagina(1, { largura_pt: 842, altura_pt: 595, rotacao: 90 })]);
  const { portas: p, chamadas } = portas(banco);
  await registrarDocumentoFonte(pedido, p);

  const [primeira] = chamadas[0].p_paginas as Record<string, unknown>[];
  assert.equal(primeira.largura_pt, 842);
  assert.equal(primeira.rotacao, 90);
  assert.equal(chamadas[0].p_pdf_sha256, HASH);
  assert.equal(chamadas[0].p_storage_path, "conta/import/hash.pdf");
});

test("sem sessão é 401 permanente, e a chave de serviço não sai do cofre", async () => {
  const banco = bancoDeTeste();
  const { portas: p, chamadas } = portas(banco, { ator: null });
  const r = await registrarDocumentoFonte(pedido, p);

  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 401);
    assert.equal(r.codigo, "nao_autenticado");
    assert.equal(r.repetivel, false);
  }
  assert.equal(chamadas.length, 0);
});

test("importação de outra marca não é alcançada", async () => {
  const banco = bancoDeTeste();
  const r = await registrarDocumentoFonte(
    { ...pedido, import_id: "12121212-1212-4212-8212-121212121212" },
    portas(banco).portas,
  );

  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.codigo, "importacao_nao_encontrada");
    assert.equal(r.repetivel, false);
  }
});

// ─── Seção não resolvida é pendência visível, não erro ─────────────────────

test("o slug da seção é resolvido para id no servidor", async () => {
  const banco = bancoDeTeste([pagina(1, { secao_slug: "cores" }), pagina(2)]);
  const { portas: p, chamadas } = portas(banco);
  await registrarDocumentoFonte(pedido, p);

  const paginas = chamadas[0].p_paginas as Record<string, unknown>[];
  assert.equal(paginas[0].document_id, SECAO);
  assert.equal(paginas[0].motivo_da_cobertura, "");
});

/**
 * Slug que não resolve NÃO derruba a publicação: vira página sem seção, com
 * motivo. Recusar tudo por causa de uma linha perderia o manifesto inteiro — e
 * o manifesto existe justamente para que ausência seja registrada.
 *
 * Mas também não pode passar como publicação limpa: a contagem volta no
 * resultado para a interface mostrar a pendência.
 */
test("slug que não resolve vira sem-seção com motivo, e conta como pendência", async () => {
  const banco = bancoDeTeste([pagina(1, { secao_slug: "inexistente" }), pagina(2)]);
  const { portas: p, chamadas } = portas(banco, { secoes: new Map() });
  const r = await registrarDocumentoFonte(pedido, p);

  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.paginas, 2);
    assert.equal(r.paginasSemSecao, 2, "a que não resolveu e a que nunca teve seção");
  }

  const paginas = chamadas[0].p_paginas as Record<string, unknown>[];
  assert.equal(paginas[0].document_id, null);
  assert.match(String(paginas[0].motivo_da_cobertura), /não foi encontrada/);
  assert.match(String(paginas[1].motivo_da_cobertura), /não entrou em nenhuma seção/);
});

test("manifesto inteiro coberto não reporta pendência", async () => {
  const banco = bancoDeTeste([
    pagina(1, { secao_slug: "cores" }),
    pagina(2, { secao_slug: "cores" }),
  ]);
  const r = await registrarDocumentoFonte(pedido, portas(banco).portas);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.paginasSemSecao, 0);
});

/**
 * Manifesto sem nenhum slug não deve consultar seções. Não é otimização: é o
 * que garante que uma queda de banco na consulta de seções não derrube uma
 * publicação que não dependia dela.
 */
test("manifesto sem slug nenhum não consulta seções", async () => {
  const banco = bancoDeTeste();
  const { portas: p, chamadas } = portas(banco, {
    erroDe: { secoes: { message: "esta porta nem deveria ser chamada" } },
  });

  const r = await registrarDocumentoFonte(pedido, p);
  assert.equal(r.ok, true);
  assert.equal(chamadas.length, 1);
});

// ─── Relatório defeituoso é permanente, não repetível ──────────────────────

/**
 * A distinção que decide se a interface oferece o botão. O relatório já está
 * gravado pela transação A: se ele está defeituoso, nenhuma repetição desta
 * chamada muda o que está lá.
 */
test("relatório sem manifesto é permanente, e não chama a RPC", async () => {
  const banco = bancoDeTeste();
  // @ts-expect-error — publicação anterior a esta etapa, sem geometria.
  delete banco.linha.report.paginas;

  const { portas: p, chamadas } = portas(banco);
  const r = await registrarDocumentoFonte(pedido, p);

  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.codigo, "manifesto_ausente");
    assert.equal(r.repetivel, false);
  }
  assert.equal(chamadas.length, 0);
});

test("manifesto com furo, repetição ou geometria zerada é permanente", async () => {
  const casos: [string, PaginaDoRelatorio[], number][] = [
    ["furo", [pagina(1), pagina(3)], 3],
    ["repetida", [pagina(1), pagina(1)], 2],
    ["fora da faixa", [pagina(1), pagina(9)], 2],
    ["sem geometria", [pagina(1), pagina(2, { largura_pt: 0 })], 2],
  ];

  for (const [rotulo, paginas, total] of casos) {
    const banco = bancoDeTeste(paginas);
    banco.linha.page_count = total;
    const { portas: p, chamadas } = portas(banco);
    const r = await registrarDocumentoFonte(pedido, p);

    assert.equal(r.ok, false, `${rotulo} deveria ser recusado`);
    if (!r.ok) {
      assert.equal(r.codigo, "manifesto_invalido", rotulo);
      assert.equal(r.repetivel, false, rotulo);
    }
    assert.equal(chamadas.length, 0, `${rotulo} não deveria alcançar a RPC`);
  }
});

// ─── Códigos estáveis, e nenhuma mensagem do banco na resposta ────────────

/**
 * O SQLSTATE decide o código, não o texto. Casar por mensagem quebra na
 * primeira vez que alguém reescreve um `raise` — e quebra em silêncio,
 * virando "repetível" para algo permanente.
 */
test("cada SQLSTATE da RPC vira um código estável", async () => {
  const mapa: [string, string, number, boolean][] = [
    ["42501", "sem_permissao", 403, false],
    ["22023", "manifesto_invalido", 422, false],
    ["22004", "manifesto_invalido", 422, false],
    // P0002 vem do objeto do Storage ausente OU da importação que não
    // corresponde a esta marca e a este arquivo — a validação do vínculo.
    ["P0002", "importacao_nao_encontrada", 404, false],
    ["08006", "falha_temporaria", 503, true],
    ["", "falha_temporaria", 503, true],
  ];

  for (const [sqlstate, codigo, status, repetivel] of mapa) {
    const banco = bancoDeTeste();
    const r = await registrarDocumentoFonte(
      pedido,
      portas(banco, { rpcFalha: () => ({ code: sqlstate, message: "texto que muda" }) }).portas,
    );

    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.codigo, codigo, sqlstate);
      assert.equal(r.status, status, sqlstate);
      assert.equal(r.repetivel, repetivel, sqlstate);
    }
  }
});

/**
 * A mensagem do banco fica no campo `tecnico`, que a rota manda ao log e não
 * ao navegador. Ela não pode aparecer em nenhum campo destinado à tela.
 */
test("a mensagem do banco viaja só no campo técnico", async () => {
  const banco = bancoDeTeste();
  const r = await registrarDocumentoFonte(
    pedido,
    portas(banco, {
      rpcFalha: () => ({ code: "22023", message: 'relation "brand_source_pages" detail' }),
    }).portas,
  );

  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.tecnico ?? "", /brand_source_pages/);
    const paraATela = JSON.stringify({ codigo: r.codigo, repetivel: r.repetivel });
    assert.doesNotMatch(paraATela, /brand_source_pages/);
  }
});
