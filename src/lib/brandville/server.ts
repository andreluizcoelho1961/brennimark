import type { SupabaseClient, User } from "@supabase/supabase-js";
import { activeDocsRegistry, brandvilleInstance } from "@/brandville/config";
import { parseDocBlocks } from "@/content/doc-blocks";
import type { DocPageEntry, DocPageImage, DocStatus } from "@/content/docs";
import { createClient } from "@/lib/supabase/server";

const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

export type BrandvilleAuthContext = {
  supabase: SupabaseClient;
  user: User;
  workspaceId: string;
  role: "owner" | "member";
};

export async function getBrandvilleAuthContext(): Promise<BrandvilleAuthContext | null> {
  if (SKIP_AUTH) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.workspace_id || (data.role !== "owner" && data.role !== "member")) return null;
  return { supabase, user, workspaceId: data.workspace_id, role: data.role };
}

function validStatus(value: unknown): value is DocStatus {
  return value === "ready" || value === "draft" || value === "pending";
}

function validBody(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function validImages(value: unknown): value is DocPageImage[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const image = item as Record<string, unknown>;
    return typeof image.src === "string" && typeof image.alt === "string" &&
      (image.caption === undefined || typeof image.caption === "string");
  });
}

export async function getResolvedBrandDocs(context?: BrandvilleAuthContext | null): Promise<DocPageEntry[]> {
  const auth = context === undefined ? await getBrandvilleAuthContext() : context;
  if (!auth) return [...activeDocsRegistry];

  const { data, error } = await auth.supabase
    .from("brand_documents")
    .select("slug, group_name, title, status, body, images, blocks, sort_order")
    .eq("workspace_id", auth.workspaceId)
    .eq("instance_key", brandvilleInstance.key);
  if (error) throw error;

  const overrides = new Map((data ?? []).map((row) => [row.slug, row]));
  return activeDocsRegistry.map((base, index) => {
    const row = overrides.get(base.slug);
    if (!row) return base;
    return {
      slug: base.slug,
      group: typeof row.group_name === "string" ? row.group_name : base.group,
      title: typeof row.title === "string" ? row.title : base.title,
      status: validStatus(row.status) ? row.status : base.status,
      body: validBody(row.body) ? row.body : base.body,
      images: validImages(row.images) ? row.images : base.images,
      blocks: parseDocBlocks(row.blocks) ?? base.blocks,
      sortOrder: typeof row.sort_order === "number" ? row.sort_order : index,
    } as DocPageEntry & { sortOrder: number };
  });
}

export async function getResolvedBrandDoc(slug: string): Promise<DocPageEntry | undefined> {
  const docs = await getResolvedBrandDocs();
  return docs.find((entry) => entry.slug === slug);
}
