import { NextResponse } from "next/server";
import { getBrandvilleAuthContext, type BrandvilleAuthContext } from "@/lib/brandville/server";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";

const isEnglish = inEnglish(PRODUCT_LOCALE);

/**
 * Apagar uma marca é ato total, e o PDF faz parte do total.
 *
 * A cascata do banco leva documentos, versões, assets e o registro da
 * importação. O que ela não alcança é o Storage: sem isto, o PDF com o manual
 * inteiro sobreviveria à exclusão.
 *
 * As linhas de `storage.objects` nunca são tocadas por SQL: quem remove é a
 * API do Storage, com a sessão de quem administra.
 */
export async function DELETE(request: Request) {
  const [contexto, auth] = await Promise.all([
    resolveWorkspaceContext(),
    getBrandvilleAuthContext(),
  ]);

  if (!auth || !contexto.capabilities.includes("administrar")) {
    return NextResponse.json(
      { message: isEnglish ? "Only owners can delete a brand." : "Apenas quem administra pode excluir uma marca." },
      { status: 403 },
    );
  }

  const entrada = await request.json().catch(() => null);
  const brandId = typeof entrada?.brandId === "string" ? entrada.brandId : "";
  if (!brandId) {
    return NextResponse.json({ message: isEnglish ? "Invalid brand." : "Marca inválida." }, { status: 400 });
  }

  /**
   * Uma transação apaga a marca E registra os arquivos a remover.
   *
   * A ordem anterior — Storage primeiro, banco depois — evitava arquivo órfão
   * e trocava por outra inconsistência: se o Storage funcionasse e o banco
   * falhasse, a marca ficava viva sem a própria fonte, e ninguém saberia.
   *
   * Agora a fila é durável e sobrevive à cascata, porque não tem vínculo com a
   * marca. Falhar ao remover o arquivo deixa uma exclusão PENDENTE e
   * repetível, não uma inconsistência invisível.
   */
  const { data: enfileirados, error: erroExclusao } = await auth.supabase.rpc(
    "delete_brand_with_files",
    { p_brand_id: brandId },
  );

  if (erroExclusao) {
    const naoEncontrada = erroExclusao.code === "P0002";
    return NextResponse.json(
      {
        message: naoEncontrada
          ? isEnglish ? "Brand not found." : "Marca não encontrada."
          : isEnglish ? "Couldn't delete the brand." : "Não foi possível excluir a marca.",
      },
      { status: naoEncontrada ? 404 : 403 },
    );
  }

  const removidos = await drenarFilaDeExclusao(auth);

  return NextResponse.json({
    ok: true,
    arquivosEnfileirados: enfileirados ?? 0,
    arquivosRemovidos: removidos.removidos,
    // Honesto sobre o que sobrou: a marca não existe mais, e estes arquivos
    // continuam pendentes para a próxima tentativa.
    pendentes: removidos.pendentes,
  });
}

/**
 * Remove o que estiver na fila e fecha os registros que saíram.
 *
 * Idempotente de propósito: uma exclusão que falhou ontem é tentada de novo
 * na próxima, sem ninguém precisar lembrar dela.
 */
async function drenarFilaDeExclusao(auth: BrandvilleAuthContext) {
  const { data: pendentes, error } = await auth.supabase
    .from("brand_deletions")
    .select("id, storage_path")
    .eq("workspace_id", auth.workspaceId)
    .limit(200);
  if (error || !pendentes?.length) return { removidos: 0, pendentes: 0 };

  const caminhos = pendentes.map((linha) => linha.storage_path);
  const { data: removidos, error: erroStorage } = await auth.supabase.storage
    .from("brand-imports")
    .remove(caminhos);

  if (erroStorage) return { removidos: 0, pendentes: pendentes.length };

  // Só fecha o que o Storage confirmou ter removido.
  const confirmados = new Set((removidos ?? []).map((objeto) => objeto.name));
  const idsParaFechar = pendentes
    .filter((linha) => confirmados.has(linha.storage_path))
    .map((linha) => linha.id);

  if (idsParaFechar.length > 0) {
    await auth.supabase.from("brand_deletions").delete().in("id", idsParaFechar);
  }

  return { removidos: idsParaFechar.length, pendentes: pendentes.length - idsParaFechar.length };
}
