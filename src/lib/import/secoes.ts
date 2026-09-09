import type { PaginaExtraida } from "./texto";
import { linhasUteis, type Linha } from "./texto";
import type { ItemDeOutline } from "./tipos";

/**
 * De páginas soltas a seções revisáveis.
 *
 * A regra que organiza tudo aqui: **um intervalo de páginas é a fonte de
 * verdade de uma seção, e o resto é derivado.**
 *
 * `sourcePageStart`/`sourcePageEnd` sozinhos descrevem uma seção contígua, e
 * param de descrever a verdade no instante em que alguém move uma página de
 * uma seção para outra — a seção passa a ser "1–5 e 9", que dois números não
 * conseguem dizer. Guardar a lista de intervalos e derivar início e fim para
 * exibição mantém as duas coisas verdadeiras ao mesmo tempo.
 */

export type MetodoDeDeteccao = "outline" | "heading" | "page-range";

/** Fechado dos dois lados, 1-based, como as pessoas contam páginas. */
export interface Intervalo {
  de: number;
  ate: number;
}

export interface Secao {
  id: string;
  titulo: string;
  /** Como a fronteira foi decidida. Aparece na prévia. */
  metodo: MetodoDeDeteccao;
  /** 0 a 1. Baixa não é erro — é convite para revisar. */
  confianca: number;
  /** A FONTE DE VERDADE. Ordenada e sem sobreposição interna. */
  sourcePageRanges: Intervalo[];
  /** Texto integral das páginas da seção. Sem truncamento. */
  linhas: string[];
}

export interface PaginaIgnorada {
  pagina: number;
  motivo: "sem-texto";
}

/**
 * O que a extração decidiu remover.
 *
 * Cabeçalho e rodapé saem da leitura editorial porque não são conteúdo — mas
 * sair sem registro é perda silenciosa. Aqui a remoção é uma decisão anotada,
 * com o que foi removido e de quantas páginas.
 */
export interface RemocaoDeExtracao {
  texto: string;
  ocorrencias: number;
}

export interface Agrupamento {
  secoes: Secao[];
  ignoradas: PaginaIgnorada[];
  removidos: RemocaoDeExtracao[];
  /** Quantas fronteiras foram dissolvidas para caber no teto de seções. */
  unidasPeloLimite: number;
}

const PAGINAS_POR_BLOCO = 8;

/** O mesmo teto que a RPC impõe. Ver a migração 20260901100000. */
export const MAXIMO_DE_SECOES = 500;

// ─── Intervalos ─────────────────────────────────────────────────────────────

/** Ordena, funde adjacentes e sobrepostos. Um intervalo vazio some. */
export function normalizar(intervalos: readonly Intervalo[]): Intervalo[] {
  const validos = intervalos.filter((i) => i.ate >= i.de).sort((a, b) => a.de - b.de);
  const saida: Intervalo[] = [];
  for (const intervalo of validos) {
    const ultimo = saida[saida.length - 1];
    if (ultimo && intervalo.de <= ultimo.ate + 1) {
      ultimo.ate = Math.max(ultimo.ate, intervalo.ate);
      continue;
    }
    saida.push({ ...intervalo });
  }
  return saida;
}

export function paginasDe(secao: Secao): number[] {
  const paginas: number[] = [];
  for (const { de, ate } of secao.sourcePageRanges) {
    for (let n = de; n <= ate; n += 1) paginas.push(n);
  }
  return paginas;
}

/** Só para exibição. A verdade é a lista de intervalos. */
export function inicioDe(secao: Secao): number | null {
  return secao.sourcePageRanges[0]?.de ?? null;
}

export function fimDe(secao: Secao): number | null {
  const ultimo = secao.sourcePageRanges[secao.sourcePageRanges.length - 1];
  return ultimo?.ate ?? null;
}

