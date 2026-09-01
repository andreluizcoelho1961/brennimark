import { NextResponse } from "next/server";
import { brandvilleInstance } from "@/brandville/config";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { autenticacaoDaRota } from "@/lib/brandville/contexto-da-rota";

// Mensagem de erro é do produto, não do manual: quem lê é quem está usando o
// Brennimark. Enquanto a preferência de idioma não tem onde ser guardada, o
// padrão do produto responde por todo mundo — e a fonte é uma só.
const isEnglish = inEnglish(PRODUCT_LOCALE);

export async function GET(request: Request) {
  const resolvido = await autenticacaoDaRota(request);
  // 409 com as opções quando há mais de uma conta: antes isso virava 401, que
  // é falso — a sessão está válida, falta dizer qual conta.
  if (!resolvido.ok) return resolvido.resposta;
  const context = resolvido.contexto;
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
