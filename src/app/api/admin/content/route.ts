import { NextResponse } from "next/server";
import { activeDocsRegistry, brandvilleInstance } from "@/brandville/config";
import type { DocStatus } from "@/content/docs";
import { parseDocBlocks } from "@/content/doc-blocks";
import { getBrandvilleAuthContext, validImages } from "@/lib/brandville/server";

const isEnglish = brandvilleInstance.metadata.language === "en";
const VALID_STATUS = new Set<DocStatus>(["ready", "draft", "pending"]);

async function ownerContext() {
  const context = await getBrandvilleAuthContext();
  return context?.role === "owner" ? context : null;
}

export async function PUT(request: Request) {
  const context = await ownerContext();
  if (!context) return NextResponse.json({ message: isEnglish ? "Only the owner can edit the guide." : "Apenas o proprietário pode editar o guia." }, { status: 403 });
  const input = await request.json().catch(() => null);
  const slug = typeof input?.slug === "string" ? input.slug : "";
  const base = activeDocsRegistry.find((entry) => entry.slug === slug);
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const group = typeof input?.group === "string" ? input.group.trim() : "";
  const status = input?.status as DocStatus;
  const body: string[] | null = Array.isArray(input?.body) ? input.body.map((item: unknown) => String(item).trim()).filter(Boolean) : null;
  if (!base || !title || title.length > 120 || !brandvilleInstance.navigation.groups.includes(group) || !VALID_STATUS.has(status) || !body || body.length > 40 || body.some((item) => item.length > 4000)) {
    return NextResponse.json({ message: isEnglish ? "Check the title, section, status, and paragraphs." : "Revise o título, a seção, o status e os parágrafos." }, { status: 400 });
  }
  // The editor only edits text. Anything already persisted for this page —
  // blocks and images — has to survive the upsert instead of being reset to
  // the matrix, which would silently discard published visual content.
  const { data: persisted } = await context.supabase
    .from("brand_documents")
    .select("images, blocks")
    .eq("workspace_id", context.workspaceId)
    .eq("instance_key", brandvilleInstance.key)
    .eq("slug", slug)
    .maybeSingle();

  const { data, error } = await context.supabase.from("brand_documents").upsert({
    workspace_id: context.workspaceId, instance_key: brandvilleInstance.key, slug, group_name: group, title, status, body,
    images: validImages(persisted?.images) ? persisted.images : (base.images ?? []),
    blocks: parseDocBlocks(persisted?.blocks) ?? base.blocks ?? [],
    sort_order: activeDocsRegistry.findIndex((entry) => entry.slug === slug),
    updated_by: context.user.id, updated_at: new Date().toISOString(),
  }, { onConflict: "workspace_id,instance_key,slug" }).select("updated_at").single();
  if (error) return NextResponse.json({ message: isEnglish ? "Couldn't save the page." : "Não foi possível salvar a página." }, { status: 500 });
  return NextResponse.json({ ok: true, updatedAt: data.updated_at });
}

export async function DELETE(request: Request) {
  const context = await ownerContext();
  if (!context) return NextResponse.json({ message: isEnglish ? "Only the owner can restore pages." : "Apenas o proprietário pode restaurar páginas." }, { status: 403 });
  const input = await request.json().catch(() => null);
  const slug = typeof input?.slug === "string" ? input.slug : "";
  if (!activeDocsRegistry.some((entry) => entry.slug === slug)) return NextResponse.json({ message: isEnglish ? "Invalid page." : "Página inválida." }, { status: 400 });
  const { error } = await context.supabase.from("brand_documents").delete().eq("workspace_id", context.workspaceId).eq("instance_key", brandvilleInstance.key).eq("slug", slug);
  if (error) return NextResponse.json({ message: isEnglish ? "Couldn't restore the page." : "Não foi possível restaurar a página." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
