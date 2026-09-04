import { classificarErroDoParser, temAssinaturaDePdf, type FalhaDePdf } from "./pdf-erros";
import type { PaginaExtraida } from "./texto";
import type { ItemDeOutline } from "./tipos";

export type { ItemDeOutline };

/**
 * A leitura do PDF, no navegador.
 *
 * O arquivo é lido UMA vez. A versão anterior chamava `file.arrayBuffer()` duas
 * vezes em paralelo — uma para o hash, outra para o parser — e num arquivo de
 * 100 MiB isso são 200 MiB de buffer cru antes de o parser começar a trabalhar.
 * Aqui o mesmo buffer serve aos dois, nesta ordem: primeiro o hash, porque o
 * PDF.js desanexa o buffer que recebe.
 */


export interface DocumentoLido {
  paginas: PaginaExtraida[];
  /** Vazio quando o PDF não declara índice. */
  outline: ItemDeOutline[];
  totalDePaginas: number;
  sha256: string;
}

export class FalhaDeLeitura extends Error {
  constructor(
    readonly falha: FalhaDePdf,
    /** Só para log. Nunca é mostrado a quem usa nem contém conteúdo do PDF. */
    readonly detalheTecnico?: string,
  ) {
    super(falha);
    this.name = "FalhaDeLeitura";
  }
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * O índice do PDF, com destino resolvido e hierarquia preservada.
 *
 * Só o texto do item não basta: para virar seção é preciso saber em que página
 * ela começa, e o aninhamento distingue capítulo de subitem. Um destino que não
 * resolve vira `pagina: null` — o item continua no índice, e quem agrupa decide
 * o que fazer com ele, em vez de receber um número inventado.
 */
async function lerOutline(
  documento: {
    getOutline(): Promise<unknown[] | null>;
    getDestination(nome: string): Promise<unknown[] | null>;
    getPageIndex(ref: unknown): Promise<number>;
  },
): Promise<ItemDeOutline[]> {
  const bruto = await documento.getOutline().catch(() => null);
  if (!bruto?.length) return [];

  async function paginaDe(dest: unknown): Promise<number | null> {
    try {
      const destino = typeof dest === "string" ? await documento.getDestination(dest) : dest;
      if (!Array.isArray(destino) || destino.length === 0) return null;
      return (await documento.getPageIndex(destino[0])) + 1;
    } catch {
      return null;
    }
  }

  async function converter(itens: unknown[], nivel: number): Promise<ItemDeOutline[]> {
    const saida: ItemDeOutline[] = [];
    for (const item of itens) {
      const i = item as { title?: string; dest?: unknown; items?: unknown[] };
      const titulo = (i.title ?? "").trim();
      if (!titulo) continue;
      saida.push({
        titulo,
        pagina: await paginaDe(i.dest),
        nivel,
        filhos: i.items?.length ? await converter(i.items, nivel + 1) : [],
      });
    }
    return saida;
  }

  return converter(bruto, 0);
}

/**
 * Lê o arquivo inteiro e devolve tudo que o agrupamento vai precisar.
 *
 * A validação é por ASSINATURA, não por MIME. Um navegador pode não declarar
 * tipo nenhum para um PDF perfeitamente válido, e um arquivo que se declara
 * `application/pdf` pode ser qualquer coisa. Os cinco primeiros bytes não
 * mentem.
 */
export async function lerPdf(
  arquivo: File,
  { maxBytes, maxPaginas }: { maxBytes: number; maxPaginas: number },
): Promise<DocumentoLido> {
  if (arquivo.size > maxBytes) throw new FalhaDeLeitura("grande-demais");

  const buffer = await arquivo.arrayBuffer();
  if (!temAssinaturaDePdf(buffer)) throw new FalhaDeLeitura("assinatura-invalida");

  // Antes do parser: o PDF.js desanexa o buffer que recebe.
  const digest = await sha256(buffer);

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  let documento;
  try {
    documento = await pdfjs.getDocument({ data: buffer }).promise;
  } catch (erro) {
    const falha = classificarErroDoParser(erro);
    throw new FalhaDeLeitura(falha, descricaoTecnica(erro));
  }

  if (documento.numPages > maxPaginas) throw new FalhaDeLeitura("paginas-demais");

  const paginas: PaginaExtraida[] = [];
  for (let numero = 1; numero <= documento.numPages; numero += 1) {
    const pagina = await documento.getPage(numero);
    const conteudo = await pagina.getTextContent();
    const [, , , alturaDaPagina] = pagina.view;

    paginas.push({
      numero,
      alturaDaPagina,
      itens: conteudo.items.flatMap((item) => {
        if (!("str" in item) || !item.str.trim()) return [];
        // transform = [a, b, c, d, e, f]; e/f são a origem, d a altura efetiva.
        const [, , , escalaY, x, y] = item.transform;
        return [{
          texto: item.str,
          x,
          y,
          altura: Math.abs(escalaY) || item.height || 0,
          fonte: item.fontName ?? "",
        }];
      }),
    });
  }

  const outline = await lerOutline(documento);
  return { paginas, outline, totalDePaginas: documento.numPages, sha256: digest };
}

/**
 * Renderiza páginas específicas do PDF como imagem, no navegador.
 *
 * Fase 1g (identidade visual fiel): até aqui, `lerPdf` só chama
 * `getTextContent()` — nunca `page.render()`, embora a biblioteca sempre
 * tenha suportado. Achado da auditoria de produto: nenhuma marca
 * importada tinha imagem nenhuma, em lugar nenhum, desde sempre. Para
 * páginas classificadas como visual-dominante (`ehVisualDominante` em
 * `secoes.ts`) — abertura de seção, diagrama, exemplo de aplicação —
 * reconstrução em texto perde o que a página É. Renderizar a página
 * inteira como imagem, fiel ao PDF original, é o que a Fase 1g usa em vez
 * disso.
 *
 * Reabre o documento UMA vez para o conjunto de páginas pedido, não uma
 * vez por página — o custo de reanalisar a estrutura do PDF não se repete
 * por imagem.
 */
export async function renderizarPaginasComoImagem(
  arquivo: File,
  numeros: readonly number[],
  { escala = 2 }: { escala?: number } = {},
): Promise<Map<number, Blob>> {
  const saida = new Map<number, Blob>();
  if (numeros.length === 0) return saida;

  const buffer = await arquivo.arrayBuffer();
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const documento = await pdfjs.getDocument({ data: buffer }).promise;

  for (const numero of numeros) {
    if (numero < 1 || numero > documento.numPages) continue;

    const pagina = await documento.getPage(numero);
    const viewport = pagina.getViewport({ scale: escala });
    const canvas = window.document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const contexto = canvas.getContext("2d");
    if (!contexto) continue;

    await pagina.render({ canvas, canvasContext: contexto, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (blob) saida.set(numero, blob);
  }

  return saida;
}

/** Nome e mensagem do erro, sem nada do conteúdo do arquivo. */
function descricaoTecnica(erro: unknown): string {
  const e = erro as { name?: string; message?: string } | null;
  return `${e?.name ?? "Error"}: ${(e?.message ?? "").slice(0, 200)}`;
}
