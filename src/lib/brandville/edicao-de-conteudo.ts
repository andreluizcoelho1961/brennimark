// Caminho relativo, não `@/`: o tsconfig dos testes não resolve o alias, e um
// módulo com regra de negócio precisa ser testável sem depender do bundler.
import type { DocPageEntry, DocStatus } from "../../content/docs";

/**
 * O contrato de edição de uma página do manual.
 *
 * O defeito que este módulo corrige
 * ---------------------------------
 * A importação persistia TODAS as linhas de uma seção. A edição recusava mais
 * de 40 entradas, ou qualquer entrada acima de 4.000 caracteres. Uma seção de
 * 41 linhas entrava pela importação e não saía pela edição — nem para trocar o
 * título, porque o editor reenviava o corpo inteiro e a rota reprovava o corpo.
 *
 * A pessoa precisava REDUZIR o manual do cliente para salvar uma alteração que
 * não dizia respeito ao texto. Truncar conteúdo de terceiro para contornar um
 * limite nosso não é correção, é perda.
 *
 * As duas mudanças
 * ----------------
 * 1. **Atualização parcial.** Campo omitido fica intocado. Renomear, mudar
 *    grupo ou status deixa de exigir o reenvio do corpo — e um cliente que não
 *    sabe do corpo não pode estragá-lo.
 *
 * 2. **Um teto de REQUISIÇÃO, não de conteúdo.** Os limites por parágrafo e
 *    por contagem eram editoriais disfarçados de proteção: não protegiam nada
 *    que o teto de requisição já não proteja, e recusavam conteúdo legítimo. O
 *    que sobra é um limite de tamanho total, fundamentado abaixo.
 *
 * O que este módulo NÃO resolve
 * -----------------------------
 * Alterar o corpo ainda o envia inteiro. Para documentos que passem do teto de
 * requisição, editar uma frase exigirá operações menores. A coluna `blocks` já
 * é lida, renderizada, indexada e versionada; o que ainda não existe é seu
 * contrato de edição. Ele será decidido junto do editor visual, não por esta
 * correção textual.
 */

/**
 * O teto de tamanho da requisição de edição.
 *
 * De onde sai o número, já que "grande" não é fundamento:
 *
 * - Uma **referência observada**: a fixture de escala tem 850 páginas com texto
 *   e 388.006 caracteres. Isto demonstra que o caso de teste cabe com folga;
 *   não estabelece um máximo para PDFs aceitos pelo produto.
 * - O **teto da plataforma**: uma Vercel Function recusa corpo acima de 4,5 MB
 *   com `FUNCTION_PAYLOAD_TOO_LARGE`, que é erro de infraestrutura e chega ao
 *   usuário sem explicação. Este teto precisa ficar abaixo, para a recusa ser
 *   NOSSA e ter mensagem.
 *
 * 2 MiB deixa margem sobre a referência observada e fica abaixo do teto da
 * plataforma. É uma proteção operacional da rota, não um limite editorial nem
 * prova de que todo PDF válido produzirá um corpo menor.
 */
export const LIMITE_DA_REQUISICAO_EM_BYTES = 2 * 1024 * 1024;

/** O título continua tendo limite: é um campo, não o conteúdo. */
export const LIMITE_DO_TITULO = 120;

export interface CamposDeEdicao {
  title?: string;
  group?: string;
  status?: DocStatus;
  body?: string[];
}

export type PedidoDeEdicao = { slug: string } & CamposDeEdicao;

const CHAVES_ACEITAS = new Set(["slug", "title", "group", "status", "body"]);

function corposIguais(a: readonly string[] | undefined, b: readonly string[] | undefined) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((linha, indice) => linha === b[indice]);
}

