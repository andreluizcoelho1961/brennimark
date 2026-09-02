import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brandville/contexto-da-rota";
import { BUCKETS, pertenceAMarca } from "@/lib/storage/caminhos";

// Mensagem de erro é do produto, não do manual: quem lê é quem está usando o
// Brennimark. Enquanto a preferência de idioma não tem onde ser guardada, o
// padrão do produto responde por todo mundo — e a fonte é uma só.
const isEnglish = inEnglish(PRODUCT_LOCALE);

export async function GET(request: Request) {
  const resolvido = await marcaDaRota(request);
  // 409 com as opções quando há mais de uma conta: antes isso virava 401, que
  // é falso — a sessão está válida, falta dizer qual conta.
  if (!resolvido.ok) return resolvido.resposta;
  const { auth: context, workspaceId, brandId } = resolvido;

  // Os dois filtros, sempre. `brand_id` sozinho bastaria pela FK composta, mas
  // deixar o workspace de fora tornaria a consulta dependente de uma garantia
  // que vive em outro arquivo — e consultas viajam para outros arquivos.
  const { data, error } = await context.supabase.from("brand_assets")
    .select("id, label, description, category, storage_path, file_name, mime_type, size_bytes, status, created_at")
    .eq("workspace_id", workspaceId).eq("brand_id", brandId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ message: isEnglish ? "Couldn't load assets." : "Não foi possível carregar os assets." }, { status: 500 });
  const assets = await Promise.all((data ?? []).map(async (asset) => {
    // Assinar só o que está dentro da pasta desta marca. A RLS protege a LINHA
    // do banco; ela não protege o objeto do Storage, e um `storage_path`
    // gravado errado assinaria o arquivo de outra marca com a sessão de quem
    // tem direito a esta.
    const signed = pertenceAMarca(asset.storage_path, workspaceId, brandId)
      ? (await context.supabase.storage.from(BUCKETS.assets)
          .createSignedUrl(asset.storage_path, 3600, { download: asset.file_name })).data
      : null;
    return {
      id: asset.id, label: asset.label, description: asset.description, category: asset.category,
      file_name: asset.file_name, mime_type: asset.mime_type, size_bytes: asset.size_bytes,
      status: asset.status, created_at: asset.created_at, downloadUrl: signed?.signedUrl ?? null,
    };
  }));
  return NextResponse.json({ assets });
}
