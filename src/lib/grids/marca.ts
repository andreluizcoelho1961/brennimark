/**
 * A marca no documento do Grids do assinante (14/10/2026) — puro, sem rede.
 *
 * Logo: o tamanho padrão é a largura de algumas colunas (um quarto da área
 * útil), nunca abaixo da redução mínima do manual nos digitais (ela é em px).
 * Vai no canto escolhido, encostado nas margens; a área de proteção (fração da
 * altura do logo, das regras do Kit) vira um retângulo que não imprime. Se a
 * margem for menor que a área de proteção, a página corta a proteção — a tela
 * avisa e oferece ajustar as margens (princípio 6 da tabela aprovada).
 *
 * Cores: só as APROVADAS da paleta. Nos impressos, o CMYK que o manual declara
 * (sem ele, a cor entra em RGB e o LEIA-ME diz); nos digitais, o RGB do HEX.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

import type { Formato } from "./formatos";
import { PT_POR_MM, formatar, type Escolhas, type Grid } from "./calcular";
import type { CorNoDocumento, EstiloNoDocumento, FonteDoEstilo } from "./idml";

export type Canto = "sup-esq" | "sup-dir" | "inf-esq" | "inf-dir";
export const CANTOS: { id: Canto; nome: string }[] = [
  { id: "inf-esq", nome: "Inferior esquerdo" },
  { id: "inf-dir", nome: "Inferior direito" },
  { id: "sup-esq", nome: "Superior esquerdo" },
  { id: "sup-dir", nome: "Superior direito" },
];

type Ret = { x: number; y: number; w: number; h: number };

/** A largura padrão do logo, em pt: um quarto da área útil, nas bordas das colunas quando há colunas. */
export function larguraPadraoDoLogo(g: Grid): number {
  const util = g.largura - g.margens.esq - g.margens.dir;
  const n = g.colunas.n;
  if (n >= 2 && g.colunasNaMargem) {
    const k = Math.max(1, Math.round(n / 4));
    const [a] = g.colunas.faixas[0];
    const [, b] = g.colunas.faixas[k - 1];
    return b - a;
  }
  return util / 4;
}

export function posicionarLogo(
  g: Grid,
  opcoes: { largura: number; aspecto: number; canto: Canto; protecao: number; reducaoMinimaPx: number | null },
): { quadro: Ret; protecao: Ret | null; avisos: string[]; margemNecessaria: number | null } {
  const avisos: string[] = [];
  let w = opcoes.largura;
  if (g.unidade === "px" && opcoes.reducaoMinimaPx && w < opcoes.reducaoMinimaPx) {
    w = opcoes.reducaoMinimaPx;
    avisos.push(`O logo foi aumentado para ${Math.round(w)} px, a redução mínima do manual.`);
  }
  const h = w * opcoes.aspecto;
  const direita = opcoes.canto.endsWith("dir");
  const baixo = opcoes.canto.startsWith("inf");
  const x = direita ? g.largura - g.margens.dir - w : g.margens.esq;
  const y = baixo ? g.altura - g.margens.inf - h : g.margens.sup;
  const quadro = { x, y, w, h };
  if (!(opcoes.protecao > 0)) return { quadro, protecao: null, avisos, margemNecessaria: null };

  const p = opcoes.protecao * h;
  const protecao = { x: x - p, y: y - p, w: w + 2 * p, h: h + 2 * p };
  const lado = direita ? g.margens.dir : g.margens.esq;
  const borda = baixo ? g.margens.inf : g.margens.sup;
  let margemNecessaria: number | null = null;
  if (lado < p - 0.01 || borda < p - 0.01) {
    margemNecessaria = p;
    avisos.push(`A margem é menor que a área de proteção do logo (${formatar(p, g.unidade)}): a página corta a proteção.`);
  }
  return { quadro, protecao, avisos, margemNecessaria };
}

/** As margens do lado do logo levadas à área de proteção (na unidade do formato). */
export function margensComProtecao(e: Escolhas, f: Formato, canto: Canto, protecaoPt: number): Escolhas["margens"] {
  const v = f.unidade === "mm" ? Math.ceil((protecaoPt / PT_POR_MM) * 10) / 10 : Math.ceil(protecaoPt);
  const m = { ...e.margens };
  if (canto.endsWith("dir")) m.dir = Math.max(m.dir, v); else m.esq = Math.max(m.esq, v);
  if (canto.startsWith("inf")) m.inf = Math.max(m.inf, v); else m.sup = Math.max(m.sup, v);
  return m;
}

