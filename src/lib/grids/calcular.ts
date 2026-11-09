/**
 * O motor do Brennimark Grids (13/10/2026): formato + escolhas → a geometria
 * do grid, em PONTOS (a unidade interna do InDesign; nos digitais, 1 px = 1 pt
 * e o documento mostra pixels). Puro: a prévia, o IDML e o PDF leem daqui.
 *
 * Os quatro tipos clássicos (Müller-Brockmann; Samara, "Grid: construção e
 * desconstrução") — manuscrito, colunas, modular, hierárquico —, a linha de
 * base em todos, e a desconstrução da v1 (decisão do André, 13/10): grid
 * SOBREPOSTO (outro grid de colunas em camada própria) e grid ROTACIONADO.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

import type { Tradutor } from "../i18n/tradutor";
import type { Formato, TipoDeGrid, Unidade } from "./formatos";

export const PT_POR_MM = 72 / 25.4;
const PHI = (1 + Math.sqrt(5)) / 2;

export type Proporcao = "unidade" | "2:3:4:6" | "van-de-graaf" | "aurea";

/** As escolhas da pessoa, na unidade do formato (mm ou px); linha de base em pt/px. */
export type Escolhas = {
  tipo: TipoDeGrid;
  colunas: number;
  linhas: number;
  medianiz: number;
  margens: { sup: number; inf: number; esq: number; dir: number };
  linhaDeBase: number;
  proporcao: Proporcao;
  zonas: number[];
  sobreposto: { ativo: boolean; colunas: number };
  rotacionado: { ativo: boolean; angulo: number };
  /** Capa de livro, em mm. */
  livro: { lombada: number; orelha: number };
};

export type Camada = "grid" | "zonas" | "segura" | "dobras" | "sobreposto";
export type Guia = { orientacao: "h" | "v"; pos: number; camada: Camada };
export type Retangulo = { x: number; y: number; w: number; h: number };
/** `id` só existe nos painéis da capa de livro, que o código procura por ele; o `nome` é o texto, já no idioma. */
export type Zona = Retangulo & { nome: string; id?: "orelhaVerso" | "contracapa" | "lombada" | "capa" | "orelhaFrente" };

export type Grid = {
  unidade: Unidade;
  largura: number;
  altura: number;
  sangria: number;
  margens: { sup: number; inf: number; esq: number; dir: number };
  /** As colunas vão nas margens do documento (InDesign) ou só como guias (capa de livro). */
  colunasNaMargem: boolean;
  colunas: { n: number; medianiz: number; faixas: [number, number][] };
  linhas: [number, number][];
  linhaDeBase: { inicio: number; passo: number };
  zonas: Zona[];
  segura: Retangulo | null;
  guias: Guia[];
  sobreposto: [number, number][];
  rotacionado: { angulo: number; segmentos: [number, number, number, number][] } | null;
  avisos: string[];
  /** As margens somam mais que a página: o grid não fecha, e o download fica travado. */
  margensExcedem: boolean;
};

const paraPt = (v: number, unidade: Unidade) => (unidade === "mm" ? v * PT_POR_MM : v);
const daUnidadeU = (f: Formato) => (f.unidade === "mm" ? f.u / PT_POR_MM : f.u); // u na unidade do formato

/** As escolhas iniciais: a tabela aprovada (proposta do Brennimark). */
export function escolhasPadrao(f: Formato): Escolhas {
  const u = daUnidadeU(f);
  const m = f.margensMm !== undefined
    ? { sup: f.margensMm, inf: f.margensMm, esq: f.margensMm, dir: f.margensMm }
    : { sup: f.margensU!.sup * u, inf: f.margensU!.inf * u, esq: f.margensU!.lat * u, dir: f.margensU!.lat * u };
  return {
    tipo: f.tipoPadrao,
    colunas: f.colunas,
    linhas: f.linhas || Math.max(1, Math.round(f.colunas * (f.altura / f.largura))),
    medianiz: arredonda(f.medianizU * u),
    margens: { sup: arredonda(m.sup), inf: arredonda(m.inf), esq: arredonda(m.esq), dir: arredonda(m.dir) },
    linhaDeBase: f.u,
    proporcao: "unidade",
    zonas: f.zonas ?? [1, 2],
    sobreposto: { ativo: false, colunas: f.colunas === 12 ? 5 : f.colunas + 1 },
    rotacionado: { ativo: false, angulo: 15 },
    livro: { lombada: 12, orelha: 0 },
  };
}

