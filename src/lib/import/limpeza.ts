import type { BrandvilleAuthContext } from "@/lib/brandville/server";

/** Um lote por vez: a drenagem roda em resposta a uma requisição de alguém. */
const LOTE = 50;

/**
 * Remove os arquivos pendentes e fecha os registros que de fato saíram.
 *
 * O fechamento NÃO confia na lista devolvida por `remove()`. A documentação
 * do Storage descreve o retorno para objetos removidos e não define o que
 * acontece quando o objeto já não existe — e esse é justamente o caso mais
 * comum numa segunda tentativa. Presumir custaria caro nos dois sentidos:
 * fechar o que não saiu perde o arquivo de vista para sempre; não fechar o que
 * já saiu deixa a fila crescendo com trabalho que nunca termina.
 *
 * Então a confirmação é por observação: depois de remover, a pasta é listada e
 * o registro só é fechado se o objeto realmente não estiver mais lá. Ausência
 * é o estado desejado, tenha ela sido causada por esta chamada ou não.
 */
export async function drenarFilaDeExclusao(auth: BrandvilleAuthContext) {
  const { data: pendentes, error } = await auth.supabase
    .from("brand_deletions")
    .select("id, storage_path")
    .eq("workspace_id", auth.workspaceId)
    .order("requested_at", { ascending: true })
    .limit(LOTE);

  if (error || !pendentes?.length) return { removidos: 0, pendentes: 0 };

  const caminhos = pendentes.map((linha) => linha.storage_path);
  await auth.supabase.storage.from("brand-imports").remove(caminhos);

  const idsParaFechar: string[] = [];
  for (const linha of pendentes) {
    if (await objetoAusente(auth, linha.storage_path)) idsParaFechar.push(linha.id);
  }

  if (idsParaFechar.length > 0) {
    await auth.supabase.from("brand_deletions").delete().in("id", idsParaFechar);
  }

  const { count } = await auth.supabase
    .from("brand_deletions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", auth.workspaceId);

  return { removidos: idsParaFechar.length, pendentes: count ?? 0 };
}

async function objetoAusente(auth: BrandvilleAuthContext, caminho: string): Promise<boolean> {
  const corte = caminho.lastIndexOf("/");
  const pasta = caminho.slice(0, corte);
  const nome = caminho.slice(corte + 1);

  const { data, error } = await auth.supabase.storage
    .from("brand-imports")
    .list(pasta, { search: nome, limit: 1 });

  // Erro ao listar não é ausência: manter na fila é o lado seguro do engano.
  if (error) return false;
  return !(data ?? []).some((objeto) => objeto.name === nome);
}
