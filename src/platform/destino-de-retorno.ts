/**
 * Para onde voltar depois de entrar — validado num lugar só.
 *
 * `next` chega pela URL, e a URL é escrita por quem clicou no link. Sem
 * validação, `?next=https://sitedele.exemplo` faz o produto redirecionar para
 * fora depois de uma autenticação bem-sucedida: a pessoa confere que está no
 * domínio certo, entra, e o navegador a leva para outro lugar já logada e sem
 * desconfiar. É o vetor clássico de phishing por redirecionamento aberto, e o
 * que o torna eficaz é justamente o login ter dado certo.
 *
 * Três telas usavam `searchParams.get("next") ?? "/"` cada uma por conta
 * própria — login, callback e cadastro. Três cópias é três chances de uma
 * delas ser corrigida e as outras não.
 *
 * A regra é lista de permissão, não de bloqueio: só passa o que é
 * comprovadamente um caminho interno. Enumerar as formas de escapar é uma
 * corrida que se perde — `//host`, `/\host`, `%2f%2fhost`, e a próxima que
 * alguém descobrir.
 */
export const DESTINO_PADRAO = "/docs";

const CONTROLE = /[\u0000-\u001f\u007f]/;

export function destinoDeRetorno(bruto: string | null | undefined): string {
  if (typeof bruto !== "string" || bruto.length === 0) return DESTINO_PADRAO;

  // Decodifica ANTES de validar: `%2f%2fhost` vira `//host`, e validar o texto
  // codificado deixaria passar o que o navegador vai interpretar como externo.
  let caminho: string;
  try {
    caminho = decodeURIComponent(bruto);
  } catch {
    // Sequência de escape inválida. Não dá para saber o que o navegador faria,
    // e não saber é motivo suficiente para recusar.
    return DESTINO_PADRAO;
  }

  // Caractere de controle, incluindo nova linha e tab: eles não aparecem em
  // caminho legítimo e servem para quebrar validações ingênuas.
  if (CONTROLE.test(caminho) || caminho.trim() !== caminho) return DESTINO_PADRAO;

  // Precisa ser caminho absoluto interno.
  if (!caminho.startsWith("/")) return DESTINO_PADRAO;

  // `//host` e `/\host` são relativos a protocolo: o navegador os trata como
  // outro domínio, apesar de começarem com barra.
  if (caminho.startsWith("//") || caminho.startsWith("/\\")) return DESTINO_PADRAO;

  // Barra invertida em qualquer posição: alguns navegadores a normalizam para
  // barra, o que reintroduz o caso acima no meio do caminho.
  if (caminho.includes("\\")) return DESTINO_PADRAO;

  // A prova final: resolvido contra uma origem qualquer, ele precisa continuar
  // naquela origem. É o que pega o caso que nenhuma regra textual pegou.
  try {
    const base = "https://origem.invalida";
    const resolvido = new URL(caminho, base);
    if (resolvido.origin !== base) return DESTINO_PADRAO;
    return `${resolvido.pathname}${resolvido.search}${resolvido.hash}`;
  } catch {
    return DESTINO_PADRAO;
  }
}
