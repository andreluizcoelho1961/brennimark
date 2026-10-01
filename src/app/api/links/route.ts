import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { autenticacaoDaRota, marcaDaRota } from "@/lib/brennimark/contexto-da-rota";
import { gerarCodigo, lerPedidoDeLink, mensagemDaRecusa, resumoDoCodigo, situacaoDoLink } from "@/lib/links/links";

const isEnglish = inEnglish(PRODUCT_LOCALE);
const SEM_CACHE = { "Cache-Control": "private, no-store" };

/**
 * Links de entrega da CONTA — ADR-0007 §2.5 (30/09/2026).
 *
 * Lê e cria com a sessão de quem pede, sem chave de serviço. Quem vê e quem
 * cria decide o banco: as tabelas só entregam links das marcas em que a sessão
 * tem `administrar`, e `criar_link_de_entrega` recusa quem não tem.
 */

/** A lista: todos os links da conta que a sessão alcança, do mais recente para trás. */
export async function GET(request: Request) {
  const resolvido = await autenticacaoDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { supabase, workspaceId } = resolvido.contexto;

  const [links, marcas] = await Promise.all([
    supabase.from("links_de_entrega")
      .select("id, brand_id, nome, destinatario, expira_em, revogado_em, created_at, criado_por_email, arquivos_do_link(count)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("brands").select("id, name").eq("workspace_id", workspaceId),
  ]);
  if (links.error || marcas.error) {
    return NextResponse.json({ message: isEnglish ? "Couldn't load the links." : "Não foi possível carregar os links." }, { status: 500, headers: SEM_CACHE });
  }

  const ids = (links.data ?? []).map((l) => l.id as string);
  // Os downloads de cada link: quantos e o último. Lidos em páginas, porque um
  // link muito usado passa das 1.000 linhas de um pedido.
  const baixados = new Map<string, { total: number; ultimo: string | null }>();
  for (let inicio = 0; ids.length > 0; inicio += 1000) {
    const { data, error } = await supabase.from("acessos_de_link")
      .select("link_id, created_at")
      .in("link_id", ids).eq("evento", "baixou")
      .order("created_at", { ascending: false }).order("id")
      .range(inicio, inicio + 999);
    if (error) break;
    for (const a of data ?? []) {
      const atual = baixados.get(a.link_id as string) ?? { total: 0, ultimo: null };
      baixados.set(a.link_id as string, { total: atual.total + 1, ultimo: atual.ultimo ?? (a.created_at as string) });
    }
    if (!data || data.length < 1000) break;
  }

  const nomes = new Map((marcas.data ?? []).map((m) => [m.id as string, m.name as string]));
  const agora = new Date();
  return NextResponse.json({
    links: (links.data ?? []).map((l) => ({
      id: l.id, marca: nomes.get(l.brand_id as string) ?? "—", nome: l.nome, destinatario: l.destinatario,
      criado_em: l.created_at, criado_por: l.criado_por_email, expira_em: l.expira_em, revogado_em: l.revogado_em,
      situacao: situacaoDoLink({ expira_em: l.expira_em as string, revogado_em: l.revogado_em as string | null }, agora),
      arquivos: ((l.arquivos_do_link as { count: number }[] | null) ?? [])[0]?.count ?? 0,
      downloads: baixados.get(l.id as string)?.total ?? 0,
      ultimo_download: baixados.get(l.id as string)?.ultimo ?? null,
    })),
  }, { headers: SEM_CACHE });
}

/**
 * Cria um link na marca do endereço (`?w=&b=`). O código nasce aqui, vai ao
 * banco só como SHA-256, e volta UMA vez nesta resposta, dentro do endereço.
 * Depois disso ninguém mais o recupera — nem quem criou.
 */
export async function POST(request: Request) {
  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, brandId } = resolvido;

  const lido = lerPedidoDeLink(await request.json().catch(() => null), isEnglish);
  if (!lido.ok) return NextResponse.json({ message: lido.mensagem }, { status: 400, headers: SEM_CACHE });
  const { nome, destinatario, dias, arquivos } = lido.pedido;

  const codigo = gerarCodigo();
  const { data, error } = await auth.supabase.rpc("criar_link_de_entrega", {
    p_brand_id: brandId, p_nome: nome, p_destinatario: destinatario, p_dias: dias,
    p_asset_ids: arquivos, p_token_hash: resumoDoCodigo(codigo),
  });
  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ message: isEnglish ? "Only people who manage this brand create delivery links." : "Só quem administra esta marca cria link de entrega." }, { status: 403, headers: SEM_CACHE });
    }
    const conhecida = error.code === "23514";
    if (!conhecida) console.error(JSON.stringify({ level: "error", msg: "link_nao_criado", code: error.code ?? "unknown" }));
    return NextResponse.json({ message: mensagemDaRecusa(error.hint, isEnglish) }, { status: conhecida ? 400 : 500, headers: SEM_CACHE });
  }

  const origem = new URL(request.url).origin;
  return NextResponse.json({ id: data, endereco: `${origem}/receber/${codigo}` }, { status: 201, headers: SEM_CACHE });
}
