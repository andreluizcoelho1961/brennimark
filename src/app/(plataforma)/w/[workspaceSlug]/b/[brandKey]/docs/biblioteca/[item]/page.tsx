import { notFound } from "next/navigation";
import { resolveWorkspaceContext } from "@/lib/brennimark/workspace-context";
import { PaginaDoItem } from "@/components/materiais/Materiais";

/**
 * A página de um item de Materiais — o KIT (spec de Materiais §5-A).
 *
 * Quem EDITA a marca liga o item às páginas do manual; quem só consulta vê a
 * regra citada e baixa. O item é resolvido no cliente, pela mesma leitura do
 * catálogo: item de outra marca não aparece, porque a RLS não o devolve.
 */
export default async function PaginaDeUmItem({
  params,
}: {
  params: Promise<{ workspaceSlug: string; brandKey: string; item: string }>;
}) {
  const alvo = await params;
  if (!/^[0-9a-f-]{36}$/i.test(alvo.item)) notFound();
  // O acesso à marca é conferido pelo layout; aqui só se decide o que aparece.
  const contexto = await resolveWorkspaceContext(alvo);
  const edita = contexto.access === "ready" && contexto.capabilities.includes("editar");
  // O atalho para criar link de entrega: a tela de links é da gestão da conta.
  const administraAConta = contexto.access === "ready"
    && contexto.capabilities.includes("administrar")
    && contexto.opcoes.find((w) => w.slug === alvo.workspaceSlug)?.papel === "owner";
  const linkDeEntrega = administraAConta ? `/w/${alvo.workspaceSlug}/links?marca=${encodeURIComponent(alvo.brandKey)}` : undefined;
  return <PaginaDoItem itemId={alvo.item} podeEditar={edita} linkDeEntrega={linkDeEntrega} />;
}
