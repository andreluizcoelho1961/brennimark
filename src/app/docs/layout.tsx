import { redirect } from "next/navigation";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { LocaleProvider } from "@/platform/locale-client";
import { BrandVocabularyProvider } from "@/platform/brand-vocabulary-client";
import { DocsNav } from "@/components/docs/DocsNav";
import { SignOutButton } from "@/components/SignOutButton";

/**
 * A moldura ainda é a V1. A promoção da V2 é o patch 5; aqui mudou de onde os
 * dados vêm.
 *
 * O layout não autentica. Ele lê `access`, que a requisição já resolveu —
 * antes ele chamava getBrandvilleAuthContext e consultava o perfil por conta
 * própria, e logo depois o contexto autenticava de novo: duas idas à Auth API
 * na mesma requisição.
 */
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const { access, docs, capabilities, userEmail, locale, brand } = await resolveWorkspaceContext();

  if (access === "anonymous") redirect("/login");
  if (access === "onboarding") redirect("/onboarding");

  return (
    <LocaleProvider locale={locale}>
    <BrandVocabularyProvider language={brand?.metadata.language} statusLabels={brand?.statusLabels}>
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
    </BrandVocabularyProvider>
    </LocaleProvider>
  );
}
