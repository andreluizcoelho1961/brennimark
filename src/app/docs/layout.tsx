import { redirect } from "next/navigation";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { LocaleProvider } from "@/platform/locale-client";
import { BrandVocabularyProvider } from "@/platform/brand-vocabulary-client";
import { AppShellV2 } from "@/components/shell/AppShellV2";
import { shellSections } from "@/components/shell/navigation";
import { SignOutButton } from "@/components/SignOutButton";

/**
 * A moldura real do produto.
 *
 * Substitui o DocsNav, que era rail de siglas de duas letras mais painel, com
 * uma barra própria empilhada por cima só para mostrar o e-mail. Aqui são três
 * zonas — barra, navegação, conteúdo — e o conteúdo recebe a maior parte da
 * área.
 *
 * O que atravessa: capacidades filtram os destinos antes de renderizar, então
 * quem não administra não recebe um link que terminaria em 403; o vocabulário
 * editorial e o idioma do manual vêm da marca resolvida; o idioma da interface
 * vem do produto. Os três já existiam separados — a promoção só os liga à
 * moldura nova.
 */
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const { access, docs, capabilities, userEmail, locale, brand } = await resolveWorkspaceContext();

  if (access === "anonymous") redirect("/login");
  if (access === "onboarding") redirect("/onboarding");

  return (
    <LocaleProvider locale={locale}>
      <BrandVocabularyProvider
        language={brand?.metadata.language}
        statusLabels={brand?.statusLabels}
      >
        <AppShellV2
          sections={shellSections({ capabilities, locale })}
          docs={docs}
          userEmail={userEmail}
          brandName={brand?.brand.name}
          brandDescriptor={brand?.brand.descriptor}
          brandLanguage={brand?.metadata.language}
          statusLabels={brand?.statusLabels}
          sessionControl={<SignOutButton />}
        >
          {children}
        </AppShellV2>
      </BrandVocabularyProvider>
    </LocaleProvider>
  );
}