/**
 * Lê o CMYK como os manuais escrevem: "0 85 100 0", "C0 M85 Y100 K0",
 * "c:0 m:85 y:100 k:0", "0/85/100/0", "0, 85, 100, 0" (com ou sem %).
 */
export function lerCmyk(texto: string | null | undefined): [number, number, number, number] | null {
  if (!texto) return null;
  const rotulado = /c\s*:?\s*(\d+(?:[.,]\d+)?)\s*%?[\s,;/|]*m\s*:?\s*(\d+(?:[.,]\d+)?)\s*%?[\s,;/|]*y\s*:?\s*(\d+(?:[.,]\d+)?)\s*%?[\s,;/|]*k\s*:?\s*(\d+(?:[.,]\d+)?)/i.exec(texto);
  const nums = rotulado ? rotulado.slice(1) : (texto.match(/\d+(?:[.,]\d+)?/g) ?? []);
  if (nums.length !== 4) return null;
  const v = nums.map((x) => Number(String(x).replace(",", ".")));
  if (v.some((x) => !(x >= 0 && x <= 100))) return null;
  return v as [number, number, number, number];
}

function hexParaRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export type CorDaPaleta = { nome: string; hex: string | null; cmyk: string | null; pagina: number | null };

/** As cores aprovadas como amostras do documento, com o que ficou de fora dito. */
export function coresParaODocumento(paleta: readonly CorDaPaleta[], impresso: boolean): { cores: CorNoDocumento[]; notas: string[] } {
  const cores: CorNoDocumento[] = [];
  const notas: string[] = [];
  for (const c of paleta) {
    if (!c.hex) { notas.push(`${c.nome}: sem código HEX no Brennimark — não entrou.`); continue; }
    const cmyk = impresso ? lerCmyk(c.cmyk) : null;
    if (impresso && !cmyk) notas.push(`${c.nome}: o manual não declara CMYK — entrou em RGB (${c.hex}); confira com a gráfica.`);
    const origem = c.pagina ? ` — manual, p. ${c.pagina}` : "";
    cores.push({ nome: `${c.nome}${origem}`, cmyk, rgb: hexParaRgb(c.hex) });
  }
  return { cores, notas };
}

/** Uma fonte APROVADA da tipografia da marca, como o Grids a usa. */
export type FonteParaOGrid = {
  uso: string; segmento: string; familia: string; estilo: string;
  espacejamento: number | null; caixaAlta: boolean | null; pagina: number | null;
};

const SEGMENTO_IMPRESSO = /impress|print|offset|gr[áa]fic|papel/i;
const SEGMENTO_DIGITAL = /digital|tela|web|online|screen|redes|social/i;

/**
 * A fonte de um uso para este meio: a do segmento do meio ("impresso",
 * "digital") quando o manual separa; senão a sem segmento; senão a primeira
 * daquele uso. Só recebe fonte APROVADA — quem chama filtra.
 */
export function fonteDoUso(fontes: readonly FonteParaOGrid[], uso: string, impresso: boolean): FonteParaOGrid | null {
  const doUso = fontes.filter((f) => f.uso === uso);
  const doMeio = doUso.find((f) => f.segmento && (impresso ? SEGMENTO_IMPRESSO : SEGMENTO_DIGITAL).test(f.segmento));
  return doMeio ?? doUso.find((f) => !f.segmento) ?? doUso[0] ?? null;
}

function paraOEstilo(f: FonteParaOGrid, herdadaDe?: string): FonteDoEstilo {
  const onde = f.pagina ? `manual, p. ${f.pagina}` : "tipografia da marca";
  return {
    familia: f.familia, estilo: f.estilo, espacejamento: f.espacejamento, caixaAlta: f.caixaAlta,
    origem: herdadaDe ? `o manual não define; usa a do ${herdadaDe} (proposta do Brennimark)` : `${onde} — aprovada`,
  };
}

