/**
 * O Markdown que o modelo escreve, lido sem virar HTML.
 *
 * O ensaio de 18/09 mostrou a resposta com `###` e `**` crus. A saída óbvia —
 * uma biblioteca de Markdown com `dangerouslySetInnerHTML` — abriria a porta
 * a HTML vindo do modelo, e o modelo lê texto de PDF de cliente: um manual
 * com `<img onerror=…>` no texto chegaria à tela de outra pessoa. Aqui o
 * resultado é DADO (blocos e trechos), e quem desenha é o React, que escapa
 * tudo.
 *
 * Cobre o que os modelos de fato usam numa resposta curta: títulos (`#` a
 * `######`), listas (`-`, `*`, `1.`), parágrafos, **negrito** e *itálico*.
 * O resto passa como texto — melhor um asterisco sobrando do que um trecho
 * sumindo.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type Bloco =
  | { tipo: "titulo"; nivel: number; texto: string }
  | { tipo: "lista"; ordenada: boolean; itens: string[] }
  | { tipo: "paragrafo"; texto: string };

export type Enfase = { tipo: "texto" | "negrito" | "italico"; valor: string };

const TITULO = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const ITEM = /^\s{0,3}(?:([-*+])|(\d{1,3})[.)])\s+(.*)$/;

export function blocosDeMarkdown(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  let paragrafo: string[] = [];
  let lista: { ordenada: boolean; itens: string[] } | null = null;

  const fecharParagrafo = () => {
    if (paragrafo.length > 0) blocos.push({ tipo: "paragrafo", texto: paragrafo.join("\n") });
    paragrafo = [];
  };
  const fecharLista = () => {
    if (lista) blocos.push({ tipo: "lista", ...lista });
    lista = null;
  };

  for (const linha of texto.replace(/\r\n?/g, "\n").split("\n")) {
    if (linha.trim() === "") {
      fecharParagrafo();
      fecharLista();
      continue;
    }
    const titulo = TITULO.exec(linha);
    if (titulo) {
      fecharParagrafo();
      fecharLista();
      blocos.push({ tipo: "titulo", nivel: titulo[1].length, texto: titulo[2] });
      continue;
    }
    const item = ITEM.exec(linha);
    if (item) {
      fecharParagrafo();
      const ordenada = item[2] !== undefined;
      if (lista && lista.ordenada !== ordenada) fecharLista();
      if (!lista) lista = { ordenada, itens: [] };
      lista.itens.push(item[3]);
      continue;
    }
    // Linha recuada logo depois de um item: continuação daquele item.
    if (lista && /^\s{2,}\S/.test(linha)) {
      lista.itens[lista.itens.length - 1] += ` ${linha.trim()}`;
      continue;
    }
    fecharLista();
    paragrafo.push(linha);
  }
  fecharParagrafo();
  fecharLista();
  return blocos;
}

/**
 * Negrito e itálico dentro de uma linha. Marcador sem par fica como texto —
 * `5 * 3` não vira itálico, e um `**` perdido não engole o resto da frase.
 */
export function enfases(texto: string): Enfase[] {
  const saida: Enfase[] = [];
  const padrao = /\*\*(?=\S)([\s\S]*?\S)\*\*|__(?=\S)([\s\S]*?\S)__|(?<![*\w])\*(?=\S)((?:\*\*(?=\S)[^*]*?\S\*\*|[^*])*?\S)\*(?![*\w])|(?<![_\w])_(?=\S)([^_]*?\S)_(?![_\w])/g;
  let cursor = 0;
  for (const m of texto.matchAll(padrao)) {
    const inicio = m.index ?? 0;
    if (inicio > cursor) saida.push({ tipo: "texto", valor: texto.slice(cursor, inicio) });
    const negrito = m[1] ?? m[2];
    saida.push(negrito !== undefined
      ? { tipo: "negrito", valor: negrito }
      // Negrito DENTRO do itálico ("*Nota: status de **RASCUNHO**.*", ensaio de
      // 25/09/2026) deixava os asteriscos crus. O trecho inteiro fica itálico,
      // sem os marcadores de dentro.
      : { tipo: "italico", valor: ((m[3] ?? m[4]) as string).replace(/\*\*(\S(?:[^*]*?\S)?)\*\*/g, "$1") });
    cursor = inicio + m[0].length;
  }
  if (cursor < texto.length) saida.push({ tipo: "texto", valor: texto.slice(cursor) });
  return saida;
}
