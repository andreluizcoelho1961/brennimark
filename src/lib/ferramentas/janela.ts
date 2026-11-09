/**
 * A ferramenta em janela solta (21/10/2026): o botão "Abrir em janela" do Kit, do
 * Cores e do Grids abre a ferramenta numa janela própria do navegador, que a
 * pessoa move para outra tela, redimensiona e deixa ao lado do Illustrator.
 *
 * Aqui mora só o que é puro: quais ferramentas existem, o endereço da janela, o
 * nome que faz o navegador REAPROVEITAR a janela já aberta, e as contas do
 * tamanho e da posição lembrados. Quem chama o navegador é `AbrirEmJanela`.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

import { IDIOMA_PADRAO_DO_SITE, caminhoDoSite, type IdiomaDoSite } from "../site/idiomas";

export const FERRAMENTAS_EM_JANELA = ["kit", "cores", "grids"] as const;
export type FerramentaEmJanela = (typeof FERRAMENTAS_EM_JANELA)[number];


export function ehFerramentaEmJanela(valor: unknown): valor is FerramentaEmJanela {
  return typeof valor === "string" && (FERRAMENTAS_EM_JANELA as readonly string[]).includes(valor);
}

/** A ferramenta na página normal do site, e na janela solta. */
export const enderecoNormal = (f: FerramentaEmJanela, idioma: IdiomaDoSite = IDIOMA_PADRAO_DO_SITE) => caminhoDoSite(idioma, `/ferramentas/${f}`);
export const enderecoDaJanela = (f: FerramentaEmJanela, idioma: IdiomaDoSite = IDIOMA_PADRAO_DO_SITE) => caminhoDoSite(idioma, `/ferramentas/janela/${f}`);

/**
 * O nome da janela: abrir de novo com o MESMO nome traz a janela que já existe
 * para a frente, em vez de abrir outra igual por cima.
 */
export const nomeDaJanela = (f: FerramentaEmJanela) => `bm-janela-${f}`;

export const CHAVE_DO_ARMAZENAMENTO = (f: FerramentaEmJanela) => `bm-janela:${f}`;

export type Geometria = { largura: number; altura: number; esquerda: number; topo: number };

export const TAMANHO_PADRAO: Record<FerramentaEmJanela, { largura: number; altura: number }> = {
  kit: { largura: 1080, altura: 780 },
  cores: { largura: 980, altura: 720 },
  grids: { largura: 1180, altura: 800 },
};

/** Menor que isso, as telas das ferramentas ficam apertadas demais para usar. */
export const TAMANHO_MINIMO = { largura: 520, altura: 420 };

type Tela = { largura: number; altura: number; esquerda?: number; topo?: number };

const finito = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * Lê o que o armazenamento guardou. Qualquer coisa fora da forma vira `null`: o
 * armazenamento é do navegador de quem usa e pode ter lixo.
 */
export function lerGeometria(texto: string | null | undefined): Geometria | null {
  if (!texto) return null;
  try {
    const v = JSON.parse(texto) as Record<string, unknown>;
    if (!v || typeof v !== "object") return null;
    const { largura, altura, esquerda, topo } = v;
    if (![largura, altura, esquerda, topo].every(finito)) return null;
    return { largura: largura as number, altura: altura as number, esquerda: esquerda as number, topo: topo as number };
  } catch {
    return null;
  }
}

/**
 * Ajusta a geometria lembrada à tela de HOJE: o monitor de ontem pode não estar
 * ligado, e uma janela aberta fora de qualquer tela não dá para pegar. O tamanho
 * fica entre o mínimo e a tela; a posição, com pelo menos uma parte da janela à
 * vista.
 */
export function ajustarATela(g: Geometria, tela: Tela): Geometria {
  const largura = Math.round(Math.min(Math.max(g.largura, TAMANHO_MINIMO.largura), Math.max(tela.largura, TAMANHO_MINIMO.largura)));
  const altura = Math.round(Math.min(Math.max(g.altura, TAMANHO_MINIMO.altura), Math.max(tela.altura, TAMANHO_MINIMO.altura)));
  const e0 = tela.esquerda ?? 0;
  const t0 = tela.topo ?? 0;
  const visivel = 120; // pelo menos isso da janela dentro da tela
  const esquerda = Math.round(Math.min(Math.max(g.esquerda, e0 - largura + visivel), e0 + tela.largura - visivel));
  const topo = Math.round(Math.min(Math.max(g.topo, t0), t0 + tela.altura - visivel));
  return { largura, altura, esquerda, topo };
}

/** A primeira abertura: o tamanho padrão, no meio da tela. */
export function geometriaInicial(f: FerramentaEmJanela, tela: Tela): Geometria {
  const { largura, altura } = TAMANHO_PADRAO[f];
  const l = Math.min(largura, Math.max(tela.largura - 80, TAMANHO_MINIMO.largura));
  const a = Math.min(altura, Math.max(tela.altura - 80, TAMANHO_MINIMO.altura));
  return {
    largura: l,
    altura: a,
    esquerda: Math.round((tela.esquerda ?? 0) + (tela.largura - l) / 2),
    topo: Math.round((tela.topo ?? 0) + (tela.altura - a) / 2),
  };
}

/** O texto de `features` do `window.open`. `popup` pede a janela enxuta, sem abas. */
export function recursosDaJanela(g: Geometria): string {
  return `popup=yes,width=${g.largura},height=${g.altura},left=${g.esquerda},top=${g.topo}`;
}

/** Mudou o bastante para valer gravar (evita escrever a cada pixel arrastado). */
export function mudouGeometria(a: Geometria | null, b: Geometria): boolean {
  if (!a) return true;
  return Math.abs(a.largura - b.largura) > 2 || Math.abs(a.altura - b.altura) > 2 || Math.abs(a.esquerda - b.esquerda) > 2 || Math.abs(a.topo - b.topo) > 2;
}