function arredonda(v: number) {
  return Math.round(v * 100) / 100;
}

/** Margens das proporções clássicas do manuscrito, em pt. Esquerda = interna. */
export function margensClassicas(p: Proporcao, larg: number, alt: number): Grid["margens"] | null {
  if (p === "2:3:4:6") {
    const k = larg / 18;
    return { esq: 2 * k, sup: 3 * k, dir: 4 * k, inf: 6 * k };
  }
  if (p === "van-de-graaf") return { esq: larg / 9, sup: alt / 9, dir: (2 * larg) / 9, inf: (2 * alt) / 9 };
  if (p === "aurea") {
    const k = (0.25 * larg) / (1 + PHI * PHI);
    return { esq: k, sup: k * PHI, dir: k * PHI * PHI, inf: k * PHI * PHI * PHI };
  }
  return null;
}

function faixas(inicio: number, total: number, n: number, medianiz: number): [number, number][] {
  const n1 = Math.max(1, Math.round(n));
  const w = (total - medianiz * (n1 - 1)) / n1;
  return Array.from({ length: n1 }, (_, i) => {
    const a = inicio + i * (w + medianiz);
    return [a, a + w] as [number, number];
  });
}

/** Corta o segmento ao retângulo (Liang–Barsky). Null se fica todo fora. */
export function recortar(x1: number, y1: number, x2: number, y2: number, r: Retangulo): [number, number, number, number] | null {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const testes: [number, number][] = [[-dx, x1 - r.x], [dx, r.x + r.w - x1], [-dy, y1 - r.y], [dy, r.y + r.h - y1]];
  for (const [p, q] of testes) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
    else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
}

