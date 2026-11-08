import type { Trecho } from "../ai/recuperacao";
import { contraste, veredito, type Veredito } from "../cores/cores";
import type { CorDaPaleta } from "./paleta";
import { ordenarPaleta } from "./paleta";
import { seConfundem, type ParQueSeConfunde } from "../cores/acessibilidade-da-peca";

/**
 * O contraste dos pares da paleta — fatia 1 de acessibilidade (06/11/2026).
 *
 * A Happy House pediu que o Vini avise sobre acessibilidade. Esta é a base
 * CALCULÁVEL: a razão de contraste de cada par de cores da ficha, e entre cada
 * cor e o branco e o preto, com o veredito por uso. Não usa IA — é conta, e por
 * isso vale em qualquer plano. A matemática (luminância, razão, veredito) é a
 * de `cores.ts`, a mesma da ferramenta Cores; aqui só se escolhem os pares.
 *
 * Honestidade editorial: o status da cor atravessa o par. Um par só é
 * AFIRMADO quando as duas cores estão aprovadas; com uma cor em rascunho a
 * conta existe, mas vai identificada como rascunho. Cor sem HEX não é medida —
 * contraste não se calcula de CMYK nem de Pantone sem inventar uma conversão —
 * e aparece em `semHex`, para a tela e o Vini dizerem "não medi".
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export const BRANCO = "#FFFFFF";
export const PRETO = "#000000";

/** Os limites da regra internacional (WCAG 2), em razão. */
export const LIMITE_TEXTO_COMUM = 4.5;
export const LIMITE_TEXTO_GRANDE = 3;
export const LIMITE_ICONES_E_BOTOES = 3;

export type CorMedida = Pick<CorDaPaleta, "nome" | "hex" | "status" | "papel" | "ordem">;

export type Extremo =
  | { tipo: "cor"; nome: string; hex: string; status: CorDaPaleta["status"] }
  | { tipo: "referencia"; qual: "branco" | "preto"; hex: string };

export type ParMedido = {
  a: Extremo;
  b: Extremo;
  /** Truncada (não arredondada) em 2 casas: 4,499 nunca vira "4,5" e passa. */
  razao: number;
  veredito: Veredito;
  /** Verdadeiro só se toda cor do par está aprovada (as referências contam como neutras). */
  afirmado: boolean;
};

export type ContrasteDaPaleta = {
  /** Cada cor medida sobre o branco e sobre o preto. */
  sobreReferencias: ParMedido[];
  /** Cada par de cores da paleta, uma vez só (a razão é a mesma nos dois sentidos). */
  entreCores: ParMedido[];
  /** Nomes das cores sem HEX — não medidas. */
  semHex: { nome: string; status: CorDaPaleta["status"] }[];
};

export function truncar2(valor: number): number {
  // A margem absorve o ruído de ponto flutuante (4.5 não pode virar 4.49).
  return Math.floor(valor * 100 + 1e-9) / 100;
}

function medir(a: Extremo, b: Extremo): ParMedido {
  const bruta = contraste(a.hex, b.hex);
  const razao = truncar2(bruta);
  return {
    a, b, razao,
    // O veredito sai da razão TRUNCADA: o que a tela escreve é o que decidiu.
    veredito: veredito(razao),
    afirmado: [a, b].every((e) => e.tipo === "referencia" || e.status === "ready"),
  };
}

export function contrastesDaPaleta(cores: readonly CorMedida[]): ContrasteDaPaleta {
  const ordenadas = ordenarPaleta(cores);
  const medidas = ordenadas.flatMap((c) =>
    c.hex ? [{ tipo: "cor", nome: c.nome, hex: c.hex, status: c.status } as const] : []);
  const semHex = ordenadas.filter((c) => !c.hex).map((c) => ({ nome: c.nome, status: c.status }));

  const branco: Extremo = { tipo: "referencia", qual: "branco", hex: BRANCO };
  const preto: Extremo = { tipo: "referencia", qual: "preto", hex: PRETO };

  const sobreReferencias = medidas.flatMap((cor) => [medir(cor, branco), medir(cor, preto)]);
  const entreCores: ParMedido[] = [];
  for (let i = 0; i < medidas.length; i++) {
    for (let j = i + 1; j < medidas.length; j++) entreCores.push(medir(medidas[i], medidas[j]));
  }
  return { sobreReferencias, entreCores, semHex };
}

/** Quantos usos o par atende, de 0 a 3. */
export function usosAtendidos(v: Veredito): number {
  return Number(v.textoPequeno !== "falha") + Number(v.textoGrande !== "falha") + Number(v.iconesEBotoes === "passa");
}

// ─── Daltonismo na paleta (fatia 3) ──────────────────────────────────────────

