/**
 * A semântica de `Range`, como módulo puro.
 *
 * Ela mora aqui, e não dentro da rota, porque é a parte que precisa estar
 * certa e é a parte que rede nenhuma ajuda a testar. Um intervalo mal
 * resolvido não falha: ele entrega os bytes errados, com status de sucesso, e
 * o PDF.js monta um documento corrompido sem dizer por quê.
 *
 * O intervalo-sufixo (`bytes=-1024`) é o caso que decide tudo. O PDF.js lê o
 * FIM do arquivo primeiro, para achar a tabela de referências cruzadas. Sem
 * sufixo não há carregamento progressivo — o visualizador baixa 100 MiB para
 * mostrar a primeira página.
 */

/**
 * Teto de uma fatia, em bytes.
 *
 * A resposta de uma função da Vercel tem teto de 4,5 MB, e 4 MiB deixa margem
 * para cabeçalhos.
 *
 * ─── O que este teto FAZ, e o que ele fazia antes ────────────────────────
 *
 * Ele **apara** o intervalo. A primeira versão **recusava** com 413, sob o
 * argumento de que servir menos do que foi pedido produziria um documento com
 * buraco silencioso. O argumento estava errado, e o erro custou caro.
 *
 * Aparar não é servir menos do que se promete: é prometer menos. O
 * `Content-Range` descreve EXATAMENTE os bytes enviados, e a RFC 9110 permite
 * ao servidor satisfazer um pedido de intervalo com um intervalo menor. Um
 * cliente que ignore o `Content-Range` estaria quebrado com qualquer servidor
 * atrás de um limite de tamanho — que é a maioria deles.
 *
 * Recusar, sim, produzia o defeito: o PDF.js pede o documento inteiro num
 * único intervalo em algumas situações, recebia 413, e caía numa sequência de
 * tentativas. Foi o que fez um manual de 4,07 MiB — 70 KB acima do teto —
 * abrir "super lento" em produção. `acima-do-teto.pdf` reproduz a propriedade
 * sem carregar material de cliente.
 */
export const TETO_DA_FATIA = 4 * 1024 * 1024;

export type Resolucao =
  /** Sem `Range`, ou `Range` que a especificação manda ignorar: arquivo inteiro. */
  | { tipo: "completo" }
  /** Um intervalo satisfazível: bytes de `inicio` a `fim`, inclusive nos dois. */
  | { tipo: "parcial"; inicio: number; fim: number }
  /** Fora do arquivo: 416, com `Content-Range: bytes *&#47;<tamanho>`. */
  | { tipo: "fora-do-alcance" };

const PADRAO = /^bytes=(\d*)-(\d*)$/;

/**
 * O que o cabeçalho `Range` pede deste arquivo.
 *
 * @param cabecalho valor bruto de `Range`, ou `null` quando ausente
 * @param tamanho tamanho total do arquivo, em bytes
 */
