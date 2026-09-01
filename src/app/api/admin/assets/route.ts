import { NextResponse } from "next/server";
import { brandvilleInstance } from "@/brandville/config";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { autenticacaoDaRota } from "@/lib/brandville/contexto-da-rota";

// Mensagem de erro é do produto, não do manual: quem lê é quem está usando o
// Brennimark. Enquanto a preferência de idioma não tem onde ser guardada, o
// padrão do produto responde por todo mundo — e a fonte é uma só.
const isEnglish = inEnglish(PRODUCT_LOCALE);
const MAX_SIZE = 25 * 1024 * 1024;
// Tipo declarado pelo cliente é uma pista, não prova. Cada entrada traz as
// assinaturas de bytes que o conteúdo precisa apresentar para ser aceito.
// `application/octet-stream` foi removido: como também era o fallback quando o
// navegador não declarava tipo, sua presença tornava a allowlist inócua.
const MAGIC: Record<string, string[]> = {
  "image/jpeg": ["ffd8ff"],
  "image/png": ["89504e47"],
  "image/webp": ["52494646"], // RIFF; o marcador WEBP é conferido à parte
  "application/pdf": ["25504446"],
  "application/zip": ["504b0304", "504b0506", "504b0708"],
  "application/postscript": ["25215053", "c5d0d3c6"],
  "font/otf": ["4f54544f"],
  "font/ttf": ["00010000", "74727565"],
  "font/woff": ["774f4646"],
  "font/woff2": ["774f4632"],
};
// SVG e XML, não binário: não tem assinatura de bytes confiável. É aceito com
// checagem textual e servido exclusivamente como download (ver createSignedUrl
// em /api/assets), porque SVG é executável quando renderizado inline.
const SVG_TYPE = "image/svg+xml";
const ALLOWED_TYPES = new Set([...Object.keys(MAGIC), SVG_TYPE]);

/** Confere se os primeiros bytes correspondem ao tipo declarado. */
async function contentMatchesType(file: File, declaredType: string): Promise<boolean> {
  if (declaredType === SVG_TYPE) {
    const head = (await file.slice(0, 512).text()).trimStart().toLowerCase();
    return head.startsWith("<?xml") || head.startsWith("<svg") || head.startsWith("<!doctype svg");
  }
  const signatures = MAGIC[declaredType];
  if (!signatures) return false;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const hex = Array.from(head, (b) => b.toString(16).padStart(2, "0")).join("");
  if (!signatures.some((signature) => hex.startsWith(signature))) return false;
  // RIFF cobre vários formatos; exigir o marcador WEBP nos bytes 8-11.
  if (declaredType === "image/webp") return hex.slice(16, 24) === "57454250";
  return true;
}
/**
 * Dono do workspace resolvido pela requisição.
 *
 * Devolve a resposta da resolução quando ela não é "pronto": com duas contas
 * alcançáveis, a rota respondia 401 e mandava entrar de novo numa sessão que já
 * era válida. A migração desta rota para `brand_id` é o M2; a ambiguidade é do
 * M1 e não podia ficar esperando.
 */
async function ownerContext(request: Request) {
  const r = await autenticacaoDaRota(request);
  if (!r.ok) return { ok: false as const, resposta: r.resposta };
  if (r.contexto.role !== "owner") return { ok: false as const, resposta: null };
  return { ok: true as const, contexto: r.contexto };
}
function safeName(name: string) { return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-160) || "asset"; }

export async function POST(request: Request) {
  const resolvido = await ownerContext(request);
  if (!resolvido.ok && resolvido.resposta) return resolvido.resposta;
  const context = resolvido.ok ? resolvido.contexto : null;
  if (!context) return NextResponse.json({ message: isEnglish ? "Only the owner can upload assets." : "Apenas o proprietário pode enviar assets." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const label = String(form.get("label") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const category = String(form.get("category") ?? (isEnglish ? "Other" : "Outros")).trim();
  if (!(file instanceof File) || !label || label.length > 120 || description.length > 500 || category.length > 80 || file.size < 1 || file.size > MAX_SIZE || !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ message: isEnglish ? "Check the file and its details. The limit is 25 MB." : "Revise o arquivo e seus dados. O limite é 25 MB." }, { status: 400 });
  }
  if (!(await contentMatchesType(file, file.type))) {
    return NextResponse.json({ message: isEnglish ? "The file content doesn't match its declared type." : "O conteúdo do arquivo não corresponde ao tipo declarado." }, { status: 400 });
  }
  const path = `${context.workspaceId}/${brandvilleInstance.key}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: uploadError } = await context.supabase.storage.from("brand-assets").upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
  if (uploadError) return NextResponse.json({ message: isEnglish ? "Couldn't upload the file." : "Não foi possível enviar o arquivo." }, { status: 500 });
  const { error } = await context.supabase.from("brand_assets").insert({
    workspace_id: context.workspaceId, instance_key: brandvilleInstance.key, label, description, category,
    storage_path: path, file_name: file.name.slice(0, 240), mime_type: file.type,
    size_bytes: file.size, status: "ready", created_by: context.user.id,
  });
  if (error) {
    await context.supabase.storage.from("brand-assets").remove([path]);
    return NextResponse.json({ message: isEnglish ? "The file uploaded, but couldn't be registered." : "O arquivo chegou, mas não foi possível registrá-lo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const resolvido = await ownerContext(request);
  if (!resolvido.ok && resolvido.resposta) return resolvido.resposta;
  const context = resolvido.ok ? resolvido.contexto : null;
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
