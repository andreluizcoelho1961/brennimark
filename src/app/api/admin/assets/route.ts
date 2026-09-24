import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brandville/contexto-da-rota";
import { BUCKETS, caminhoDeMiniatura } from "@/lib/storage/caminhos";
import { drenarFilaDeExclusao } from "@/lib/import/limpeza";
import { decidirRemocao } from "@/lib/assets/remocao";
import { motivoDaRecusa } from "@/lib/assets/eixos";
import { BYTES_DO_COMECO, TAMANHO_MAXIMO_DE_MATERIAL, conteudoConfere } from "@/lib/assets/conferir-arquivo";
import { lerEnvio, tamanhoDoContentRange } from "@/lib/assets/envio";

// Mensagem de erro é do produto, não do manual: quem lê é quem está usando o
// Brennimark. Enquanto a preferência de idioma não tem onde ser guardada, o
// padrão do produto responde por todo mundo — e a fonte é uma só.
const isEnglish = inEnglish(PRODUCT_LOCALE);
/**
 * A miniatura: PNG pequeno, gerado no navegador de quem envia (fatia 5). Não é
 * obrigatória — EPS e AI sem compatibilidade PDF não geram —, e falhar em
 * guardá-la não derruba o envio do original. Pequena o bastante para ainda
 * atravessar a função; o original, não.
 */