/**
 * Uma seção é predominantemente visual — arte, não texto corrido.
 *
 * Fase 1g (identidade visual fiel): heurística de APOIO, não juíza final —
 * a prévia de importação mostra o resultado antes de publicar, do mesmo
 * jeito que título e agrupamento já são revisáveis hoje. O sinal: pouco
 * texto extraível numa seção curta. Uma abertura de seção real (fundo
 * sólido, tipografia de destaque, pouco ou nenhum texto corrido) bate
 * nisso; uma página de FAQ ou política, mesmo curta, não — tem parágrafo.
 *
 * ─── Calibrado em 09/09/2026, contra manual real ────────────────────────
 *
 * O teto nasceu em 300 caracteres, declarado aqui mesmo como "ponto de
 * partida, não uma medição calibrada". A primeira importação real — um manual
 * de identidade de 47 páginas — deu a medição que faltava, e ela condenou o
 * número: das 43 seções, apenas 3 viravam imagem.
 *
 * O que decidiu não foi a contagem, foi ONDE a linha caía. As seções, em
 * caracteres:
 *
 *     297, 299, 299, 300, 306, 307, 312
 *
 * Sete páginas do mesmo tipo, quase idênticas, e o corte em 300 mandou três
 * para imagem e quatro para texto. Um teto que separa páginas indistinguíveis
 * não está medindo a página: está medindo o acaso.
 *
 * Fora do cluster, ficavam de fora páginas que só existem como imagem —
 * símbolo com efeito 2D (462), versão 3D (475), estilo fotográfico (578),
 * grafismo (601), grid (623). Reconstruir isso em texto perde o que a página É.
 *
 * 900 apanha o cluster inteiro e essas páginas, e ainda recusa texto corrido:
 * uma página de FAQ ou política passa dos 900 com folga. Medido no mesmo
 * manual: 3 seções a 300, 10 a 600, 25 a 900, 32 a 1200.
 *
 * ─── O que o teto custa dos dois lados ───────────────────────────────────
 *
 * Errar para MENOS perde para sempre a aparência real da página, e fidelidade
 * visual é uma das promessas do produto. Errar para MAIS custa armazenamento e
 * TEMPO DE PUBLICAÇÃO — cada página vira uma renderização em escala 2, e a
 * publicação já leva minutos. Por isso 900 e não 1200: o ganho de 25 para 32
 * seções não paga o terço a mais de espera.
 *
 * A heurística continua de APOIO: a prévia mostra o resultado antes de
 * publicar, e quem importa decide.
 */
const TETO_DE_CARACTERES_VISUAL = 900;
const TETO_DE_PAGINAS_VISUAL = 2;

export function ehVisualDominante(secao: Secao): boolean {
  const totalDePaginas = paginasDe(secao).length;
  if (totalDePaginas === 0 || totalDePaginas > TETO_DE_PAGINAS_VISUAL) return false;
  const totalDeCaracteres = secao.linhas.join("").length;
  return totalDeCaracteres < TETO_DE_CARACTERES_VISUAL;
}

/** "Páginas 40–47" ou "Páginas 1–5, 9". Contíguo ou não, sem mentir. */
export function faixaLegivel(secao: Secao): string {
  return secao.sourcePageRanges
    .map(({ de, ate }) => (de === ate ? `${de}` : `${de}–${ate}`))
    .join(", ");
}

function removerPagina(intervalos: readonly Intervalo[], pagina: number): Intervalo[] {
  const saida: Intervalo[] = [];
  for (const { de, ate } of intervalos) {
    if (pagina < de || pagina > ate) {
      saida.push({ de, ate });
      continue;
    }
    if (pagina > de) saida.push({ de, ate: pagina - 1 });
    if (pagina < ate) saida.push({ de: pagina + 1, ate });
  }
  return saida;
}

// ─── Detecção de fronteiras ─────────────────────────────────────────────────

