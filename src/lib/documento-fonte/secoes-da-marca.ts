import type { Leitura } from "./registrar";

/**
 * As seções de uma marca, lidas por páginas.
 *
 * ─── Por que não `.in(slugs)` ───────────────────────────────────────────
 *
 * A versão anterior mandava todos os slugs do manifesto num `.in(...)`. O
 * PostgREST recebe isso na QUERY STRING, então a URL cresce com o número de
 * seções e com o tamanho de cada slug. `agrupar` permite até
 * `MAXIMO_DE_SECOES` = **500** seções, e o slug sai de `slugify`, que corta em
 * 60 caracteres: o pior caso passa de 30 KB só de slugs, antes do
 * escapamento. Proxies, balanceadores e servidores impõem tetos de linha de
 * requisição bem abaixo disso, e o teto varia por camada.
 *
 * Depois da correção da leitura, essa falha ao menos era segura — virava
 * `503` em vez de manifesto sem seção. Mas era um `503` PERMANENTE: repetir
 * monta a mesma URL longa e falha igual. Um manual grande ficaria com o
 * registro impossível de concluir, e a mensagem diria "tente de novo".
 *
 * ─── Por que PAGINADO, e não "buscar todas de uma vez" ──────────────────
 *
 * Buscar todas as seções da marca resolve o tamanho da URL, mas introduz
 * outro silêncio: o PostgREST tem `max_rows` (1000 nesta instalação) e
 * **trunca sem erro** ao alcançá-lo. Uma marca com mais documentos que isso
 * devolveria uma página cheia e nenhum aviso, os slugs que ficaram de fora não
 * resolveriam, e as páginas correspondentes virariam `sem-secao` com o vínculo
 * fechado em seguida — exatamente o defeito permanente que a distinção entre
 * "não achou" e "não rodou" acabou de eliminar, reintroduzido por outro
 * caminho.
 *
 * O teto de 500 vale para o que a IMPORTAÇÃO cria; a curadoria acrescenta
 * documentos depois, e nada promete que o total fique abaixo de `max_rows`
 * para sempre. Paginar não depende dessa promessa.
 */

/** Uma página de resultados, como a consulta a devolve. */
export interface PaginaDeSecoes {
  id: string;
  slug: string;
}

/**
 * Lê uma faixa fechada `[de, ate]`, 0-based — a forma do `.range()` do
 * Supabase. Devolve erro separado de dados, pela mesma razão de sempre:
 * "não achei" e "não rodou" levam a manifestos diferentes.
 */
export type LeitorDeFaixa = (de: number, ate: number) => Promise<Leitura<PaginaDeSecoes[]>>;

/** Confortavelmente abaixo de `max_rows`, e poucas idas para 500 seções. */
export const TAMANHO_DA_PAGINA = 500;

/**
 * O teto de segurança do laço.
 *
 * Um `max_rows` menor que `TAMANHO_DA_PAGINA` faria toda página voltar
 * "curta", o laço terminaria cedo e a truncagem voltaria a ser silenciosa —
 * então o laço não pode depender só disso. Este teto existe para o caso
 * inverso: uma porta que sempre devolve página cheia (um `range` ignorado, um
 * mock mal escrito) giraria para sempre. 200 páginas de 500 são 100 mil
 * documentos numa marca, ordens de magnitude acima de qualquer manual real.
 */
const MAXIMO_DE_PAGINAS = 200;

/**
 * Todas as seções da marca, num `Map` de slug para id.
 *
 * Só o `Map` sai daqui: quem chama resolve slugs, e um slug ausente do mapa é
 * um fato sobre a extração — vira página sem seção, com motivo. O que NÃO pode
 * acontecer é um slug ausente porque a leitura parou no meio, e é isso que a
 * paginação com página curta como sinal de fim garante.
 */
export async function lerSecoesDaMarca(ler: LeitorDeFaixa): Promise<Leitura<Map<string, string>>> {
  const porSlug = new Map<string, string>();

  for (let pagina = 0; pagina < MAXIMO_DE_PAGINAS; pagina += 1) {
    const de = pagina * TAMANHO_DA_PAGINA;
    const { dados, erro } = await ler(de, de + TAMANHO_DA_PAGINA - 1);

    // Erro NÃO vira mapa parcial: um mapa parcial é indistinguível de uma
    // marca com menos seções, e a diferença entre os dois é uma publicação
    // com a estrutura errada gravada para sempre.
    if (erro || !dados) return { dados: null, erro: erro ?? new Error("leitura sem dados") };

    for (const linha of dados) {
      // O primeiro vence. `brand_documents` garante slug único por marca, mas
      // depender disso aqui seria depender de uma garantia de outro arquivo.
      if (linha?.slug && !porSlug.has(linha.slug)) porSlug.set(linha.slug, linha.id);
    }

    // Página curta é o fim. É o único sinal confiável: contar contra um total
    // exigiria um `count` que muda entre as idas.
    if (dados.length < TAMANHO_DA_PAGINA) return { dados: porSlug, erro: null };
  }

  /*
   * Alcançar o teto significa que a porta nunca devolveu página curta. Isso é
   * um defeito do chamador, não uma marca gigante — e devolver o mapa aqui
   * seria devolver um mapa possivelmente incompleto, que é o desfecho que este
   * módulo existe para impedir.
   */
  return {
    dados: null,
    erro: new Error(`leitura de seções não terminou em ${MAXIMO_DE_PAGINAS} páginas`),
  };
}
