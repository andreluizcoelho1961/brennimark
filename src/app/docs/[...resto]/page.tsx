import { permanentRedirect, redirect } from "next/navigation";
import { resolveWorkspaceContext } from "@/lib/brennimark/workspace-context";

/**
 * Endereços antigos, sem contexto: /docs/chat, /docs/historico/42.
 *
 * Eles existiram e estão em links salvos, favoritos e no histórico de quem já
 * usava o produto. Devolver 404 seria transformar a correção do M1 numa quebra
 * para quem não fez nada de errado.
 *
 * O caminho é preservado inteiro. Só o contexto é acrescentado na frente — e
 * só quando ele é inequívoco. Havendo mais de uma marca alcançável, a pessoa
 * passa pelo seletor em vez de ser mandada para um palpite.
 */
export default async function RedirecionaEnderecoAntigo({
  params,
}: {
  params: Promise<{ resto: string[] }>;
}) {
  const { resto } = await params;
  const contexto = await resolveWorkspaceContext();

  if (contexto.access === "anonymous") redirect("/login");
  if (contexto.access === "onboarding") redirect("/onboarding");

  if (contexto.access === "ready" && contexto.workspaceSlug && contexto.brand) {
    const caminho = resto.map(encodeURIComponent).join("/");
    permanentRedirect(
      `/w/${contexto.workspaceSlug}/b/${contexto.brand.key}/docs/${caminho}`,
    );
  }

  // Ambíguo ou sem marca: o resolvedor decide, e o caminho pedido se perde de
  // propósito — mandá-lo para uma marca escolhida a esmo seria o defeito de
  // volta, agora disfarçado de compatibilidade.
  redirect("/docs");
}