/** `t` é o tradutor ligado a `ferramentas.grids`: os avisos e os nomes das zonas saem no idioma da tela. */
export function calcularGrid(f: Formato, e: Escolhas, t: Tradutor): Grid {
  const avisos: string[] = [];
  let margensExcedem = false;
  const decimal = t("separadorDecimal");
  const fmt = (pt: number) => formatar(pt, f.unidade, decimal);
  const guias: Guia[] = [];
  const un = f.unidade;
  const medianiz = paraPt(e.medianiz, un);
  const passo = e.linhaDeBase; // já em pt (impresso) ou px (digital)

  // A página. A capa de livro cresce com orelhas e lombada.
  const capaL = paraPt(f.largura, un);
  const alt = paraPt(f.altura, un);
  const lombada = f.livro ? Math.max(0, e.livro.lombada) * PT_POR_MM : 0;
  const orelha = f.livro ? Math.max(0, e.livro.orelha) * PT_POR_MM : 0;
  const larg = f.livro ? 2 * orelha + 2 * capaL + lombada : capaL;

  let margens = {
    sup: paraPt(e.margens.sup, un), inf: paraPt(e.margens.inf, un),
    esq: paraPt(e.margens.esq, un), dir: paraPt(e.margens.dir, un),
  };
  if (e.tipo === "manuscrito" && !f.livro) {
    const c = margensClassicas(e.proporcao, larg, alt);
    if (c) margens = c;
  }

  const zonas: Zona[] = [];
  let colunasNaMargem = true;
  let faixasCol: [number, number][];

  if (f.livro) {
    // Painéis da esquerda para a direita: orelha · contracapa · lombada · capa · orelha.
    colunasNaMargem = false;
    const xs = [0, orelha, orelha + capaL, orelha + capaL + lombada, orelha + 2 * capaL + lombada, larg];
    const ids = ["orelhaVerso", "contracapa", "lombada", "capa", "orelhaFrente"] as const;
    for (let i = 0; i < 5; i++) {
      if (xs[i + 1] - xs[i] <= 0.01) continue;
      zonas.push({ id: ids[i], nome: t(`zonas.${ids[i]}`), x: xs[i], y: 0, w: xs[i + 1] - xs[i], h: alt });
      if (i > 0) guias.push({ orientacao: "v", pos: xs[i], camada: "dobras" });
    }
    const m = margens.esq;
    const capa = zonas.find((z) => z.id === "capa")!;
    const contra = zonas.find((z) => z.id === "contracapa")!;
    faixasCol = faixas(capa.x + m, capa.w - 2 * m, e.tipo === "manuscrito" ? 1 : e.colunas, medianiz);
    for (const [a, b] of [...faixasCol, ...faixas(contra.x + m, contra.w - 2 * m, e.tipo === "manuscrito" ? 1 : e.colunas, medianiz)]) {
      guias.push({ orientacao: "v", pos: a, camada: "grid" }, { orientacao: "v", pos: b, camada: "grid" });
    }
    guias.push({ orientacao: "h", pos: margens.sup, camada: "grid" }, { orientacao: "h", pos: alt - margens.inf, camada: "grid" });
    if (lombada > 0 && lombada < 2 * 5 * PT_POR_MM) avisos.push(t("avisos.lombadaFina"));
  } else {
    const n = e.tipo === "manuscrito" ? 1 : e.colunas;
    faixasCol = faixas(margens.esq, larg - margens.esq - margens.dir, n, medianiz);
  }

  // Modular: módulos em linhas de base inteiras; a margem de baixo fecha a conta.
  let linhas: [number, number][] = [];
  if (e.tipo === "modular" && !f.livro) {
    const L = Math.max(1, Math.round(e.linhas));
    const H = alt - margens.sup - margens.inf;
    let m = (H - medianiz * (L - 1)) / L;
    const casa = passo > 0 && Math.abs((medianiz / passo) - Math.round(medianiz / passo)) < 1e-6;
    if (casa) {
      // O múltiplo de linha de base MAIS PRÓXIMO (para cima ou para baixo), e
      // a diferença vai às margens: dividida entre cima e baixo quando eram
      // iguais (os digitais — a página continua simétrica), só embaixo quando
      // não eram (o impresso, que já tem a de baixo maior). Achado no teste de
      // 13/10: arredondar só para baixo abria 78 px a mais embaixo do post 4:5.
      const opcoes = [Math.floor(m / passo + 1e-9), Math.ceil(m / passo - 1e-9)].map((k) => k * passo).filter((v) => v > 0);
      const sobraDe = (v: number) => H - (L * v + medianiz * (L - 1));
      const simetrica = Math.abs(margens.sup - margens.inf) < 0.01;
      const cabe = (v: number) => {
        const sobra = sobraDe(v);
        const sup = simetrica ? margens.sup + sobra / 2 : margens.sup;
        const inf = simetrica ? margens.inf + sobra / 2 : margens.inf + sobra;
        return sup >= margens.sup / 2 && inf >= margens.inf / 2;
      };
      const escolhida = opcoes.filter(cabe).sort((x, y) => Math.abs(sobraDe(x)) - Math.abs(sobraDe(y)))[0];
      if (escolhida) {
        const sobra = sobraDe(escolhida);
        if (Math.abs(sobra) > 0.01) {
          const antes = { ...margens };
          margens = simetrica
            ? { ...margens, sup: margens.sup + sobra / 2, inf: margens.inf + sobra / 2 }
            : { ...margens, inf: margens.inf + sobra };
          avisos.push(simetrica
            ? t("avisos.margensAjustadas", { de: fmt(antes.sup), para: fmt(margens.sup) })
            : t("avisos.margemInferiorAjustada", { de: fmt(antes.inf), para: fmt(margens.inf) }));
        }
        m = escolhida;
      }
    } else {
      avisos.push(t("avisos.medianizForaDaBase"));
    }
    linhas = Array.from({ length: L }, (_, i) => {
      const a = margens.sup + i * (m + medianiz);
      return [a, a + m] as [number, number];
    });
    for (let i = 0; i < L - 1; i++) {
      guias.push({ orientacao: "h", pos: linhas[i][1], camada: "grid" }, { orientacao: "h", pos: linhas[i + 1][0], camada: "grid" });
    }
  }

  // Hierárquico: zonas por proporção, ao longo do lado maior.
  if (e.tipo === "hierarquico" && !f.livro) {
    const pesos = e.zonas.filter((p) => p > 0);
    const deitado = larg >= alt;
    const ini = deitado ? margens.esq : margens.sup;
    const total = (deitado ? larg - margens.esq - margens.dir : alt - margens.sup - margens.inf) - medianiz * (pesos.length - 1);
    const soma = pesos.reduce((a, b) => a + b, 0) || 1;
    let pos = ini;
    pesos.forEach((p, i) => {
      const tam = (total * p) / soma;
      const nome = t(p === 1 ? "zonas.umaParte" : "zonas.variasPartes", { n: i + 1, p: String(p).replace(".", decimal) });
      zonas.push(deitado
        ? { nome, x: pos, y: margens.sup, w: tam, h: alt - margens.sup - margens.inf }
        : { nome, x: margens.esq, y: pos, w: larg - margens.esq - margens.dir, h: tam });
      if (i < pesos.length - 1) {
        guias.push({ orientacao: deitado ? "v" : "h", pos: pos + tam, camada: "zonas" });
        guias.push({ orientacao: deitado ? "v" : "h", pos: pos + tam + medianiz, camada: "zonas" });
      }
      pos += tam + medianiz;
    });
  }

  // Área segura da plataforma (só com fonte oficial).
  let segura: Retangulo | null = null;
  if (f.seguraFracao) {
    const s = f.seguraFracao;
    segura = { x: larg * s.esq, y: alt * s.sup, w: larg * (1 - s.esq - s.dir), h: alt * (1 - s.sup - s.inf) };
  } else if (f.seguraCentral) {
    const w = paraPt(f.seguraCentral.largura, un), h = paraPt(f.seguraCentral.altura, un);
    segura = { x: (larg - w) / 2, y: (alt - h) / 2, w, h };
  }
  if (segura) {
    guias.push(
      { orientacao: "h", pos: segura.y, camada: "segura" }, { orientacao: "h", pos: segura.y + segura.h, camada: "segura" },
      { orientacao: "v", pos: segura.x, camada: "segura" }, { orientacao: "v", pos: segura.x + segura.w, camada: "segura" },
    );
  }

  // Desconstrução: outro grid de colunas por cima, em camada própria.
  let sobreposto: [number, number][] = [];
  if (e.sobreposto.ativo && !f.livro) {
    sobreposto = faixas(margens.esq, larg - margens.esq - margens.dir, e.sobreposto.colunas, medianiz);
    for (const [a, b] of sobreposto) guias.push({ orientacao: "v", pos: a, camada: "sobreposto" }, { orientacao: "v", pos: b, camada: "sobreposto" });
  }

  // Desconstrução: o grid de colunas girado em torno do centro, repetido até
  // cobrir a página e cortado nas bordas. Guia não gira no InDesign: vira linha
  // fina numa camada que não imprime.
  let rotacionado: Grid["rotacionado"] = null;
  if (e.rotacionado.ativo && !f.livro && faixasCol.length > 0) {
    const ang = (e.rotacionado.angulo * Math.PI) / 180;
    const [a0, b0] = faixasCol[0];
    const largCol = b0 - a0;
    const passoCol = largCol + medianiz;
    const cx = larg / 2, cy = alt / 2;
    const D = Math.hypot(larg, alt);
    const pagina = { x: 0, y: 0, w: larg, h: alt };
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const gira = (x: number, y: number): [number, number] => [cx + x * cos - y * sin, cy + x * sin + y * cos];
    const segmentos: [number, number, number, number][] = [];
    // Em 0°, as linhas caem exatamente nas bordas das colunas reais.
    const base = a0 - cx;
    const k = Math.ceil(D / passoCol) + 1;
    for (let i = -k; i <= k; i++) {
      for (const dx of medianiz > 0 ? [base + i * passoCol, base + i * passoCol + largCol] : [base + i * passoCol]) {
        const [x1, y1] = gira(dx, -D);
        const [x2, y2] = gira(dx, D);
        const c = recortar(x1, y1, x2, y2, pagina);
        if (c) segmentos.push(c);
      }
    }
    rotacionado = { angulo: e.rotacionado.angulo, segmentos };
  }

  if (margens.esq + margens.dir >= larg || margens.sup + margens.inf >= alt) { avisos.push(t("avisos.margensSomamMais")); margensExcedem = true; }

  return {
    unidade: un, largura: larg, altura: alt, sangria: f.sangria * PT_POR_MM, margens, colunasNaMargem,
    colunas: { n: faixasCol.length, medianiz, faixas: faixasCol }, linhas,
    linhaDeBase: { inicio: margens.sup, passo }, zonas, segura, guias, sobreposto, rotacionado, avisos, margensExcedem,
  };
}

/** `decimal` é o separador do idioma da tela (`,` em português, `.` em inglês). */
export function formatar(pt: number, un: Unidade, decimal = ","): string {
  if (un === "mm") return `${(pt / PT_POR_MM).toFixed(1).replace(".", decimal)} mm`;
  return `${Math.round(pt)} px`;
}
