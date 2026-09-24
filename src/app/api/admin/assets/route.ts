import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brandville/contexto-da-rota";
import { BUCKETS, caminhoDeAsset, caminhoDeMiniatura } from "@/lib/storage/caminhos";
import { drenarFilaDeExclusao } from "@/lib/import/limpeza";
import { decidirRemocao } from "@/lib/assets/remocao";
import { conferirEixos, ehTipoDeItem, lerEixos, motivoDaRecusa, rotulo } from "@/lib/assets/eixos";

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
/**
 * A miniatura: PNG pequeno, gerado no navegador de quem envia (fatia 5). Não é
 * obrigatória — EPS e AI sem compatibilidade PDF não geram —, e falhar em
 * guardá-la não derruba o envio do original.
 */
const MAX_MINIATURA = 512 * 1024;
async function miniaturaAceitavel(valor: FormDataEntryValue | null): Promise<File | null> {
  if (!(valor instanceof File) || valor.size < 1 || valor.size > MAX_MINIATURA || valor.type !== "image/png") return null;
  return (await contentMatchesType(valor, "image/png")) ? valor : null;
}
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
  const r = await marcaDaRota(request);
  if (!r.ok) return { ok: false as const, resposta: r.resposta };
  if (r.papel !== "owner") return { ok: false as const, resposta: null };
  return { ok: true as const, contexto: r };
}

