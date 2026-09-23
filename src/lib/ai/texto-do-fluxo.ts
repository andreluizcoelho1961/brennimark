/**
 * O texto de uma resposta em fluxo — e o erro do provedor, quando vem.
 *
 * `result.textStream` do SDK tem um defeito para nós: quando o provedor
 * recusa no meio do caminho, o erro vai para o `onError` e o fluxo de texto
 * simplesmente TERMINA, vazio. Quem lê só vê "acabou sem texto" e não tem
 * como saber o porquê. No ensaio de 23/09 o Google respondeu "This model is
 * currently experiencing high demand" e a tela disse "não foi possível falar
 * com o provedor" — a causa estava no log e sumia antes de chegar à pessoa.
 *
 * Aqui se lê o fluxo COMPLETO: o texto passa, e a parte de erro é LANÇADA com
 * o erro original, para `classifyAIError` dizer o que de fato aconteceu.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export type ParteDoFluxo = { type: string; text?: string; error?: unknown };

export async function* textoOuErro(fluxo: AsyncIterable<ParteDoFluxo>): AsyncGenerator<string> {
  for await (const parte of fluxo) {
    if (parte.type === "text-delta" && parte.text) yield parte.text;
    else if (parte.type === "error") throw parte.error;
  }
}