const MAX_MINIATURA = 512 * 1024;
async function miniaturaAceitavel(valor: FormDataEntryValue | null): Promise<File | null> {
  if (!(valor instanceof File) || valor.size < 1 || valor.size > MAX_MINIATURA || valor.type !== "image/png") return null;
  return conteudoConfere(new Uint8Array(await valor.slice(0, BYTES_DO_COMECO).arrayBuffer()), "image/png") ? valor : null;
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

/**
 * CONCLUIR o envio de um material — passo 2 de 2 (24/09/2026).
 *
 * O arquivo já está no Storage: o navegador o mandou direto, pelo endereço que
 * o passo 1 (`/api/admin/assets/envio`) assinou para UM caminho. Aqui chega só
 * a autorização assinada — e a miniatura, que é pequena. Nada do que o cliente
 * mandar de novo é usado: caminho, item, eixos e nome vêm da autorização.
 *
 * Antes de registrar, a rota lê os primeiros bytes e o tamanho REAIS do que
 * chegou. Enquanto a variante não existe, a policy do bucket deixa quem edita
 * a marca ler o arquivo; depois de registrada, só pela rota que registra
 * download. Conteúdo que não confere, ou tamanho diferente do declarado, apaga
 * o arquivo e recusa.
 */
export async function POST(request: Request) {
  const resolvido = await ownerContext(request);
  if (!resolvido.ok && resolvido.resposta) return resolvido.resposta;
  const context = resolvido.ok ? resolvido.contexto : null;
  if (!context) return NextResponse.json({ message: isEnglish ? "Only the owner can upload assets." : "Apenas o proprietário pode enviar assets." }, { status: 403 });
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) return NextResponse.json({ message: isEnglish ? "Uploads aren't configured on this server." : "O envio não está configurado neste servidor." }, { status: 503 });

  const form = await request.formData();
  const leitura = lerEnvio(form.get("autorizacao"), chave, {
    userId: context.auth.user.id, workspaceId: context.workspaceId, brandId: context.brandId,
  });
  if (!leitura.ok) {
    return NextResponse.json({
      message: leitura.motivo === "expirado"
        ? (isEnglish ? "The upload took too long. Send the file again." : "O envio demorou demais. Envie o arquivo de novo.")
        : (isEnglish ? "This upload isn't valid." : "Este envio não é válido."),
    }, { status: 400 });
  }
  const envio = leitura.dados;
  const path = envio.caminho;
  const apagar = (caminhos: string[]) => context.auth.supabase.storage.from(BUCKETS.assets).remove(caminhos);

  // A mesma autorização concluída de novo (duplo clique, repetição de rede):
  // o arquivo já está registrado. Responde o mesmo, e não toca em nada — nem
  // conseguiria ler o arquivo, que depois do registro só sai pela rota que
  // registra download.
  const { data: jaRegistrado } = await context.auth.supabase.from("brand_assets")
    .select("id").eq("storage_path", path).eq("brand_id", context.brandId).maybeSingle();
  if (jaRegistrado) return NextResponse.json({ ok: true, substituicao: "nao-pedida" }, { status: 200 });

  // O que chegou de verdade: os primeiros bytes e o tamanho total.
  const { data: leituraAssinada } = await context.auth.supabase.storage.from(BUCKETS.assets).createSignedUrl(path, 60);
  const comeco = leituraAssinada?.signedUrl
    ? await fetch(leituraAssinada.signedUrl, { headers: { Range: `bytes=0-${BYTES_DO_COMECO - 1}` }, cache: "no-store" }).catch(() => null)
    : null;
  if (!comeco || (comeco.status !== 206 && comeco.status !== 200)) {
    return NextResponse.json({ message: isEnglish ? "The file didn't reach storage. Send it again." : "O arquivo não chegou ao armazenamento. Envie de novo." }, { status: 400 });
  }
  const tamanhoReal = tamanhoDoContentRange(comeco.headers.get("content-range")) ?? Number(comeco.headers.get("content-length"));
  const bytes = new Uint8Array(await comeco.arrayBuffer()).slice(0, BYTES_DO_COMECO);
  if (tamanhoReal !== envio.sizeBytes || tamanhoReal > TAMANHO_MAXIMO_DE_MATERIAL || !conteudoConfere(bytes, envio.mimeType)) {
    await apagar([path]);
    return NextResponse.json({ message: isEnglish ? "The file content doesn't match its declared type." : "O conteúdo do arquivo não corresponde ao tipo declarado." }, { status: 400 });
  }

  let miniaturaPath: string | null = null;
  const miniatura = await miniaturaAceitavel(form.get("miniatura"));
  if (miniatura) {
    const caminho = caminhoDeMiniatura(context.workspaceId, context.brandId, crypto.randomUUID());
    const { error: erroDaMiniatura } = await context.auth.supabase.storage.from(BUCKETS.assets)
      .upload(caminho, miniatura, { contentType: "image/png", upsert: false, cacheControl: "3600" });
    if (!erroDaMiniatura) miniaturaPath = caminho;
  }
  const { error } = await context.auth.supabase.from("brand_assets").insert({
    workspace_id: context.workspaceId, brand_id: context.brandId, item_id: envio.itemId,
    label: envio.label, description: envio.description,
    ...envio.eixos,
    storage_path: path, file_name: envio.fileName, mime_type: envio.mimeType,
    size_bytes: tamanhoReal, status: "ready", created_by: context.auth.user.id,
    miniatura_path: miniaturaPath,
  });
  if (error) {
    await apagar(miniaturaPath ? [path, miniaturaPath] : [path]);
    // A recusa do banco com nome conhecido é erro de quem enviou, e diz o quê.
    // Só o que não se reconhece continua sendo "não foi possível".
    const motivo = motivoDaRecusa(`${error.message} ${error.details ?? ""}`);
    if (motivo) return NextResponse.json({ message: isEnglish ? "The library refused this file's details. Review the item and its fields." : "A biblioteca recusou os dados deste arquivo. Revise o item e os campos." , motivo }, { status: 400 });
    // Registro duplicado: o mesmo envio concluído duas vezes (duplo clique,
    // repetição de rede). O arquivo é o mesmo, e já está registrado.
    if (error.code === "23505") return NextResponse.json({ ok: true, substituicao: "nao-pedida" }, { status: 200 });
    return NextResponse.json({ message: isEnglish ? "The file uploaded, but couldn't be registered." : "O arquivo chegou, mas não foi possível registrá-lo." }, { status: 500 });
  }
  const substitui = envio.substitui;

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