export async function POST(request: Request) {
  const resolvido = await ownerContext(request);
  if (!resolvido.ok && resolvido.resposta) return resolvido.resposta;
  const context = resolvido.ok ? resolvido.contexto : null;
  if (!context) return NextResponse.json({ message: isEnglish ? "Only the owner can upload assets." : "Apenas o proprietário pode enviar assets." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const label = String(form.get("label") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const itemId = String(form.get("item") ?? "").trim();
  // Opcional: o asset que este arquivo vem substituir. Vazio é o caso comum —
  // nem todo upload troca alguma coisa.
  const substitui = String(form.get("substitui") ?? "").trim();
  if (!(file instanceof File) || !label || label.length > 120 || description.length > 500 || !itemId || file.size < 1 || file.size > MAX_SIZE || !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ message: isEnglish ? "Check the file and its details. The limit is 25 MB." : "Revise o arquivo e seus dados. O limite é 25 MB." }, { status: 400 });
  }

  /*
   * O item e os eixos, conferidos ANTES de o arquivo subir.
   *
   * O banco recusaria de qualquer jeito — mas depois de 25 MB irem para o
   * Storage e voltarem apagados. Conferir aqui é o que deixa a recusa custar
   * uma requisição curta, e dizer QUAL eixo falta em vez de "não foi possível".
   * A autoridade continua sendo o gatilho do banco (ver `lib/assets/eixos.ts`).
   */
  const { data: item } = await context.auth.supabase.from("brand_asset_items")
    .select("id, tipo").eq("id", itemId).eq("brand_id", context.brandId).maybeSingle();
  if (!item || !ehTipoDeItem(item.tipo)) {
    return NextResponse.json({ message: isEnglish ? "Choose an item of this brand." : "Escolha um item desta marca." }, { status: 400 });
  }
  const lidos = lerEixos((nome) => form.get(nome));
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
  if (!(await contentMatchesType(file, file.type))) {
    return NextResponse.json({ message: isEnglish ? "The file content doesn't match its declared type." : "O conteúdo do arquivo não corresponde ao tipo declarado." }, { status: 400 });
  }
  // O caminho só carrega identificadores imutáveis. Com a chave da marca ali,
  // renomeá-la deixaria todo arquivo já enviado num caminho que não
  // corresponde mais a nada — e nem a listagem nem a exclusão os encontrariam.
  const path = caminhoDeAsset(context.workspaceId, context.brandId, file.name, crypto.randomUUID());
  const { error: uploadError } = await context.auth.supabase.storage.from(BUCKETS.assets).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
  if (uploadError) return NextResponse.json({ message: isEnglish ? "Couldn't upload the file." : "Não foi possível enviar o arquivo." }, { status: 500 });

  let miniaturaPath: string | null = null;
  const miniatura = await miniaturaAceitavel(form.get("miniatura"));
  if (miniatura) {
    const caminho = caminhoDeMiniatura(context.workspaceId, context.brandId, crypto.randomUUID());
    const { error: erroDaMiniatura } = await context.auth.supabase.storage.from(BUCKETS.assets)
      .upload(caminho, miniatura, { contentType: "image/png", upsert: false, cacheControl: "3600" });
    if (!erroDaMiniatura) miniaturaPath = caminho;
  }
  const { error } = await context.auth.supabase.from("brand_assets").insert({
    workspace_id: context.workspaceId, brand_id: context.brandId, item_id: item.id, label, description,
    ...lidos.eixos,
    storage_path: path, file_name: file.name.slice(0, 240), mime_type: file.type,
    size_bytes: file.size, status: "ready", created_by: context.auth.user.id,
    miniatura_path: miniaturaPath,
  });
  if (error) {
    await context.auth.supabase.storage.from(BUCKETS.assets).remove(miniaturaPath ? [path, miniaturaPath] : [path]);
    // A recusa do banco com nome conhecido é erro de quem enviou, e diz o quê.
    // Só o que não se reconhece continua sendo "não foi possível".
    const motivo = motivoDaRecusa(`${error.message} ${error.details ?? ""}`);
    if (motivo) return NextResponse.json({ message: isEnglish ? "The library refused this file's details. Review the item and its fields." : "A biblioteca recusou os dados deste arquivo. Revise o item e os campos." , motivo }, { status: 400 });
    return NextResponse.json({ message: isEnglish ? "The file uploaded, but couldn't be registered." : "O arquivo chegou, mas não foi possível registrá-lo." }, { status: 500 });
  }

  /*
   * A substituição, quando pedida — e o que acontece se ela falhar.
   *
   * Marcar o antigo ANTES de o novo existir deixaria, numa falha do upload, um
   * asset descontinuado apontando para nada: a marca perde o logo em uso sem
   * ter ganhado o substituto. Nesta ordem o pior caso é os dois ficarem em uso,
   * que é visível na tela e desfazível num clique.
   *
   * Por isso a falha aqui não é 500: o arquivo entrou, e mandar tentar de novo
   * subiria o mesmo arquivo duas vezes. A resposta diz o que ficou por fazer.
   */
  let substituicao: "feita" | "nao-pedida" | "falhou" = "nao-pedida";
  if (substitui) {
    const { data: novo } = await context.auth.supabase.from("brand_assets")
      .select("id").eq("storage_path", path).maybeSingle();
    const { error: erroDaTroca } = await context.auth.supabase.from("brand_assets")
      .update({
        descontinuado_em: new Date().toISOString(),
        descontinuado_por: context.auth.user.id,
        substituido_por: novo?.id ?? null,
      })
      .eq("id", substitui).eq("brand_id", context.brandId);
    substituicao = erroDaTroca ? "falhou" : "feita";
  }

  return NextResponse.json({ ok: true, substituicao }, { status: 201 });
}

/**
 * Descontinuar — o que o botão da biblioteca faz agora.
 *
 * Até 13/09/2026 este método apagava: a linha saía e o arquivo ia para a fila
 * de exclusão. Isso contradizia o CLAUDE.md ("nunca apagar asset em silêncio")
 * e o que o produto vende — uma plataforma de governança que perde a versão
 * anterior do logo não governa, esquece.
 *
 * Agora o asset é marcado, continua visível e continua baixável. O apagamento
 * definitivo não sumiu: virou `?definitivo=1`, e só alcança o que JÁ está
 * descontinuado. Dois passos deliberados em vez de um clique — é a diferença
 * entre apagar de propósito e apagar sem querer.
 */
export async function DELETE(request: Request) {
  const resolvido = await ownerContext(request);
  if (!resolvido.ok && resolvido.resposta) return resolvido.resposta;
  const context = resolvido.ok ? resolvido.contexto : null;
  if (!context) return NextResponse.json({ message: isEnglish ? "Only the owner can remove assets." : "Apenas o proprietário pode remover assets." }, { status: 403 });
  const input = await request.json().catch(() => null);
  const id = typeof input?.id === "string" ? input.id : "";
  const definitivo = new URL(request.url).searchParams.get("definitivo") === "1";

  // O estado atual do asset, e só dele: os dois filtros garantem que ele é
  // desta marca antes de qualquer decisão.
  const { data: alvo } = await context.auth.supabase.from("brand_assets")
    .select("id, descontinuado_em").eq("id", id).eq("brand_id", context.brandId).maybeSingle();
  if (!alvo) return NextResponse.json({ message: isEnglish ? "Asset not found." : "Asset não encontrado." }, { status: 404 });

  // A decisão vive em `lib/assets/remocao.ts`, onde a suíte de unidade
  // alcança. Aqui ficam só os efeitos.
  const decisao = decidirRemocao({ definitivo, descontinuadoEm: alvo.descontinuado_em });

  if (decisao.acao === "recusar") {
    return NextResponse.json({
      message: decisao.motivo === "precisa-descontinuar-antes"
        ? (isEnglish ? "Discontinue the asset before deleting it for good." : "Descontinue o asset antes de removê-lo em definitivo.")
        : (isEnglish ? "This asset is already discontinued." : "Este asset já está descontinuado."),
    }, { status: 409 });
  }

  if (decisao.acao === "descontinuar") {
    const { error } = await context.auth.supabase.from("brand_assets")
      .update({ descontinuado_em: new Date().toISOString(), descontinuado_por: context.auth.user.id })
      .eq("id", id).eq("brand_id", context.brandId);
    if (error) return NextResponse.json({ message: isEnglish ? "Couldn't discontinue." : "Não foi possível descontinuar." }, { status: 500 });
    return NextResponse.json({ ok: true, descontinuado: true });
  }

  const { error } = await context.auth.supabase.rpc("delete_asset_with_file", { p_asset_id: id });
  if (error) return NextResponse.json({ message: isEnglish ? "Asset not found." : "Asset não encontrado." }, { status: 404 });

  const fila = await drenarFilaDeExclusao(context.auth);
  // A falha do Storage não é erro da requisição: o registro já saiu e o
  // arquivo está enfileirado. Dizer 500 aqui faria quem apagou tentar de novo
  // uma operação que já funcionou.
  return NextResponse.json({ ok: true, arquivosPendentes: fila.pendentes });
}

/**
 * Reativar um asset descontinuado — desfazer, que é o par de descontinuar.
 *
 * Sem isto, "descontinuar" seria irreversível pela interface, e a pessoa que
 * errou o card teria de subir o arquivo de novo — criando uma segunda cópia da
 * mesma coisa, que é como um acervo vira uma pasta bagunçada.
 */
export async function PATCH(request: Request) {
  const resolvido = await ownerContext(request);
  if (!resolvido.ok && resolvido.resposta) return resolvido.resposta;
  const context = resolvido.ok ? resolvido.contexto : null;
  if (!context) return NextResponse.json({ message: isEnglish ? "Only the owner can change assets." : "Apenas o proprietário pode alterar assets." }, { status: 403 });
  const input = await request.json().catch(() => null);
  const id = typeof input?.id === "string" ? input.id : "";

  const { data, error } = await context.auth.supabase.from("brand_assets")
    // `substituido_por` sai junto: um asset em uso que ainda apontasse para o
    // sucessor diria "fui trocado e continuo valendo". A trava do banco recusa
    // esse estado, e limpar aqui é o que faz a reativação passar.
    .update({ descontinuado_em: null, descontinuado_por: null, substituido_por: null })
    .eq("id", id).eq("brand_id", context.brandId).not("descontinuado_em", "is", null)
    .select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ message: isEnglish ? "Asset not found." : "Asset não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true, reativado: true });
}
