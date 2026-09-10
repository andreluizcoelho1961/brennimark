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
 * Este módulo recebe apenas `{ marca, import_id }`. Todo o manifesto sai do
 * relatório que a transação A gravou em `brand_imports.report`, lido aqui sob
 * RLS.
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
 * O custo é o relatório carregar o manifesto (uma linha de geometria por
 * página). É `jsonb` e o Postgres o guarda fora da linha; medido no passo 5.
 *
 * ─── Os dois clientes, e por que não é um só ────────────────────────────
 *
 * `service_role` tem `bypassrls`, mas **grants continuam valendo**: ele não
 * tem `select` em `brand_documents`, de propósito, para a superfície da chave
 * ficar no mínimo. Então marca, importação e seção são resolvidas com a
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
  /** A chave primária da linha, para o vínculo final. */
  id: string;
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

/** O pedido inteiro. Duas cordas, e nenhuma delas é um id privilegiado. */
export interface PedidoDeRegistro {
  marca: string;
  import_id: string;
}

export interface PortasDoRegistro {
  /** O usuário da SESSÃO. Nunca vem do corpo da requisição. */
  ator(): Promise<{ id: string } | null>;
  /** Resolve a marca pela chave, sob RLS. */
  marca(chave: string): Promise<{ id: string; workspace_id: string } | null>;
  /** Lê a importação, sob RLS, exigindo marca e conta. */
  importacao(
    importId: string,
    brandId: string,
    workspaceId: string,
  ): Promise<RegistroDeImportacao | null>;
  /** Resolve slugs de seção para ids, sob RLS, dentro desta marca. */
  secoes(brandId: string, slugs: string[]): Promise<Map<string, string>>;
  /** Chama a RPC com a chave de serviço. */
  registrar(argumentos: Record<string, unknown>): Promise<{ id: string | null; erro: unknown }>;
  /** Liga o registro de importação ao documento-fonte, sob RLS. */
  vincular(id: string, sourceDocumentId: string): Promise<{ erro: unknown }>;
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
  | "marca_nao_encontrada"
  | "importacao_nao_encontrada"
  | "manifesto_ausente"
  | "manifesto_invalido"
  | "sem_permissao"
  | "falha_ao_vincular"
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
    case "P0002": // no_data_found — o objeto do Storage não está lá
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
  if (!pedido?.marca || !UUID.test(pedido?.import_id ?? "")) {
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
  if (!ator) return recusar(401, "nao_autenticado", false);

  const marca = await portas.marca(pedido.marca);
  // "Não existe" e "não é sua" respondem igual: responder diferente
  // confirmaria o endereço para quem sonda.
  if (!marca) return recusar(404, "marca_nao_encontrada", false);

  const registro = await portas.importacao(pedido.import_id, marca.id, marca.workspace_id);
  if (!registro) return recusar(404, "importacao_nao_encontrada", false);

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
   * Um slug que não resolve NÃO vira erro: vira página sem seção, com motivo.
   * Recusar a publicação inteira porque uma seção não foi encontrada perderia
   * o manifesto todo por causa de uma linha — e o manifesto existe justamente
   * para que ausência seja registrada em vez de descartada. A contagem volta
   * no resultado, para a interface mostrar como pendência.
   */
  const slugs = [
    ...new Set(doRelatorio.map((p) => p.secao_slug).filter((s): s is string => Boolean(s))),
  ];
  const porSlug =
    slugs.length > 0 ? await portas.secoes(marca.id, slugs) : new Map<string, string>();

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
    p_workspace_id: marca.workspace_id,
    p_brand_id: marca.id,
    p_storage_path: registro.storage_path,
    p_pdf_sha256: registro.pdf_sha256,
    p_byte_size: registro.report.bytes ?? 0,
    p_page_count: registro.page_count,
    p_tipo: "manual",
    p_idioma: null,
    p_titulo: typeof registro.report.arquivo === "string" ? registro.report.arquivo : "",
    p_paginas: paginas,
    p_created_by: ator.id,
  });

  if (erro || !id) {
    const { codigo, status } = classificarErroDaRpc(erro);
    return recusar(status, codigo, codigo === "falha_temporaria", mensagemTecnica(erro));
  }

  /*
   * O vínculo é escrito por último, e ele é o SINAL de publicação completa.
   *
   * `source_document_id is null` significa incompleta. Falhar aqui deixa o
   * documento e o manifesto já gravados e a linha ainda marcada como
   * incompleta — que é o erro seguro dos dois, porque a repetição é
   * idempotente e a próxima tentativa fecha o vínculo sem duplicar nada.
   */
  const { erro: erroDoVinculo } = await portas.vincular(registro.id, id);
  if (erroDoVinculo) {
    return recusar(503, "falha_ao_vincular", true, mensagemTecnica(erroDoVinculo));
  }

  return { ok: true, documentoId: id, paginas: paginas.length, paginasSemSecao: semSecao, jaEstava: false };
}

function mensagemTecnica(erro: unknown): string | undefined {
  const e = erro as { code?: string; message?: string } | null;
  if (!e) return undefined;
  return [e.code, e.message].filter(Boolean).join(" ") || undefined;
}
