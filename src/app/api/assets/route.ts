import { NextResponse } from "next/server";
import { brandvilleInstance } from "@/brandville/config";
import { getBrandvilleAuthContext } from "@/lib/brandville/server";

const isEnglish = brandvilleInstance.metadata.language === "en";

export async function GET() {
  const context = await getBrandvilleAuthContext();
  if (!context) return NextResponse.json({ message: isEnglish ? "Sign in to access the assets." : "Entre para acessar os assets." }, { status: 401 });
  const { data, error } = await context.supabase.from("brand_assets")
    .select("id, label, description, category, storage_path, file_name, mime_type, size_bytes, status, created_at")
    .eq("workspace_id", context.workspaceId).eq("instance_key", brandvilleInstance.key).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ message: isEnglish ? "Couldn't load assets." : "Não foi possível carregar os assets." }, { status: 500 });
  const assets = await Promise.all((data ?? []).map(async (asset) => {
    const { data: signed } = await context.supabase.storage.from("brand-assets").createSignedUrl(asset.storage_path, 3600, { download: asset.file_name });
    return {
      id: asset.id, label: asset.label, description: asset.description, category: asset.category,
      file_name: asset.file_name, mime_type: asset.mime_type, size_bytes: asset.size_bytes,
      status: asset.status, created_at: asset.created_at, downloadUrl: signed?.signedUrl ?? null,
    };
  }));
  return NextResponse.json({ assets });
}