/**
 * Um título, pela geometria.
 *
 * "Linha curta" sozinho confunde título com a última linha de um parágrafo.
 * O que distingue de verdade é o DESTAQUE: a linha é sensivelmente maior que o
 * corpo da página. Cabeçalho e rodapé já saíram antes de chegar aqui.
 */
function tituloVisual(linhas: readonly Linha[]): { texto: string; confianca: number } | null {
  if (linhas.length === 0) return null;

  const candidata = linhas[0];

  /**
   * O corpo é medido SEM a candidata.
   *
   * Incluí-la enviesa a mediana justamente para cima quando o título é grande —
   * numa página com um título de 30pt e uma linha de corpo de 12pt, a mediana
   * dava 30 e a proporção dava 1, e o título nunca era reconhecido. Página com
   * uma linha só não tem corpo com que comparar.
   */
  const alturasDoCorpo = linhas.slice(1).map((l) => l.altura).filter((a) => a > 0);
  if (alturasDoCorpo.length === 0) return null;
  const ordenadas = [...alturasDoCorpo].sort((a, b) => a - b);
  const mediana = ordenadas[Math.floor((ordenadas.length - 1) / 2)];

  const proporcao = mediana > 0 ? candidata.altura / mediana : 1;

  // Precisa ser a primeira linha, destacada, e curta o bastante para ser um
  // rótulo e não uma frase.
  if (proporcao < 1.25 || candidata.texto.length > 80) return null;

  /*
   * Destaque tipográfico não é título — pode ser espécime.
   *
   * Num manual de identidade, páginas inteiras mostram letras em corpo enorme:
   * um "G g" de 200pt sobre uma legenda de 8pt tem a proporção mais alta da
   * página e passa em todos os testes acima. O resultado eram nove seções do
   * GE_ID000 chamadas "e", "g" e "G g", de uma página cada — o índice do
   * manual virava a tabela de glifos.
   *
   * A regra: um título precisa de ao menos UMA palavra de duas letras ou mais.
   * "Cor", "Voz" e "Grid" passam; "G g", "e" e "a b c" não. É neutra em idioma
   * e não depende de lista de palavras.
   *
   * O que se perde: uma seção legitimamente chamada "A" deixa de ser detectada
   * por título e cai na faixa de páginas — que é o comportamento certo para
   * uma evidência tão fraca.
   */
  const temPalavra = candidata.texto
    .split(/[\s\u00a0]+/)
    .some((palavra) => palavra.replace(/[^\p{L}\p{N}]/gu, "").length >= 2);
  if (!temPalavra) return null;

  // Quanto maior o destaque, mais confiança — com teto, porque geometria não
  // prova intenção.
  return { texto: candidata.texto, confianca: Math.min(0.85, 0.45 + (proporcao - 1.25) * 0.4) };
}

/**
 * As páginas onde o índice do PDF declara que uma seção começa.
 *
 * Achado da auditoria de produto (04/09): antes, só o nível 0 do índice
 * virava fronteira — comentário original: "subitens dividiriam demais um
 * manual de 700 páginas". Na prática, um manual de identidade real tem
 * bookmark RASO no nível 0 ("Cor", "Tipografia") e a granularidade que
 * corresponde a uma seção de verdade no nível 1+ — jogada fora inteira.
 * Contra o manual real da GE, isso sozinho respondia pela maior parte dos
 * 56% de títulos genéricos (`Página(s) N–M`) medidos.
 *
 * Agora todo nível do índice vira fronteira candidata — a árvore inteira
 * que `lerOutline` já lia e descartava. O risco de over-fragmentação num
 * índice patologicamente profundo (um bookmark por parágrafo) não fica
 * sem rede: `MAXIMO_DE_SECOES` + `limitarSecoes` já fundem o excesso pela
 * MENOR confiança quando uma importação passa do teto — a mesma proteção
 * que já existia para qualquer outra fonte de fronteira em excesso, não
 * uma garantia nova criada para este caso.
 */
