/**
 * De citação a página do PDF — o "momento mais forte da demonstração"
 * (spec do Assistente §4.1).
 *
 * O modelo cita pelo CAMINHO do trecho (`/docs/cores`), no formato que o
 * prompt exige. A página NÃO é pedida a ele: um número escrito pelo modelo
 * poderia sair errado com toda a confiança do mundo, e a citação que leva à
 * página errada é pior que citação nenhuma. A página vem dos trechos que o
 * servidor de fato entregou — `page_start` de `brand_chunks` —, num cabeçalho
 * da resposta, e a janela a aplica.
 *
 * Citação cujo caminho não está no mapa (o modelo citou algo que não recebeu,
 * ou o trecho não tem página) abre o manual sem página: leva ao documento
 * certo e não inventa lugar nele.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export const CABECALHO_DE_PAGINAS = "X-Brennimark-Paginas";

export type MapaDePaginas = Record<string, number>;

/** Do que o servidor entregou ao modelo: caminho citável → primeira página. */
export function mapaDePaginas(
  trechos: readonly { documentSlug: string; pageStart: number | null }[],
): MapaDePaginas {
  const mapa: MapaDePaginas = {};
  for (const trecho of trechos) {
    if (trecho.pageStart === null || !Number.isInteger(trecho.pageStart) || trecho.pageStart < 1) continue;
    const caminho = `/docs/${trecho.documentSlug}`;
    // O mesmo documento em vários trechos: vale a primeira página dele.
    mapa[caminho] = Math.min(mapa[caminho] ?? trecho.pageStart, trecho.pageStart);
  }
  return mapa;
}

/** Cabeçalho HTTP só carrega ASCII; o slug pode ter acento. */
export function codificarMapa(mapa: MapaDePaginas): string {
  return encodeURIComponent(JSON.stringify(mapa));
}

/** Defensivo: cabeçalho ausente, truncado ou adulterado vira mapa vazio. */
export function decodificarMapa(valor: string | null | undefined): MapaDePaginas {
  if (!valor) return {};
  try {
    const bruto: unknown = JSON.parse(decodeURIComponent(valor));
    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
    const mapa: MapaDePaginas = {};
    for (const [caminho, pagina] of Object.entries(bruto)) {
      if (caminho.startsWith("/docs/") && Number.isInteger(pagina) && (pagina as number) >= 1) {
        mapa[caminho] = pagina as number;
      }
    }
    return mapa;
  } catch {
    return {};
  }
}

/**
 * Para onde a citação leva: o manual (PDF) desta marca, na página, se houver.
 * `basePath` é `/w/<conta>/b/<marca>/docs`. `pedido` distingue dois cliques
 * na mesma citação — ver `paginaPedida` no visualizador.
 */
export function destinoDaCitacao(
  caminho: string,
  mapa: MapaDePaginas,
  basePath: string,
  pedido: string,
): { href: string; pagina: number | null } {
  const pagina = mapa[caminho] ?? null;
  const manual = `${basePath}/original`;
  return pagina === null
    ? { href: manual, pagina: null }
    : { href: `${manual}?pagina=${pagina}&ir=${encodeURIComponent(pedido)}`, pagina };
}
