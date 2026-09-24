import type { BrandvilleAuthContext } from "@/lib/brandville/server";
import { intervaloDeEspera, type PendenciaDeExclusao } from "./fila";

/** Um lote por vez: a drenagem roda em resposta a uma requisição de alguém. */
export const LOTE = 50;

/**
 * O que a drenagem precisa: um cliente e a conta. A sessão de quem administra
 * (a tela de administração) ou a chave de serviço (a limpeza periódica, uma
 * conta por vez).
 */
export type ContextoDaDrenagem = Pick<BrandvilleAuthContext, "supabase" | "workspaceId">;

/**
 * Obrigatório quando o cliente é a chave de serviço: sem a sessão, as
 * policies do Storage não seguram nada, e o escopo passa a ser a trava.
 */
export type EscopoDaDrenagem = { bucket: "brand-assets" };

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
 *
 * Desde o M2 a fila atravessa TRÊS buckets — PDFs de importação, assets e
 * evidências de análise — e cada linha diz o seu. Sem isso a drenagem tentaria
 * apagar tudo no bucket dos PDFs, receberia "não existe" para os outros dois,
 * observaria a ausência (correta, no bucket errado) e fecharia o registro. Os
 * arquivos ficariam para sempre, e a fila diria que o trabalho terminou.
 */
export async function drenarFilaDeExclusao(auth: ContextoDaDrenagem, escopo?: EscopoDaDrenagem) {
  const agora = Date.now();

  let consulta = auth.supabase
    .from("brand_deletions")
    .select("id, storage_path, bucket_id, tentativas, ultima_tentativa_at")
    .eq("workspace_id", auth.workspaceId);
  if (escopo) {
    // Com a chave de serviço nenhuma policy do Storage segura a remoção. O que
    // segura é isto: só o bucket pedido, e só caminho DENTRO da pasta da conta
    // dona da linha. A policy de inserção da fila deixa quem administra a
    // conta enfileirar qualquer texto — um caminho de outra conta, enfileirado
    // na sua, seria apagado pela chave que tudo pode.
    consulta = consulta.eq("bucket_id", escopo.bucket).like("storage_path", `${auth.workspaceId}/%`);
  }
  const { data: todas, error } = await consulta.order("requested_at", { ascending: true }).limit(LOTE);

  if (error) return { removidos: 0, pendentes: 0, adiados: 0 };

  const pendentes = (todas ?? []) as PendenciaDeExclusao[];
  // Uma falha permanente — arquivo que o Storage recusa apagar — seria tentada
  // de novo a cada abertura da administração, para sempre, gastando a mesma
  // chamada com o mesmo resultado. A espera cresce com o número de tentativas.
  const aptas = pendentes.filter((linha) => podeTentar(linha, agora));
  const adiados = pendentes.length - aptas.length;

  // Última conferência antes da chave de serviço apagar: a pendência cujo
  // caminho ainda é o original ou a miniatura de uma variante NÃO sai. Não
  // fecha nem apaga — fica na fila com o motivo, visível, para alguém olhar.
  const vivos = escopo?.bucket === "brand-assets" ? await caminhosDeVariante(auth, aptas) : new Set<string>();
  if (vivos === null) return { removidos: 0, pendentes: await contar(auth), adiados };
  const prontas = aptas.filter((linha) => !vivos.has(linha.storage_path));
  const recusadas = aptas
    .filter((linha) => vivos.has(linha.storage_path))
    .map((linha) => ({ ...linha, ultimo_erro: "o caminho ainda é de uma variante registrada: não se apaga" }));

  if (prontas.length === 0) {
    await registrarFalhas(auth, recusadas);
    return { removidos: 0, pendentes: await contar(auth), adiados };
  }

  // Agrupadas por bucket: uma chamada de remoção por bucket, não por arquivo.
  const porBucket = new Map<string, PendenciaDeExclusao[]>();
  for (const linha of prontas) {
    const lista = porBucket.get(linha.bucket_id) ?? [];
    lista.push(linha);
    porBucket.set(linha.bucket_id, lista);
  }

  const fechar: string[] = [];
  const falharam: PendenciaDeExclusao[] = [...recusadas];

  for (const [bucket, linhas] of porBucket) {
    const { error: erroDeRemocao } = await auth.supabase.storage
      .from(bucket)
      .remove(linhas.map((linha) => linha.storage_path));

    for (const linha of linhas) {
      if (await objetoAusente(auth, bucket, linha.storage_path)) {
        fechar.push(linha.id);
      } else {
        falharam.push({ ...linha, ultimo_erro: erroDeRemocao?.message ?? "o objeto continua no Storage" });
      }
    }
  }

  if (fechar.length > 0) {
    await auth.supabase.from("brand_deletions").delete().in("id", fechar);
  }

  await registrarFalhas(auth, falharam);

  return { removidos: fechar.length, pendentes: await contar(auth), adiados };
}

/**
 * O registro da tentativa é o que torna a falha VISÍVEL. Sem ele, um arquivo
 * que nunca sai é indistinguível de um que acabou de entrar na fila.
 */
async function registrarFalhas(auth: ContextoDaDrenagem, falharam: PendenciaDeExclusao[]) {
  for (const linha of falharam) {
    await auth.supabase
      .from("brand_deletions")
      .update({
        tentativas: linha.tentativas + 1,
        ultimo_erro: (linha.ultimo_erro ?? "").slice(0, 500),
        ultima_tentativa_at: new Date().toISOString(),
      })
      .eq("id", linha.id);
  }
}

/**
 * Quais destes caminhos ainda são original ou miniatura de uma variante.
 * `null` quando a consulta falha: sem saber, nada se apaga.
 */
async function caminhosDeVariante(
  auth: ContextoDaDrenagem,
  linhas: PendenciaDeExclusao[],
): Promise<Set<string> | null> {
  if (linhas.length === 0) return new Set();
  const caminhos = linhas.map((linha) => linha.storage_path);
  const [originais, miniaturas] = await Promise.all([
    auth.supabase.from("brand_assets").select("storage_path").in("storage_path", caminhos),
    auth.supabase.from("brand_assets").select("miniatura_path").in("miniatura_path", caminhos),
  ]);
  if (originais.error || miniaturas.error) return null;
  return new Set([
    ...(originais.data ?? []).map((a: { storage_path: string }) => a.storage_path),
    ...(miniaturas.data ?? []).map((a: { miniatura_path: string }) => a.miniatura_path),
  ]);
}

function podeTentar(linha: PendenciaDeExclusao, agora: number): boolean {
  if (!linha.ultima_tentativa_at) return true;
  const desde = agora - new Date(linha.ultima_tentativa_at).getTime();
  return desde >= intervaloDeEspera(linha.tentativas);
}

async function contar(auth: ContextoDaDrenagem): Promise<number> {
  const { count } = await auth.supabase
    .from("brand_deletions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", auth.workspaceId);
  return count ?? 0;
}

async function objetoAusente(
  auth: ContextoDaDrenagem,
  bucket: string,
  caminho: string,
): Promise<boolean> {
  const corte = caminho.lastIndexOf("/");
  const pasta = caminho.slice(0, corte);
  const nome = caminho.slice(corte + 1);

  const { data, error } = await auth.supabase.storage
    .from(bucket)
    .list(pasta, { search: nome, limit: 1 });

  // Erro ao listar não é ausência: manter na fila é o lado seguro do engano.
  if (error) return false;
  return !(data ?? []).some((objeto) => objeto.name === nome);
}