/**
 * Produz o contrato estreito enviado pelo editor.
 *
 * `DocPageEntry` também carrega imagens e blocos, mas o editor textual não os
 * edita. Mandá-los mesmo assim permitiria que uma API os ignorasse e ainda
 * respondesse "salvo". Só os quatro campos visíveis nesta tela atravessam a
 * rede, e somente quando mudaram.
 */
export function criarPedidoDeEdicao(
  atual: DocPageEntry,
  persistido: DocPageEntry,
): PedidoDeEdicao | null {
  const pedido: PedidoDeEdicao = { slug: atual.slug };
  if (atual.title !== persistido.title) pedido.title = atual.title;
  if (atual.group !== persistido.group) pedido.group = atual.group;
  if (atual.status !== persistido.status) pedido.status = atual.status;
  if (!corposIguais(atual.body, persistido.body)) pedido.body = [...(atual.body ?? [])];
  return Object.keys(pedido).length > 1 ? pedido : null;
}

export type Interpretacao =
  | { ok: true; slug: string; campos: CamposDeEdicao }
  | { ok: false; status: 400 | 413; mensagem: string };

const STATUS_VALIDOS = new Set<DocStatus>(["ready", "draft", "pending"]);

/**
 * Lê a edição pedida, aceitando ausência.
 *
 * `undefined` e valor são coisas diferentes aqui, e é essa distinção que faz a
 * atualização parcial funcionar: ausente significa "não mexa", nunca "apague".
 * Por isso a leitura testa a PRESENÇA da chave antes do tipo — `"title" in
 * entrada` e não `typeof entrada.title`, que trataria ausência e tipo errado
 * como o mesmo caso.
 */
export function interpretarEdicao(
  entrada: unknown,
  opcoes: { gruposValidos: readonly string[]; bytesDaRequisicao: number },
): Interpretacao {
  if (opcoes.bytesDaRequisicao > LIMITE_DA_REQUISICAO_EM_BYTES) {
    return {
      ok: false,
      status: 413,
      mensagem: "A alteração é grande demais para uma requisição. Divida-a em partes.",
    };
  }

  if (typeof entrada !== "object" || entrada === null) {
    return { ok: false, status: 400, mensagem: "Revise os campos da alteração." };
  }
  const e = entrada as Record<string, unknown>;

  if (Object.keys(e).some((chave) => !CHAVES_ACEITAS.has(chave))) {
    return { ok: false, status: 400, mensagem: "A alteração contém campos que esta tela não edita." };
  }

  const slug = typeof e.slug === "string" ? e.slug.trim() : "";
  if (!slug) return { ok: false, status: 400, mensagem: "A alteração precisa dizer qual página." };

  const campos: CamposDeEdicao = {};

  if ("title" in e) {
    const title = typeof e.title === "string" ? e.title.trim() : "";
    if (!title || title.length > LIMITE_DO_TITULO) {
      return { ok: false, status: 400, mensagem: "Revise o título." };
    }
    campos.title = title;
  }

  if ("group" in e) {
    const group = typeof e.group === "string" ? e.group.trim() : "";
    if (!opcoes.gruposValidos.includes(group)) {
      return { ok: false, status: 400, mensagem: "Revise a seção." };
    }
    campos.group = group;
  }

  if ("status" in e) {
    const status = e.status as DocStatus;
    if (!STATUS_VALIDOS.has(status)) {
      return { ok: false, status: 400, mensagem: "Revise o status." };
    }
    campos.status = status;
  }

  if ("body" in e) {
    if (!Array.isArray(e.body) || e.body.some((item) => typeof item !== "string")) {
      return { ok: false, status: 400, mensagem: "Revise os parágrafos." };
    }
    // O corpo é conteúdo do cliente. Validação não é autorização para
    // normalizar: espaços e entradas vazias permanecem exatamente como vieram.
    campos.body = [...(e.body as string[])];
  }

  if (Object.keys(campos).length === 0) {
    return { ok: false, status: 400, mensagem: "A alteração não muda nada." };
  }

  return { ok: true, slug, campos };
}
