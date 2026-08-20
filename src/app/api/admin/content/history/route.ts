import { NextResponse } from "next/server";
import { activeDocsRegistry, brandvilleInstance } from "@/brandville/config";
import type { DocPageEntry, DocPageImage, DocStatus } from "@/content/docs";
import { getBrandvilleAuthContext } from "@/lib/brandville/server";

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

const isEnglish = brandvilleInstance.metadata.language === "en";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUS = new Set<DocStatus>(["ready", "draft", "pending"]);

async function ownerContext() {
  const context = await getBrandvilleAuthContext();
  return context?.role === "owner" ? context : null;
}

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
  if (action === "restored_to_matrix") return [isEnglish ? "Reverted to matrix" : "Retorno à matriz"];
  if (!previous) return [isEnglish ? "First custom version" : "Primeira versão personalizada"];
  type ComparableSnapshot = NonNullable<ReturnType<typeof comparable>>;
  const fields: Array<[keyof ComparableSnapshot, string]> = isEnglish
    ? [["title", "Title"], ["group", "Section"], ["status", "Status"], ["body", "Text"], ["images", "Images"], ["sortOrder", "Order"]]
    : [["title", "Título"], ["group", "Seção"], ["status", "Status"], ["body", "Texto"], ["images", "Imagens"], ["sortOrder", "Ordem"]];
  const currentComparable = comparable(current)!;
  const previousComparable = comparable(previous)!;
  const changed = fields.filter(([key]) => JSON.stringify(currentComparable[key]) !== JSON.stringify(previousComparable[key])).map(([, label]) => label);
  return changed.length > 0 ? changed : [isEnglish ? "Version republished" : "Versão republicada"];
}

export async function GET(request: Request) {
  const context = await ownerContext();
  if (!context) return NextResponse.json({ message: isEnglish ? "Only the owner can view history." : "Apenas o proprietário pode consultar o histórico." }, { status: 403 });
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!activeDocsRegistry.some((entry) => entry.slug === slug)) return NextResponse.json({ message: isEnglish ? "Invalid page." : "Página inválida." }, { status: 400 });

  const [versionsResult, currentResult] = await Promise.all([
    context.supabase.from("brand_document_versions")
      .select("id, action, snapshot, actor_label, created_at")
      .eq("workspace_id", context.workspaceId).eq("instance_key", brandvilleInstance.key).eq("slug", slug)
      .order("created_at", { ascending: false }).limit(50),
    context.supabase.from("brand_documents")
      .select("slug, group_name, title, status, body, images, sort_order, updated_at")
      .eq("workspace_id", context.workspaceId).eq("instance_key", brandvilleInstance.key).eq("slug", slug).maybeSingle(),
  ]);
  if (versionsResult.error || currentResult.error) return NextResponse.json({ message: isEnglish ? "Couldn't load history." : "Não foi possível carregar o histórico." }, { status: 500 });

  const currentSnapshot = currentResult.data ? parseSnapshot({
    slug: currentResult.data.slug, group: currentResult.data.group_name, title: currentResult.data.title,
    status: currentResult.data.status, body: currentResult.data.body, images: currentResult.data.images,
    sortOrder: currentResult.data.sort_order, updatedAt: currentResult.data.updated_at,
  }) : null;
  const validRows = (versionsResult.data ?? []).map((row) => ({ ...row, parsed: parseSnapshot(row.snapshot) })).filter((row) => row.parsed !== null);
  const versions = validRows.map((row, index) => {
    const previous = validRows[index + 1]?.parsed ?? null;
    const snapshot = row.parsed!;
    return {
      id: row.id,
      action: row.action,
      actorLabel: row.actor_label,
      createdAt: row.created_at,
      title: snapshot.title,
      status: snapshot.status,
      preview: snapshot.body[0]?.slice(0, 220) ?? (isEnglish ? "No text in this version." : "Sem texto nesta versão."),
      changedFields: changedFields(snapshot, previous, row.action),
      isCurrent: index === 0 && JSON.stringify(comparable(snapshot)) === JSON.stringify(comparable(currentSnapshot)),
    };
  });
  return NextResponse.json({ versions, matrixActive: currentSnapshot === null });
}

export async function POST(request: Request) {
  const context = await ownerContext();
  if (!context) return NextResponse.json({ message: isEnglish ? "Only the owner can restore versions." : "Apenas o proprietário pode recuperar versões." }, { status: 403 });
  const input = await request.json().catch(() => null);
  const versionId = typeof input?.versionId === "string" ? input.versionId : "";
  if (!UUID_PATTERN.test(versionId)) return NextResponse.json({ message: isEnglish ? "Invalid version." : "Versão inválida." }, { status: 400 });

  const { data: version, error: versionError } = await context.supabase.from("brand_document_versions")
    .select("slug, snapshot").eq("id", versionId).eq("workspace_id", context.workspaceId).eq("instance_key", brandvilleInstance.key).maybeSingle();
  const snapshot = parseSnapshot(version?.snapshot);
  const base = snapshot ? activeDocsRegistry.find((entry) => entry.slug === snapshot.slug) : null;
  if (versionError || !version || !snapshot || !base || !brandvilleInstance.navigation.groups.includes(snapshot.group)) {
    return NextResponse.json({ message: isEnglish ? "This version can't be restored." : "Esta versão não pode ser recuperada." }, { status: 400 });
  }

  const { data, error } = await context.supabase.from("brand_documents").upsert({
    workspace_id: context.workspaceId, instance_key: brandvilleInstance.key, slug: snapshot.slug,
    group_name: snapshot.group, title: snapshot.title, status: snapshot.status, body: snapshot.body,
    images: snapshot.images, sort_order: snapshot.sortOrder, updated_by: context.user.id, updated_at: new Date().toISOString(),
  }, { onConflict: "workspace_id,instance_key,slug" }).select("updated_at").single();
  if (error) return NextResponse.json({ message: isEnglish ? "Couldn't restore this version." : "Não foi possível recuperar esta versão." }, { status: 500 });

  const document: DocPageEntry = {
    slug: snapshot.slug, group: snapshot.group, title: snapshot.title, status: snapshot.status,
    body: snapshot.body, images: snapshot.images,
  };
  return NextResponse.json({ ok: true, updatedAt: data.updated_at, document });
}