function fronteirasDoOutline(
  outline: readonly ItemDeOutline[],
  totalDePaginas: number,
): { pagina: number; titulo: string }[] {
  const achatado: { pagina: number; titulo: string }[] = [];
  const visitar = (itens: readonly ItemDeOutline[]) => {
    for (const item of itens) {
      if (item.pagina && item.pagina >= 1 && item.pagina <= totalDePaginas) {
        achatado.push({ pagina: item.pagina, titulo: item.titulo });
      }
      // Todo nível é visitado agora, tenha o item resolvido página própria
      // ou não — um capítulo de nível 0 e suas subseções de nível 1+ podem
      // coexistir como fronteiras distintas.
      if (item.filhos.length > 0) visitar(item.filhos);
    }
  };
  visitar(outline);

  const porPagina = new Map<number, string>();
  for (const { pagina, titulo } of achatado.sort((a, b) => a.pagina - b.pagina)) {
    if (!porPagina.has(pagina)) porPagina.set(pagina, titulo);
  }
  return [...porPagina.entries()]
    .map(([pagina, titulo]) => ({ pagina, titulo }))
    .sort((a, b) => a.pagina - b.pagina);
}

// ─── Agrupamento ────────────────────────────────────────────────────────────

export function agrupar({
  paginas,
  outline = [],
  repetidos = new Set<string>(),
}: {
  paginas: readonly PaginaExtraida[];
  outline?: readonly ItemDeOutline[];
  repetidos?: ReadonlySet<string>;
}): Agrupamento {
  const linhasPorPagina = new Map<number, Linha[]>();
  const ignoradas: PaginaIgnorada[] = [];

  for (const pagina of paginas) {
    const uteis = linhasUteis(pagina, repetidos);
    linhasPorPagina.set(pagina.numero, uteis);
    if (uteis.length === 0) ignoradas.push({ pagina: pagina.numero, motivo: "sem-texto" });
  }

  const removidos = registrarRemocoes(paginas, repetidos);
  const comTexto = paginas
    .map((p) => p.numero)
    .filter((n) => (linhasPorPagina.get(n)?.length ?? 0) > 0);

  if (comTexto.length === 0) {
    return { secoes: [], ignoradas, removidos, unidasPeloLimite: 0 };
  }

  const total = Math.max(...paginas.map((p) => p.numero));
  const fronteiras = calcularFronteiras({ comTexto, total, outline, linhasPorPagina });

  const secoes: Secao[] = fronteiras.map((fronteira, indice) => {
    const proxima = fronteiras[indice + 1];
    const ate = proxima ? proxima.pagina - 1 : total;
    const paginasDaSecao = comTexto.filter((n) => n >= fronteira.pagina && n <= ate);
    const linhas = paginasDaSecao.flatMap((n) => (linhasPorPagina.get(n) ?? []).map((l) => l.texto));

    return {
      id: `s${fronteira.pagina}`,
      titulo: fronteira.titulo,
      metodo: fronteira.metodo,
      confianca: fronteira.confianca,
      // Só as páginas COM texto entram: as vazias estão em `ignoradas`, com
      // motivo, e uma página não pode estar nos dois lugares.
      sourcePageRanges: normalizar(paginasDaSecao.map((n) => ({ de: n, ate: n }))),
      linhas,
    };
  });

  const comPaginas = secoes.filter((s) => s.sourcePageRanges.length > 0);
  const { secoes: dentroDoLimite, unidas } = limitarSecoes(comPaginas, MAXIMO_DE_SECOES);
  return { secoes: dentroDoLimite, ignoradas, removidos, unidasPeloLimite: unidas };
}

