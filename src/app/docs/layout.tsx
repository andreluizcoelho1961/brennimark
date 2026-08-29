import { redirect } from "next/navigation";
import { getBrandvilleAuthContext } from "@/lib/brandville/server";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { DocsNav } from "@/components/docs/DocsNav";
import { SignOutButton } from "@/components/SignOutButton";

const SKIP_AUTH = process.env.BRANDVILLE_DEV_SKIP_AUTH === "true";

/**
 * A moldura ainda é a V1. A promoção da V2 é o patch 5; aqui só a origem dos
 * dados mudou — DocsNav recebe o que a requisição resolveu, em vez de um
 * registro em código que hoje está vazio.
 */
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  if (!SKIP_AUTH) {
    const auth = await getBrandvilleAuthContext();
    if (!auth) redirect("/login");

    const { data: profile } = await auth.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (!profile || !profile.full_name) redirect("/onboarding");
  }

  // Uma resolução por requisição, compartilhada com as páginas filhas.
  const { docs, capabilities, userEmail } = await resolveWorkspaceContext();

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <DocsNav docs={docs} isOwner={capabilities.includes("administrar")} />
      <div className="flex flex-1 flex-col overflow-y-auto">
        {userEmail && (
          <header className="flex flex-none items-center justify-end gap-4 border-b border-border-default px-8 py-3">
            <span className="font-mono text-[10px] text-text-secondary">{userEmail}</span>
            <SignOutButton />
          </header>
        )}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
