/**
 * Qual artigo da Central de ajuda cabe na tela em que a pessoa está.
 *
 * O botão Ajuda da moldura abre o painel já no artigo certo. A decisão é só
 * pelo endereço, e pelo SEGMENTO dele (`pessoas`, `original`), não por um
 * trecho como `/w/conta/pessoas`: o prefixo muda — `/w/<conta>/b/<marca>/docs`
 * em produção, `/dev/...` na bancada — e o segmento não (mesma razão de
 * `coluna.ts`).
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
const POR_SEGMENTO: readonly (readonly [segmento: string, artigo: string])[] = [
  ["original", "manual-em-pdf"],
  ["complementos", "complementos"],
  ["kit", "kit"],
  ["cores", "cores"],
  ["grids", "grids"],
  ["pessoas", "pessoas-e-acesso"],
  ["links", "links-de-entrega"],
  ["registros", "registros"],
  ["configuracoes", "assinatura"],
  ["admin", "tipografia-e-fontes"],
  ["importar", "primeiros-passos"],
  ["chat", "vini-max"],
  ["analise", "vini-max"],
  ["historico", "vini-max"],
];

/** O endereço do artigo da tela, ou `null` quando a tela não tem um (aí o painel mostra a lista). */
export function artigoDaTela(pathname: string): string | null {
  const segmentos = pathname.split(/[?#]/)[0].split("/").filter(Boolean);
  // O último segmento é o que a tela É; um `/docs/kit/...` filho ainda é o Kit.
  for (let i = segmentos.length - 1; i >= 0; i--) {
    const achado = POR_SEGMENTO.find(([s]) => s === segmentos[i]);
    if (achado) return achado[1];
  }
  return null;
}
