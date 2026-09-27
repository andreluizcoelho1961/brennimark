import type { Trecho } from "../ai/recuperacao";
import { lerCorEscrita, type CorEscrita } from "./paleta";

/**
 * A ficha da paleta SUGERIDA pela IA — decisão do André, 27/09/2026.
 *
 * Cadastrar 19 cores com quatro códigos cada, à mão, é o trabalho que ninguém
 * faz. Com as imagens de leitura das páginas (#50), a IA lê a tabela de
 * amostras como uma pessoa lê, e devolve as cores. Duas decisões do André:
 *
 *   1. cada cor guarda a ORIGEM — "ia" ou "pessoa" —, porque "quem leu este
 *      código?" é pergunta legítima numa auditoria do dono da marca;
 *   2. a sugestão só ACRESCENTA o que falta: não mexe em cor já cadastrada,
 *      muito menos em aprovada.
 *
 * E uma que não se discute: a sugestão nasce RASCUNHO (o banco garante). A IA
 * pode trocar um dígito de um CMYK lendo imagem, e código errado aprovado vai
 * direto ao prompt do designer.
 *
 * Tudo aqui é puro, sem rede: a rota faz as chamadas, e isto decide.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

/** Quantas páginas a IA lê por sugestão. Cada imagem custa ~1.100–2.300 tokens. */
export const MAXIMO_DE_PAGINAS_DA_SUGESTAO = 4;
/** Um trecho que cobre uma seção longa entra só pelas primeiras páginas. */
const PAGINAS_POR_TRECHO = 3;
/** Teto de cores numa sugestão: além disso não é paleta, é catálogo. */
export const MAXIMO_DE_CORES_SUGERIDAS = 60;

const CODIGOS = [
  /#[0-9a-f]{6}\b/gi,
  /\b(?:pantone|pms)\b/gi,
  /\bcmyk\b/gi,
  /\brgb\b/gi,
  /\bhex(?:adecimal)?\b/gi,
  /\b[cmyk]\s?\d{1,3}\b/gi,
];
const TITULO_DE_COR = /\b(?:cor|cores|paleta|colou?rs?|palette|crom[aá]tic[oa])\b/i;

/** Quanto um texto tem cara de página de paleta: códigos de cor contados. */
export function pontuarCodigosDeCor(texto: string): number {
  return CODIGOS.reduce((soma, padrao) => soma + (texto.match(padrao)?.length ?? 0), 0);
}

/**
 * As páginas do manual onde a paleta está, a partir do texto já indexado —
 * sem abrir o PDF. Vence o trecho com mais códigos de cor; título de seção
 * sobre cor desempata. Nenhum trecho com cara de paleta = lista vazia, e a
 * tela pede que a pessoa diga as páginas.
 */
export function paginasDaPaleta(trechos: readonly Trecho[], maximo = MAXIMO_DE_PAGINAS_DA_SUGESTAO): number[] {
  const pontuados = trechos
    .filter((t) => t.pageStart !== null)
    .map((t) => {
      const codigos = pontuarCodigosDeCor(t.content);
      const titulo = TITULO_DE_COR.test(`${t.documentTitle} ${t.section ?? ""}`) ? 1 : 0;
      return { t, codigos, titulo };
    })
    .filter((p) => p.codigos >= 2)
    .sort((a, b) => b.codigos - a.codigos || b.titulo - a.titulo || a.t.pageStart! - b.t.pageStart!);

  const paginas: number[] = [];
  for (const { t } of pontuados) {
    const fim = Math.min(t.pageEnd ?? t.pageStart!, t.pageStart! + PAGINAS_POR_TRECHO - 1);
    for (let p = t.pageStart!; p <= fim; p++) {
      if (!paginas.includes(p)) paginas.push(p);
      if (paginas.length >= maximo) return paginas.sort((a, b) => a - b);
    }
  }
  return paginas.sort((a, b) => a - b);
}

export type PaginasPedidas = { ok: true; paginas: number[] } | { ok: false; motivo: "formato" | "demais" | "fora-do-manual" };

