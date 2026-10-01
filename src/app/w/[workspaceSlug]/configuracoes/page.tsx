import { redirect } from "next/navigation";
import { Configuracoes } from "@/components/configuracoes/Configuracoes";
import { MolduraDaConta } from "@/components/shell/MolduraDaConta";
import { resolveWorkspaceContext } from "@/lib/brennimark/workspace-context";

/**
 * Configurações — tela da CONTA, como Registros (30/09/2026).
 *
 * O portão daqui só decide o que APARECE: quem administra a conta. Quem pode
 * LER o consumo decide o banco — `ai_ledger`, `ai_budgets` e
 * `consumo_de_armazenamento` só entregam a conta a quem a administra.
 */
export default async function ConfiguracoesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const contexto = await resolveWorkspaceContext();

  if (contexto.access === "anonymous") redirect("/login");
  if (contexto.access === "onboarding") redirect("/onboarding");
  if (contexto.access === "sem-acesso") redirect("/docs");

  const conta = contexto.opcoes.find((w) => w.slug === workspaceSlug);
  // Não participa, ou não administra: a mesma saída para os dois.
  if (!conta || conta.papel !== "owner") redirect("/docs");

  return (
    <MolduraDaConta contexto={contexto} contaSlug={conta.slug}>
      <div className="px-[var(--space-shell-5)] py-[var(--space-shell-6)]">
        <div className="mx-auto max-w-[68rem]">
          <h1 className="font-display text-2xl font-black uppercase text-platform-text">Configurações</h1>
          <p className="mt-3 max-w-[46rem] text-sm leading-relaxed text-platform-text-muted">
            O que {conta.nome} usa do Vini, quanto espaço as marcas ocupam e o plano da conta. Só quem
            administra a conta vê esta tela.
          </p>
          <div className="mt-8">
            <Configuracoes />
          </div>
        </div>
      </div>
    </MolduraDaConta>
  );
}
