import { redirect } from "next/navigation";
import { activeDocsRegistry } from "@/brandville/config";
import { getBrandvilleAuthContext, getResolvedBrandDocs } from "@/lib/brandville/server";
import { DocsNav } from "@/components/docs/DocsNav";
import { SignOutButton } from "@/components/SignOutButton";

const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  let userEmail = "";
  let isOwner = false;
  let docs = [...activeDocsRegistry];

  if (!SKIP_AUTH) {
    const context = await getBrandvilleAuthContext();
    if (!context) {
      redirect("/login");
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.user.id)
      .maybeSingle();

    if (!profile || !profile.full_name) {
      redirect("/onboarding");
    }

    userEmail = context.user.email ?? "";
    isOwner = context.role === "owner";
    docs = await getResolvedBrandDocs(context);
  }

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <DocsNav docs={docs} isOwner={isOwner} />
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
