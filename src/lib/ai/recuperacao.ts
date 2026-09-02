/**
 * O que a IA recebe da marca — e, principalmente, o que ela NÃO recebe.
 *
 * Antes o prompt levava o manual inteiro em cada mensagem. Com 743 páginas e
 * 152 seções isso é caro, lento, e pior nas duas pontas: o modelo gasta
 * atenção com material irrelevante, e a resposta piora justamente nos manuais
 * grandes, que são os que mais precisam de ajuda.
 *
 * Módulo puro: os limites e o formato do contexto são verificáveis sem banco,
 * sem rede e sem modelo. A consulta ao Postgres entra por parâmetro.
 */

export interface Trecho {
  documentSlug: string;
  documentTitle: string;
  groupName: string;
  /** Nulo quando o trecho é o corpo da página. */
  section: string | null;
  status: "ready" | "draft" | "pending" | string;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
}

/**
 * Os limites, num lugar só, com número explícito.
 *
 * Cada um existe contra uma forma diferente de o custo escapar. Espalhados
 * pelo código eles viram números mágicos que ninguém revisa junto; aqui dá
 * para ler o orçamento de uma requisição de uma vez.
 */
export const LIMITES_DE_IA = {
  /** Fontes por resposta. Acima disso o modelo dilui em vez de fundamentar. */
  maxTrechos: 8,
  /** Caracteres de cada trecho. Um bloco gigante consumiria a cota sozinho. */
  maxCaracteresPorTrecho: 1_200,
  /** Teto do contexto inteiro, somados os trechos. */
  maxCaracteresDeContexto: 8_000,
  /** A pergunta. Mais que isto é colagem de documento, não pergunta. */
  maxCaracteresDaPergunta: 2_000,
  /** Mensagens de histórico enviadas junto. */
  maxMensagens: 12,
  /** Caracteres por mensagem do histórico. */
  maxCaracteresPorMensagem: 4_000,
} as const;

/** Corta preservando palavra e avisando que cortou. */
export function limitarTexto(texto: string, maximo: number): string {
  if (texto.length <= maximo) return texto;
  const corte = texto.slice(0, maximo);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return `${corte.slice(0, ultimoEspaco > maximo * 0.6 ? ultimoEspaco : maximo)}…`;
}

/**
 * A pergunta, dentro do limite.
 *
 * Truncar em silêncio faria o modelo responder a uma pergunta que a pessoa não
 * fez, sem que ninguém percebesse. A reticência não é decoração: é o aviso.
 */
export function limitarPergunta(pergunta: string): string {
  return limitarTexto(pergunta.trim(), LIMITES_DE_IA.maxCaracteresDaPergunta);
}

/**
 * O histórico, limitado pelas duas pontas.
 *
 * As ÚLTIMAS mensagens, não as primeiras: uma conversa longa perde o começo
 * antes de perder o assunto atual. E cada mensagem é cortada por tamanho — sem
 * isso, uma única mensagem colada estoura o orçamento inteiro e as outras onze
 * deixam de caber.
 */
export function limitarMensagens<T extends { content?: unknown }>(mensagens: readonly T[]): T[] {
  return mensagens.slice(-LIMITES_DE_IA.maxMensagens).map((mensagem) =>
    typeof mensagem.content === "string"
      ? { ...mensagem, content: limitarTexto(mensagem.content, LIMITES_DE_IA.maxCaracteresPorMensagem) }
      : mensagem,
  );
}

/** "páginas 12–18", "página 7", ou vazio quando não há procedência. */
export function faixaDeTrecho(trecho: Trecho, ingles: boolean): string {
  const { pageStart: inicio, pageEnd: fim } = trecho;
  if (inicio === null) return "";
  const rotulo = ingles ? (inicio === fim || fim === null ? "page" : "pages") : (inicio === fim || fim === null ? "página" : "páginas");
  return fim === null || inicio === fim ? `${rotulo} ${inicio}` : `${rotulo} ${inicio}–${fim}`;
}

/**
 * Os trechos recuperados, no formato que o prompt recebe.
 *
 * O orçamento é aplicado AQUI, e não confiado ao banco: a função de busca já
 * tem teto próprio, mas ela é uma entre várias formas de chegar até aqui, e
 * quem monta o prompt é o último lugar onde o limite ainda pode ser garantido.
 *
 * `draft` aparece — conteúdo provisório é conteúdo, e escondê-lo faria o
 * assistente dizer "não há diretriz" sobre algo que está escrito. Mas aparece
 * ROTULADO, e as regras de fundamentação obrigam a tratá-lo como provisório.
 */
export function montarContextoRecuperado(
  trechos: readonly Trecho[],
  rotulos: Record<string, string>,
): { texto: string; usados: Trecho[] } {
  const usados: Trecho[] = [];
  const partes: string[] = [];
  let orcamento = LIMITES_DE_IA.maxCaracteresDeContexto;

  for (const trecho of trechos.slice(0, LIMITES_DE_IA.maxTrechos)) {
    const conteudo = limitarTexto(trecho.content, LIMITES_DE_IA.maxCaracteresPorTrecho);
    if (conteudo.length > orcamento) break;
    orcamento -= conteudo.length;
    usados.push(trecho);

    const status = rotulos[trecho.status] ?? trecho.status;
    const secao = trecho.section ? `\nSEÇÃO: ${trecho.section}` : "";
    const paginas = trecho.pageStart !== null
      ? `\nPÁGINAS DO PDF: ${trecho.pageStart}${trecho.pageEnd !== null && trecho.pageEnd !== trecho.pageStart ? `–${trecho.pageEnd}` : ""}`
      : "";
    partes.push(
      `<source id="doc:${trecho.documentSlug}" status="${status}" kind="guide-page">
TÍTULO: ${trecho.documentTitle}
GRUPO: ${trecho.groupName}
CAMINHO: /docs/${trecho.documentSlug}${secao}${paginas}
CONTEÚDO:
${conteudo}
</source>`,
    );
  }

  return { texto: partes.join("\n\n"), usados };
}

/**
 * O que o prompt diz quando a busca não encontrou nada.
 *
 * Um bloco de conhecimento VAZIO seria pior que ausente: o modelo tende a
 * preencher silêncio, e o silêncio aqui é indistinguível de "a marca não
 * documentou isso". A frase é explícita para que a resposta honesta seja o
 * caminho mais fácil, e não uma exceção que o modelo precise lembrar.
 */
export function semEvidencia(ingles: boolean): string {
  return ingles
    ? "No passage of this brand's manual matched the question. Say clearly that there is no documented guidance for it, and do not infer a rule from general knowledge."
    : "Nenhum trecho do manual desta marca correspondeu à pergunta. Diga com clareza que não há diretriz documentada para isso, e não infira uma regra a partir de conhecimento geral.";
}
