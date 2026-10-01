import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { conteudoDaRota } from "@/lib/brennimark/contexto-da-rota";
import { lerTextoDoComplemento, mensagemDaRecusa, type Complemento } from "@/lib/complementos/complementos";

const isEnglish = inEnglish(PRODUCT_LOCALE);
const SEM_CACHE = { "Cache-Control": "private, no-store" };

/**
 * Os complementos da marca do endereço (`?w=&b=`) — 01/10/2026.
 *
 * Lê com a sessão de quem pede, sem chave de serviço. Quem vê o quê decide o
 * banco: quem consulta recebe só o publicado e não arquivado; o rascunho só
 * chega a quem edita (tabela própria, com RLS de `editar`). `podeEditar` aqui
 * só decide o que a TELA mostra.
 */
export async function GET(request: Request) {
  const resolvido = await conteudoDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { contexto, auth } = resolvido;
  const marca = contexto.brand!;
  const podeEditar = contexto.capabilities.includes("editar");

  const [publicados, rascunhos] = await Promise.all([
    auth.supabase.from("complementos")
      .select("id, slug, versao, titulo, texto, publicado_em, publicado_por_email, arquivado_em")
      .eq("brand_id", marca.id).order("created_at", { ascending: true }),
    podeEditar
      ? auth.supabase.from("rascunhos_de_complemento")
        .select("complemento_id, titulo, texto, atualizado_em, atualizado_por_email")
        .eq("brand_id", marca.id)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (publicados.error || rascunhos.error) {
    return NextResponse.json({ message: isEnglish ? "Couldn't load the supplements." : "Não foi possível carregar os complementos." }, { status: 500, headers: SEM_CACHE });
  }
  const porId = new Map((rascunhos.data ?? []).map((r) => [r.complemento_id as string, r]));
  const complementos: Complemento[] = (publicados.data ?? []).map((c) => {
    const r = porId.get(c.id as string);
    return {
      id: c.id, slug: c.slug, versao: c.versao, titulo: c.titulo, texto: c.texto,
      publicado_em: c.publicado_em, publicado_por_email: c.publicado_por_email, arquivado_em: c.arquivado_em,
      rascunho: r ? { titulo: r.titulo, texto: r.texto, atualizado_em: r.atualizado_em, atualizado_por_email: r.atualizado_por_email } : null,
    };
  });
  return NextResponse.json({ podeEditar, complementos }, { headers: SEM_CACHE });
}

/** Cria um complemento — nasce como rascunho, só de quem edita. */
export async function POST(request: Request) {
  const resolvido = await conteudoDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { contexto, auth } = resolvido;

  const lido = lerTextoDoComplemento(await request.json().catch(() => null), isEnglish);
  if (!lido.ok) return NextResponse.json({ message: lido.mensagem }, { status: 400, headers: SEM_CACHE });

  const { data, error } = await auth.supabase.rpc("criar_complemento", {
    p_brand_id: contexto.brand!.id, p_titulo: lido.titulo, p_texto: lido.texto,
  });
  if (error?.code === "42501") {
    return NextResponse.json({ message: isEnglish ? "Only people who edit this brand write supplements." : "Só quem edita esta marca escreve complementos." }, { status: 403, headers: SEM_CACHE });
  }
  if (error) {
    return NextResponse.json({ message: mensagemDaRecusa(error.hint, isEnglish) }, { status: error.code === "23514" ? 400 : 500, headers: SEM_CACHE });
  }
  return NextResponse.json({ id: data }, { status: 201, headers: SEM_CACHE });
}