export function resolverRange(cabecalho: string | null, tamanho: number): Resolucao {
  if (!cabecalho) return { tipo: "completo" };

  const bruto = cabecalho.trim();

  /**
   * Multi-intervalo (`bytes=0-99,200-299`) é ignorado, de propósito.
   *
   * A RFC 9110 §14.2 permite ao servidor ignorar `Range` — e ignorar é a única
   * saída honesta aqui. Responder `multipart/byteranges` de verdade é trabalho
   * real; responder só o primeiro intervalo entregaria menos bytes do que o
   * cliente pediu, com status de sucesso, que é a classe de erro que este
   * módulo existe para impedir. Nenhum cliente que servimos usa multi-intervalo:
   * o PDF.js pede um por vez.
   */
  if (bruto.includes(",")) return { tipo: "completo" };

  const casou = PADRAO.exec(bruto);
  // Malformado é ignorado, não recusado — também §14.2. Recusar transformaria
  // um cabeçalho estranho de intermediário em falha de leitura do documento.
  if (!casou) return { tipo: "completo" };

  const [, esquerda, direita] = casou;

  // `bytes=-` não pede nada: os dois lados vazios não formam intervalo.
  if (esquerda === "" && direita === "") return { tipo: "completo" };

  // Arquivo vazio não tem byte nenhum para satisfazer intervalo algum.
  if (tamanho <= 0) return { tipo: "fora-do-alcance" };

  let inicio: number;
  let fim: number;

  if (esquerda === "") {
    // Sufixo: `bytes=-1024` são os ÚLTIMOS 1024 bytes. É o pedido que o PDF.js
    // faz primeiro, e o que um servidor desatento trata como "do 0 ao 1024".
    const quantos = Number(direita);
    if (quantos === 0) return { tipo: "fora-do-alcance" };
    // Pedir mais sufixo do que o arquivo tem devolve o arquivo inteiro, e não
    // é erro: a especificação manda encurtar para o que existe.
    inicio = Math.max(0, tamanho - quantos);
    fim = tamanho - 1;
  } else {
    inicio = Number(esquerda);
    // Começar em ou depois do fim é o único caso de 416 num pedido bem-formado.
    if (inicio >= tamanho) return { tipo: "fora-do-alcance" };
    // `bytes=100-` vai até o fim. Um fim além do arquivo é aparado, não recusado.
    fim = direita === "" ? tamanho - 1 : Math.min(Number(direita), tamanho - 1);
    // `bytes=500-100`: intervalo invertido não é satisfazível.
    if (fim < inicio) return { tipo: "fora-do-alcance" };
  }

  // Aparado ao teto, mantendo o início. O `Content-Range` da resposta dirá
  // exatamente o que foi enviado, e o cliente pede o resto se quiser.
  if (fim - inicio + 1 > TETO_DA_FATIA) fim = inicio + TETO_DA_FATIA - 1;

  return { tipo: "parcial", inicio, fim };
}

/**
 * O `Range` deve ser aplicado, dado o `If-Range` que o cliente mandou?
 *
 * O cliente diz: "me dê este pedaço, MAS só se o arquivo ainda for aquele que
 * eu já comecei a ler". Se mudou, ele prefere recomeçar do zero a colar dois
 * pedaços de arquivos diferentes — que é exatamente o que aconteceria sem esta
 * verificação, e sem erro nenhum aparecendo.
 *
 * Ausente, o `Range` vale. Presente e igual, vale. Presente e diferente, o
 * arquivo inteiro é servido — 200, não 206.
 */
export function ifRangeAutoriza(ifRange: string | null, etag: string | null): boolean {
  if (!ifRange) return true;
  if (!etag) return false;
  return normalizarEtag(ifRange) === normalizarEtag(etag);
}

/** Sem aspas e sem o prefixo `W/`, para comparar o que o servidor variou de forma. */
function normalizarEtag(valor: string): string {
  return valor.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
}

/** O `Content-Range` de uma resposta 206. */
export function contentRange(inicio: number, fim: number, tamanho: number): string {
  return `bytes ${inicio}-${fim}/${tamanho}`;
}

/** O `Content-Range` de uma resposta 416, que informa só o tamanho. */
export function contentRangeForaDoAlcance(tamanho: number): string {
  return `bytes */${tamanho}`;
}

/**
 * O tamanho TOTAL do arquivo, lido de um `Content-Range` que a origem mandou.
 *
 * É como a rota descobre o tamanho sem uma viagem a mais: numa resposta 206 o
 * total vem depois da barra (`bytes 0-1023/11844340`). `*` no lugar do total
 * significa "não sei", e devolver `null` é mais honesto que devolver `NaN`
 * disfarçado de número.
 */
export function totalDoContentRange(cabecalho: string | null): number | null {
  if (!cabecalho) return null;
  const casou = /^bytes\s+(?:\d+-\d+|\*)\/(\d+)$/.exec(cabecalho.trim());
  return casou ? Number(casou[1]) : null;
}