/** "21, 22" digitado na tela → páginas conferidas contra o manual atual. */
export function lerPaginasPedidas(valor: unknown, paginasDoManual: number | null): PaginasPedidas {
  if (valor === undefined || valor === null || valor === "") return { ok: true, paginas: [] };
  const partes = String(valor).split(/[,;\s]+/).filter(Boolean);
  const numeros = partes.map(Number);
  if (numeros.some((n) => !Number.isInteger(n) || n < 1)) return { ok: false, motivo: "formato" };
  const unicas = [...new Set(numeros)].sort((a, b) => a - b);
  if (unicas.length > MAXIMO_DE_PAGINAS_DA_SUGESTAO) return { ok: false, motivo: "demais" };
  if (paginasDoManual !== null && unicas.some((n) => n > paginasDoManual)) return { ok: false, motivo: "fora-do-manual" };
  return { ok: true, paginas: unicas };
}

/**
 * O que a IA recebe. A regra que mais importa: códigos COMO ESTÃO IMPRESSOS,
 * nunca convertidos — um HEX calculado a partir do CMYK parece dado do manual
 * e não é.
 */
export function instrucoesDaSugestao(ingles: boolean, paginas: readonly number[]): string {
  const lista = paginas.join(", ");
  return ingles
    ? `You read brand manual pages and transcribe the brand color palette. The images are manual pages ${lista}, in this order.

Rules:
- Transcribe ONLY colors that appear in these pages as part of the brand palette (swatches with a name or codes). Ignore colors of photos and illustrations.
- Copy each code EXACTLY as printed. Never convert or calculate a code: if the page shows CMYK but no HEX, the HEX field is "-".
- Role is "principal" only when the manual calls the color primary, main, institutional or equivalent; otherwise "apoio".
- Segment: the group the manual gives the color (e.g. a business line), or "-".
- Page: the page number (from the list above) where the color appears.
- Answer with ONE LINE PER COLOR and nothing else — no title, no explanation, no JSON:
name | role | segment | HEX | RGB | CMYK | PMS | page
- Use "-" for a field that isn't printed. No palette in these pages → answer only: NENHUMA`
    : `Você lê páginas de manual de marca e transcreve a paleta de cores da marca. As imagens são as páginas ${lista} do manual, nesta ordem.

Regras:
- Transcreva SÓ as cores que aparecem nestas páginas como parte da paleta da marca (amostras com nome ou códigos). Ignore cores de fotos e ilustrações.
- Copie cada código EXATAMENTE como está impresso. Nunca converta nem calcule um código: se a página mostra CMYK e não mostra HEX, o campo HEX é "-".
- Papel é "principal" só quando o manual chama a cor de principal, primária, institucional ou equivalente; senão, "apoio".
- Segmento: o grupo em que o manual põe a cor (ex.: uma linha de negócio), ou "-".
- Página: o número da página (da lista acima) em que a cor aparece.
- Responda com UMA LINHA POR COR e nada mais — sem título, sem explicação, sem JSON:
nome | papel | segmento | HEX | RGB | CMYK | PMS | página
- Use "-" no campo que não está impresso. Sem paleta nestas páginas → responda só: NENHUMA`;
}

/**
 * Por que LINHAS e não JSON (ensaio de 27/09/2026): a primeira sugestão real,
 * no Bradesco, gastou 1.948 dos 2.000 tokens de saída e não entregou cor
 * nenhuma. JSON com chaves e nulos custa ~3 vezes mais por cor, e o Gemini
 * ainda raciocina antes — e o raciocínio conta como saída. Em linha, uma
 * resposta cortada perde só a última cor, não todas.
 */
function deLinhas(texto: string): Record<string, unknown>[] {
  const vazio = (v: string | undefined) => (v === undefined || /^[-–—]?$/.test(v.trim()) || /^null$/i.test(v.trim()) ? null : v.trim());
  const itens: Record<string, unknown>[] = [];
  for (const linha of texto.split(/\r?\n/)) {
    const campos = linha.replace(/^\s*[-*•\d.)]*\s*(?=\S)/, "").split("|").map((c) => c.trim());
    // Linha de cor tem os oito campos; cabeçalho repetido ("nome | papel…") não é cor.
    if (campos.length < 8 || /^(nome|name)$/i.test(campos[0])) continue;
    const [nome, papel, segmento, hex, rgb, cmyk, pms, pagina] = campos;
    itens.push({ nome, papel: (papel ?? "").toLowerCase(), segmento: vazio(segmento) ?? "", hex: vazio(hex), rgb: vazio(rgb), cmyk: vazio(cmyk), pms: vazio(pms), pagina: vazio(pagina) });
  }
  return itens;
}

