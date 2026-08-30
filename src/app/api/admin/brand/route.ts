import { NextResponse } from "next/server";
import { getBrandvilleAuthContext } from "@/lib/brandville/server";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";

const isEnglish = inEnglish(PRODUCT_LOCALE);

/**
 * Apagar uma marca é ato total, e o PDF faz parte do total.
 *
 * A cascata do banco leva documentos, versões, assets e o registro da
 * importação. O que ela não alcança é o Storage: o PDF com o manual inteiro
 * sobreviveria à exclusão da marca, e o produto teria prometido apagar
 * enquanto guardava a cópia mais completa de todas.
 *
 * A ordem importa e é deliberada: o arquivo sai PRIMEIRO. Se a remoção do
 * Storage falhar, a marca continua de pé e a pessoa vê um erro — melhor que
 * uma marca apagada com o PDF órfão, que ninguém mais consegue alcançar para
 * remover, porque o caminho vivia no registro que a cascata levou.
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

  // A marca tem que ser desta conta. A RLS já garante, mas uma resposta 404
  // explícita é melhor que uma exclusão que não apaga nada e diz que apagou.
  const { data: marca, error: erroMarca } = await auth.supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();
  if (erroMarca) throw erroMarca;
  if (!marca) {
    return NextResponse.json(
      { message: isEnglish ? "Brand not found." : "Marca não encontrada." },
      { status: 404 },
    );
  }

  const { data: importacoes, error: erroImportacoes } = await auth.supabase
    .from("brand_imports")
    .select("id, storage_path")
    .eq("brand_id", brandId)
    .eq("workspace_id", auth.workspaceId);
  if (erroImportacoes) throw erroImportacoes;

  const caminhos = (importacoes ?? []).map((linha) => linha.storage_path).filter(Boolean);

  if (caminhos.length > 0) {
    const { error: erroStorage } = await auth.supabase.storage
      .from("brand-imports")
      .remove(caminhos);
    if (erroStorage) {
      // Nada foi apagado ainda. A marca continua inteira e alcançável.
      return NextResponse.json(
        {
          message: isEnglish
            ? "Couldn't remove the imported files. Nothing was deleted."
            : "Não foi possível remover os arquivos importados. Nada foi excluído.",
        },
        { status: 502 },
      );
    }
  }

  // A cascata leva documentos, versões, assets e os registros de importação.
  const { error: erroExclusao } = await auth.supabase
    .from("brands")
    .delete()
    .eq("id", brandId)
    .eq("workspace_id", auth.workspaceId);
  if (erroExclusao) {
    return NextResponse.json(
      {
        message: isEnglish
          ? "The files were removed but the brand could not be deleted."
          : "Os arquivos foram removidos, mas a marca não pôde ser excluída.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, arquivosRemovidos: caminhos.length });
}
