import { redirect } from "next/navigation";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { MolduraDaConta } from "@/components/shell/MolduraDaConta";
import { TelaInicial } from "@/components/shell/TelaInicial";
import { EmptyBrandState } from "@/components/shell/EmptyBrandState";

/**
 * Marcas — a tela inicial de UMA conta, dentro da moldura.
 *
 * É o destino do item "Marcas" da coluna (plano da interface §2). Até 18/09 a
 * conta não tinha endereço próprio: a tela inicial vivia só em `/docs`, que
 * mistura as marcas de todas as contas da pessoa. Com a moldura, "Marcas" e a
 * gestão precisam saber DE QUAL conta — e é este endereço que diz.
 *
 * O centro segue o esboço do André: sem marca, o convite para enviar a
 * primeira (ou, para quem só consulta, a quem pedir); com marcas, os cartões.
 */
export default async function MarcasDaConta({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const contexto = await resolveWorkspaceContext();

  if (contexto.access === "anonymous") redirect("/login");
  if (contexto.access === "onboarding") redirect("/onboarding");

  const conta = contexto.opcoes.find((w) => w.slug === workspaceSlug);
  // Não participa: a mesma saída de uma conta que não existe. Responder
  // diferente confirmaria o endereço para quem sonda.
  if (!conta) redirect("/docs");

  const administra = conta.papel === "owner";
  const pares = conta.marcas.map((m) => ({
    workspaceSlug: conta.slug, brandKey: m.key, conta: conta.nome, marca: m.nome,
  }));

  return (
    <MolduraDaConta contexto={contexto} contaSlug={conta.slug}>
      {pares.length === 0
        ? <EmptyBrandState podeImportar={administra} contaImportar={`/w/${conta.slug}/importar`} />
        : <TelaInicial opcoes={pares} novaMarca={administra ? `/w/${conta.slug}/importar` : undefined} />}
    </MolduraDaConta>
  );
}