/**
 * Faz caber no teto sem perder página nem inventar conteúdo.
 *
 * Um manual de 1.000 páginas com um item de índice por página produziria 1.000
 * seções, e a RPC recusaria a importação inteira. Recusar um manual VÁLIDO por
 * causa de um teto do produto seria o produto culpando o cliente pelo próprio
 * limite.
 *
 * A saída é dissolver fronteiras, não descartar páginas: as seções de menor
 * confiança se juntam à anterior, na ordem, até caber. Nenhuma página muda de
 * lugar — só deixa de ter fronteira própria. O título que sobrevive é o da
 * seção que abre o trecho, e quantas foram unidas fica registrado.
 */
function limitarSecoes(
  secoes: readonly Secao[],
  maximo: number,
): { secoes: Secao[]; unidas: number } {
  if (secoes.length <= maximo) return { secoes: [...secoes], unidas: 0 };

  // A primeira nunca perde a fronteira: dissolvê-la deixaria o começo do
  // manual sem seção.
  const candidatas = secoes
    .map((secao, indice) => ({ indice, confianca: secao.confianca }))
    .slice(1)
    .sort((a, b) => a.confianca - b.confianca || b.indice - a.indice);

  const dissolver = new Set(
    candidatas.slice(0, secoes.length - maximo).map((c) => c.indice),
  );

  const saida: Secao[] = [];
  for (const [indice, secao] of secoes.entries()) {
    if (dissolver.has(indice) && saida.length > 0) {
      const anterior = saida[saida.length - 1];
      saida[saida.length - 1] = {
        ...anterior,
        sourcePageRanges: normalizar([...anterior.sourcePageRanges, ...secao.sourcePageRanges]),
        linhas: [...anterior.linhas, ...secao.linhas],
        confianca: Math.min(anterior.confianca, secao.confianca),
      };
      continue;
    }
    saida.push({ ...secao });
  }

  return { secoes: saida, unidas: dissolver.size };
}

/**
 * A ordem de confiança, e é o coração do agrupamento.
 *
 * 1. O índice do PDF, quando existe: é a estrutura que o autor declarou.
 * 2. Título detectado por destaque visual — só onde o índice não decidiu.
 * 3. Blocos de oito páginas, com procedência explícita no rótulo.
 *
 * Os três se combinam: um manual com índice parcial recebe as fronteiras dele
 * e preenche o resto pelas outras vias, em vez de escolher uma estratégia só.
 */
function calcularFronteiras({
  comTexto,
  total,
  outline,
  linhasPorPagina,
}: {
  comTexto: number[];
  total: number;
  outline: readonly ItemDeOutline[];
  linhasPorPagina: Map<number, Linha[]>;
}): { pagina: number; titulo: string; metodo: MetodoDeDeteccao; confianca: number }[] {
  const porPagina = new Map<
    number,
    { pagina: number; titulo: string; metodo: MetodoDeDeteccao; confianca: number }
  >();

  for (const { pagina, titulo } of fronteirasDoOutline(outline, total)) {
    porPagina.set(pagina, { pagina, titulo, metodo: "outline", confianca: 1 });
  }

  for (const numero of comTexto) {
    if (porPagina.has(numero)) continue;
    const titulo = tituloVisual(linhasPorPagina.get(numero) ?? []);
    if (titulo) {
      porPagina.set(numero, {
        pagina: numero,
        titulo: titulo.texto,
        metodo: "heading",
        confianca: titulo.confianca,
      });
    }
  }

  const fronteiras = [...porPagina.values()].sort((a, b) => a.pagina - b.pagina);

  // A primeira página com texto sempre abre uma seção — senão o começo do
  // manual ficaria fora de qualquer seção, e a invariante de cobertura cairia.
  const primeira = comTexto[0];
  if (fronteiras.length === 0 || fronteiras[0].pagina > primeira) {
    fronteiras.unshift(...blocosDeFallback(primeira, (fronteiras[0]?.pagina ?? total + 1) - 1));
  }

  // Vãos longos entre fronteiras viram blocos: uma seção de 200 páginas não é
  // revisável, e fingir que é seria pior que admitir que não houve estrutura.
  const completas = [...fronteiras];
  for (let i = 0; i < fronteiras.length; i += 1) {
    const inicio = fronteiras[i].pagina;
    const fim = (fronteiras[i + 1]?.pagina ?? total + 1) - 1;
    if (fim - inicio + 1 > PAGINAS_POR_BLOCO) {
      completas.push(...blocosDeFallback(inicio + PAGINAS_POR_BLOCO, fim));
    }
  }

  return completas.sort((a, b) => a.pagina - b.pagina);
}

