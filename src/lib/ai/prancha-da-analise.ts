import type { StructuredAnalysis } from "./analysis-result";
import type { MapaDePaginas } from "./paginas-citadas";

/**
 * A prancha da análise — a imagem que se baixa: a peça intacta, o carimbo do
 * veredito e as correções numeradas, com fonte e página. Decisão do André,
 * 22/09/2026.
 *
 * ⚖️ Nada é desenhado SOBRE a peça. A análise diz o que está errado, não onde;
 * uma marca na posição errada iria no arquivo que o cliente recebe. Marca na
 * peça só onde o sistema souber a posição por conta própria (a cor, lida nos
 * pixels) — e isso é outra fatia.
 *
 * ⚖️ Cada correção leva o STATUS da regra citada. Rascunho sai escrito
 * "rascunho": ninguém pode receber esta prancha e tomar regra provisória por
 * aprovada (honestidade editorial, CLAUDE.md).
 *
 * Este arquivo é o CONTEÚDO da prancha, sem canvas: os testes de unidade o
 * trancam. Quem desenha é `components/vini/baixarPrancha.ts`.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type FonteDaCorrecao = { titulo: string; status: string; pagina: number | null };
export type ItemDaPrancha = { numero: number; texto: string; fontes: FonteDaCorrecao[] };

const CITACAO = /\[(?:Fonte|Source):\s*(.+?)\s+—\s+(?:([^·\]]+?)\s+·\s+(\/docs\/[^\]\s]+)|(\/docs\/[^\]\s]+)\s+·\s+([^\]]+?))\s*\]/g;

/** Separa o texto das citações; cada citação vira fonte com a página, se conhecida. */
export function separarCitacoes(linha: string, paginas: MapaDePaginas): { texto: string; fontes: FonteDaCorrecao[] } {
  const fontes: FonteDaCorrecao[] = [];
  const texto = linha.replace(CITACAO, (_, titulo: string, s1?: string, c1?: string, c2?: string, s2?: string) => {
    const caminho = (c1 ?? c2) as string;
    fontes.push({ titulo: titulo.trim(), status: (s1 ?? s2 ?? "").trim(), pagina: paginas[caminho] ?? null });
    return "";
  }).replace(/\s+([.,;:])/g, "$1").replace(/\s{2,}/g, " ").trim();
  return { texto, fontes };
}

/**
 * As correções numeradas: os problemas, na ordem da análise. A correção
 * sugerida entra como último item, quando existe — é ela que diz o que fazer.
 */
export function itensDaPrancha(a: StructuredAnalysis, paginas: MapaDePaginas): ItemDaPrancha[] {
  const linhas = a.problems.map((p) => p.trim()).filter(Boolean);
  const itens = linhas.map((linha, i) => ({ numero: i + 1, ...separarCitacoes(linha, paginas) }));
  const correcao = a.correction.trim();
  if (correcao) itens.push({ numero: itens.length + 1, ...separarCitacoes(correcao, paginas) });
  return itens.filter((item) => item.texto.length > 0);
}

/** "Cluster Colours · p. 12 · RASCUNHO" — a linha de procedência de cada item. */
export function linhaDaFonte(f: FonteDaCorrecao, ingles = false): string {
  const partes = [f.titulo];
  if (f.pagina) partes.push(`${ingles ? "p." : "p."} ${f.pagina}`);
  if (f.status) partes.push(f.status.toUpperCase());
  return partes.join(" · ");
}

/**
 * Quebra o texto em linhas que cabem na largura, medindo com a função dada
 * (no navegador, `ctx.measureText`). Palavra maior que a linha é quebrada no
 * caractere, para nunca vazar da prancha.
 */
export function quebrarTexto(texto: string, largura: number, medir: (s: string) => number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (medir(tentativa) <= largura) {
      atual = tentativa;
      continue;
    }
    if (atual) linhas.push(atual);
    if (medir(palavra) <= largura) {
      atual = palavra;
      continue;
    }
    let pedaco = "";
    for (const ch of palavra) {
      if (medir(pedaco + ch) > largura && pedaco) {
        linhas.push(pedaco);
        pedaco = ch;
      } else {
        pedaco += ch;
      }
    }
    atual = pedaco;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** O nome do arquivo baixado: o da peça, sem extensão, com o sufixo da análise. */
export function nomeDaPrancha(nomeDaPeca: string, ingles = false): string {
  const base = nomeDaPeca.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "") || "peca";
  return `${base}-${ingles ? "review" : "analise"}.png`;
}
