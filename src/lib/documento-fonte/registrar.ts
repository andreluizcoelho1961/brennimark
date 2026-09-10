/**
 * O segundo passo da publicação: registrar o documento-fonte e o manifesto.
 *
 * ─── Por que é um segundo passo, e não parte do primeiro ────────────────
 *
 * `publish_brand_import` é `security invoker` e roda no navegador com a sessão
 * de quem importa. A RPC do manifesto é `security definer` e revogada de
 * `authenticated` — só `service_role` a executa, porque completude do
 * manifesto e imutabilidade do original não são expressáveis linha a linha e
 * portanto não podem depender de `insert` concedido ao cliente.
 *
 * Consequência: duas transações que **não são atômicas entre si**. A escolha é
 * transitória e está registrada como dívida arquitetural em
 * `docs/plan/desenho-documento-fonte-e-manifesto.md` §9 — a publicação inteira
 * deve migrar para uma transação única no servidor.
 *
 * ─── O pedido é DERIVADO, não enviado ──────────────────────────────────
 *
 * Este módulo recebe apenas `{ workspace, marca, import_id }`. Todo o
 * manifesto sai do relatório que a transação A gravou em
 * `brand_imports.report`, lido aqui sob RLS.
 *
 * A alternativa era o navegador reenviar o manifesto inteiro na segunda
 * chamada. Ela cai em três dos requisitos de uma vez:
 *
 *   1. **repetir exige o mesmo payload.** Reenviado, "o mesmo" depende de o
 *      navegador ter guardado o que mandou; derivado, é o mesmo por
 *      construção, porque a fonte é a linha que a transação A gravou.
 *   2. **a recuperação precisa sobreviver a um recarregamento.** O manifesto
 *      de mil páginas vivia no estado do React: recarregar a aba o perdia, e
 *      com ele a possibilidade de concluir a publicação. Derivado, a
 *      recuperação não precisa de estado nenhum do cliente — e funciona de
 *      outro aparelho.
 *   3. **nada privilegiado vem do payload.** Geometria e slugs deixam de ser
 *      declaração do cliente na segunda transação.
 *
 * Uma precisão sobre o que isso garante: a geometria é **repetível**, porque
 * vem de uma linha durável. Ela não é **autêntica** — foi medida pelo
 * navegador durante a transação A, e nenhuma leitura posterior do relatório
 * transforma isso em prova. Autenticidade exigiria medir o PDF no servidor,
 * que é outra decisão, com outro custo, e não está tomada.
 *
 * ─── Os dois clientes, e por que não é um só ────────────────────────────
 *
 * `service_role` tem `bypassrls`, mas **grants continuam valendo**: ele não
 * tem `select` em `brand_documents`, de propósito, para a superfície da chave
 * ficar no mínimo. Então conta, marca, importação e seção são resolvidas com a
 * **sessão do usuário**, sob RLS — é ela que garante que a seção pertence à
 * marca de quem pede — e só os identificadores já resolvidos vão à RPC.
 */

/**
 * Uma página do manifesto, como a transação A a gravou no relatório.
 *
 * `secao_slug` e nunca um id: o slug é o que a extração produziu, e o id é
 * resolvido aqui sob RLS. Um id vindo do relatório seria um id que o cliente
 * escreveu, e apontar para seção de outra marca é exatamente a brecha que a
 * chave composta fecha — melhor não depender só da constraint.
 */
export interface PaginaDoRelatorio {
  pagina: number;
  largura_pt: number;
  altura_pt: number;
  rotacao?: number;
  tem_texto: boolean;
  caracteres?: number;
  secao_slug?: string | null;
}

/** O que a rota lê de `brand_imports`, sob RLS. */
export interface RegistroDeImportacao {
  import_id: string;
  storage_path: string;
  pdf_sha256: string;
  page_count: number;
  /** Nulo é o sinal de publicação incompleta. Preenchido, já concluiu. */
  source_document_id: string | null;
  report: {
    paginas?: PaginaDoRelatorio[];
    bytes?: number;
    arquivo?: string;
    [chave: string]: unknown;
  };
}

/**
 * O pedido inteiro: três cordas, e nenhuma delas é um id privilegiado.
 *
 * `workspace` existe porque `brands.key` é único **dentro** da conta, e não
 * globalmente — a garantia é `unique (workspace_id, key)`. Quem participa de
 * duas contas que tenham uma marca `padaria` em cada veria a consulta por
 * chave sozinha devolver duas linhas: `maybeSingle` recusa, e a rota
 * responderia 404 para uma marca que existe. O par exato resolve uma só.
 */