function blocosDeFallback(de: number, ate: number) {
  const blocos = [];
  for (let inicio = de; inicio <= ate; inicio += PAGINAS_POR_BLOCO) {
    const fim = Math.min(inicio + PAGINAS_POR_BLOCO - 1, ate);
    blocos.push({
      pagina: inicio,
      // O rótulo diz de onde veio. Não inventa nome de capítulo.
      titulo: inicio === fim ? `Página ${inicio}` : `Páginas ${inicio}–${fim}`,
      metodo: "page-range" as const,
      confianca: 0.2,
    });
  }
  return blocos;
}

function registrarRemocoes(
  paginas: readonly PaginaExtraida[],
  repetidos: ReadonlySet<string>,
): RemocaoDeExtracao[] {
  if (repetidos.size === 0) return [];
  const contagem = new Map<string, number>();
  for (const pagina of paginas) {
    const todas = linhasUteis(pagina, new Set());
    const uteis = new Set(linhasUteis(pagina, repetidos).map((l) => l.texto));
    for (const linha of todas) {
      if (uteis.has(linha.texto)) continue;
      contagem.set(linha.texto, (contagem.get(linha.texto) ?? 0) + 1);
    }
  }
  return [...contagem.entries()]
    .map(([texto, ocorrencias]) => ({ texto, ocorrencias }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias);
}

// ─── Edição, preservando a procedência ──────────────────────────────────────

export function renomear(secoes: readonly Secao[], id: string, titulo: string): Secao[] {
  return secoes.map((secao) => (secao.id === id ? { ...secao, titulo } : secao));
}

/**
 * Divide uma seção na página indicada, que passa a abrir a segunda.
 *
 * O texto acompanha as páginas, e a soma dos intervalos das duas partes é
 * exatamente a da original: dividir não pode perder página.
 */
export function dividir(
  secoes: readonly Secao[],
  id: string,
  paginaDeCorte: number,
  linhasPorPagina: ReadonlyMap<number, string[]>,
): Secao[] {
  const indice = secoes.findIndex((s) => s.id === id);
  if (indice < 0) return [...secoes];

  const original = secoes[indice];
  const paginas = paginasDe(original);
  const antes = paginas.filter((n) => n < paginaDeCorte);
  const depois = paginas.filter((n) => n >= paginaDeCorte);
  if (antes.length === 0 || depois.length === 0) return [...secoes];

  const monta = (numeros: number[], sufixo: string): Secao => ({
    ...original,
    id: `${original.id}${sufixo}`,
    sourcePageRanges: normalizar(numeros.map((n) => ({ de: n, ate: n }))),
    linhas: numeros.flatMap((n) => linhasPorPagina.get(n) ?? []),
  });

  const segunda = monta(depois, "b");
  return [
    ...secoes.slice(0, indice),
    monta(antes, "a"),
    { ...segunda, titulo: `${original.titulo} (continuação)` },
    ...secoes.slice(indice + 1),
  ];
}

/** Une duas seções. A procedência da segunda entra na primeira, sem perda. */
export function unir(
  secoes: readonly Secao[],
  idA: string,
  idB: string,
  linhasPorPagina: ReadonlyMap<number, string[]>,
): Secao[] {
  const a = secoes.find((s) => s.id === idA);
  const b = secoes.find((s) => s.id === idB);
  if (!a || !b || a.id === b.id) return [...secoes];

  const intervalos = normalizar([...a.sourcePageRanges, ...b.sourcePageRanges]);
  const unida: Secao = {
    ...a,
    sourcePageRanges: intervalos,
    linhas: paginasDe({ ...a, sourcePageRanges: intervalos }).flatMap(
      (n) => linhasPorPagina.get(n) ?? [],
    ),
    // A confiança cai para a menor das duas: unir é decisão humana sobre uma
    // fronteira que a heurística tinha traçado.
    confianca: Math.min(a.confianca, b.confianca),
  };
  return secoes.filter((s) => s.id !== idB).map((s) => (s.id === idA ? unida : s));
}

/**
 * Move uma página de uma seção para outra.
 *
 * É a operação que quebra `sourcePageStart`/`sourcePageEnd`: a seção de origem
 * pode ficar com um buraco, e a de destino pode ficar descontínua. A lista de
 * intervalos descreve as duas sem inventar nada.
 */
export function moverPagina(
  secoes: readonly Secao[],
  pagina: number,
  idDestino: string,
  linhasPorPagina: ReadonlyMap<number, string[]>,
): Secao[] {
  const destino = secoes.find((s) => s.id === idDestino);
  if (!destino || paginasDe(destino).includes(pagina)) return [...secoes];
  if (!secoes.some((s) => paginasDe(s).includes(pagina))) return [...secoes];

  const recalcular = (secao: Secao, intervalos: Intervalo[]): Secao => ({
    ...secao,
    sourcePageRanges: intervalos,
    linhas: paginasDe({ ...secao, sourcePageRanges: intervalos }).flatMap(
      (n) => linhasPorPagina.get(n) ?? [],
    ),
  });

  return secoes
    .map((secao) => {
      if (secao.id === idDestino) {
        return recalcular(secao, normalizar([...secao.sourcePageRanges, { de: pagina, ate: pagina }]));
      }
      if (!paginasDe(secao).includes(pagina)) return secao;
      return recalcular(secao, normalizar(removerPagina(secao.sourcePageRanges, pagina)));
    })
    .filter((secao) => secao.sourcePageRanges.length > 0);
}

// ─── Invariantes ────────────────────────────────────────────────────────────

export interface Violacao {
  tipo: "pagina-em-duas-secoes" | "pagina-sem-destino" | "intervalo-invertido";
  detalhe: string;
}

/**
 * O que precisa continuar verdadeiro depois de qualquer edição.
 *
 * Roda nos testes e depois de cada operação da prévia: uma edição que viole
 * qualquer destas deixou de descrever o PDF, e publicar assim gravaria uma
 * procedência falsa.
 */
export function validarInvariantes(
  agrupamento: Agrupamento,
  paginasExtraiveis: readonly number[],
): Violacao[] {
  const violacoes: Violacao[] = [];
  const dona = new Map<number, string>();

  for (const secao of agrupamento.secoes) {
    for (const { de, ate } of secao.sourcePageRanges) {
      if (ate < de) {
        violacoes.push({ tipo: "intervalo-invertido", detalhe: `${secao.id}: ${de}–${ate}` });
      }
    }
    for (const pagina of paginasDe(secao)) {
      const anterior = dona.get(pagina);
      if (anterior) {
        violacoes.push({
          tipo: "pagina-em-duas-secoes",
          detalhe: `página ${pagina} em ${anterior} e ${secao.id}`,
        });
        continue;
      }
      dona.set(pagina, secao.id);
    }
  }

  const ignoradas = new Set(agrupamento.ignoradas.map((i) => i.pagina));
  for (const pagina of paginasExtraiveis) {
    if (!dona.has(pagina) && !ignoradas.has(pagina)) {
      violacoes.push({ tipo: "pagina-sem-destino", detalhe: `página ${pagina}` });
    }
  }

  return violacoes;
}
