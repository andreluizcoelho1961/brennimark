import { notFound } from "next/navigation";
import Link from "next/link";
import { getBrandvilleAuthContext } from "@/lib/brandville/server";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { VisualizadorDePdf } from "@/components/documento-fonte/VisualizadorDePdf";

/**
 * O manual original — a camada visual canônica.
 *
 * É o PDF que a agência enviou, apresentado como ele é: layout, tipografia,
 * cores, fotografia e proporção do documento do cliente, sem recorte, sem
 * reenquadramento e sem remontagem. A moldura ao redor é da plataforma; do
 * quadro branco para dentro, o produto não toca em nada.
 *
 * A distinção com `/docs` é de camada, não de versão: `/docs` mostra a
 * estrutura EXTRAÍDA — seções, títulos, texto para busca e para a IA — e essa
 * extração pode falhar, ficar em rascunho ou precisar de curadoria. Esta página
 * não depende dela. Uma extração ruim nunca deforma o que se vê aqui.
 */
export default async function ManualOriginal({
  params,
}: {
  params: Promise<{ workspaceSlug: string; brandKey: string }>;
}) {
  const alvo = await params;
  const contexto = await resolveWorkspaceContext(alvo);
  // O layout já resolveu sessão e pertencimento; chegar aqui sem marca é
  // endereço que não serve para esta pessoa.
  if (contexto.access !== "ready" || !contexto.brand) notFound();

  /**
   * O documento-fonte desta marca.
   *
   * Hoje é a importação mais recente. Quando `brand_source_documents` existir,
   * passa a ser a edição ATIVA do manual, e o `select` muda com ele.
   */
  const auth = await getBrandvilleAuthContext(contexto.workspaceSlug ?? undefined);
  if (!auth) notFound();

  // Os dois filtros, sempre — a mesma disciplina da rota de transporte: a FK
  // composta já garantiria, mas deixar o workspace de fora faria esta consulta
  // depender de uma garantia que vive em outro arquivo.
  const { data: documento } = await auth.supabase
    .from("brand_imports")
    .select("id, page_count")
    .eq("workspace_id", auth.workspaceId)
    .eq("brand_id", contexto.brand.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!documento) {
    return (
      <div className="mx-auto max-w-[560px] p-[var(--space-shell-5)] text-platform-text">
        <h1 className="text-[18px] font-semibold">Esta marca ainda não tem manual original</h1>
        <p className="mt-[var(--space-shell-3)] text-[14px] text-platform-text-muted">
          O manual original é o PDF enviado na importação. Marcas criadas antes
          desta tela podem não ter o arquivo associado — importar de novo
          resolve, e nada do que já existe é apagado.
        </p>
        <Link
          href={`/w/${alvo.workspaceSlug}/importar`}
          className="mt-[var(--space-shell-4)] inline-block rounded border border-platform-border px-3 py-2 text-[13px]"
        >
          Importar um manual
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-var(--shell-topbar,56px))]">
      <VisualizadorDePdf
        documentoId={documento.id}
        contaSlug={alvo.workspaceSlug}
        marcaChave={alvo.brandKey}
        className="h-full"
      />
    </div>
  );
}
