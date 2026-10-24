import { resolveWorkspaceContext } from "@/lib/brennimark/workspace-context";
import { BancoDeImagens } from "@/components/materiais/BancoDeImagens";

/**
 * O banco de imagens da marca: os itens de tipo foto e ilustração de Materiais,
 * vistos como álbuns de miniaturas. Enviar fotos é de quem EDITA a marca; a
 * rota de envio e a RLS decidem de verdade o que é permitido.
 */
export default async function PaginaDoBancoDeImagens({
  params,
}: {
  params: Promise<{ workspaceSlug: string; brandKey: string }>;
}) {
  const contexto = await resolveWorkspaceContext(await params);
  const administra = contexto.access === "ready" && contexto.capabilities.includes("administrar");
  return <BancoDeImagens podeGerenciar={administra} />;
}
