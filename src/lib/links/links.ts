/**
 * Links de entrega — ADR-0007 §2.5 (30/09/2026). O que é puro: o código, o
 * resumo dele, a situação de um link e a validação dos pedidos.
 *
 * O código do link é o segredo que abre a entrega. Ele nasce aqui, aparece UMA
 * vez para quem cria (na resposta da criação) e nunca é guardado: o banco
 * recebe só o SHA-256 (`links_de_entrega.token_hash`). Quem perder o link cria
 * outro — é o preço de ninguém conseguir tirar links da tabela.
 *
 * As regras de validação espelham as do banco, que é quem decide; aqui elas
 * existem para a pessoa receber a mensagem certa antes da ida ao banco.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import { createHash, randomBytes } from "node:crypto";

export const PRAZO_PADRAO_DIAS = 7;
export const PRAZO_MAXIMO_DIAS = 30;
export const MAXIMO_DE_ARQUIVOS = 60;

/** 32 bytes aleatórios em base64url: 43 caracteres, 256 bits — ninguém adivinha. */
export function gerarCodigo(): string {
  return randomBytes(32).toString("base64url");
}

/** A forma de um código gerado aqui. Qualquer outra coisa nem chega ao banco. */
export function codigoValido(codigo: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(codigo);
}

/** O que o banco guarda: o SHA-256 do código, em hexadecimal. */
export function resumoDoCodigo(codigo: string): string {
  return createHash("sha256").update(codigo, "utf8").digest("hex");
}

export type SituacaoDoLink = "ativo" | "expirado" | "revogado";

export function situacaoDoLink(link: { expira_em: string; revogado_em: string | null }, agora = new Date()): SituacaoDoLink {
  if (link.revogado_em) return "revogado";
  return new Date(link.expira_em).getTime() <= agora.getTime() ? "expirado" : "ativo";
}

export type PedidoDeLink = { nome: string; destinatario: string; dias: number; arquivos: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lê o corpo da criação. Devolve o pedido limpo ou a mensagem do que falta. */
export function lerPedidoDeLink(corpo: unknown, ingles = false): { ok: true; pedido: PedidoDeLink } | { ok: false; mensagem: string } {
  const t = (pt: string, en: string) => (ingles ? en : pt);
  const c = (corpo ?? {}) as Record<string, unknown>;
  const nome = typeof c.nome === "string" ? c.nome.trim() : "";
  const destinatario = typeof c.destinatario === "string" ? c.destinatario.trim() : "";
  const dias = c.dias === undefined || c.dias === null || c.dias === "" ? PRAZO_PADRAO_DIAS : Number(c.dias);
  const arquivos = Array.isArray(c.arquivos) ? c.arquivos.filter((a): a is string => typeof a === "string") : [];

  if (!nome) return { ok: false, mensagem: t("Dê um nome ao link, para reconhecê-lo depois.", "Give the link a name, so you can recognise it later.") };
  if (nome.length > 120 || destinatario.length > 120) return { ok: false, mensagem: t("Nome e destinatário vão até 120 caracteres.", "Name and recipient take up to 120 characters.") };
  if (!Number.isInteger(dias) || dias < 1 || dias > PRAZO_MAXIMO_DIAS) {
    return { ok: false, mensagem: t(`O prazo vai de 1 a ${PRAZO_MAXIMO_DIAS} dias.`, `The deadline goes from 1 to ${PRAZO_MAXIMO_DIAS} days.`) };
  }
  if (arquivos.length === 0) return { ok: false, mensagem: t("Escolha pelo menos um arquivo.", "Choose at least one file.") };
  if (arquivos.length > MAXIMO_DE_ARQUIVOS) {
    return { ok: false, mensagem: t(`Um link leva até ${MAXIMO_DE_ARQUIVOS} arquivos; você escolheu ${arquivos.length}.`, `A link carries up to ${MAXIMO_DE_ARQUIVOS} files; you chose ${arquivos.length}.`) };
  }
  if (new Set(arquivos).size !== arquivos.length || !arquivos.every((a) => UUID.test(a))) {
    return { ok: false, mensagem: t("A seleção de arquivos veio inválida. Escolha de novo.", "The file selection is invalid. Choose again.") };
  }
  return { ok: true, pedido: { nome, destinatario, dias, arquivos } };
}

/** A identificação de quem baixa: nome e e-mail, autodeclarados (decisão de 30/09). */
export function identificacaoValida(nome: string, email: string): boolean {
  const n = nome.trim();
  const e = email.trim();
  return n.length >= 1 && n.length <= 120 && e.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
}

/**
 * A recusa do banco na criação, traduzida. O PostgREST não devolve o nome da
 * constraint; as funções do link o põem na DICA (`hint`) de cada recusa, e a
 * rota passa `hint` aqui. O que não se reconhece vira a mensagem genérica —
 * nunca o texto do banco.
 */
export function mensagemDaRecusa(dica: string | null | undefined, ingles = false): string {
  const t = (pt: string, en: string) => (ingles ? en : pt);
  switch (dica ?? "") {
    case "arquivos_do_link_em_uso":
      return t("Um dos arquivos saiu de uso enquanto você escolhia. Recarregue e escolha de novo.", "One of the files went out of use while you were choosing. Reload and choose again.");
    case "arquivos_do_link_sem_fonte":
      return t("Fonte não vai por link: só quem tem acesso à marca a recebe.", "Fonts don't go by link: only people with access to the brand receive them.");
    case "arquivos_do_link_da_marca":
      return t("Um dos arquivos não é desta marca. Recarregue e escolha de novo.", "One of the files isn't from this brand. Reload and choose again.");
    case "links_de_entrega_prazo_maximo":
      return t(`O prazo vai de 1 a ${PRAZO_MAXIMO_DIAS} dias.`, `The deadline goes from 1 to ${PRAZO_MAXIMO_DIAS} days.`);
    case "links_de_entrega_selecao_check":
      return t(`Um link leva de 1 a ${MAXIMO_DE_ARQUIVOS} arquivos, sem repetição.`, `A link carries 1 to ${MAXIMO_DE_ARQUIVOS} files, without repeats.`);
    default:
      return t("Não foi possível criar o link. Tente de novo.", "Couldn't create the link. Try again.");
  }
}
