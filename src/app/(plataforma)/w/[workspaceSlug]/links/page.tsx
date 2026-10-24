import { redirect } from "next/navigation";
import { LinksDeEntrega } from "@/components/links/LinksDeEntrega";
import { MolduraDaConta } from "@/components/shell/MolduraDaConta";
import { resolveWorkspaceContext } from "@/lib/brennimark/workspace-context";

/**
 * Links de entrega — tela da CONTA, como Registros (30/09/2026, ADR-0007 §2.5).
 *
 * O portão daqui só decide o que APARECE: quem administra a conta. Quem pode
 * ler, criar e encerrar cada link decide o banco — `administrar` na marca.
 *
 * `?marca=<chave>&arquivos=<id,id>` abre a criação já preenchida: é o atalho
 * que vem da seleção em Materiais.
 */
export default async function LinksPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ marca?: string; arquivos?: string }>;
}) {
  const { workspaceSlug } = await params;
  const busca = await searchParams;
  const contexto = await resolveWorkspaceContext();

  if (contexto.access === "anonymous") redirect("/login");
  if (contexto.access === "onboarding") redirect("/onboarding");
  if (contexto.access === "sem-acesso") redirect("/docs");

  const conta = contexto.opcoes.find((w) => w.slug === workspaceSlug);
  // Não participa, ou não administra: a mesma saída para os dois.
  if (!conta || conta.papel !== "owner") redirect("/docs");

  const arquivos = (busca.arquivos ?? "").split(",").filter((a) => /^[0-9a-f-]{36}$/i.test(a)).slice(0, 60);
  const inicial = busca.marca ? { marca: busca.marca, arquivos } : undefined;

  return (
    <MolduraDaConta contexto={contexto} contaSlug={conta.slug}>
      <div className="px-[var(--space-shell-5)] py-[var(--space-shell-6)]">
        <div className="mx-auto max-w-[68rem]">
          <h1 className="font-display text-2xl font-black uppercase text-platform-text">Links de entrega</h1>
          <p className="mt-3 max-w-[46rem] text-sm leading-relaxed text-platform-text-muted">
            Arquivos das marcas de {conta.nome} para quem não tem conta — a gráfica de um job, um fornecedor
            pontual. Cada link tem prazo, entrega só o que foi escolhido, leva junto as páginas do manual que regem
            cada arquivo e registra quem baixou.
          </p>
          <div className="mt-8">
            <LinksDeEntrega marcas={conta.marcas.map((m) => ({ id: m.id, nome: m.nome, chave: m.key }))} inicial={inicial} />
          </div>
        </div>
      </div>
    </MolduraDaConta>
  );
}
