import { notFound } from "next/navigation";
import Link from "next/link";
import { getBrandvilleAuthContext } from "@/lib/brandville/server";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { VisualizadorDePdf } from "@/components/documento-fonte/VisualizadorDePdf";
import {
  ConclusaoPendente, PendenciaDeSecao,
} from "@/components/documento-fonte/ConclusaoPendente";

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

  /*
   * O estado do registro do documento-fonte, em consulta SEPARADA de propósito.
   *
   * As colunas e tabelas da fatia 2 podem não existir na instalação — a
   * migração é versionada e aplicada por decisão, não por deploy. Se elas
   * entrassem no `select` do visualizador, uma instalação sem a migração
   * perderia a página inteira: o manual original pararia de abrir por causa de
   * um aviso sobre o manual original. Consulta à parte, erro engolido, e o
   * visualizador nunca depende disto.
   */
  const registro = documento ? await lerEstadoDoRegistro(auth.supabase, documento.id) : null;

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
    <div className="flex h-[calc(100dvh-var(--shell-topbar,56px))] flex-col">
      {registro?.incompleta && registro.importId && (
        <ConclusaoPendente
          contaSlug={alvo.workspaceSlug}
          marcaChave={alvo.brandKey}
          importId={registro.importId}
        />
      )}
      {/*
        Páginas sem seção: pendência de CURADORIA, e não defeito. Elas estão
        registradas, medidas e ligadas ao original — o que falta é alguém dizer
        a que seção pertencem. Aparece aqui porque quem cura não é
        necessariamente quem importou, e o aviso do importador morreu com a
        navegação.
      */}
      {registro?.sourceDocumentId && (
        <PendenciaDeSecao
          paginasSemSecao={registro.paginasSemSecao}
          total={documento.page_count}
        />
      )}
      <div className="min-h-0 flex-1">
        <VisualizadorDePdf
          documentoId={documento.id}
          contaSlug={alvo.workspaceSlug}
          marcaChave={alvo.brandKey}
          className="h-full"
        />
      </div>
    </div>
  );
}

/**
 * O estado do registro, e nenhuma exceção que derrube a página.
 *
 * Duas leituras que dependem da migração da fatia 2. Falha em qualquer uma
 * significa "não sei", e "não sei" aqui é o mesmo que não mostrar aviso: o
 * visualizador continua servindo o PDF, que é a razão de a página existir.
 */
async function lerEstadoDoRegistro(
  supabase: Awaited<ReturnType<typeof getBrandvilleAuthContext>> extends null
    ? never
    : NonNullable<Awaited<ReturnType<typeof getBrandvilleAuthContext>>>["supabase"],
  id: string,
): Promise<{
  incompleta: boolean;
  sourceDocumentId: string | null;
  importId: string | null;
  /** `null` quando não foi medido. Zero é afirmação, não padrão. */
  paginasSemSecao: number | null;
} | null> {
  const { data, error } = await supabase
    .from("brand_imports")
    .select("import_id, source_document_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const sourceDocumentId = (data.source_document_id as string | null) ?? null;
  const importId = (data.import_id as string | null) ?? null;

  if (!sourceDocumentId) {
    // Sem documento-fonte não há manifesto para contar: não medido.
    return { incompleta: true, sourceDocumentId: null, importId, paginasSemSecao: null };
  }

  // `head: true` porque só a contagem interessa: mil páginas sem seção seriam
  // mil linhas trazidas para pintar um número.
  const { count, error: erroDaContagem } = await supabase
    .from("brand_source_pages")
    .select("pagina", { count: "exact", head: true })
    .eq("source_document_id", sourceDocumentId)
    .is("document_id", null);

  return {
    incompleta: false,
    sourceDocumentId,
    importId,
    /*
     * Contagem que FALHOU não é contagem zero. A versão anterior dizia `0`
     * quando a consulta caía, e zero apaga o aviso: páginas sem seção reais
     * sumiriam da vista de quem cura justamente quando o banco tropeçou.
     */
    paginasSemSecao: erroDaContagem ? null : (count ?? null),
  };
}
