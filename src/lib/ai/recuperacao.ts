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
  maxTrechos: 6,
  /**
   * Caracteres de cada trecho. Um bloco gigante consumiria a cota sozinho.
   *
   * Era 1.200 até 25/09/2026. O trecho é uma SEÇÃO inteira do manual, e a
   * tabela de códigos de cor da Heineken começava depois do caractere 1.200 do
   * capítulo "3.2 Cores": o Vini respondeu "tons de verde" com os códigos no
   * banco. Menos trechos, cada um maior, e recortado onde a pergunta está
   * (`recortarTrecho`) — não no começo.
   */
  maxCaracteresPorTrecho: 2_000,
  /** Teto do contexto inteiro, somados os trechos. */
  maxCaracteresDeContexto: 10_000,
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

const PALAVRAS_VAZIAS = new Set([
  "que", "qual", "quais", "como", "para", "uma", "umas", "uns", "das", "dos", "com", "sem", "por",
  "sao", "ser", "tem", "esta", "este", "essa", "esse", "isso", "onde", "quando", "marca", "manual",
  "sobre", "pode", "posso", "devo", "deve", "mais", "menos", "the", "what", "which", "are", "and",
  "for", "with", "this", "that", "how", "can", "should", "brand", "about", "does",
]);

/** Minúsculas e sem acento: "Códigos" e "codigos" são a mesma palavra. */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Os termos da pergunta que valem busca, como PREFIXOS de até 5 letras:
 * "principais" acha "PRINCIPAIS" e "principal"; "cores" acha "cores".
 */
export function termosDaPergunta(pergunta: string): string[] {
  const termos = normalizar(pergunta)
    .split(/[^a-z0-9#]+/)
    .filter((palavra) => palavra.length >= 3 && !PALAVRAS_VAZIAS.has(palavra))
    .map((palavra) => palavra.slice(0, 5));
  return [...new Set(termos)];
}

/**
 * Valores técnicos: código de cor, sistema de cor, medida. Quem pergunta a um
 * manual quase sempre quer o valor, e é nele que o recorte deve cair quando a
 * pergunta não decide sozinha.
 */
const VALOR_TECNICO = /#[0-9a-f]{6}\b|\b(?:pantone|cmyk|rgb|hex)\b|\b[cmykrgb] ?\d{1,3}\b|\b\d+(?:[.,]\d+)? ?(?:mm|cm|px|pt|%)/g;

/**
 * A janela do trecho que responde à pergunta — não o começo dele.
 *
 * O trecho é uma seção inteira. Cortar no começo entregava a abertura do
 * capítulo e deixava de fora a tabela que a pessoa pediu (Heineken, "quais as
 * cores principais?", 25/09/2026). Aqui cada ocorrência de termo da pergunta
 * vale 1 e cada valor técnico vale 0,3; vence a janela de `maximo`
 * caracteres com mais pontos, a mais cedo em caso de empate. Sem ocorrência
 * nenhuma, o começo — como antes.
 */
export function recortarTrecho(conteudo: string, pergunta: string, maximo: number): string {
  if (conteudo.length <= maximo) return conteudo;
  const base = normalizar(conteudo);
  const marcas: { posicao: number; peso: number }[] = [];

  for (const termo of termosDaPergunta(pergunta)) {
    let indice = base.indexOf(termo);
    while (indice !== -1) {
      marcas.push({ posicao: indice, peso: 1 });
      indice = base.indexOf(termo, indice + termo.length);
    }
  }
  for (const achado of base.matchAll(VALOR_TECNICO)) {
    marcas.push({ posicao: achado.index ?? 0, peso: 0.3 });
  }
  if (marcas.length === 0) return limitarTexto(conteudo, maximo);

  marcas.sort((a, b) => a.posicao - b.posicao);
  // Um pouco de contexto antes da primeira ocorrência da janela.
  const folga = Math.floor(maximo * 0.1);
  let melhorInicio = 0;
  let melhorPontos = -1;
  for (const marca of marcas) {
    const inicio = Math.max(0, Math.min(marca.posicao - folga, conteudo.length - maximo));
    const fim = inicio + maximo;
    let pontos = 0;
    for (const outra of marcas) {
      if (outra.posicao >= inicio && outra.posicao < fim) pontos += outra.peso;
    }
    if (pontos > melhorPontos) {
      melhorPontos = pontos;
      melhorInicio = inicio;
    }
  }

  // Começar e terminar em palavra inteira; a reticência avisa o corte.
  let inicio = melhorInicio;
  if (inicio > 0) {
    const espaco = conteudo.indexOf(" ", inicio);
    inicio = espaco !== -1 && espaco - inicio < 40 ? espaco + 1 : inicio;
  }
  const janela = limitarTexto(conteudo.slice(inicio), maximo - (inicio > 0 ? 1 : 0));
  return inicio > 0 ? `…${janela}` : janela;
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
 * O conteúdo de UMA mensagem, dentro do limite — string ou lista de partes.
 *
 * `ModelMessage.content` aceita as duas formas: uma string, ou uma lista de
 * partes (`[{type:"text", text:"..."}, {type:"image", ...}, ...]`). Limitar
 * só a forma string deixava a forma de partes passar INTACTA — uma única
 * parte de texto gigante, ou muitas partes pequenas somando um total
 * gigante, furava o orçamento sem que a rota percebesse: o limite hoje é
 * sobre o TOTAL da mensagem, então soma através das partes, não por parte
 * isolada.
 *
 * Partes que não são texto (imagem, arquivo, chamada de ferramenta) são
 * descartadas — o chat não é multimodal (a análise de imagem é uma rota
 * separada, com seu próprio limite de tamanho), e aceitá-las sem limite
 * seria outro jeito de escapar do orçamento. Um formato totalmente
 * desconhecido (nem string, nem lista) não é interpretado nem modificado —
 * `streamText` decide o que fazer com ele, mas nada aqui finge que sabe.
 */
function limitarConteudoDaMensagem(content: unknown): unknown {
  if (typeof content === "string") return limitarTexto(content, LIMITES_DE_IA.maxCaracteresPorMensagem);
  if (!Array.isArray(content)) return content;

  let restante = LIMITES_DE_IA.maxCaracteresPorMensagem;
  const partes: unknown[] = [];
  for (const parte of content) {
    if (restante <= 0) break;
    const ehTexto = typeof parte === "object" && parte !== null
      && (parte as { type?: unknown }).type === "text"
      && typeof (parte as { text?: unknown }).text === "string";
    if (!ehTexto) continue;
    const texto = (parte as { text: string }).text;
    const cortado = limitarTexto(texto, restante);
    partes.push({ ...(parte as object), text: cortado });
    restante -= cortado.length;
  }
  return partes;
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
  return mensagens.slice(-LIMITES_DE_IA.maxMensagens).map((mensagem) => ({
    ...mensagem,
    content: limitarConteudoDaMensagem(mensagem.content),
  }));
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
  pergunta = "",
): { texto: string; usados: Trecho[] } {
  const usados: Trecho[] = [];
  const partes: string[] = [];
  let orcamento = LIMITES_DE_IA.maxCaracteresDeContexto;

  for (const trecho of trechos.slice(0, LIMITES_DE_IA.maxTrechos)) {
    const conteudo = recortarTrecho(trecho.content, pergunta, LIMITES_DE_IA.maxCaracteresPorTrecho);
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
