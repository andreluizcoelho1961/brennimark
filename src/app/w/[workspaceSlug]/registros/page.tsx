import { redirect } from "next/navigation";
import { Registros } from "@/components/registros/Registros";
import { MolduraDaConta } from "@/components/shell/MolduraDaConta";
import { resolveWorkspaceContext } from "@/lib/brennimark/workspace-context";

/**
 * Registros — tela da CONTA, como Pessoas e acesso (28/09/2026).
 *
 * O portão daqui só decide o que APARECE: quem administra a conta. Quem pode
 * LER cada linha decide o banco — as tabelas de registro só entregam as marcas
 * que a sessão administra.
 */
export default async function RegistrosPage({
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
          <h1 className="font-display text-2xl font-black uppercase text-platform-text">Registros</h1>
          <p className="mt-3 max-w-[46rem] text-sm leading-relaxed text-platform-text-muted">
            O que aconteceu nas marcas de {conta.nome}: quem baixou, quem recebeu acesso, o que mudou no
            manual. Nada aqui se apaga, e ninguém fora da conta enxerga.
          </p>
          <div className="mt-8">
            <Registros marcas={conta.marcas.map((m) => ({ id: m.id, nome: m.nome }))} />
          </div>
        </div>
      </div>
    </MolduraDaConta>
  );
}
