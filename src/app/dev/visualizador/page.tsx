import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { LocaleProvider } from "@/platform/locale-client";
import { VisualizadorDePdf } from "@/components/documento-fonte/VisualizadorDePdf";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada do visualizador canônico.
 *
 * Existe para o Marco A ser exercível ANTES de o Studio e o Guia terem rotas
 * definitivas (Etapa 6 do plano). Sem uma tela que monte o visualizador, todo
 * o trabalho da Etapa 1 fica provado só por teste de unidade — e o portão de
 * aceite é comparação visual contra o original, que exige olho humano num
 * documento real.
 *
 * Não é maquete: usa a marca resolvida de verdade, a rota de transporte de
 * verdade e a autorização de verdade. O que ela não tem é lugar definitivo na
 * navegação — e é justamente por isso que fica fora de produção.
 */
export default async function BancadaDoVisualizador({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  /**
   * Modo fixture: o visualizador sobre um PDF da pasta de testes, sem banco e
   * sem sessão. É o que a suíte de navegador dirige nos três motores.
   */
  const { fixture } = await searchParams;
  if (fixture) {
    return (
      <main className="flex h-dvh flex-col">
        <VisualizadorDePdf
          documentoId="fixture"
          origem={`/dev/fixture/${encodeURIComponent(fixture)}`}
          className="min-h-0 flex-1"
        />
      </main>
    );
  }

  const contexto = await resolveWorkspaceContext();
  if (contexto.access !== "ready" || !contexto.brand) {
    return (
      <main className="p-[var(--space-shell-5)] text-platform-text">
        <p className="text-[14px]">
          Nenhuma marca resolvida nesta sessão. Importe um manual primeiro.
        </p>
      </main>
    );
  }

  /**
   * O documento-fonte mais recente desta marca.
   *
   * `brand_imports` é o registro de importação, e é o identificador estável
   * que existe HOJE. Quando `brand_source_documents` nascer na Etapa 2, este
   * `select` e o parâmetro da rota mudam juntos — está registrado no AGENTS.md
   * para não virar surpresa.
   */
  const supabase = await createClient();
  const { data: importacao } = await supabase
    .from("brand_imports")
    .select("id, page_count, created_at")
    .eq("brand_id", contexto.brand.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!importacao) {
    return (
      <main className="p-[var(--space-shell-5)] text-platform-text">
        <p className="text-[14px]">
          Esta marca não tem manual importado. O visualizador precisa de um PDF
          de origem — importe um pela tela de importação.
        </p>
      </main>
    );
  }

  return (
    <LocaleProvider locale={contexto.locale}>
      <main className="flex h-dvh flex-col">
        <header className="border-b border-platform-border bg-platform-panel px-[var(--space-shell-3)] py-[var(--space-shell-2)] text-platform-text">
          <h1 className="text-[13px] font-semibold">
            {contexto.brand.brand.name} · documento-fonte
          </h1>
          <p className="text-[12px] text-platform-text-muted">
            {importacao.page_count} páginas · bancada de desenvolvimento
          </p>
        </header>

        <VisualizadorDePdf
          documentoId={importacao.id}
          contaSlug={contexto.workspaceSlug ?? undefined}
          marcaChave={contexto.brand.key}
          className="min-h-0 flex-1"
        />
      </main>
    </LocaleProvider>
  );
}
