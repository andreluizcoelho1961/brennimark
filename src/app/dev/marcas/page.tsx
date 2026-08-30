import { notFound } from "next/navigation";
import { AppShellV2 } from "@/components/shell/AppShellV2";
import { shellSections } from "@/components/shell/navigation";
import { BrandCanvas } from "@/components/BrandCanvas";
import { DocPage } from "@/components/docs/DocPage";
import { LocaleProvider } from "@/platform/locale-client";
import { BrandVocabularyProvider } from "@/platform/brand-vocabulary-client";
import { PRODUCT_LOCALE } from "@/platform/locale";
import { capabilitiesForRole } from "@/platform/capabilities";
import { parseBrandRow } from "@/lib/brandville/brand-row";
import { MARCAS_OPOSTAS } from "@/platform/fixtures/marcas-opostas";
import type { DocPageEntry } from "@/content/docs";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A mesma moldura, quatro marcas opostas.
 *
 * Nada aqui é reconstruído: a linha passa por parseBrandRow, o mesmo tradutor
 * da aplicação; a moldura é o AppShellV2 real; o canvas é o BrandCanvas real.
 * Uma rota que montasse os objetos à mão testaria a fixture, não o caminho —
 * foi assim que o adaptador do prompt descartou statusLabels com o CI verde.
 *
 * Fora de produção por construção.
 */
const PAGINAS: DocPageEntry[] = [
  {
    slug: "abertura",
    group: "Sistema",
    title: "Abertura",
    status: "ready",
    body: ["Esta página existe para mostrar o canvas vestido pela marca."],
    blocks: [
      {
        kind: "swatches",
        title: "Paleta",
        items: [{ name: "Acento", hex: "#000000" }],
      },
    ],
  },
  { slug: "voz", group: "Sistema", title: "Voz", status: "draft", body: ["Rascunho editorial."] },
];

export default async function MarcasOpostas({
  searchParams,
}: {
  searchParams: Promise<{ marca?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { marca: chave } = await searchParams;
  const linha = MARCAS_OPOSTAS.find((m) => m.key === chave) ?? MARCAS_OPOSTAS[0];
  const marca = parseBrandRow(linha);
  if (!marca) notFound();

  // O acento de cada marca aparece no bloco de swatches, que é conteúdo.
  const paginas = PAGINAS.map((pagina) =>
    pagina.blocks
      ? { ...pagina, blocks: [{ kind: "swatches" as const, title: "Paleta", items: [{ name: "Acento", hex: marca.theme.accent }] }] }
      : pagina,
  );

  return (
    <LocaleProvider locale={PRODUCT_LOCALE}>
      <BrandVocabularyProvider language={marca.metadata.language} statusLabels={marca.statusLabels}>
        <AppShellV2
          sections={shellSections({ capabilities: capabilitiesForRole("owner"), locale: PRODUCT_LOCALE })}
          docs={paginas}
          userEmail="pessoa@exemplo.invalid"
          brandName={marca.brand.name}
          brandDescriptor={marca.brand.descriptor}
          brandLanguage={marca.metadata.language}
          statusLabels={marca.statusLabels}
          basePath="/dev/marcas"
        >
          <BrandCanvas theme={marca.theme}>
            <DocPage
              entry={paginas[0]}
              brandLanguage={marca.metadata.language}
              statusLabels={marca.statusLabels}
            />
          </BrandCanvas>
        </AppShellV2>
      </BrandVocabularyProvider>
    </LocaleProvider>
  );
}
