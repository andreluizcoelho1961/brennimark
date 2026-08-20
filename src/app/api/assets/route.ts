import { NextResponse } from "next/server";
import { brandvilleInstance } from "@/brandville/config";
import { getBrandvilleAuthContext } from "@/lib/brandville/server";

const isEnglish = brandvilleInstance.metadata.language === "en";

export async function GET() {
  const context = await getBrandvilleAuthContext();
  if (!context && process.env.NEXT_PUBLIC_SKIP_AUTH === "true" && brandvilleInstance.key === "hairline") {
    const files = [
      ["primary-color", "Primary logo — color", "Preferred horizontal signature in the Hairline primary palette.", "primary-color.png", 95104],
      ["primary-reverse", "Primary logo — reverse", "Horizontal signature for dark backgrounds.", "primary-reverse.png", 89218],
      ["primary-mono", "Primary logo — monochrome", "Single-color horizontal signature for constrained production.", "primary-mono.png", 93234],
      ["secondary-color", "Secondary logo — color", "Compact alternative signature in the Hairline primary palette.", "secondary-color.png", 194456],
      ["secondary-reverse", "Secondary logo — reverse", "Compact signature for dark backgrounds.", "secondary-reverse.png", 195097],
      ["secondary-mono", "Secondary logo — monochrome", "Single-color compact signature for constrained production.", "secondary-mono.png", 175935],
      ["symbol", "Hairline symbol", "Compact mark for avatars, app icons, and small identifiers.", "symbol.png", 95657],
    ] as const;
    return NextResponse.json({ assets: files.map(([id, label, description, file_name, size_bytes]) => ({
      id: `hairline-${id}`, label, description, category: "Logos", file_name,
      mime_type: "image/png", size_bytes, status: "approved", created_at: "2026-07-21T00:00:00.000Z",
      downloadUrl: `/brand/hairline/logos/${file_name}`,
    })) });
  }
  if (!context) return NextResponse.json({ message: isEnglish ? "Sign in to access the assets." : "Entre para acessar os assets." }, { status: 401 });
  const { data, error } = await context.supabase.from("brand_assets")
    .select("id, label, description, category, storage_path, file_name, mime_type, size_bytes, status, created_at")
    .eq("workspace_id", context.workspaceId).eq("instance_key", brandvilleInstance.key).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ message: isEnglish ? "Couldn't load assets." : "Não foi possível carregar os assets." }, { status: 500 });
  const assets = await Promise.all((data ?? []).map(async (asset) => {
    const { data: signed } = await context.supabase.storage.from("brand-assets").createSignedUrl(asset.storage_path, 3600);
    return {
      id: asset.id, label: asset.label, description: asset.description, category: asset.category,
      file_name: asset.file_name, mime_type: asset.mime_type, size_bytes: asset.size_bytes,
      status: asset.status, created_at: asset.created_at, downloadUrl: signed?.signedUrl ?? null,
    };
  }));
  return NextResponse.json({ assets });
}