export interface PedidoDeRegistro {
  workspace: string;
  marca: string;
  import_id: string;
}

/**
 * O resultado de uma leitura no banco, com a distinção que importa.
 *
 * `{ dados: null, erro: null }` é "a consulta rodou e não há linha" — 404.
 * `{ dados: null, erro: <algo> }` é "a consulta não rodou" — 503, repetível.
 *
 * Colapsar os dois foi o defeito mais perigoso desta rota: uma queda de banco
 * na resolução de seções gravava as mil páginas como `sem-secao`, fechava o
 * vínculo, e a idempotência impedia qualquer repetição de corrigir. Perda
 * silenciosa e permanente de estrutura, com aparência de publicação limpa.
 */
export interface Leitura<T> {
  dados: T | null;
  erro: unknown;
}

export interface PortasDoRegistro {
  /** O usuário da SESSÃO. Nunca vem do corpo da requisição. */
  ator(): Promise<Leitura<{ id: string }>>;
  /** Resolve a conta pelo slug, sob RLS. `workspaces.slug` é único global. */
  conta(slug: string): Promise<Leitura<{ id: string }>>;
  /** Resolve a marca pelo par exato (conta, chave), sob RLS. */
  marca(contaId: string, chave: string): Promise<Leitura<{ id: string }>>;
  /** Lê a importação, sob RLS, exigindo marca e conta. */
  importacao(
    importId: string,
    brandId: string,
    workspaceId: string,
  ): Promise<Leitura<RegistroDeImportacao>>;
  /** Resolve slugs de seção para ids, sob RLS, dentro desta marca. */
  secoes(brandId: string, slugs: string[]): Promise<Leitura<Map<string, string>>>;
  /**
   * Chama a RPC com a chave de serviço.
   *
   * O vínculo com a importação vai DENTRO dela, por `p_import_id`: documento,
   * manifesto e vínculo na mesma transação. A rota não escreve em
   * `brand_imports` — `authenticated` não tem `update` nessa tabela, e
   * conceder seria deixar o cliente declarar completude.
   */
  registrar(argumentos: Record<string, unknown>): Promise<{ id: string | null; erro: unknown }>;
}

/**
 * O vocabulário FECHADO de falhas.
 *
 * Mensagem de banco não atravessa: ela muda quando alguém reescreve um
 * `raise`, vaza a forma interna do esquema para o navegador, e chega numa só
 * língua num produto bilíngue. O código é o contrato; o texto na tela é
 * decisão da interface, e o detalhe técnico fica no log do servidor.
 */
export type CodigoDeFalha =
  | "nao_autenticado"
  | "pedido_invalido"
  | "conta_nao_encontrada"
  | "marca_nao_encontrada"
  | "importacao_nao_encontrada"
  | "manifesto_ausente"
  | "manifesto_invalido"
  | "sem_permissao"
  | "falha_de_leitura"
  | "falha_temporaria";

