/**
 * O nome de uma marca, como a pessoa o digita na configuração.
 *
 * O limite de 120 é o do banco (`brands.name`, check `length between 1 and
 * 120`): conferir aqui dá uma mensagem legível em vez do erro da constraint.
 * Caractere de controle sai — quebra de linha no nome quebraria a barra de
 * cima — e espaços em sequência viram um só.
 */
export const NOME_MAXIMO = 120;

export function normalizarNomeDaMarca(entrada: unknown): string | null {
  if (typeof entrada !== "string") return null;
  const nome = entrada.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (nome.length < 1 || nome.length > NOME_MAXIMO) return null;
  return nome;
}

/**
 * A confirmação de apagar: a pessoa digita o nome da marca. Sem distinguir
 * maiúsculas nem espaços nas pontas — o que se quer é a intenção, não a
 * digitação perfeita.
 */
export function confirmacaoConfere(digitado: string, nome: string): boolean {
  const limpo = (texto: string) => texto.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
  return limpo(digitado).length > 0 && limpo(digitado) === limpo(nome);
}
