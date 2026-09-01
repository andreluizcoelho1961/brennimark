import { NextResponse } from "next/server";
import type { DocStatus } from "@/content/docs";
import { conteudoDaRota } from "@/lib/brandville/contexto-da-rota";

const VALID_STATUS = new Set<DocStatus>(["ready", "draft", "pending"]);

/**
 * Escrita de conteúdo, agora pela marca.
 *
 * O que mudou de fundo: a página a editar era procurada em `activeDocsRegistry`
 * — o registro em código — e gravada por `workspace_id + instance_key`. Com o
 * registro vazio desde a remoção da herança, esta rota respondia 400 a tudo:
 * editar era impossível. Agora a página é procurada no banco, dentro da marca
 * que a requisição resolveu.
 *
 * Também deixou de ser `upsert`. O editor edita texto; imagens e blocos vivem
 * na linha e não são enviados. Com `update` eles simplesmente não são tocados
 * — antes era preciso lê-los antes e regravá-los, e esquecer esse passo
 * apagaria conteúdo publicado.
 */
async function contextoDeAdministracao(request: Request) {
  // O alvo vem da requisição. Sem ele, resolve se houver uma marca só; havendo
  // mais, a resposta é 409 com as opções — nunca um palpete silencioso.
  const resolvido = await conteudoDaRota(request);
  if (!resolvido.ok) return resolvido;
  const { contexto, auth } = resolvido;
  if (!contexto.capabilities.includes("administrar") || !contexto.brand) {
    return { ok: false as const, resposta: null };
  }
  return { ok: true as const, dados: { ...contexto, brand: contexto.brand, auth } };
}

const SEM_PERMISSAO = { message: "Apenas quem administra a marca pode editar o guia." };
const SEM_PAGINA = { message: "Esta página não existe nesta marca." };

export async function PUT(request: Request) {
  const resolvido = await contextoDeAdministracao(request);
  if (!resolvido.ok) {
    if (resolvido.resposta) return resolvido.resposta;
  }
  const contexto = resolvido.ok ? resolvido.dados : null;
  if (!contexto) return NextResponse.json(SEM_PERMISSAO, { status: 403 });

  const { auth } = contexto;
  const input = await request.json().catch(() => null);
  const slug = typeof input?.slug === "string" ? input.slug : "";
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const group = typeof input?.group === "string" ? input.group.trim() : "";
  const status = input?.status as DocStatus;
  const body: string[] | null = Array.isArray(input?.body)
    ? input.body.map((item: unknown) => String(item).trim()).filter(Boolean)
    : null;

  // Seções válidas são as da marca, não as de uma instância de código.
  const secoes = contexto.brand.navigation.groups;
  if (
    !title || title.length > 120 || !secoes.includes(group) || !VALID_STATUS.has(status) ||
    !body || body.length > 40 || body.some((item) => item.length > 4000)
  ) {
    return NextResponse.json(
      { message: "Revise o título, a seção, o status e os parágrafos." },
      { status: 400 },
    );
  }

  // A página tem que pertencer a esta marca. Sem esta verificação, um slug
  // vindo do cliente alcançaria a linha de outra marca do mesmo workspace.
  const existe = contexto.docs.some((doc) => doc.slug === slug);
  if (!existe) return NextResponse.json(SEM_PAGINA, { status: 404 });

  const { data, error } = await auth.supabase
    .from("brand_documents")
    .update({
      group_name: group,
      title,
      status,
      body,
      // Uma edição comum não vem de versão nenhuma. Zerar aqui é o que faz o
      // gatilho registrar "publicada" depois de uma recuperação.
      restored_from_version_id: null,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("brand_id", contexto.brand.id)
    .eq("slug", slug)
    .select("updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ message: "Não foi possível salvar a página." }, { status: 500 });
  if (!data) return NextResponse.json(SEM_PAGINA, { status: 404 });
  return NextResponse.json({ ok: true, updatedAt: data.updated_at });
}

/**
 * Excluir a página. Não é mais "restaurar a matriz".
 *
 * O nome antigo descrevia um mundo em que apagar a linha devolvia a página ao
 * registro em código. Sem matriz, apagar apaga — e o histórico registra
 * `deleted`, com o conteúdo preservado no instantâneo para quem quiser
 * recuperá-lo depois.
 */
export async function DELETE(request: Request) {
  const resolvido = await contextoDeAdministracao(request);
  if (!resolvido.ok) {
    if (resolvido.resposta) return resolvido.resposta;
  }
  const contexto = resolvido.ok ? resolvido.dados : null;
  if (!contexto) return NextResponse.json(SEM_PERMISSAO, { status: 403 });

  const input = await request.json().catch(() => null);
  const slug = typeof input?.slug === "string" ? input.slug : "";
  if (!contexto.docs.some((doc) => doc.slug === slug)) {
    return NextResponse.json(SEM_PAGINA, { status: 404 });
  }

  const { error } = await contexto.auth.supabase
    .from("brand_documents")
    .delete()
    .eq("brand_id", contexto.brand.id)
    .eq("slug", slug);

  if (error) return NextResponse.json({ message: "Não foi possível excluir a página." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
