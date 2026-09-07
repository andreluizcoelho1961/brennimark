import { NextResponse } from "next/server";
import { conteudoDaRota } from "@/lib/brandville/contexto-da-rota";
import { interpretarEdicao } from "@/lib/brandville/edicao-de-conteudo";

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

  /*
   * O corpo é lido como TEXTO antes de virar JSON, para o tamanho ser medido
   * antes de qualquer parsing. Medir depois já teria pago o custo de analisar
   * um payload que a gente vai recusar de qualquer jeito.
   */
  const bruto = await request.text().catch(() => "");
  let entrada: unknown = null;
  try {
    entrada = JSON.parse(bruto);
  } catch {
    entrada = null;
  }

  const lida = interpretarEdicao(entrada, {
    gruposValidos: contexto.brand.navigation.groups,
    bytesDaRequisicao: Buffer.byteLength(bruto),
  });
  if (!lida.ok) {
    return NextResponse.json({ message: lida.mensagem }, { status: lida.status });
  }

  const { slug, campos } = lida;

  // A página tem que pertencer a esta marca. Sem esta verificação, um slug
  // vindo do cliente alcançaria a linha de outra marca do mesmo workspace.
  const existe = contexto.docs.some((doc) => doc.slug === slug);
  if (!existe) return NextResponse.json(SEM_PAGINA, { status: 404 });

  /*
   * Só os campos PRESENTES vão para o update.
   *
   * É o que faz a atualização parcial ser parcial de verdade: o que a
   * requisição não mandou, o banco não vê — nem como `null`, nem como valor
   * relido e regravado, que é onde uma leitura desatualizada apagaria a edição
   * de outra pessoa.
   */
  const alteracao: Record<string, unknown> = {
    ...(campos.group !== undefined ? { group_name: campos.group } : {}),
    ...(campos.title !== undefined ? { title: campos.title } : {}),
    ...(campos.status !== undefined ? { status: campos.status } : {}),
    ...(campos.body !== undefined ? { body: campos.body } : {}),
    // Uma edição comum não vem de versão nenhuma. Zerar aqui é o que faz o
    // gatilho registrar "publicada" depois de uma recuperação.
    restored_from_version_id: null,
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.supabase
    .from("brand_documents")
    .update(alteracao)
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
