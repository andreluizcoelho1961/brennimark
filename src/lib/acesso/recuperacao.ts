/**
 * "Esqueci a senha" — as regras, sem rede e sem banco (03/10/2026).
 *
 * O caminho:
 *   1. a pessoa pede pelo e-mail em `/esqueci-senha`. A resposta é SEMPRE a
 *      mesma, exista o login ou não: a tela não serve para descobrir quem é
 *      cliente;
 *   2. existindo o login, o servidor gera um SEGREDO, guarda só o resumo
 *      (sha-256) e a hora no `app_metadata` (que só a chave de serviço
 *      escreve), e manda por e-mail um link do provedor de autenticação que
 *      abre a sessão e leva a `/nova-senha?r=<segredo>`;
 *   3. em `/nova-senha`, a senha só muda se o segredo do endereço bate com o
 *      resumo guardado e está no prazo. Ter a sessão não basta: uma sessão
 *      esquecida aberta num computador não troca a senha de ninguém sem o
 *      e-mail.
 *
 * O clique no e-mail é também a PROVA DE QUE O E-MAIL É DA PESSOA — o que a
 * compra não prova (o Stripe não confere o e-mail de quem paga). Por isso a
 * confirmação da assinatura manda quem não criou a senha para cá.
 *
 * Pedir de novo antes de {@link INTERVALO_ENTRE_PEDIDOS_S} segundos não manda
 * outro e-mail: sem isso, a tela viraria um jeito de encher a caixa de alguém.
 * Pedir NÃO bloqueia o acesso de ninguém — a senha antiga vale até a troca.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export const PRAZO_DA_RECUPERACAO_MINUTOS = 60;
export const INTERVALO_ENTRE_PEDIDOS_S = 60;
export const CAMINHO_DA_NOVA_SENHA = "/nova-senha";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function lerEmail(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const email = valor.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

export function gerarSegredo(aleatorio: (b: Uint8Array) => Uint8Array = (b) => globalThis.crypto.getRandomValues(b)): string {
  return Array.from(aleatorio(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function resumoDoSegredo(segredo: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(segredo));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mesmoTexto(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

function meta(appMetadata: unknown): Record<string, unknown> {
  return appMetadata && typeof appMetadata === "object" ? (appMetadata as Record<string, unknown>) : {};
}

function horaDoPedido(appMetadata: unknown): number | null {
  const valor = meta(appMetadata).recuperacao_pedida_em;
  if (typeof valor !== "string") return null;
  const hora = new Date(valor).getTime();
  return Number.isNaN(hora) ? null : hora;
}

/** Pode mandar outro e-mail agora? */
export function podePedirDeNovo(appMetadata: unknown, agora: number): boolean {
  const hora = horaDoPedido(appMetadata);
  return hora === null || agora - hora >= INTERVALO_ENTRE_PEDIDOS_S * 1000;
}

/** O que gravar no login ao mandar o e-mail. */
export function marcaDoPedido(resumo: string, agora: number): Record<string, string> {
  return { recuperacao_resumo: resumo, recuperacao_pedida_em: new Date(agora).toISOString() };
}

/** O que apagar do login quando a senha muda: o segredo serve uma vez. */
export const MARCA_APAGADA = { recuperacao_resumo: null, recuperacao_pedida_em: null } as const;

export type Conferencia = "confere" | "sem-pedido" | "nao-confere" | "vencido";

export async function conferirSegredo(appMetadata: unknown, segredo: unknown, agora: number): Promise<Conferencia> {
  const resumoGuardado = meta(appMetadata).recuperacao_resumo;
  const hora = horaDoPedido(appMetadata);
  if (typeof resumoGuardado !== "string" || hora === null) return "sem-pedido";
  if (typeof segredo !== "string" || !/^[0-9a-f]{64}$/.test(segredo)) return "nao-confere";
  if (!mesmoTexto(await resumoDoSegredo(segredo), resumoGuardado)) return "nao-confere";
  if (agora - hora > PRAZO_DA_RECUPERACAO_MINUTOS * 60_000) return "vencido";
  return "confere";
}
