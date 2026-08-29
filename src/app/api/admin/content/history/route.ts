import { NextResponse } from "next/server";
import type { DocPageEntry, DocPageImage, DocStatus } from "@/content/docs";
import { getBrandvilleAuthContext } from "@/lib/brandville/server";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { historyActionLabel, type HistoryAction } from "@/lib/brandville/history-action";

type VersionSnapshot = {
  slug: string;
  group: string;
  title: string;
  status: DocStatus;
  body: string[];
  images: DocPageImage[];
  sortOrder: number;
  updatedAt?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUS = new Set<DocStatus>(["ready", "draft", "pending"]);

async function contextoDeAdministracao() {
  const [contexto, auth] = await Promise.all([
    resolveWorkspaceContext(),
    getBrandvilleAuthContext(),
  ]);
  if (!auth || !contexto.capabilities.includes("administrar") || !contexto.brand) return null;
  return { ...contexto, brand: contexto.brand, auth };
}

const SEM_PERMISSAO = { message: "Apenas quem administra a marca pode ver o histórico." };

function validImages(value: unknown): value is DocPageImage[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const image = item as Record<string, unknown>;
    return typeof image.src === "string" && typeof image.alt === "string" &&
      (image.caption === undefined || typeof image.caption === "string");
  });
}

function parseSnapshot(value: unknown): VersionSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Record<string, unknown>;
  if (
    typeof snapshot.slug !== "string" ||
    typeof snapshot.group !== "string" ||
    typeof snapshot.title !== "string" ||
    !STATUS.has(snapshot.status as DocStatus) ||
    !Array.isArray(snapshot.body) || !snapshot.body.every((item) => typeof item === "string") ||
    !validImages(snapshot.images) ||
    typeof snapshot.sortOrder !== "number"
  ) return null;
  return snapshot as VersionSnapshot;
}

function comparable(snapshot: VersionSnapshot | null) {
  if (!snapshot) return null;
  return {
    group: snapshot.group,
    title: snapshot.title,
    status: snapshot.status,
    body: snapshot.body,
    images: snapshot.images,
    sortOrder: snapshot.sortOrder,
  };
}

function changedFields(current: VersionSnapshot, previous: VersionSnapshot | null, action: string) {
  const rotulo = historyActionLabel(action as HistoryAction);
  if (rotulo.replacesFieldList) return [rotulo.summary];
  if (!previous) return ["Primeira versão"];
  type ComparableSnapshot = NonNullable<ReturnType<typeof comparable>>;
  const fields: Array<[keyof ComparableSnapshot, string]> = [
    ["title", "Título"], ["group", "Seção"], ["status", "Status"],
    ["body", "Texto"], ["images", "Imagens"], ["sortOrder", "Ordem"],
  ];
  const atual = comparable(current)!;
  const anterior = comparable(previous)!;
  const changed = fields
    .filter(([key]) => JSON.stringify(atual[key]) !== JSON.stringify(anterior[key]))
    .map(([, label]) => label);
  return changed.length > 0 ? changed : ["Versão republicada"];
}

export async function GET(request: Request) {
  const contexto = await contextoDeAdministracao();
  if (!contexto) return NextResponse.json(SEM_PERMISSAO, { status: 403 });

  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  // A página precisa pertencer à marca ativa. Antes a validação era contra o
  // registro em código, que não sabe nada sobre esta conta.
  if (!contexto.docs.some((doc) => doc.slug === slug)) {
    return NextResponse.json({ message: "Esta página não existe nesta marca." }, { status: 404 });
  }

  const [versionsResult, currentResult] = await Promise.all([
    contexto.auth.supabase.from("brand_document_versions")
      .select("id, action, snapshot, actor_label, created_at")
      .eq("brand_id", contexto.brand.id).eq("slug", slug)
      .order("created_at", { ascending: false }).limit(50),
    contexto.auth.supabase.from("brand_documents")
      .select("slug, group_name, title, status, body, images, sort_order, updated_at")
      .eq("brand_id", contexto.brand.id).eq("slug", slug).maybeSingle(),
  ]);
  if (versionsResult.error || currentResult.error) {
    return NextResponse.json({ message: "Não foi possível carregar o histórico." }, { status: 500 });
  }

  const currentSnapshot = currentResult.data ? parseSnapshot({
    slug: currentResult.data.slug, group: currentResult.data.group_name, title: currentResult.data.title,
    status: currentResult.data.status, body: currentResult.data.body, images: currentResult.data.images,
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
  const contexto = await contextoDeAdministracao();
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

  const document: DocPageEntry = {
    slug: snapshot.slug, group: snapshot.group, title: snapshot.title,
    status: snapshot.status, body: snapshot.body, images: snapshot.images,
  };
  return NextResponse.json({ ok: true, updatedAt: data.updated_at, document });
}
