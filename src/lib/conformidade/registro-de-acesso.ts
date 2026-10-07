/**
 * O registro de acesso do Marco Civil (Lei 12.965/2014, art. 15) — as regras,
 * sem rede e sem banco. Ver a migration `acessos_e_aceites`.
 *
 * O `proxy` registra no máximo UMA linha por pessoa, por hora e por IP: o
 * cookie `bm_acesso` guarda a marca da última hora registrada. Sem a marca, o
 * banco ganharia uma linha a cada página — e o registro não precisa disso:
 * a lei pede "data e hora de uso a partir de determinado IP".
 *
 * O IP vem do cabeçalho que a Vercel escreve (`x-forwarded-for`, o primeiro
 * endereço; a Vercel sobrescreve o que o navegador mandar). Valor que não é
 * IP não vira registro.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export const COOKIE_DO_ACESSO = "bm_acesso";

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-fA-F:]{2,39}$/;

export function ipDoPedido(cabecalhos: { get(nome: string): string | null }): string | null {
  const bruto = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() || cabecalhos.get("x-real-ip")?.trim() || "";
  if (IPV4.test(bruto)) return bruto;
  if (IPV6.test(bruto) && bruto.includes(":")) return bruto;
  return null;
}

/** A marca da hora corrente para este IP — muda a cada hora e a cada IP. */
export function marcaDoAcesso(ip: string, agora: number): string {
  return `${Math.floor(agora / 3_600_000)}|${ip}`;
}

export function precisaRegistrar(marcaDoCookie: string | undefined, marcaAtual: string): boolean {
  return marcaDoCookie !== marcaAtual;
}
