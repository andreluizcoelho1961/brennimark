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
 * O teste que decide se a solução transitória é aceitável é o ciclo completo:
 * A passa, B falha, a aba recarrega, a repetição conclui, e nenhuma página se
 * perde. É a condição imposta para aceitar duas transações não atômicas.
 */

const MARCA = "44444444-4444-4444-8444-444444444444";
const CONTA = "55555555-5555-4555-8555-555555555555";
const ATOR = "66666666-6666-4666-8666-666666666666";
const SECAO = "77777777-7777-4777-8777-777777777777";
const IMPORT = "88888888-8888-4888-8888-888888888888";
const LINHA = "99999999-9999-4999-8999-999999999999";
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
 * `brand_imports` mora aqui, num objeto que as portas leem e escrevem — e
 * "recarregar a página" é construir portas novas sobre o mesmo banco.
 */
function bancoDeTeste(paginas: PaginaDoRelatorio[] = [pagina(1), pagina(2)]) {
  return {
    linha: {
      id: LINHA,
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

function portas(
  banco: Banco,
  opcoes: {
    ator?: { id: string } | null;
    marca?: { id: string; workspace_id: string } | null;
    secoes?: Map<string, string>;
    /** Recebe o número da tentativa GLOBAL desta bancada. */
    rpcFalha?: (n: number) => { code?: string; message?: string } | null;
    vinculoFalha?: (n: number) => unknown;
  } = {},
  contador: { rpc: number; vinculo: number } = { rpc: 0, vinculo: 0 },
): { portas: PortasDoRegistro; chamadas: Chamada[] } {
  const chamadas: Chamada[] = [];

  return {
    chamadas,
    portas: {
      async ator() {
        return "ator" in opcoes ? opcoes.ator! : { id: ATOR };
      },
      async marca() {
        return "marca" in opcoes ? opcoes.marca! : { id: MARCA, workspace_id: CONTA };
      },
      async importacao(importId, brandId, workspaceId) {
        if (importId !== IMPORT || brandId !== MARCA || workspaceId !== CONTA) return null;
        // Cópia, como um `select` devolveria: a lógica não pode mutar a linha.
        return JSON.parse(JSON.stringify(banco.linha)) as RegistroDeImportacao;
      },
      async secoes() {
        return opcoes.secoes ?? new Map([["cores", SECAO]]);
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
        const jaExiste = banco.documentos.includes(chave);
        if (!jaExiste) banco.documentos.push(chave);
        banco.manifesto.set(
          chave,
          (argumentos.p_paginas as { pagina: number }[]).map((p) => p.pagina),
        );
        return { id: chave, erro: null };
      },
      async vincular(id, sourceDocumentId) {
        contador.vinculo += 1;
        const falha = opcoes.vinculoFalha?.(contador.vinculo);
        if (falha) return { erro: falha };
        if (id !== LINHA) return { erro: { message: "linha errada" } };
        banco.linha.source_document_id = sourceDocumentId;
        return { erro: null };
      },
    },
  };
}

const pedido = { marca: "padaria", import_id: IMPORT };

// ─── O ciclo que o Marco B exige ───────────────────────────────────────────

/**
 * A passa → B falha → recarrega → repete → conclui → nada perdido.
 *
 * O recarregamento é o passo que mais importa e o mais fácil de fingir: aqui
 * ele é honesto porque as portas da segunda tentativa são construídas de novo
 * e o pedido não carrega NADA além de marca e importação. Se o payload
 * dependesse de estado do cliente, esta tentativa não teria o que enviar.
 */
test("ciclo completo: A passa, B falha, recarrega, repete e conclui sem perder página", async () => {
  const banco = bancoDeTeste([pagina(1), pagina(2), pagina(3)]);
  const contador = { rpc: 0, vinculo: 0 };

  // Primeira tentativa: a RPC cai.
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
  const depois = portas(banco, {}, contador);
  const segunda = await registrarDocumentoFonte(pedido, depois.portas);

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
  const contador = { rpc: 0, vinculo: 0 };

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
 * Falhar ao VINCULAR é o caso mais escorregadio: o documento e o manifesto já
 * existem, mas a publicação continua marcada como incompleta. É o erro seguro
 * dos dois, e a próxima tentativa precisa fechar o vínculo sem duplicar.
 */
test("falha no vínculo mantém source_document_id nulo e a repetição fecha", async () => {
  const banco = bancoDeTeste();
  const contador = { rpc: 0, vinculo: 0 };

  const primeira = await registrarDocumentoFonte(
    pedido,
    portas(banco, { vinculoFalha: (n) => (n === 1 ? { message: "sem rede" } : null) }, contador)
      .portas,
  );
  assert.equal(primeira.ok, false);
  if (!primeira.ok) {
    assert.equal(primeira.codigo, "falha_ao_vincular");
    assert.equal(primeira.repetivel, true);
  }
  assert.equal(banco.linha.source_document_id, null);
  assert.equal(banco.documentos.length, 1, "a RPC gravou, mesmo com o vínculo falhando");

  const segunda = await registrarDocumentoFonte(pedido, portas(banco, {}, contador).portas);
  assert.equal(segunda.ok, true);
  assert.equal(banco.linha.source_document_id, HASH);
  assert.equal(banco.documentos.length, 1, "a repetição não criou um segundo documento");
  assert.deepEqual(banco.manifesto.get(HASH), [1, 2]);
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

// ─── Nada privilegiado vem do payload ──────────────────────────────────────

/**
 * O pedido tem duas cordas. Um `created_by`, um `workspace_id` ou uma
 * geometria enviados pelo navegador seriam declaração de quem não pode
 * declará-la — e a RPC usa `p_created_by` para decidir se quem chama
 * administra a conta.
 */
test("o ator e a conta vêm da sessão e da marca, e o corpo não influencia", async () => {
  const banco = bancoDeTeste();
  const { portas: p, chamadas } = portas(banco);

  await registrarDocumentoFonte(
    {
      ...pedido,
      // Um cliente tentando se declarar outro, e apontar para outra conta.
      p_created_by: "00000000-0000-4000-8000-000000000000",
      p_workspace_id: "11111111-1111-4111-8111-111111111111",
      p_paginas: [{ pagina: 1, largura_pt: 1, altura_pt: 1 }],
    } as never,
    p,
  );

  assert.equal(chamadas[0].p_created_by, ATOR);
  assert.equal(chamadas[0].p_workspace_id, CONTA);
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

test("marca inalcançável e importação de outra conta respondem igual: 404", async () => {
  const banco = bancoDeTeste();

  const semMarca = await registrarDocumentoFonte(pedido, portas(banco, { marca: null }).portas);
  assert.equal(semMarca.ok, false);
  if (!semMarca.ok) assert.equal(semMarca.codigo, "marca_nao_encontrada");

  const outraImportacao = await registrarDocumentoFonte(
    { marca: "padaria", import_id: "12121212-1212-4212-8212-121212121212" },
    portas(banco).portas,
  );
  assert.equal(outraImportacao.ok, false);
  if (!outraImportacao.ok) {
    assert.equal(outraImportacao.codigo, "importacao_nao_encontrada");
    assert.equal(outraImportacao.repetivel, false);
  }
});

test("import_id fora do formato é recusado antes de qualquer consulta", async () => {
  const banco = bancoDeTeste();
  const { portas: p, chamadas } = portas(banco);
  for (const ruim of ["", "nao-e-uuid", "../../etc"]) {
    const r = await registrarDocumentoFonte({ marca: "padaria", import_id: ruim }, p);
    assert.equal(r.ok, false, `"${ruim}" deveria ser recusado`);
    if (!r.ok) assert.equal(r.codigo, "pedido_invalido");
  }
  assert.equal(chamadas.length, 0);
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
  const banco = bancoDeTeste([pagina(1, { secao_slug: "cores" }), pagina(2, { secao_slug: "cores" })]);
  const r = await registrarDocumentoFonte(pedido, portas(banco).portas);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.paginasSemSecao, 0);
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