export type ParDaPaletaQueSeConfunde = ParQueSeConfunde & { nomeA: string; nomeB: string; afirmado: boolean };

/**
 * Pares da paleta que se distinguem bem para o olho típico e deixam de se
 * distinguir para quem tem protanopia, deuteranopia ou tritanopia. Mesma regra
 * de status do contraste: com cor em rascunho, o par vem marcado.
 */
export function paresQueSeConfundem(cores: readonly CorMedida[]): ParDaPaletaQueSeConfunde[] {
  const medidas = ordenarPaleta(cores).filter((c): c is CorMedida & { hex: string } => Boolean(c.hex));
  const achados: ParDaPaletaQueSeConfunde[] = [];
  for (let i = 0; i < medidas.length; i++) {
    for (let j = i + 1; j < medidas.length; j++) {
      for (const par of seConfundem(medidas[i].hex, medidas[j].hex)) {
        achados.push({ ...par, nomeA: medidas[i].nome, nomeB: medidas[j].nome, afirmado: medidas[i].status === "ready" && medidas[j].status === "ready" });
      }
    }
  }
  return achados;
}

// ─── Para o Vini ─────────────────────────────────────────────────────────────

export const SLUG_DO_CONTRASTE = "contraste-da-paleta";
export const SLUG_DO_CONTRASTE_EM_RASCUNHO = "contraste-da-paleta-rascunho";

/**
 * Acima disto, o Vini recebe só os pares que chegam a 3:1 (e a frase de que o
 * que não está listado foi medido e fica abaixo). A ficha entra INTEIRA no
 * prompt, fora do orçamento da busca; uma paleta de 19 cores (171 pares) a
 * estouraria — a IA gratuita aceita ~8 mil tokens por minuto.
 */
export const LIMITE_DE_LINHAS_DO_CONTRASTE = 100;

function nomeDoExtremo(e: Extremo, ingles: boolean): string {
  if (e.tipo === "referencia") return e.qual === "branco" ? (ingles ? "white" : "branco") : (ingles ? "black" : "preto");
  const marca = e.status === "draft" ? (ingles ? " (draft)" : " (rascunho)") : "";
  return `${e.nome}${marca}`;
}

function linhaDoPar(p: ParMedido, ingles: boolean): string {
  const sim = ingles ? "pass" : "passa";
  const nao = ingles ? "fail" : "falha";
  const razao = String(p.razao.toFixed(2));
  const v = p.veredito;
  const usos = ingles
    ? `normal text ${v.textoPequeno !== "falha" ? sim : nao} · large text ${v.textoGrande !== "falha" ? sim : nao} · icons/buttons ${v.iconesEBotoes === "passa" ? sim : nao}`
    : `texto comum ${v.textoPequeno !== "falha" ? sim : nao} · texto grande ${v.textoGrande !== "falha" ? sim : nao} · ícones/botões ${v.iconesEBotoes === "passa" ? sim : nao}`;
  return `- ${nomeDoExtremo(p.a, ingles)} × ${nomeDoExtremo(p.b, ingles)}: ${razao}:1 — ${usos}`;
}

/** Quantos pares que se confundem vão ao prompt por fonte: o teto protege o orçamento de tokens. */
export const LIMITE_DE_CONFUSOES = 12;

/**
 * Pares que a simulação de daltonismo mostra quase iguais, um por linha com os
 * tipos. Vão ao Vini identificados como SIMULAÇÃO APROXIMADA: ele não os afirma
 * como laudo, e a saída que indica nunca é trocar a cor da marca.
 */
function linhasDeConfusao(achados: readonly ParDaPaletaQueSeConfunde[], ingles: boolean): string[] {
  if (achados.length === 0) return [];
  const porPar = new Map<string, { a: string; b: string; tipos: string[] }>();
  for (const c of achados) {
    const chave = [c.nomeA, c.nomeB].join("|");
    const par = porPar.get(chave) ?? { a: c.nomeA, b: c.nomeB, tipos: [] };
    par.tipos.push(c.tipo);
    porPar.set(chave, par);
  }
  const pares = [...porPar.values()];
  const mostrados = pares.slice(0, LIMITE_DE_CONFUSOES);
  const linhas = [ingles
    ? "Pairs that look alike to people with color blindness (APPROXIMATE simulation, not a diagnosis; the brand colors stay as they are, the fix is not to rely on color alone):"
    : "Pares que ficam parecidos para quem tem daltonismo (simulação APROXIMADA, não laudo; as cores da marca não mudam, a saída é não depender só da cor):"];
  linhas.push(...mostrados.map((p) => `- ${p.a} / ${p.b}: ${p.tipos.join(", ")}`));
  if (pares.length > mostrados.length) {
    linhas.push(ingles ? `(${pares.length - mostrados.length} more pairs not listed; do not claim a pair is safe just because it is not here.)` : `(mais ${pares.length - mostrados.length} pares não listados; não afirme que um par é seguro só porque não está aqui.)`);
  }
  return linhas;
}

