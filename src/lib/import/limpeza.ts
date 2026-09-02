import type { BrandvilleAuthContext } from "@/lib/brandville/server";
import { intervaloDeEspera, type PendenciaDeExclusao } from "./fila";

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
 *
 * Desde o M2 a fila atravessa TRÊS buckets — PDFs de importação, assets e
 * evidências de análise — e cada linha diz o seu. Sem isso a drenagem tentaria
 * apagar tudo no bucket dos PDFs, receberia "não existe" para os outros dois,
 * observaria a ausência (correta, no bucket errado) e fecharia o registro. Os
 * arquivos ficariam para sempre, e a fila diria que o trabalho terminou.
 */
export async function drenarFilaDeExclusao(auth: BrandvilleAuthContext) {
  const agora = Date.now();

  const { data: todas, error } = await auth.supabase
    .from("brand_deletions")
    .select("id, storage_path, bucket_id, tentativas, ultima_tentativa_at")
    .eq("workspace_id", auth.workspaceId)
    .order("requested_at", { ascending: true })
    .limit(LOTE);

  if (error) return { removidos: 0, pendentes: 0, adiados: 0 };

  const pendentes = (todas ?? []) as PendenciaDeExclusao[];
  // Uma falha permanente — arquivo que o Storage recusa apagar — seria tentada
  // de novo a cada abertura da administração, para sempre, gastando a mesma
  // chamada com o mesmo resultado. A espera cresce com o número de tentativas.
  const prontas = pendentes.filter((linha) => podeTentar(linha, agora));
  const adiados = pendentes.length - prontas.length;

  if (prontas.length === 0) {
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
  const falharam: PendenciaDeExclusao[] = [];

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

  // O registro da tentativa é o que torna a falha VISÍVEL. Sem ele, um arquivo
  // que nunca sai é indistinguível de um que acabou de entrar na fila.
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

  return { removidos: fechar.length, pendentes: await contar(auth), adiados };
}

function podeTentar(linha: PendenciaDeExclusao, agora: number): boolean {
  if (!linha.ultima_tentativa_at) return true;
  const desde = agora - new Date(linha.ultima_tentativa_at).getTime();
  return desde >= intervaloDeEspera(linha.tentativas);
}

async function contar(auth: BrandvilleAuthContext): Promise<number> {
  const { count } = await auth.supabase
    .from("brand_deletions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", auth.workspaceId);
  return count ?? 0;
}

async function objetoAusente(
  auth: BrandvilleAuthContext,
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
