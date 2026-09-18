import { notFound, redirect } from "next/navigation";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { caminhoDaMarca } from "@/lib/brandville/selecao";
import { documentosVisiveis } from "@/content/visibilidade";
import { LocaleProvider } from "@/platform/locale-client";
import { BrandVocabularyProvider } from "@/platform/brand-vocabulary-client";
import { AppShellV2 } from "@/components/shell/AppShellV2";
import { shellSections } from "@/components/shell/navigation";
import { molduraDaMarcaAberta } from "@/components/shell/coluna-da-marca";
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
export default async function DocsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string; brandKey: string }>;
}) {
  const alvo = await params;
  const { access, docs, capabilities, userEmail, locale, brand, opcoes } =
    await resolveWorkspaceContext(alvo);

  if (access === "anonymous") redirect("/login");
  if (access === "onboarding") redirect("/onboarding");
  // Endereço que não serve para esta pessoa é 404 — a mesma resposta para
  // "não existe" e "você não participa", para não confirmar o endereço a quem
  // sonda. `ambiguous` aqui significaria uma URL sem os dois segmentos, que
  // esta rota não consegue produzir; ainda assim, resolver leva ao seletor.
  if (access === "not-found") notFound();
  if (access === "ambiguous") redirect("/docs");

  const basePath = caminhoDaMarca(alvo);
  const sections = shellSections({
    capabilities,
    locale,
    utilityLinks: brand?.navigation.utilityLinks,
  });

  /*
   * A mesma coluna das telas da conta, mais o grupo da marca aberta (plano da
   * interface §2). A gestão aparece para quem administra a CONTA desta marca —
   * é da conta, não da marca, e por isso não depende da capacidade aqui.
   */
  const conta = opcoes.find((w) => w.slug === alvo.workspaceSlug);
  const { coluna, segmentado } = molduraDaMarcaAberta({
    sections, basePath, contaSlug: alvo.workspaceSlug,
    administraConta: conta?.papel === "owner", ingles: locale === "en",
  });

  return (
    <LocaleProvider locale={locale}>
      <BrandVocabularyProvider
        language={brand?.metadata.language}
        statusLabels={brand?.statusLabels}
      >
        <AppShellV2
          basePath={basePath}
          contextoAtivo={{
            workspaceSlug: alvo.workspaceSlug,
            brandKey: alvo.brandKey,
            opcoes: opcoes.map((w) => ({
              slug: w.slug,
              nome: w.nome,
              marcas: w.marcas.map((m) => ({ key: m.key, nome: m.nome })),
            })),
          }}
          coluna={coluna}
          segmentado={segmentado}
          sections={sections}
          docs={documentosVisiveis(docs, capabilities)}
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
