import { NextResponse } from "next/server";
import { brandvilleInstance } from "@/brandville/config";
import { getBrandvilleAuthContext } from "@/lib/brandville/server";

const isEnglish = brandvilleInstance.metadata.language === "en";
const MAX_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml", "application/pdf", "application/zip", "application/postscript", "font/otf", "font/ttf", "font/woff", "font/woff2", "application/octet-stream"]);
async function ownerContext() { const context = await getBrandvilleAuthContext(); return context?.role === "owner" ? context : null; }
function safeName(name: string) { return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-160) || "asset"; }

export async function POST(request: Request) {
  const context = await ownerContext();
  if (!context) return NextResponse.json({ message: isEnglish ? "Only the owner can upload assets." : "Apenas o proprietário pode enviar assets." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const label = String(form.get("label") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const category = String(form.get("category") ?? (isEnglish ? "Other" : "Outros")).trim();
  if (!(file instanceof File) || !label || label.length > 120 || description.length > 500 || category.length > 80 || file.size < 1 || file.size > MAX_SIZE || !ALLOWED_TYPES.has(file.type || "application/octet-stream")) {
    return NextResponse.json({ message: isEnglish ? "Check the file and its details. The limit is 25 MB." : "Revise o arquivo e seus dados. O limite é 25 MB." }, { status: 400 });
  }
  const path = `${context.workspaceId}/${brandvilleInstance.key}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: uploadError } = await context.supabase.storage.from("brand-assets").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false, cacheControl: "3600" });
  if (uploadError) return NextResponse.json({ message: isEnglish ? "Couldn't upload the file." : "Não foi possível enviar o arquivo." }, { status: 500 });
  const { error } = await context.supabase.from("brand_assets").insert({
    workspace_id: context.workspaceId, instance_key: brandvilleInstance.key, label, description, category,
    storage_path: path, file_name: file.name.slice(0, 240), mime_type: file.type || "application/octet-stream",
    size_bytes: file.size, status: "ready", created_by: context.user.id,
  });
  if (error) {
    await context.supabase.storage.from("brand-assets").remove([path]);
    return NextResponse.json({ message: isEnglish ? "The file uploaded, but couldn't be registered." : "O arquivo chegou, mas não foi possível registrá-lo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const context = await ownerContext();
  if (!context) return NextResponse.json({ message: isEnglish ? "Only the owner can remove assets." : "Apenas o proprietário pode remover assets." }, { status: 403 });
  const input = await request.json().catch(() => null);
  const id = typeof input?.id === "string" ? input.id : "";
  const { data, error } = await context.supabase.from("brand_assets").select("storage_path").eq("id", id).eq("workspace_id", context.workspaceId).eq("instance_key", brandvilleInstance.key).maybeSingle();
  if (error || !data) return NextResponse.json({ message: isEnglish ? "Asset not found." : "Asset não encontrado." }, { status: 404 });
  const { error: storageError } = await context.supabase.storage.from("brand-assets").remove([data.storage_path]);
  if (storageError) return NextResponse.json({ message: isEnglish ? "Couldn't remove the file." : "Não foi possível remover o arquivo." }, { status: 500 });
  const { error: deleteError } = await context.supabase.from("brand_assets").delete().eq("id", id).eq("workspace_id", context.workspaceId);
  if (deleteError) return NextResponse.json({ message: isEnglish ? "The file was removed, but the catalog needs updating." : "O arquivo foi removido, mas o catálogo precisa ser atualizado." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
