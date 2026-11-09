/**
 * O e-mail de marketing, a parte sem rede e sem provedor (22/10/2026): os
 * cabeçalhos de saída em um clique e a leitura dos pedidos do Console.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import { CARGOS, EQUIPES } from "../cadastro/cadastro";
import { campanhaDe, idiomaDoDestinatario, type Idioma } from "./campanhas";

/** Quantas pessoas no máximo por clique. O banco recusa acima disso (`console_email_reservar`). */
export const TETO_POR_ENVIO = 25;

/**
 * Os cabeçalhos da saída em UM clique (RFC 8058). O Gmail, o iCloud e o Yahoo
 * mostram "Cancelar inscrição" ao lado do remetente, e o clique vira um POST a
 * este endereço, sem abrir página. O endereço é `/api/sair/<token>`, fora do
 * prefixo `/api/cadastro`, para o limite do Firewall do cadastro não barrar o
 * provedor de e-mail.
 */
export function cabecalhosDeSaida(linkDeUmClique: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${linkDeUmClique}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** O corpo de um clique em "Cancelar inscrição" (RFC 8058 §3.1): `List-Unsubscribe=One-Click`. */
export function ehSaidaEmUmClique(corpo: string): boolean {
  return /(^|&)List-Unsubscribe=One-Click(&|$)/.test(corpo.trim());
}

export type AcaoDeEmail =
  | { acao: "resumo"; campanha: string; cargos: string[]; equipes: string[] }
  | { acao: "teste"; campanha: string; idioma: Idioma }
  | { acao: "enviar"; campanha: string; cargos: string[]; equipes: string[]; limite: number };

const CARGOS_IDS: ReadonlySet<string> = new Set(CARGOS.map((c) => c.id));
const EQUIPES_IDS: ReadonlySet<string> = new Set(EQUIPES.map((e) => e.id));

function lista(valor: unknown, permitidos: ReadonlySet<string>): string[] | null {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) return null;
  const unicos = [...new Set(valor)];
  return unicos.every((v) => typeof v === "string" && permitidos.has(v)) ? (unicos as string[]) : null;
}

/** O pedido do Console, antes de chegar ao banco. */
export function lerAcaoDeEmail(corpo: unknown): { ok: true; acao: AcaoDeEmail } | { ok: false; motivo: string } {
  const c = (corpo ?? {}) as Record<string, unknown>;
  const campanha = campanhaDe(c.campanha);
  if (!campanha) return { ok: false, motivo: "Escolha uma campanha." };

  if (c.acao === "teste") return { ok: true, acao: { acao: "teste", campanha: campanha.id, idioma: idiomaDoDestinatario(c.idioma) } };

  if (c.acao !== "resumo" && c.acao !== "enviar") return { ok: false, motivo: "Ação desconhecida." };
  const cargos = lista(c.cargos, CARGOS_IDS);
  if (!cargos) return { ok: false, motivo: "Cargo fora da lista." };
  const equipes = lista(c.equipes, EQUIPES_IDS);
  if (!equipes) return { ok: false, motivo: "Tamanho de equipe fora da lista." };

  if (c.acao === "resumo") return { ok: true, acao: { acao: "resumo", campanha: campanha.id, cargos, equipes } };

  const limite = Number(c.limite);
  if (!Number.isInteger(limite) || limite < 1 || limite > TETO_POR_ENVIO) {
    return { ok: false, motivo: `Escolha de 1 a ${TETO_POR_ENVIO} pessoas por envio.` };
  }
  return { ok: true, acao: { acao: "enviar", campanha: campanha.id, cargos, equipes, limite } };
}
