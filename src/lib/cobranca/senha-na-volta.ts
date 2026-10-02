/**
 * A senha criada na volta do pagamento — as regras, sem rede e sem banco.
 *
 * Decisão do André (02/10/2026): quem assina pelo site paga, volta para
 * `/assinar/obrigado`, cria a senha ali e entra. Sem senha provisória por
 * e-mail, e sem depender de e-mail nenhum no caminho feliz.
 *
 * ─── O risco que decide o desenho ───────────────────────────────────────
 *
 * O endereço da volta leva o identificador da sessão de checkout. Ele aparece
 * no histórico do navegador, numa tela compartilhada, num print. Se esse
 * identificador bastasse, quem o visse criaria a senha e tomaria a conta.
 *
 * Por isso ele NÃO basta. Quem abre o checkout pelo site recebe uma PROVA DO
 * NAVEGADOR: um segredo aleatório num cookie que só o servidor lê
 * (`httpOnly`). O Stripe guarda só o RESUMO dele (sha-256) nos metadados da
 * sessão. Criar a senha exige as três coisas juntas: a sessão paga, o cookie,
 * e o resumo do cookie igual ao que o Stripe guardou. Um link copiado, aberto
 * em outro navegador, não leva o cookie.
 *
 * E mesmo com a prova:
 *   - só vale por {@link PRAZO_DA_SENHA_NA_VOLTA_HORAS} horas depois da compra;
 *   - só vale para o login que nasceu DESTA compra (`criado_pela_assinatura`
 *     igual à assinatura da sessão) e que nunca entrou. Login que já existia
 *     — de outra conta, ou de uma compra ANTERIOR com o mesmo e-mail — NUNCA
 *     tem a senha criada por aqui. Corrigido em 02/10/2026: a primeira versão
 *     aceitava qualquer login nascido de compra, e quem comprasse com o
 *     e-mail de um cliente que ainda não criou a senha tomaria a conta dele
 *     (o Stripe não confere se o e-mail é de quem paga). Achado no teste
 *     real, quando uma segunda compra criou a senha do login da primeira;
 *   - vale uma vez: criada a senha, o login fica marcado e entra; a próxima
 *     tentativa vê "já tem acesso".
 *
 * O link de piloto do Console não leva prova (o checkout é aberto no
 * navegador de quem administra, não de quem paga). Para ele, e para quem
 * fechar a aba antes da hora, o caminho continua sendo o link de primeiro
 * acesso gerado no Console.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export const COOKIE_DA_PROVA = "bm_prova_da_compra";
/** O cookie só viaja para a rota que o confere — nenhuma outra o recebe. */
export const CAMINHO_DO_COOKIE = "/api/cobranca/senha";
export const PRAZO_DA_SENHA_NA_VOLTA_HORAS = 24;
/** Onde o resumo da prova mora nos metadados da sessão de checkout. */
export const CHAVE_DA_PROVA_NO_STRIPE = "prova_do_navegador";

const SESSAO = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

/** Só identificador de sessão de checkout bem formado chega ao Stripe. */
export function sessaoValida(valor: unknown): valor is string {
  return typeof valor === "string" && SESSAO.test(valor);
}

/** 32 bytes do gerador criptográfico, em hexadecimal. */
export function gerarProva(aleatorio: (b: Uint8Array) => Uint8Array = (b) => globalThis.crypto.getRandomValues(b)): string {
  return Array.from(aleatorio(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function resumoDaProva(prova: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(prova));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Comparação que não para no primeiro caractere diferente. */
export function mesmoTexto(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

/** A sessão de checkout como o Stripe a descreve AGORA — só o que a decisão lê. */
export type SessaoDaCompra = {
  paga: boolean;
  /** Quando a sessão foi criada, em milissegundos. */
  criadaEm: number;
  email: string | null;
  idAssinatura: string | null;
  resumoDaProva: string | null;
  /** O nome que a pessoa digitou no `/assinar` — vai para o perfil. */
  comprador: string | null;
  /** O nome da empresa digitado no `/assinar`. */
  empresa: string | null;
};

export type LoginDaCompra = {
  criadoPelaCobranca: boolean;
  /** A assinatura cuja compra criou o login; `null` em login sem a marca. */
  assinaturaDeOrigem: string | null;
  jaEntrou: boolean;
  senhaJaCriada: boolean;
};

export type Momento =
  /** Sem cookie, ou cookie que não confere: nada é revelado sobre a compra. */
  | "sem-prova"
  /** Pago mas a conta ainda não nasceu (o webhook não chegou), ou ainda não pago. */
  | "aguardando"
  | "expirado"
  | "criar-senha"
  /** O e-mail já tinha login, ou a senha já foi criada: o caminho é entrar. */
  | "ja-tem-acesso";

export function momentoDaVolta(p: {
  provaConfere: boolean;
  sessao: SessaoDaCompra | null;
  contaExiste: boolean;
  login: LoginDaCompra | null;
  agora: number;
}): Momento {
  if (!p.provaConfere || !p.sessao) return "sem-prova";
  if (p.agora - p.sessao.criadaEm > PRAZO_DA_SENHA_NA_VOLTA_HORAS * 3_600_000) return "expirado";
  if (!p.sessao.paga || !p.contaExiste || !p.login) return "aguardando";
  if (!p.login.criadoPelaCobranca || p.login.assinaturaDeOrigem === null
      || p.login.assinaturaDeOrigem !== p.sessao.idAssinatura
      || p.login.jaEntrou || p.login.senhaJaCriada) return "ja-tem-acesso";
  return "criar-senha";
}

/** O login lido do provedor de autenticação, de forma defensiva. */
export function loginDaCompra(usuario: { app_metadata?: unknown; last_sign_in_at?: string | null }): LoginDaCompra {
  const meta = (usuario.app_metadata && typeof usuario.app_metadata === "object" ? usuario.app_metadata : {}) as Record<string, unknown>;
  return {
    criadoPelaCobranca: meta.criado_pela_cobranca === true,
    assinaturaDeOrigem: typeof meta.criado_pela_assinatura === "string" && meta.criado_pela_assinatura.length > 0
      ? meta.criado_pela_assinatura : null,
    jaEntrou: typeof usuario.last_sign_in_at === "string" && usuario.last_sign_in_at.length > 0,
    senhaJaCriada: meta.senha_criada_na_compra !== undefined && meta.senha_criada_na_compra !== null,
  };
}
