import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { getBrandvilleAuthContext, getDeletedPages } from "@/lib/brandville/server";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { drenarFilaDeExclusao } from "@/lib/import/limpeza";
import { caminhoDaMarca } from "@/lib/brandville/selecao";

export default async function AdminPage({ params }: { params: Promise<{ workspaceSlug: string; brandKey: string }> }) {
  const alvo = await params;
  // Leitura e escrita, as duas pela marca da requisição.
  const { access, capabilities, docs, brand } = await resolveWorkspaceContext(alvo);
  if (access === "anonymous") redirect("/login");
  if (access === "onboarding") redirect("/onboarding");
  if (!capabilities.includes("administrar")) redirect(caminhoDaMarca(alvo));

  // Sem marca não há o que administrar, e as seções são as que a marca
  // declara — não as de uma instância de código.
  if (!brand) redirect(caminhoDaMarca(alvo));

  const auth = await getBrandvilleAuthContext(alvo.workspaceSlug);
  const excluidas = auth
    ? await getDeletedPages(auth, brand.id, docs.map((doc) => doc.slug))
    : [];

  // A administração drena a fila de arquivos ao abrir. Sem isto, uma pendência
  // só seria tentada de novo na próxima exclusão de marca — que numa conta com
  // uma marca só talvez nunca aconteça. Falhar aqui não pode impedir a tela de
  // abrir: a fila continua pendente e será tentada na próxima vez.
  if (auth) await drenarFilaDeExclusao(auth).catch(() => undefined);

  return (
    <AdminPanel
      initialDocs={[...docs]}
      deletedPages={excluidas}
      groups={brand.navigation.groups}
    />
  );
}
