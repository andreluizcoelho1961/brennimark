/**
 * Complementos da marca — 01/10/2026. O que é puro: a validação do que se
 * escreve, a situação de cada complemento, a tradução das recusas do banco e a
 * forma como um trecho de complemento entra no Vini.
 *
 * As regras que não se afrouxam (direção §20): o MANUAL é o cânone, o
 * complemento acrescenta; só o PUBLICADO alimenta o Vini e quem consulta; quem
 * pode editar, ao publicar, está aprovando. O banco decide — as funções
 * `criar_complemento`, `publicar_complemento`… e as políticas das quatro
 * tabelas. Aqui a validação existe para a pessoa ler a frase certa antes da
 * ida ao banco.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import type { Trecho } from "../ai/recuperacao";

export const MAXIMO_DO_TITULO = 120;
export const MAXIMO_DO_TEXTO = 20_000;

export type Complemento = {
  id: string;
  slug: string;
  versao: number;
  titulo: string | null;
  texto: string | null;
  publicado_em: string | null;
  publicado_por_email: string | null;
  arquivado_em: string | null;
  /** Só chega a quem edita — a RLS do rascunho decide. */
  rascunho: { titulo: string; texto: string; atualizado_em: string; atualizado_por_email: string } | null;
};

export type Situacao = "rascunho" | "publicado" | "publicado-com-rascunho" | "arquivado";

export function situacao(c: Pick<Complemento, "versao" | "arquivado_em" | "rascunho">): Situacao {
  if (c.arquivado_em) return "arquivado";
  if (c.versao === 0) return "rascunho";
  return c.rascunho ? "publicado-com-rascunho" : "publicado";
}

/** O que a pessoa vê como título: o publicado, ou o do rascunho se ainda não há publicado. */
export function tituloVisivel(c: Pick<Complemento, "titulo" | "rascunho">): string {
  return c.titulo ?? c.rascunho?.titulo ?? "";
}

export function lerTextoDoComplemento(corpo: unknown, ingles = false): { ok: true; titulo: string; texto: string } | { ok: false; mensagem: string } {
  const t = (pt: string, en: string) => (ingles ? en : pt);
  const c = (corpo ?? {}) as Record<string, unknown>;
  const titulo = typeof c.titulo === "string" ? c.titulo.trim() : "";
  const texto = typeof c.texto === "string" ? c.texto.replace(/\r\n/g, "\n") : "";
  if (!titulo) return { ok: false, mensagem: t("Dê um título ao complemento.", "Give the supplement a title.") };
  if (titulo.length > MAXIMO_DO_TITULO) return { ok: false, mensagem: t(`O título vai até ${MAXIMO_DO_TITULO} caracteres.`, `The title takes up to ${MAXIMO_DO_TITULO} characters.`) };
  if (texto.length > MAXIMO_DO_TEXTO) {
    return { ok: false, mensagem: t(`O texto vai até ${MAXIMO_DO_TEXTO.toLocaleString("pt-BR")} caracteres; este tem ${texto.length.toLocaleString("pt-BR")}.`, `The text takes up to ${MAXIMO_DO_TEXTO} characters; this one has ${texto.length}.`) };
  }
  return { ok: true, titulo, texto };
}

export const ACOES = ["salvar", "publicar", "descartar", "arquivar", "reativar"] as const;
export type Acao = (typeof ACOES)[number];

export function ehAcao(valor: unknown): valor is Acao {
  return typeof valor === "string" && (ACOES as readonly string[]).includes(valor);
}

/**
 * A recusa do banco, traduzida. O PostgREST não devolve o nome da constraint:
 * as funções o põem na DICA (`hint`). Desconhecido vira a frase genérica —
 * nunca o texto do banco.
 */
export function mensagemDaRecusa(dica: string | null | undefined, ingles = false): string {
  const t = (pt: string, en: string) => (ingles ? en : pt);
  switch (dica ?? "") {
    case "rascunhos_de_complemento_titulo_check":
      return t(`O título vai de 1 a ${MAXIMO_DO_TITULO} caracteres.`, `The title takes 1 to ${MAXIMO_DO_TITULO} characters.`);
    case "rascunhos_de_complemento_texto_check":
      return t("O texto vai até 20 mil caracteres.", "The text takes up to 20,000 characters.");
    case "complementos_texto_check":
      return t("Escreva o texto antes de publicar.", "Write the text before publishing.");
    case "complementos_sem_rascunho":
      return t("Não há alteração para publicar.", "There's no change to publish.");
    case "complementos_arquivado":
      return t("Este complemento está arquivado. Reative-o antes de editar.", "This supplement is archived. Reactivate it before editing.");
    case "complementos_arquivo_coerente":
      return t("Só o que foi publicado pode ser arquivado.", "Only what was published can be archived.");
    default:
      return t("Não foi possível concluir. Tente de novo.", "Couldn't complete it. Try again.");
  }
}

/** O caminho que o Vini cita para um complemento — e que a tela abre. */
export function caminhoDoComplemento(slug: string): string {
  return `/complementos/${slug}`;
}

/** Uma linha de `buscar_complementos`, como o Vini a recebe. */
export function trechoDoComplemento(
  linha: { slug: string; titulo: string; secao: string | null; conteudo: string },
  ingles = false,
): Trecho {
  return {
    documentSlug: linha.slug,
    documentTitle: linha.titulo,
    groupName: ingles ? "Supplements" : "Complementos",
    section: linha.secao,
    // Só o publicado vira trecho (o banco garante): é regra aprovada.
    status: "ready",
    pageStart: null,
    pageEnd: null,
    content: linha.conteudo,
    origem: "complemento",
  };
}
