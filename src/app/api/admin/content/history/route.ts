import { NextResponse } from "next/server";
import type { DocPageEntry } from "@/content/docs";
import {
  comparable,
  pageFromSnapshot,
  parseSnapshot,
  type VersionSnapshot,
} from "@/lib/brandville/version-snapshot";
import { conteudoDaRota } from "@/lib/brandville/contexto-da-rota";
import { historyActionLabel, type HistoryAction } from "@/lib/brandville/history-action";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

const SEM_PERMISSAO = { message: "Apenas quem administra a marca pode ver o histórico." };

function changedFields(current: VersionSnapshot, previous: VersionSnapshot | null, action: string) {
  const rotulo = historyActionLabel(action as HistoryAction);
  if (rotulo.replacesFieldList) return [rotulo.summary];
  if (!previous) return ["Primeira versão"];
  type ComparableSnapshot = NonNullable<ReturnType<typeof comparable>>;
  const fields: Array<[keyof ComparableSnapshot, string]> = [
    ["title", "Título"], ["group", "Seção"], ["status", "Status"],
    ["body", "Texto"], ["images", "Imagens"], ["blocks", "Blocos"], ["sortOrder", "Ordem"],
  ];
  const atual = comparable(current)!;
  const anterior = comparable(previous)!;
  const changed = fields
    .filter(([key]) => JSON.stringify(atual[key]) !== JSON.stringify(anterior[key]))
    .map(([, label]) => label);
  return changed.length > 0 ? changed : ["Versão republicada"];
}

export async function GET(request: Request) {
  const resolvido = await contextoDeAdministracao(request);
  if (!resolvido.ok) {
    if (resolvido.resposta) return resolvido.resposta;
  }
  const contexto = resolvido.ok ? resolvido.dados : null;
  if (!contexto) return NextResponse.json(SEM_PERMISSAO, { status: 403 });

  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!slug) return NextResponse.json({ message: "Página inválida." }, { status: 400 });

  const [versionsResult, currentResult] = await Promise.all([
    contexto.auth.supabase.from("brand_document_versions")
      .select("id, action, snapshot, actor_label, created_at")
      .eq("brand_id", contexto.brand.id).eq("slug", slug)
      .order("created_at", { ascending: false }).limit(50),
    contexto.auth.supabase.from("brand_documents")
      .select("slug, group_name, title, status, body, images, blocks, sort_order, updated_at")
      .eq("brand_id", contexto.brand.id).eq("slug", slug).maybeSingle(),
  ]);
  if (versionsResult.error || currentResult.error) {
    return NextResponse.json({ message: "Não foi possível carregar o histórico." }, { status: 500 });
  }

  // Uma página excluída não tem mais linha em brand_documents, mas continua
  // tendo histórico — e é de lá que ela volta. Validar o slug contra as páginas
  // vivas tornava a recuperação inalcançável justamente quando é necessária.
  // O que delimita o acesso é o brand_id da consulta, não a existência da
  // página.
  if ((versionsResult.data ?? []).length === 0 && !currentResult.data) {
    return NextResponse.json({ message: "Esta página não existe nesta marca." }, { status: 404 });
  }

  const currentSnapshot = currentResult.data ? parseSnapshot({
    slug: currentResult.data.slug, group: currentResult.data.group_name, title: currentResult.data.title,
    status: currentResult.data.status, body: currentResult.data.body, images: currentResult.data.images,
    blocks: currentResult.data.blocks,
    sortOrder: currentResult.data.sort_order, updatedAt: currentResult.data.updated_at,
  }) : null;

  const validRows = (versionsResult.data ?? [])
    .map((row) => ({ ...row, parsed: parseSnapshot(row.snapshot) }))
    .filter((row) => row.parsed !== null);

  const versions = validRows.map((row, index) => {
    const previous = validRows[index + 1]?.parsed ?? null;
    const snapshot = row.parsed!;
    return {
      id: row.id,
      action: row.action,
      actionLabel: historyActionLabel(row.action as HistoryAction).badge,
      actorLabel: row.actor_label,
      createdAt: row.created_at,
      title: snapshot.title,
      status: snapshot.status,
      preview: snapshot.body[0]?.slice(0, 220) ?? "Sem texto nesta versão.",
      changedFields: changedFields(snapshot, previous, row.action),
      isCurrent: index === 0 &&
        JSON.stringify(comparable(snapshot)) === JSON.stringify(comparable(currentSnapshot)),
    };
  });

  // A página pode ter sido excluída e continuar tendo histórico: é assim que
  // se recupera o que foi apagado.
  return NextResponse.json({ versions, pageDeleted: currentSnapshot === null });
}

/**
 * Recuperar uma versão.
 *
 * A escrita declara de qual versão veio, e é isso que faz o gatilho registrar
 * `restored_from_version` em vez de mais uma publicação. Ver a migração
 * 20260829160000.
 */
export async function POST(request: Request) {
  const resolvido = await contextoDeAdministracao(request);
  if (!resolvido.ok) {
    if (resolvido.resposta) return resolvido.resposta;
  }
  const contexto = resolvido.ok ? resolvido.dados : null;
  if (!contexto) {
    return NextResponse.json(
      { message: "Apenas quem administra a marca pode recuperar versões." },
      { status: 403 },
    );
  }

  const input = await request.json().catch(() => null);
  const versionId = typeof input?.versionId === "string" ? input.versionId : "";
  if (!UUID_PATTERN.test(versionId)) {
    return NextResponse.json({ message: "Versão inválida." }, { status: 400 });
  }

  const { data: version, error: versionError } = await contexto.auth.supabase
    .from("brand_document_versions")
    .select("slug, snapshot")
    .eq("id", versionId)
    .eq("brand_id", contexto.brand.id)
    .maybeSingle();

  const snapshot = parseSnapshot(version?.snapshot);
  if (versionError || !version || !snapshot || !contexto.brand.navigation.groups.includes(snapshot.group)) {
    return NextResponse.json({ message: "Esta versão não pode ser recuperada." }, { status: 400 });
  }

  const { data, error } = await contexto.auth.supabase
    .from("brand_documents")
    .upsert({
      workspace_id: contexto.auth.workspaceId,
      brand_id: contexto.brand.id,
      instance_key: contexto.brand.key,
      slug: snapshot.slug,
      group_name: snapshot.group,
      title: snapshot.title,
      status: snapshot.status,
      body: snapshot.body,
      images: snapshot.images,
      // Sem isto a linha renasce com o padrão [] e todo o conteúdo estruturado
      // — paletas, galerias, territórios — some na recuperação.
      blocks: snapshot.blocks ?? [],
      sort_order: snapshot.sortOrder,
      restored_from_version_id: versionId,
      updated_by: contexto.auth.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "brand_id,slug" })
    .select("updated_at")
    .single();

  if (error) {
    return NextResponse.json({ message: "Não foi possível recuperar esta versão." }, { status: 500 });
  }

  const document: DocPageEntry = pageFromSnapshot(snapshot);
  return NextResponse.json({ ok: true, updatedAt: data.updated_at, document });
}
