import { redirect } from "next/navigation";
import { PessoasEAcesso } from "@/components/pessoas/PessoasEAcesso";
import { MolduraDaConta } from "@/components/shell/MolduraDaConta";
import { resolveWorkspaceContext } from "@/lib/brennimark/workspace-context";

/**
 * Pessoas e acesso — tela da CONTA, não da marca.
 *
 * Ela vive fora de `/b/[brandKey]` de propósito: conceder acesso é ato de quem
 * responde pela conta, e a tela precisa existir mesmo quando a conta ainda não
 * tem marca nenhuma — que é exatamente o dia em que a agência chama o time.
 *
 * O portão daqui só decide o que aparece. Quem AUTORIZA são as funções do banco
 * (`pessoas_da_conta`, `conceder_acesso`, `revogar_acesso`), que conferem quem
 * administra a conta dentro delas.
 */
export default async function PessoasPage({
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
  // Não participa, ou não administra: a mesma saída para os dois. Responder
  // diferente confirmaria a existência da conta para quem está sondando.
  if (!conta || conta.papel !== "owner") redirect("/docs");

  // O idioma da SESSÃO: com a interface em inglês, o título e a explicação saem em inglês.
  const en = contexto.locale === "en";

  return (
    <MolduraDaConta contexto={contexto} contaSlug={conta.slug}>
      <div className="px-[var(--space-shell-5)] py-[var(--space-shell-6)]">
        <div className="mx-auto max-w-[68rem]">
          <h1 className="font-display text-2xl font-black uppercase text-platform-text">
            {en ? "People & access" : "Pessoas e acesso"}
          </h1>
          <p className="mt-3 max-w-[46rem] text-sm leading-relaxed text-platform-text-muted">
            {en
              ? `Who works on ${conta.nome}'s brands, and on which ones. This list is yours: nobody outside the account sees it.`
              : `Quem trabalha nas marcas de ${conta.nome}, e em quais. Esta lista é sua: ninguém fora da conta a enxerga.`}
          </p>
          <div className="mt-8">
            <PessoasEAcesso />
          </div>
        </div>
      </div>
    </MolduraDaConta>
  );
}
