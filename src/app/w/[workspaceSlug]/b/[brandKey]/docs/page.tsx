import { redirect } from "next/navigation";
import { resolveWorkspaceContext } from "@/lib/brennimark/workspace-context";
import { EmptyBrandState } from "@/components/shell/EmptyBrandState";
import { caminhoDaMarca } from "@/lib/brennimark/selecao";

/**
 * A porta do manual.
 *
 * Antes esta página perguntava a `hasBrand`, uma constante calculada da
 * instância estática na inicialização do processo. Uma marca podia existir em
 * `brands` e a pessoa continuar vendo "Nenhuma marca por aqui ainda" — o
 * estado vazio mentia sobre o banco.
 */
export default async function DocsIndexPage({ params }: { params: Promise<{ workspaceSlug: string; brandKey: string }> }) {
  const alvo = await params;
  const { brand, capabilities } = await resolveWorkspaceContext(alvo);

  // Sem marca não há manual. O estado vazio é a resposta certa, e redirecionar
  // para /docs/ daria laço.
  if (!brand) {
    return (
      <EmptyBrandState
        podeImportar={capabilities.includes("administrar")}
        contaImportar={`/w/${alvo.workspaceSlug}/importar`}
      />
    );
  }

  /**
   * A porta do manual é o PDF, e não a primeira seção extraída.
   *
   * O destino anterior era `defaultDocSlug` — uma página REMONTADA pela
   * máquina. Num manual real isso levava à seção que por acaso vinha primeiro
   * no arquivo: a importação de 743 páginas fazia `what-s-new` ser a entrada,
   * porque era a primeira página do PDF.
   *
   * O PDF não tem esse problema: é o documento que a agência aprovou, com a
   * diagramação do estúdio, e nenhuma interpretação nossa no meio. A extração
   * continua existindo e continua servindo a busca, o assistente e as URLs já
   * compartilhadas — ela deixa de ser a PORTA, não deixa de existir.
   *
   * `defaultDocSlug` permanece no modelo: ele volta a decidir a entrada quando
   * a curadoria puder escolher uma página do PDF como abertura.
   */
  redirect(caminhoDaMarca(alvo, "docs/original"));
}
