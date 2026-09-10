/**
 * O rastro de um arquivo de terceiro que ficou sem destino.
 *
 * ─── Por que existe ─────────────────────────────────────────────────────
 *
 * Quando a publicação falha, o importador tenta tirar do Storage o PDF e as
 * imagens que já tinha enviado. Se nem a remoção nem a fila durável aceitam, o
 * arquivo fica lá sem marca, sem procedência e sem pendência — e é material de
 * um cliente. O PR #22 fez essa falha deixar de ser silenciosa, mas o aviso era
 * um `console.error` no NAVEGADOR de quem importava: sumia quando a aba
 * fechava e não chegava a nenhum log que alguém consulte. Um rastro que ninguém
 * lê não é rastro.
 *
 * Este módulo é a metade do servidor: recebe o aviso, confere quem manda e
 * sobre qual conta, e escreve a linha no log do servidor — o que chega à
 * Vercel.
 *
 * Puro de propósito, com as dependências injetadas: módulo de rota do App
 * Router só exporta verbos HTTP, e regra que não se testa sem navegador não é
 * regra. Também não importa nada do servidor, porque o ajudante do cliente
 * reaproveita os tipos daqui.
 */

export const ORIGENS_DO_RASTRO = ["envio", "fila", "imagens"] as const;

/**
 * De onde veio o arquivo perdido. São os três pontos do importador que podem
 * deixar um objeto sem destino, e o nome diz qual garantia falhou:
 *
 *   envio    o envio falhou no meio, e a limpeza do que já tinha subido também
 *   fila     a publicação falhou, a remoção do PDF falhou e a fila recusou
 *   imagens  a publicação falhou e a limpeza das imagens de página falhou
 */
export type OrigemDoRastro = (typeof ORIGENS_DO_RASTRO)[number];

export interface EventoDeRastro {
  origem: OrigemDoRastro;
  caminhos: string[];
  /** O SQLSTATE da recusa, quando houver. Só a origem `fila` tem um. */
  sqlstate?: string | null;
}

/**
 * Teto de caminhos por aviso. Uma importação grande deixa no máximo o PDF e as
 * imagens de página; 200 é folga, e o teto impede que um corpo arbitrário vire
 * uma linha de log de megabytes.
 */
export const MAXIMO_DE_CAMINHOS = 200;
const MAXIMO_DO_CAMINHO = 512;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SQLSTATE = /^(?:[0-9A-Z]{5}|PGRST\d{3})$/;

type Validacao =
  | { ok: true; evento: EventoDeRastro; conta: string }
  | { ok: false };

/**
 * A forma do aviso, e nada além dela.
 *
 * Todo caminho do importador começa pela conta (`<conta>/<importação ou
 * marca>/...`), e é por ela que a rota decide se quem manda pode falar sobre
 * aqueles arquivos. Por isso os caminhos de um aviso precisam ser todos da
 * MESMA conta: um aviso que misturasse contas pediria uma autorização que a
 * rota não sabe dar.
 */
export function validarRastro(corpo: unknown): Validacao {
  const c = corpo as Partial<Record<keyof EventoDeRastro, unknown>> | null;
  if (!c || typeof c !== "object") return { ok: false };
  if (!ORIGENS_DO_RASTRO.includes(c.origem as OrigemDoRastro)) return { ok: false };
  if (!Array.isArray(c.caminhos)) return { ok: false };
  if (c.caminhos.length < 1 || c.caminhos.length > MAXIMO_DE_CAMINHOS) return { ok: false };

  let conta: string | null = null;
  for (const caminho of c.caminhos) {
    if (typeof caminho !== "string" || caminho.length > MAXIMO_DO_CAMINHO) return { ok: false };
    if (caminho.startsWith("/") || caminho.split("/").includes("..")) return { ok: false };
    const primeiro = caminho.split("/")[0];
    if (!UUID.test(primeiro)) return { ok: false };
    if (conta && primeiro.toLowerCase() !== conta) return { ok: false };
    conta = primeiro.toLowerCase();
  }

  /*
   * O SQLSTATE é informação de diagnóstico, não de autorização: um valor fora
   * do formato vira `null` em vez de derrubar o aviso inteiro. Recusar o
   * rastro por causa de um campo acessório perderia justamente os caminhos,
   * que são o que importa.
   */
  const sqlstate =
    typeof c.sqlstate === "string" && SQLSTATE.test(c.sqlstate) ? c.sqlstate : null;

  return {
    ok: true,
    conta: conta!,
    evento: { origem: c.origem as OrigemDoRastro, caminhos: c.caminhos as string[], sqlstate },
  };
}

export interface PortasDoRastro {
  /** O usuário da SESSÃO, com o token validado. Nunca vem do corpo. */
  ator(): Promise<{ id: string } | null>;
  /**
   * Se quem chama é membro da conta, sob RLS.
   * `null` quando a consulta não rodou — o que é diferente de "não é membro".
   */
  membroDaConta(contaId: string): Promise<boolean | null>;
  /** Escreve a linha no log do servidor. */
  registrar(linha: Record<string, unknown>): void;
}

export type RespostaDoRastro =
  | { status: 202; codigo: "registrado" }
  | { status: 400; codigo: "pedido_invalido" }
  | { status: 401; codigo: "nao_autenticado" }
  | { status: 404; codigo: "nao_encontrado" };

export async function receberRastro(
  corpo: unknown,
  portas: PortasDoRastro,
): Promise<RespostaDoRastro> {
  const validacao = validarRastro(corpo);
  if (!validacao.ok) return { status: 400, codigo: "pedido_invalido" };

  const ator = await portas.ator();
  if (!ator) return { status: 401, codigo: "nao_autenticado" };

  const membro = await portas.membroDaConta(validacao.conta);

  /*
   * Não membro: recusado e NÃO registrado. Sem isto, qualquer sessão válida
   * escreveria no log linhas falsas sobre arquivos da conta de outra pessoa —
   * e o log é justamente o que alguém vai ler para decidir o que apagar.
   * "Não existe" e "não é sua" respondem igual, para não confirmar a conta.
   */
  if (membro === false) return { status: 404, codigo: "nao_encontrado" };

  /*
   * Consulta de pertencimento que FALHOU: o rastro é registrado mesmo assim,
   * marcado como não verificado. Recusar aqui perderia o aviso exatamente
   * quando o banco está tropeçando — que é quando arquivos ficam sem destino.
   * A marca na linha diz a quem lê que a conta não foi conferida.
   */
  portas.registrar({
    level: "error",
    msg: "importacao_deixou_objeto_sem_destino",
    origem: validacao.evento.origem,
    conta: validacao.conta,
    conta_verificada: membro === true,
    ator: ator.id,
    caminhos: validacao.evento.caminhos,
    sqlstate: validacao.evento.sqlstate ?? null,
  });

  return { status: 202, codigo: "registrado" };
}
