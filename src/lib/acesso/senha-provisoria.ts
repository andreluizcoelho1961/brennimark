/**
 * A senha provisória — as regras, sem rede e sem banco.
 *
 * Fatia 2 do plano da interface (18/09/2026): o administrador cadastra a
 * pessoa, o SERVIDOR gera a senha e a mostra uma vez, e a pessoa troca a
 * senha no primeiro acesso. O banco garante a metade que importa — senha
 * provisória não dá acesso a nada (`supabase/migrations/…_senha_provisoria.sql`);
 * aqui mora o que o servidor e a moldura decidem.
 *
 * Onde vive a marca de "provisória": em `app_metadata`, que só a chave de
 * serviço escreve. Em `user_metadata` a própria pessoa a apagaria.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

/** Prazo decidido pelo André em 18/09: cobre um fim de semana entre o
 *  cadastro e o primeiro acesso, sem deixar senha esquecida valendo. */
export const PRAZO_DA_SENHA_PROVISORIA_HORAS = 72;

/**
 * Sem os caracteres que se confundem ao ditar ou copiar à mão: 0/O, 1/l/I.
 * 56 símbolos × 16 posições ≈ 93 bits — mais que suficiente para uma senha
 * que vale três dias e não dá acesso a nada antes de ser trocada.
 */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const TAMANHO = 16;

/**
 * Gera a senha com o gerador criptográfico do ambiente (Web Crypto, presente
 * no Node do servidor). `Math.random` não serve: é previsível.
 *
 * Amostragem por rejeição: `byte % 56` favoreceria os primeiros símbolos,
 * porque 256 não é múltiplo de 56. Descartar os bytes acima do maior múltiplo
 * mantém a distribuição uniforme.
 *
 * Sai em quatro grupos de quatro ("Ab3d-…"), para ser lida em voz alta sem
 * perder a conta. Os hífens fazem parte da senha.
 */
export function gerarSenhaProvisoria(
  aleatorio: (bytes: Uint8Array) => Uint8Array = (b) => globalThis.crypto.getRandomValues(b),
): string {
  const limite = 256 - (256 % ALFABETO.length);
  const simbolos: string[] = [];
  while (simbolos.length < TAMANHO) {
    for (const byte of aleatorio(new Uint8Array(32))) {
      if (byte < limite) simbolos.push(ALFABETO[byte % ALFABETO.length]);
      if (simbolos.length === TAMANHO) break;
    }
  }
  return [0, 4, 8, 12].map((i) => simbolos.slice(i, i + 4).join("")).join("-");
}

/** Até quando a senha gerada agora vale, no formato que o banco lê. */
export function prazoDaSenhaProvisoria(agora: Date = new Date()): string {
  return new Date(agora.getTime() + PRAZO_DA_SENHA_PROVISORIA_HORAS * 3_600_000).toISOString();
}

/**
 * O prazo gravado no login, ou `null` se a senha não é provisória.
 *
 * Lê de forma defensiva: `app_metadata` vem do provedor de autenticação, e um
 * valor que não é data não pode virar "sem prazo" — isso liberaria a pessoa
 * da troca. Valor estranho conta como provisória já vencida.
 */
export function senhaProvisoriaAte(appMetadata: unknown): Date | null {
  if (!appMetadata || typeof appMetadata !== "object") return null;
  const valor = (appMetadata as Record<string, unknown>).senha_provisoria_ate;
  if (valor === undefined || valor === null || valor === "") return null;
  const data = typeof valor === "string" ? new Date(valor) : new Date(Number.NaN);
  return Number.isNaN(data.getTime()) ? new Date(0) : data;
}

export function senhaProvisoriaVencida(ate: Date, agora: Date = new Date()): boolean {
  return ate.getTime() <= agora.getTime();
}

/**
 * O que a moldura faz com quem tem senha provisória: só a troca é permitida.
 *
 * Nas páginas, desvio para a troca. Na API, recusa — um desvio para HTML
 * seria lido como resposta pelo `fetch` e quebraria em silêncio.
 */
export const CAMINHO_DA_TROCA = "/trocar-senha";
const LIVRES = [CAMINHO_DA_TROCA, "/api/conta/trocar-senha", "/auth/callback"];

export function desvioDaSenhaProvisoria(
  pathname: string,
  appMetadata: unknown,
): "seguir" | "trocar" | "recusar" {
  if (!senhaProvisoriaAte(appMetadata)) return "seguir";
  if (LIVRES.some((livre) => pathname === livre || pathname.startsWith(`${livre}/`))) return "seguir";
  return pathname.startsWith("/api/") ? "recusar" : "trocar";
}

/**
 * A senha que a pessoa escolhe na troca.
 *
 * 12 caracteres no mínimo: a conta dá acesso a material de marca de clientes.
 * 72 no máximo: o provedor de autenticação guarda com bcrypt, que ignora
 * calado o que passa de 72 bytes — uma senha longa demais pareceria aceita e
 * valeria só o começo.
 */
export type RecusaDeSenha = "curta" | "longa" | "diferentes";

export function conferirSenhaNova(senha: unknown, confirmacao: unknown): RecusaDeSenha | null {
  if (typeof senha !== "string" || senha.length < 12) return "curta";
  if (new TextEncoder().encode(senha).length > 72) return "longa";
  if (senha !== confirmacao) return "diferentes";
  return null;
}
