/**
 * Onde cada arquivo mora no Storage.
 *
 * Um lugar só monta caminho. Espalhar isso significa que um caminho fica para
 * trás numa mudança, e um caminho fora do padrão é um arquivo que a exclusão
 * não encontra — ele sobrevive à marca que o gerou.
 *
 * A REGRA: só identificadores imutáveis. `workspaceId/brandId/...`, nunca
 * `instance_key`, slug, chave da marca ou nome de arquivo do cliente.
 *
 * Por quê: slug e chave são editáveis. No instante em que alguém renomeia a
 * marca, todo arquivo já gravado passa a morar num caminho que não corresponde
 * mais ao nome — e a partir daí, ou a listagem não os encontra, ou a exclusão
 * não os apaga. Os dois casos são silenciosos. Um uuid não muda nunca, e é
 * feio na URL exatamente porque ninguém deveria estar lendo a URL.
 */

/**
 * Nome de arquivo seguro para o Storage, preservando algo legível.
 *
 * A sequência `..` é colapsada em um ponto só. Sem barras ela não navega para
 * lugar nenhum, mas alguns backends normalizam caminhos antes de resolvê-los,
 * e um segmento que PARECE travessia é a espécie de detalhe que sobrevive a
 * uma troca de provedor e vira defeito lá. Nome de arquivo real não perde nada
 * com isso.
 */
export function nomeSeguro(nome: string): string {
  return (
    nome
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/\.{2,}/g, ".")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(-160) || "arquivo"
  );
}

export const BUCKETS = {
  assets: "brand-assets",
  importacoes: "brand-imports",
  evidencias: "analysis-evidence",
} as const;

export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

/**
 * Asset da biblioteca: `workspaceId/brandId/<uuid>-<nome>`.
 *
 * O uuid antes do nome, e não depois: dois envios do mesmo arquivo precisam de
 * caminhos diferentes, e o nome do cliente pode se repetir à vontade.
 */
export function caminhoDeAsset(
  workspaceId: string,
  brandId: string,
  nomeDoArquivo: string,
  id: string,
): string {
  return `${workspaceId}/${brandId}/${id}-${nomeSeguro(nomeDoArquivo)}`;
}

/** PDF de origem de uma importação: `workspaceId/importId/<hash>.pdf`. */
export function caminhoDeImportacao(
  workspaceId: string,
  importId: string,
  hash: string,
): string {
  return `${workspaceId}/${importId}/${hash}.pdf`;
}

/** Peça analisada: `workspaceId/brandId/<runId>-<nome>`. */
export function caminhoDeEvidencia(
  workspaceId: string,
  brandId: string,
  runId: string,
  nomeDoArquivo: string,
): string {
  return `${workspaceId}/${brandId}/${runId}-${nomeSeguro(nomeDoArquivo)}`;
}

/**
 * O caminho pertence a esta marca?
 *
 * Usado antes de assinar URL ou apagar. A RLS protege a LINHA do banco; ela
 * não protege o objeto do Storage, e um `storage_path` gravado errado — ou
 * adulterado numa requisição — assinaria o arquivo de outra marca com a sessão
 * de quem tem direito a esta.
 */
export function pertenceAMarca(
  caminho: string,
  workspaceId: string,
  brandId: string,
): boolean {
  return caminho.startsWith(`${workspaceId}/${brandId}/`);
}

/**
 * O PDF é DESTA importação, desta conta? — o download do manual (fatia 3).
 *
 * O caminho da importação não carrega a marca (`conta/importação/<hash>.pdf`),
 * então `pertenceAMarca` não serve. O que se confere é a conta e a importação
 * lidas da linha que a RLS devolveu, e que não há subpasta escondida: um
 * `storage_path` gravado errado assinaria o arquivo de outra conta com a
 * sessão de quem tem direito a esta.
 */
export function pertenceAImportacao(
  caminho: string,
  workspaceId: string,
  importId: string,
): boolean {
  const partes = caminho.split("/");
  return (
    partes.length === 3 &&
    partes[0] === workspaceId &&
    partes[1] === importId &&
    /^[0-9a-f]{64}\.pdf$/.test(partes[2])
  );
}
