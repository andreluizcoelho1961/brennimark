import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brandville/contexto-da-rota";
import { BUCKETS, pertenceAMarca } from "@/lib/storage/caminhos";

const isEnglish = inEnglish(PRODUCT_LOCALE);

/**
 * O download de um asset — registrado ANTES de o arquivo sair.
 *
 * ─── Por que existe ────────────────────────────────────────────────────────
 *
 * Até 14/09/2026 a biblioteca assinava um endereço de 1 hora para cada arquivo
 * da marca na hora de listar, e o clique em "Baixar" ia direto ao Storage. O
 * servidor sabia quem abriu a página, não quem baixou; e quem abria levava
 * links do acervo inteiro, repassáveis por uma hora. Decisão do André: o
 * download passa por aqui. Ver ADR-0007 §2.4, item 18.
 *
 * ─── A ordem, e por que registro que falha RECUSA o download ───────────────
 *
 * Registrar, e só então assinar. Na ordem inversa, uma falha ao gravar
 * deixaria o arquivo sair sem rastro — exatamente o caso que o registro existe
 * para impedir, e o que uma foundry perguntaria depois ("quem recebeu?").
 *
 * Recusar incomoda quem queria o logo. Mas o incômodo é visível e se resolve
 * tentando de novo; o download sem registro é invisível e não se desfaz.
 *
 * ─── Os 60 segundos ────────────────────────────────────────────────────────
 *
 * O endereço assinado vale o bastante para o navegador seguir o
 * redirecionamento e começar a transferência — que, uma vez começada, não
 * depende mais da validade. Mais que isso seria devolver o link repassável que
 * esta rota existe para tirar de circulação.
 */
const VALIDADE_DO_ENDERECO_S = 60;

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, workspaceId, brandId } = resolvido;

  // Os dois filtros, sempre — a mesma disciplina de `GET /api/assets`. A RLS
  // já esconde asset de marca que a pessoa não alcança; o filtro por marca
  // impede que um id válido de OUTRA marca da mesma pessoa seja servido sob o
  // endereço desta.
  const { data: asset } = await auth.supabase
    .from("brand_assets")
    .select("id, storage_path, file_name")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (!asset) {
    return NextResponse.json(
      { message: isEnglish ? "Asset not found." : "Asset não encontrado." },
      { status: 404 },
    );
  }

  // A RLS protege a LINHA; ela não protege o objeto do Storage. Um caminho
  // gravado errado assinaria o arquivo de outra marca com esta sessão.
  if (!pertenceAMarca(asset.storage_path, workspaceId, brandId)) {
    return NextResponse.json(
      { message: isEnglish ? "Asset not found." : "Asset não encontrado." },
      { status: 404 },
    );
  }

  // Só o identificador do asset. Pessoa, e-mail, marca, rótulo e nome do
  // arquivo são preenchidos pelo banco a partir da sessão — o que viesse daqui
  // seria descartado de qualquer forma. Ver a migration `registro_de_download`.
  const { error: erroDoRegistro } = await auth.supabase
    .from("brand_asset_downloads")
    .insert({ asset_id: asset.id, brand_id: brandId, workspace_id: workspaceId, pessoa: auth.user.id, pessoa_email: "", asset_label: "", file_name: "" });

  if (erroDoRegistro) {
    return NextResponse.json(
      {
        message: isEnglish
          ? "The download couldn't be recorded, so it wasn't started. Try again."
          : "Não foi possível registrar o download, então ele não foi iniciado. Tente de novo.",
      },
      { status: 503 },
    );
  }

  const { data: assinado } = await auth.supabase.storage
    .from(BUCKETS.assets)
    .createSignedUrl(asset.storage_path, VALIDADE_DO_ENDERECO_S, { download: asset.file_name });

  if (!assinado?.signedUrl) {
    return NextResponse.json(
      { message: isEnglish ? "Couldn't prepare the download." : "Não foi possível preparar o download." },
      { status: 500 },
    );
  }

  const resposta = NextResponse.redirect(assinado.signedUrl, 302);
  // O redirecionamento carrega um endereço assinado. Guardado em cache, ele
  // seria servido a outra pessoa — ou a esta, sem registrar de novo.
  resposta.headers.set("Cache-Control", "no-store");
  return resposta;
}
