import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { AppShellV2 } from "@/components/shell/AppShellV2";
import { colunaDaPlataforma } from "@/components/shell/coluna";
import { TelaInicial } from "@/components/shell/TelaInicial";
import { EmptyBrandState } from "@/components/shell/EmptyBrandState";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A bancada da moldura da CONTA — a que existe sem marca aberta.
 *
 * As telas reais (`/w/<conta>`, `/docs`) resolvem sessão e conta no banco, e a
 * suíte de navegador roda sem banco. Aqui a moldura é a mesma `AppShellV2`,
 * com a coluna montada pela mesma `colunaDaPlataforma` — o que muda é só a
 * origem do dado.
 *
 * `?papel=consulta` mostra quem não administra; `?marcas=0` a conta vazia.
 */
export default async function BancadaDaMoldura({
  searchParams,
}: {
  searchParams: Promise<{ papel?: string; marcas?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { papel, marcas } = await searchParams;
  const administra = papel !== "consulta";
  const vazia = marcas === "0";

  const pares = vazia ? [] : [
    { workspaceSlug: "dev", brandKey: "solara", conta: "Agência Dev", marca: "Solara" },
    { workspaceSlug: "dev", brandKey: "ferro", conta: "Agência Dev", marca: "Ferro" },
  ];

  return (
    <LocaleProvider locale="pt-BR">
      <AppShellV2
        coluna={colunaDaPlataforma({ contaSlug: "dev", administraConta: administra })}
        segmentado={{}}
        sections={[]}
        docs={[]}
        userEmail="pessoa@exemplo.invalid"
        brandName="Agência Dev"
      >
        {vazia
          ? <EmptyBrandState podeImportar={administra} contaImportar="/w/dev/importar" />
          : <TelaInicial opcoes={pares} novaMarca={administra ? "/w/dev/importar" : undefined} />}
      </AppShellV2>
    </LocaleProvider>
  );
}