/**
 * Os estilos de texto no corpo e na entrelinha do grid, com a fonte da marca.
 * Corpo de título e de texto da tabela aprovada quando ela define ("título
 * 96/108 · texto 32/36", "9,5 / 12 pt"); a ENTRELINHA é sempre o múltiplo da
 * linha de base que comporta o corpo — achado no InDesign em 14/10: o texto
 * de 32 px saía com entrelinha de 12.
 *
 * A fonte (14/10/2026) vem da tipografia APROVADA: família, estilo,
 * espacejamento e caixa alta. O tamanho continua o do grid, porque depende da
 * peça. Subtítulo sem fonte herda a do Título, e Legenda, a do Texto — dito
 * como proposta. Destaque e Apoio só existem quando a marca os define.
 */
export function estilosDoFormato(f: Formato, e: Escolhas, fontes: readonly FonteParaOGrid[] = []): EstiloNoDocumento[] {
  const u = e.linhaDeBase;
  const num = (v: string) => Number(v.replace(",", "."));
  const par = (rotulo: string) => {
    const m = new RegExp(`${rotulo}\\s+(\\d+(?:[.,]\\d+)?)\\s*/\\s*(\\d+(?:[.,]\\d+)?)`, "i").exec(f.corpo ?? "");
    return m ? { corpo: num(m[1]), entrelinha: num(m[2]) } : null;
  };
  const soTexto = /^\s*(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/.exec(f.corpo ?? "");
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const naBase = (corpo: number, desejada?: number) => {
    const minima = Math.max(desejada ?? 0, corpo * 1.125);
    return Math.max(1, Math.ceil(minima / u - 1e-9)) * u;
  };
  const texto = par("texto") ?? (soTexto ? { corpo: num(soTexto[1]), entrelinha: num(soTexto[2]) } : { corpo: r1(u * 0.8), entrelinha: u });
  const titulo = par("título") ?? { corpo: r1(u * 3 * 0.86), entrelinha: u * 3 };
  const sub = r1((titulo.corpo + texto.corpo) / 2);
  const legenda = r1(texto.corpo * 0.8);

  const impresso = f.unidade === "mm";
  const de = (uso: string) => fonteDoUso(fontes, uso, impresso);
  const fTitulo = de("titulo"), fTexto = de("texto"), fSub = de("subtitulo"), fLegenda = de("legenda");
  const fDestaque = de("destaque"), fApoio = de("apoio");
  const estilos: EstiloNoDocumento[] = [
    { nome: "Título", corpo: titulo.corpo, entrelinha: naBase(titulo.corpo, titulo.entrelinha), fonte: fTitulo ? paraOEstilo(fTitulo) : null },
    { nome: "Subtítulo", corpo: sub, entrelinha: naBase(sub), fonte: fSub ? paraOEstilo(fSub) : fTitulo ? paraOEstilo(fTitulo, "Título") : null },
    { nome: "Texto", corpo: texto.corpo, entrelinha: naBase(texto.corpo, texto.entrelinha), fonte: fTexto ? paraOEstilo(fTexto) : null },
    { nome: "Legenda", corpo: legenda, entrelinha: naBase(legenda), fonte: fLegenda ? paraOEstilo(fLegenda) : fTexto ? paraOEstilo(fTexto, "Texto") : null },
  ];
  if (fDestaque) estilos.push({ nome: "Destaque", corpo: sub, entrelinha: naBase(sub), fonte: paraOEstilo(fDestaque) });
  if (fApoio) estilos.push({ nome: "Apoio", corpo: texto.corpo, entrelinha: naBase(texto.corpo, texto.entrelinha), fonte: paraOEstilo(fApoio) });
  return estilos;
}

/** "Inter Bold" — como a pessoa procura no menu de fontes. */
export function nomeDaFonteNoEstilo(f: Pick<FonteDoEstilo, "familia" | "estilo">): string {
  return f.estilo ? `${f.familia} ${f.estilo}` : f.familia;
}

/** As linhas dos estilos para o LEIA-ME e para a tela. */
export function linhasDosEstilos(estilos: readonly EstiloNoDocumento[]): string[] {
  return estilos.map((e) => {
    const medida = `${String(e.corpo).replace(".", ",")}/${String(e.entrelinha).replace(".", ",")}`;
    if (!e.fonte) return `${e.nome} (${medida}): sem fonte da marca aprovada — fica a fonte padrão do InDesign.`;
    const extras = [
      e.fonte.espacejamento !== null ? `espacejamento ${e.fonte.espacejamento}` : "",
      e.fonte.caixaAlta ? "caixa alta" : "",
    ].filter(Boolean).join(", ");
    return `${e.nome} (${medida}): ${nomeDaFonteNoEstilo(e.fonte)}${extras ? `, ${extras}` : ""} — ${e.fonte.origem}.`;
  });
}

/** O LEIA-ME do pacote: de onde veio cada coisa, e o que falta. */
export function leiaMeDoGrid(d: {
  marca: string; formato: Formato; origemDoGrid: string; tipo: string;
  logo: { arquivo: string; versao: string; protecao: string | null } | null;
  cores: CorNoDocumento[]; notasDasCores: string[]; avisos: string[];
  estilos?: readonly EstiloNoDocumento[]; fontesEmRascunho?: number;
}): string {
  const estilos = d.estilos ?? [];
  const comFonte = estilos.filter((e) => e.fonte);
  const familias = [...new Set(comFonte.map((e) => nomeDaFonteNoEstilo(e.fonte!)))];
  const rascunhos = d.fontesEmRascunho ?? 0;
  const linhas = [
    `Grid de ${d.marca} — ${d.formato.nome}`,
    "Feito no Brennimark Grids. Abra o .idml no InDesign (ou no Affinity Publisher).",
    "",
    `GRID (${d.tipo}): ${d.origemDoGrid}.`,
    "As camadas de guia são travadas e não imprimem; ligue e desligue no painel Camadas.",
    "",
    d.logo
      ? `LOGO: ${d.logo.arquivo} (${d.logo.versao}), na pasta Links. ${d.logo.protecao ? `Área de proteção: ${d.logo.protecao} — o retângulo vermelho em volta do logo não imprime.` : "O manual não tem área de proteção registrada no Brennimark."}`
      : "LOGO: a marca não tem logotipo nos Materiais em formato que o InDesign coloque (PDF, AI, SVG, PNG ou JPG).",
    "Se o InDesign disser que o vínculo está ausente, mantenha a pasta Links ao lado do .idml.",
    "",
    d.cores.length ? `CORES (amostras): só as aprovadas — ${d.cores.map((c) => c.nome).join("; ")}.` : "CORES: a paleta desta marca ainda não tem cores aprovadas no Brennimark.",
    ...d.notasDasCores.map((n) => `  · ${n}`),
    "",
    `ESTILOS DE TEXTO: ${estilos.length ? estilos.map((e) => e.nome).join(", ") : "Título, Subtítulo, Texto e Legenda"}, no corpo e na entrelinha do grid, alinhados à linha de base.`,
    ...linhasDosEstilos(estilos).map((l) => `  · ${l}`),
    familias.length
      ? `INSTALE AS FONTES antes de abrir: ${familias.join("; ")}. O Brennimark não distribui o arquivo da fonte; sem ela instalada, o InDesign avisa que a fonte falta.`
      : "A tipografia da marca ainda não tem fonte aprovada no Brennimark: os estilos ficam com a fonte padrão do InDesign.",
    ...(rascunhos > 0 ? [`  · ${rascunhos === 1 ? "1 fonte em rascunho não entrou" : `${rascunhos} fontes em rascunho não entraram`}: elas entram quando forem aprovadas.`] : []),
  ];
  if (d.avisos.length) linhas.push("", "AVISOS:", ...d.avisos.map((a) => `  · ${a}`));
  return linhas.join("\n") + "\n";
}

/** Que formato de logo o InDesign coloca (o que o Kit abre e o InDesign não, como WebP, fica de fora). */
export function formatoParaOInDesign(arquivo: string, mime: string): "pdf" | "svg" | "png" | "jpeg" | null {
  const ext = /\.([a-z0-9]+)$/i.exec(arquivo)?.[1]?.toLowerCase() ?? "";
  const m = (mime || "").toLowerCase();
  if (ext === "pdf" || ext === "ai" || m === "application/pdf") return "pdf";
  if (ext === "svg" || m === "image/svg+xml") return "svg";
  if (ext === "png" || m === "image/png") return "png";
  if (ext === "jpg" || ext === "jpeg" || m === "image/jpeg") return "jpeg";
  return null;
}