/**
 * Os objetos `{...}` completos de um texto, mesmo que ele tenha sido cortado
 * no meio: resposta interrompida pelo teto de saída ainda entrega as cores que
 * terminou de escrever, em vez de nenhuma.
 */
function objetosCompletos(texto: string): unknown[] {
  const objetos: unknown[] = [];
  const inicios: number[] = [];
  let emTexto = false;
  let escapado = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (emTexto) {
      if (escapado) escapado = false;
      else if (c === "\\") escapado = true;
      else if (c === '"') emTexto = false;
      continue;
    }
    if (c === '"') emTexto = true;
    else if (c === "{") inicios.push(i);
    else if (c === "}" && inicios.length > 0) {
      const inicio = inicios.pop()!;
      try {
        const objeto: unknown = JSON.parse(texto.slice(inicio, i + 1));
        // Só a cor tem nome; o invólucro {"cores": [...]} não entra.
        if (objeto && typeof objeto === "object" && typeof (objeto as { nome?: unknown }).nome === "string") objetos.push(objeto);
      } catch { /* objeto malformado: fica de fora */ }
    }
  }
  return objetos;
}

function comoLista(texto: string): unknown[] {
  const limpo = texto.replace(/```(?:json|text)?/gi, "").trim();
  const linhas = deLinhas(limpo);
  if (linhas.length > 0) return linhas;
  // Reserva: modelo que insiste em JSON.
  try {
    const bruto: unknown = JSON.parse(limpo);
    if (Array.isArray(bruto)) return bruto;
    if (bruto && typeof bruto === "object" && Array.isArray((bruto as { cores?: unknown }).cores)) {
      return (bruto as { cores: unknown[] }).cores;
    }
    return [];
  } catch {
    return objetosCompletos(limpo);
  }
}

export type CorSugerida = Omit<CorEscrita, "ordem">;

/**
 * A resposta da IA → cores que passam nas MESMAS regras do banco. O que não
 * passa fica de fora em silêncio: uma cor sem código, ou com HEX torto, não
 * vira rascunho para alguém consertar — vira ruído.
 *
 * A página tem de ser uma das enviadas; página inventada vira "sem página".
 */
export function lerSugestao(texto: string, paginasEnviadas: readonly number[]): CorSugerida[] {
  const cores: CorSugerida[] = [];
  for (const item of comoLista(texto).slice(0, MAXIMO_DE_CORES_SUGERIDAS)) {
    if (!item || typeof item !== "object") continue;
    const bruto = item as Record<string, unknown>;
    // "22", "p. 22", 22: o número é o que importa.
    const pagina = Number(String(bruto.pagina ?? "").replace(/\D/g, "") || NaN);
    const lida = lerCorEscrita({
      ...bruto,
      papel: bruto.papel === "principal" ? "principal" : "apoio",
      pagina: paginasEnviadas.includes(pagina) ? pagina : paginasEnviadas.length === 1 ? paginasEnviadas[0] : null,
    });
    if (!lida.ok) continue;
    const { nome, papel, segmento, hex, rgb, cmyk, pms, pagina: paginaLida } = lida.cor;
    cores.push({ nome, papel, segmento, hex, rgb, cmyk, pms, pagina: paginaLida });
  }
  return cores;
}

/** Nome comparável: sem acento, sem caixa, espaços únicos. */
export function chaveDoNome(nome: string): string {
  return nome.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Só o que FALTA na ficha — decisão do André, 27/09. Uma sugestão é repetida
 * quando já existe cor com o mesmo HEX ou com o mesmo nome; também não se
 * repete dentro da própria sugestão. Cor existente nunca é tocada.
 */
export function soOQueFalta(
  sugeridas: readonly CorSugerida[],
  existentes: readonly { nome: string; hex: string | null }[],
): { novas: CorSugerida[]; repetidas: number } {
  const hexes = new Set(existentes.map((c) => c.hex).filter((h): h is string => h !== null));
  const nomes = new Set(existentes.map((c) => chaveDoNome(c.nome)));
  const novas: CorSugerida[] = [];
  let repetidas = 0;
  for (const cor of sugeridas) {
    const nome = chaveDoNome(cor.nome);
    if ((cor.hex !== null && hexes.has(cor.hex)) || nomes.has(nome)) {
      repetidas += 1;
      continue;
    }
    novas.push(cor);
    nomes.add(nome);
    if (cor.hex !== null) hexes.add(cor.hex);
  }
  return { novas, repetidas };
}