export type ResultadoDoRegistro =
  | {
      ok: true;
      documentoId: string;
      paginas: number;
      /** Páginas que ficaram sem seção. Pendência de curadoria, não erro. */
      paginasSemSecao: number;
      /** Verdadeiro quando já estava registrado e nada foi gravado agora. */
      jaEstava: boolean;
    }
  | {
      ok: false;
      status: number;
      codigo: CodigoDeFalha;
      /**
       * Se vale tentar de novo.
       *
       * A interface precisa disso para não oferecer um botão que vai falhar
       * igual, nem esconder um botão que resolveria. Repetir é seguro sempre —
       * a RPC é idempotente por `sha256` —, então o campo diz se é ÚTIL.
       */
      repetivel: boolean;
      /** Só para o log do servidor. A rota não devolve isto ao navegador. */
      tecnico?: string;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function recusar(
  status: number,
  codigo: CodigoDeFalha,
  repetivel: boolean,
  tecnico?: string,
): ResultadoDoRegistro {
  return { ok: false, status, codigo, repetivel, tecnico };
}

/** Falha de consulta: temporária e repetível, nunca "não encontrado". */
function falhaDeLeitura(onde: string, erro: unknown): ResultadoDoRegistro {
  return recusar(503, "falha_de_leitura", true, `${onde}: ${mensagemTecnica(erro) ?? "erro"}`);
}

/**
 * O manifesto que a transação A gravou é conferido antes de ir à RPC.
 *
 * A autoridade sobre completude é a RPC — é para isso que ela existe. Esta
 * conferência serve a outra coisa: distinguir "o relatório está defeituoso",
 * que é permanente e nenhuma repetição conserta, de "a chamada falhou", que é
 * repetível. Sem ela, as duas chegariam como o mesmo erro.
 */
function conferirManifesto(registro: RegistroDeImportacao): CodigoDeFalha | null {
  const paginas = registro.report?.paginas;
  if (!Array.isArray(paginas) || paginas.length === 0) return "manifesto_ausente";
  if (paginas.length !== registro.page_count) return "manifesto_invalido";

  const vistas = new Set<number>();
  for (const p of paginas) {
    if (!Number.isInteger(p?.pagina) || p.pagina < 1 || p.pagina > registro.page_count) {
      return "manifesto_invalido";
    }
    if (vistas.has(p.pagina)) return "manifesto_invalido";
    vistas.add(p.pagina);
    if (!(p.largura_pt > 0) || !(p.altura_pt > 0)) return "manifesto_invalido";
  }
  return null;
}

/**
 * O SQLSTATE decide o código, e não o texto da exceção.
 *
 * Casar por mensagem quebra na primeira vez que alguém reescreve um `raise` —
 * e quebra em silêncio, virando "erro repetível" para algo permanente. O
 * SQLSTATE é declarado de propósito na migração e é o que se pode citar.
 */
function classificarErroDaRpc(erro: unknown): { codigo: CodigoDeFalha; status: number } {
  const codigoSql = (erro as { code?: string } | null)?.code;
  switch (codigoSql) {
    case "42501": // insufficient_privilege — não administra a conta
      return { codigo: "sem_permissao", status: 403 };
    case "22023": // invalid_parameter_value — manifesto incompleto, repetido ou com furo
    case "22004": // null_value_not_allowed — autor ausente
      return { codigo: "manifesto_invalido", status: 422 };
    /*
     * P0002 vem de dois lugares, e os dois querem dizer a mesma coisa para
     * quem chamou: o objeto do Storage não está lá, ou a importação não
     * corresponde a esta marca e a este arquivo — a validação que o vínculo
     * faz dentro da transação.
     */
    case "P0002":
      return { codigo: "importacao_nao_encontrada", status: 404 };
    default:
      // Desconhecido é tratado como TEMPORÁRIO, de propósito: repetir é
      // idempotente e barato, e o erro seguro entre os dois é oferecer a
      // tentativa. Chamar de permanente o que é uma queda de rede deixaria
      // uma publicação completável marcada como perdida.
      return { codigo: "falha_temporaria", status: 503 };
  }
}

export async function registrarDocumentoFonte(
  pedido: PedidoDeRegistro,
  portas: PortasDoRegistro,
): Promise<ResultadoDoRegistro> {
  if (!pedido?.workspace || !pedido?.marca || !UUID.test(pedido?.import_id ?? "")) {
    return recusar(400, "pedido_invalido", false);
  }

  /*
   * O ator vem da SESSÃO, sempre.
   *
   * `created_by` enviado pelo navegador seria uma declaração de identidade
   * feita por quem não pode declará-la — e a RPC usa esse campo para decidir
   * se quem chama administra a conta.
   */
  const ator = await portas.ator();
  if (ator.erro) return falhaDeLeitura("sessao", ator.erro);
  if (!ator.dados) return recusar(401, "nao_autenticado", false);

  const conta = await portas.conta(pedido.workspace);
  if (conta.erro) return falhaDeLeitura("conta", conta.erro);
  // "Não existe" e "não é sua" respondem igual: responder diferente
  // confirmaria o endereço para quem sonda.
  if (!conta.dados) return recusar(404, "conta_nao_encontrada", false);

  const marca = await portas.marca(conta.dados.id, pedido.marca);
  if (marca.erro) return falhaDeLeitura("marca", marca.erro);
  if (!marca.dados) return recusar(404, "marca_nao_encontrada", false);

  const marcaId = marca.dados.id;
  const contaId = conta.dados.id;

  const importacao = await portas.importacao(pedido.import_id, marcaId, contaId);
  if (importacao.erro) return falhaDeLeitura("importacao", importacao.erro);
  if (!importacao.dados) return recusar(404, "importacao_nao_encontrada", false);
  const registro = importacao.dados;

  /*
   * Já vinculado é sucesso, e sem tocar no banco.
   *
   * A RPC é idempotente e devolveria o mesmo documento, mas a chamada custa
   * uma ida com a chave de serviço para descobrir o que a linha já dizia. E
   * este é o caminho normal de quem recarrega a página depois de uma
   * publicação que concluiu: precisa responder "está completa", não repetir.
   */
  if (registro.source_document_id) {
    return {
      ok: true,
      documentoId: registro.source_document_id,
      paginas: registro.page_count,
      paginasSemSecao: 0,
      jaEstava: true,
    };
  }

  const defeito = conferirManifesto(registro);
  if (defeito) {
    // Defeito do relatório é permanente: a transação A já gravou, e nenhuma
    // repetição desta chamada muda o que está lá.
    return recusar(422, defeito, false);
  }
  const doRelatorio = registro.report.paginas!;

  /*
   * Slugs → ids, sob RLS e dentro desta marca.
   *
   * A distinção entre "a consulta rodou e o slug não existe" e "a consulta
   * falhou" é a coisa mais importante deste trecho. A primeira é um fato sobre
   * a extração: vira página sem seção, com motivo, e a publicação segue —
   * recusar tudo por causa de uma linha perderia o manifesto inteiro, e o
   * manifesto existe justamente para registrar ausência em vez de descartá-la.
   *
   * A segunda é um acidente, e tratá-la como a primeira era o pior defeito
   * possível aqui: uma queda de banco gravava as mil páginas como `sem-secao`,
   * o vínculo fechava, e a idempotência por `sha256` impedia qualquer
   * repetição de consertar. A estrutura do manual se perdia em silêncio, com
   * aparência de publicação bem-sucedida. Por isso: 503, repetível, e NADA
   * gravado.
   */
  const slugs = [
    ...new Set(doRelatorio.map((p) => p.secao_slug).filter((s): s is string => Boolean(s))),
  ];
  let porSlug = new Map<string, string>();
  if (slugs.length > 0) {
    const resolvidas = await portas.secoes(marcaId, slugs);
    if (resolvidas.erro || !resolvidas.dados) {
      return falhaDeLeitura("secoes", resolvidas.erro);
    }
    porSlug = resolvidas.dados;
  }

  const paginas = doRelatorio
    // Ordem estável: o payload precisa ser idêntico entre tentativas, e a
    // ordem de um array jsonb é a de gravação, não a numérica.
    .slice()
    .sort((a, b) => a.pagina - b.pagina)
    .map((p) => {
      const id = p.secao_slug ? porSlug.get(p.secao_slug) : undefined;
      return {
        pagina: p.pagina,
        largura_pt: p.largura_pt,
        altura_pt: p.altura_pt,
        rotacao: p.rotacao ?? 0,
        tem_texto: p.tem_texto === true,
        caracteres: p.caracteres ?? 0,
        document_id: id ?? null,
        motivo_da_cobertura: id
          ? ""
          : p.secao_slug
            ? `seção "${p.secao_slug}" não foi encontrada na marca`
            : "página não entrou em nenhuma seção da extração",
        classificacao: null,
        confianca: null,
      };
    });

  const semSecao = paginas.filter((p) => p.document_id === null).length;

  const { id, erro } = await portas.registrar({
    p_workspace_id: contaId,
    p_brand_id: marcaId,
    p_storage_path: registro.storage_path,
    p_pdf_sha256: registro.pdf_sha256,
    p_byte_size: registro.report.bytes ?? 0,
    p_page_count: registro.page_count,
    p_tipo: "manual",
    p_idioma: null,
    p_titulo: typeof registro.report.arquivo === "string" ? registro.report.arquivo : "",
    p_paginas: paginas,
    p_created_by: ator.dados.id,
    /*
     * O vínculo vai DENTRO da transação.
     *
     * Ele era escrito depois, pela rota, com o cliente da sessão — e não podia
     * funcionar: `authenticated` não tem `update` em `brand_imports`. Toda
     * publicação falharia com 42501 no último passo, e a rota chamaria isso de
     * falha temporária, oferecendo eternamente uma nova tentativa que jamais
     * concluiria. Agora documento, manifesto e vínculo acontecem juntos ou
     * nenhum acontece.
     */
    p_import_id: registro.import_id,
  });

  if (erro || !id) {
    const { codigo, status } = classificarErroDaRpc(erro);
    return recusar(status, codigo, codigo === "falha_temporaria", mensagemTecnica(erro));
  }

  return {
    ok: true,
    documentoId: id,
    paginas: paginas.length,
    paginasSemSecao: semSecao,
    jaEstava: false,
  };
}

function mensagemTecnica(erro: unknown): string | undefined {
  const e = erro as { code?: string; message?: string } | null;
  if (!e) return undefined;
  return [e.code, e.message].filter(Boolean).join(" ") || undefined;
}
