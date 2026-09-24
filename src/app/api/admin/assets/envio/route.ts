import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brandville/contexto-da-rota";
import { BUCKETS, caminhoDeAsset } from "@/lib/storage/caminhos";
import { conferirEixos, ehTipoDeItem, lerEixos, rotulo } from "@/lib/assets/eixos";
import { TAMANHO_MAXIMO_DE_MATERIAL, TIPOS_ACEITOS } from "@/lib/assets/conferir-arquivo";
import { PRAZO_DO_ENVIO_MS, assinarEnvio } from "@/lib/assets/envio";

const isEnglish = inEnglish(PRODUCT_LOCALE);

/**
 * PREPARAR o envio de um material — passo 1 de 2 (24/09/2026).
 *
 * O arquivo não passa por aqui: ele vai do navegador DIRETO ao Storage. Esta
 * rota confere tudo o que dá para conferir antes de ele sair do computador da
 * pessoa — item desta marca, eixos do tipo, tipo aceito, tamanho —, ESCOLHE o
 * caminho (nunca o cliente) e devolve:
 *
 *   - um endereço de envio assinado que só serve para ESSE caminho, sem
 *     sobrescrever (é o Storage quem garante);
 *   - a autorização assinada que o passo 2 (`POST /api/admin/assets`) exige,
 *     com tudo o que foi validado aqui.
 *
 * O conteúdo real é conferido no passo 2, sobre os bytes que chegaram.
 */
export async function POST(request: Request) {
  const r = await marcaDaRota(request);
  if (!r.ok) return r.resposta;
  if (r.papel !== "owner") {
    return NextResponse.json({ message: isEnglish ? "Only the owner can upload assets." : "Apenas o proprietário pode enviar assets." }, { status: 403 });
  }
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) {
    return NextResponse.json({ message: isEnglish ? "Uploads aren't configured on this server." : "O envio não está configurado neste servidor." }, { status: 503 });
  }

  const corpo = await request.json().catch(() => null);
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const label = texto(corpo?.label);
  const description = texto(corpo?.description);
  const itemId = texto(corpo?.item);
  const substitui = texto(corpo?.substitui) || null;
  const fileName = texto(corpo?.fileName).slice(0, 240);
  const mimeType = texto(corpo?.mimeType);
  const sizeBytes = Number(corpo?.sizeBytes);

  if (!label || label.length > 120 || description.length > 500 || !itemId || !fileName || !TIPOS_ACEITOS.has(mimeType)
      || !Number.isInteger(sizeBytes) || sizeBytes < 1) {
    return NextResponse.json({ message: isEnglish ? "Check the file and its details." : "Revise o arquivo e seus dados." }, { status: 400 });
  }
  if (sizeBytes > TAMANHO_MAXIMO_DE_MATERIAL) {
    return NextResponse.json({ message: isEnglish ? "The limit is 25 MB per file." : "O limite é 25 MB por arquivo." }, { status: 413 });
  }

  // O item e os eixos ANTES de o arquivo subir: a recusa custa uma requisição
  // curta, e diz QUAL eixo falta. A autoridade continua sendo o banco.
  const { data: item } = await r.auth.supabase.from("brand_asset_items")
    .select("id, tipo").eq("id", itemId).eq("workspace_id", r.workspaceId).eq("brand_id", r.brandId).maybeSingle();
  if (!item || !ehTipoDeItem(item.tipo)) {
    return NextResponse.json({ message: isEnglish ? "Choose an item of this brand." : "Escolha um item desta marca." }, { status: 400 });
  }
  const lidos = lerEixos((nome) => corpo?.[nome]);
  if ("invalido" in lidos) {
    return NextResponse.json({ message: isEnglish ? `Invalid value for ${rotulo(lidos.invalido, true)}.` : `Valor inválido para ${rotulo(lidos.invalido, false)}.` }, { status: 400 });
  }
  const conferencia = conferirEixos(item.tipo, lidos.eixos);
  if (!conferencia.ok) {
    const message = conferencia.motivo === "exige-termo"
      ? (isEnglish ? "Fonts can only be uploaded after the license term is signed." : "Fonte só pode ser enviada depois de assinado o termo de licença.")
      : conferencia.motivo === "falta"
        ? (isEnglish ? `${rotulo(item.tipo, true)} needs ${rotulo(conferencia.eixo, true).toLowerCase()}.` : `${rotulo(item.tipo, false)} precisa de ${rotulo(conferencia.eixo, false).toLowerCase()}.`)
        : (isEnglish ? `${rotulo(conferencia.eixo, true)} doesn't apply to ${rotulo(item.tipo, true).toLowerCase()}.` : `${rotulo(conferencia.eixo, false)} não se aplica a ${rotulo(item.tipo, false).toLowerCase()}.`);
    return NextResponse.json({ message }, { status: 400 });
  }

  // O caminho só carrega identificadores imutáveis — e é escolhido AQUI.
  const caminho = caminhoDeAsset(r.workspaceId, r.brandId, fileName, crypto.randomUUID());
  // Assinado com a SESSÃO: a policy de envio do bucket (quem edita a marca, na
  // pasta dela) continua sendo a porta. O endereço vale só para este caminho.
  const { data: envio, error } = await r.auth.supabase.storage.from(BUCKETS.assets).createSignedUploadUrl(caminho);
  if (error || !envio) {
    return NextResponse.json({ message: isEnglish ? "Couldn't prepare the upload." : "Não foi possível preparar o envio." }, { status: error?.message?.includes("row-level") ? 403 : 500 });
  }

  const autorizacao = assinarEnvio({
    workspaceId: r.workspaceId, brandId: r.brandId, userId: r.auth.user.id, itemId: item.id,
    caminho, label, description, fileName, mimeType, sizeBytes, eixos: lidos.eixos, substitui,
    expira: Date.now() + PRAZO_DO_ENVIO_MS,
  }, chave);

  return NextResponse.json(
    { autorizacao, caminho, token: envio.token },
    { headers: { "Cache-Control": "no-store" } },
  );
}