function cabecalho(ingles: boolean): string {
  return ingles
    ? `Contrast ratios (WCAG 2) MEASURED by the platform from the HEX codes of the palette sheet. Thresholds: normal text 4.5:1, large text 3:1, icons and buttons 3:1. Ratios are truncated to 2 decimals. Cite the ratio shown; never recompute it from memory.`
    : `Razões de contraste (WCAG 2) MEDIDAS pela plataforma a partir dos HEX da ficha da paleta. Limites: texto comum 4,5:1, texto grande 3:1, ícones e botões 3:1. As razões estão truncadas em 2 casas. Cite a razão escrita aqui; nunca a recalcule de memória.`;
}

/**
 * A tabela de contraste como fontes do Vini — uma para os pares das cores
 * APROVADAS e outra para os pares em que alguma cor é RASCUNHO, cada uma com o
 * seu status (ADR-0004 §3.2). Vazia quando não há nada medido nem a avisar.
 */
export function trechosDoContraste(cores: readonly CorMedida[], ingles: boolean): Trecho[] {
  const { sobreReferencias, entreCores, semHex } = contrastesDaPaleta(cores);
  const todos = [...sobreReferencias, ...entreCores];
  const total = todos.length;
  const cortar = total > LIMITE_DE_LINHAS_DO_CONTRASTE;
  const confundem = paresQueSeConfundem(cores);
  const trechos: Trecho[] = [];

  const grupos: [CorDaPaleta["status"], string, string][] = [
    ["ready", SLUG_DO_CONTRASTE, ingles ? "Palette contrast (approved colors)" : "Contraste da paleta (cores aprovadas)"],
    ["draft", SLUG_DO_CONTRASTE_EM_RASCUNHO, ingles ? "Palette contrast (includes draft colors)" : "Contraste da paleta (com cor em rascunho)"],
  ];
  for (const [status, slug, titulo] of grupos) {
    const doGrupo = todos.filter((p) => p.afirmado === (status === "ready"));
    const semMedida = semHex.filter((c) => c.status === status);
    if (doGrupo.length === 0 && semMedida.length === 0) continue;

    const listados = cortar ? doGrupo.filter((p) => p.razao >= LIMITE_TEXTO_GRANDE) : doGrupo;
    const linhas = [cabecalho(ingles)];
    if (cortar) {
      linhas.push(ingles
        ? `Only pairs that reach 3:1 are listed. Any pair of these colors (or color against white/black) NOT listed was measured and stays BELOW 3:1: it fails every use. Its exact ratio is in the palette screen.`
        : `Só os pares que chegam a 3:1 estão listados. Todo par destas cores (ou cor contra branco/preto) que NÃO está na lista foi medido e fica ABAIXO de 3:1: falha em todos os usos. A razão exata está na tela da paleta.`);
    }
    linhas.push(...listados.map((p) => linhaDoPar(p, ingles)));
    const confusoesDoGrupo = confundem.filter((c) => c.afirmado === (status === "ready"));
    const paresComparados = entreCores.some((p) => p.afirmado === (status === "ready"));
    linhas.push(...linhasDeConfusao(confusoesDoGrupo, ingles));
    // Ausência também é resultado medido: sem esta linha o Vini respondia "não está documentado".
    if (confusoesDoGrupo.length === 0 && paresComparados) {
      linhas.push(ingles
        ? "Color blindness: no pair of these colors comes out alike for protanopia, deuteranopia or tritanopia in the APPROXIMATE simulation (not a diagnosis). Say it is a simulation, and that the brand's own manual does not document it."
        : "Daltonismo: nenhum par destas cores fica parecido para protanopia, deuteranopia ou tritanopia na simulação APROXIMADA (não é laudo). Diga que é simulação e que o manual da marca não documenta isso.");
    }
    if (semMedida.length > 0) {
      linhas.push(ingles
        ? `NOT measured (no HEX in the sheet): ${semMedida.map((c) => c.nome).join(", ")}. Say you did not measure them.`
        : `NÃO medidas (sem HEX na ficha): ${semMedida.map((c) => c.nome).join(", ")}. Diga que não mediu.`);
    }
    trechos.push({
      documentSlug: slug,
      documentTitle: titulo,
      groupName: ingles ? "Colors" : "Cores",
      section: null,
      status,
      pageStart: null,
      pageEnd: null,
      content: linhas.join("\n"),
    });
  }
  return trechos;
}
