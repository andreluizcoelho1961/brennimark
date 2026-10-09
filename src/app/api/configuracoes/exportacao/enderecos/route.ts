import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { workspaceDaRota } from "@/lib/brennimark/contexto-da-rota";
import { BUCKETS } from "@/lib/storage/caminhos";

/**
 * Os endereços de um lote da exportação (08/10/2026).
 *
 * O navegador manda CHAVES (`material:<id>`…), nunca caminhos. A função
 * `caminhos_da_exportacao`, com a sessão da pessoa, confere que ela é a dona
 * da conta da exportação, que a exportação tem menos de 6 horas, e devolve só
 * os caminhos daquela conta. Depois, a chave de SERVIÇO assina — desde
 * `storage_por_marca` ninguém lê original direto no Storage — e cada caminho
 * é conferido de novo (bucket conhecido, pasta da conta, sem `..`), por
 * garantia. Há teto de endereços por exportação, no banco.
 *
 * 120 segundos: o navegador pede um lote logo antes de buscá-lo.
 */
const VALIDADE_DO_ENDERECO_S = 120;
const SEM_CACHE = { "Cache-Control": "private, no-store" };
// Os mesmos três da função do banco — segunda linha, caso um dia divirjam.
const BUCKETS_DA_EXPORTACAO = new Set<string>([BUCKETS.importacoes, BUCKETS.assets, BUCKETS.evidencias]);

export async function POST(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  if (r.papel !== "owner") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const corpo = await request.json().catch(() => null);
  const exportacao = typeof corpo?.exportacao === "string" ? corpo.exportacao : "";
  const chaves = Array.isArray(corpo?.chaves)
    ? (corpo.chaves as unknown[]).filter((c): c is string => typeof c === "string")
    : [];
  if (!exportacao || chaves.length === 0 || chaves.length > 50) {
    return NextResponse.json({ message: "Pedido inválido." }, { status: 400, headers: SEM_CACHE });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("caminhos_da_exportacao", { p_exportacao: exportacao, p_chaves: chaves });
  if (error?.code === "42501" || error?.code === "22P02") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  if (error?.hint === "exportacao_expirada") {
    return NextResponse.json({ message: "Esta exportação passou de 6 horas. Comece outra." }, { status: 410, headers: SEM_CACHE });
  }
  if (error?.hint === "exportacao_limite_de_arquivos") {
    return NextResponse.json({ message: "Esta exportação já baixou o que podia. Comece outra." }, { status: 429, headers: SEM_CACHE });
  }
  if (error?.hint === "exportacao_exclusao_em_andamento") {
    return NextResponse.json({ message: "A exclusão desta conta já começou, e os arquivos estão sendo removidos." }, { status: 409, headers: SEM_CACHE });
  }
  if (error) return NextResponse.json({ message: "Não foi possível preparar os arquivos." }, { status: 503, headers: SEM_CACHE });

  const todas = (data ?? []) as { chave: string; bucket: string; caminho: string; conta: string }[];
  // A exportação é de outra conta da mesma dona: não é esta tela.
  if (todas.some((l) => l.conta !== r.workspaceId)) return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  const linhas = todas.filter((l) =>
    BUCKETS_DA_EXPORTACAO.has(l.bucket) && l.caminho.startsWith(`${r.workspaceId}/`)
    && !l.caminho.split("/").includes("..") && !l.caminho.includes("//"));
  const porBucket = new Map<string, { chave: string; caminho: string }[]>();
  for (const l of linhas) porBucket.set(l.bucket, [...(porBucket.get(l.bucket) ?? []), l]);

  const enderecos: Record<string, string> = {};
  const servico = createServiceClient();
  for (const [bucket, doBucket] of porBucket) {
    const { data: assinados, error: erro } = await servico.storage
      .from(bucket).createSignedUrls(doBucket.map((l) => l.caminho), VALIDADE_DO_ENDERECO_S);
    if (erro || !assinados) {
      return NextResponse.json({ message: "Não foi possível preparar os arquivos." }, { status: 503, headers: SEM_CACHE });
    }
    const porCaminho = new Map(assinados.filter((a) => a.path && a.signedUrl).map((a) => [a.path as string, a.signedUrl]));
    for (const l of doBucket) {
      const url = porCaminho.get(l.caminho);
      if (url) enderecos[l.chave] = url;
    }
  }
  // Endereço assinado é credencial: nada de cache.
  return NextResponse.json({ enderecos }, { headers: SEM_CACHE });
}
