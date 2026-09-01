/**
 * Tipos compartilhados entre a leitura do PDF e o agrupamento.
 *
 * Eles vivem à parte porque `pdf.ts` usa `import.meta` e APIs do navegador: um
 * módulo puro que importasse tipo de lá arrastaria isso junto, e a suíte de
 * unidade — que compila para commonjs — pararia de compilar inteira.
 */

/** Um item do índice declarado pelo autor do PDF. */
export interface ItemDeOutline {
  titulo: string;
  /** Página resolvida, 1-based. Nula quando o destino não resolve. */
  pagina: number | null;
  /** Profundidade na hierarquia; 0 é o primeiro nível. */
  nivel: number;
  filhos: ItemDeOutline[];
}
