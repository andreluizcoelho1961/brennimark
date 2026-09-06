import { notFound } from "next/navigation";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { LocaleProvider } from "@/platform/locale-client";
import { PRODUCT_LOCALE } from "@/platform/locale";
import type { DocPageEntry } from "@/content/docs";
import type { BrandvilleTheme } from "@/brandville/types";

export const metadata = { robots: { index: false, follow: false } };

const TEMA_FIXO: BrandvilleTheme = {
  background: "#14161a", backgroundSecondary: "#14161a", surface: "#1b1e24",
  surfaceLight: "#242830", foreground: "#f4f5f7", muted: "#9099a8",
  accent: "#f4f5f7", accentSecondary: "#9099a8", border: "#2b3038",
  focus: "#ffffff", fontStack: "var(--font-ui)",
};

/**
 * A tela de administração com dados fixos, para o teste de navegador.
 *
 * A administração de verdade exige sessão, workspace e marca no banco. Criar
 * um usuário permanente no Supabase só para o Playwright seria pior do que o
 * problema: conta viva num projeto real, credencial em algum lugar, e um teste
 * que depende de rede. As APIs são interceptadas no teste; a integridade do
 * banco já está coberta pelos testes em SQL.
 *
 * O que esta rota exercita é o que faltava: o CAMINHO pela interface. Excluir
 * uma página e não conseguir voltar até ela foi defeito real duas vezes — e nas
 * duas o código parecia certo na leitura.
 *
 * Fora de produção por construção.
 */
const VIVAS: DocPageEntry[] = [
  {
    slug: "cores",
    group: "Sistema",
    title: "Cores",
    status: "ready",
    body: Array.from({ length: 41 }, (_, indice) => `Regra cromática ${indice + 1}.`),
    images: [{ src: "/brand/festival/home-hero.jpg", alt: "Aplicação cromática" }],
    blocks: [{ kind: "callout", text: "O vermelho é proprietário da marca." }],
  },
  { slug: "tipografia", group: "Sistema", title: "Tipografia", status: "ready", body: ["Uma família, quatro pesos."] },
];

export default async function AdminPanelLab({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { estado } = await searchParams;

  // `?estado=com-excluida` é o servidor devolvendo o que devolveria depois de
  // um recarregamento: uma página viva e outra já excluída.
  const comExcluida = estado === "com-excluida";
  const docs = comExcluida ? VIVAS.slice(0, 1) : VIVAS;
  const excluidas = comExcluida
    ? [{ slug: "tipografia", title: "Tipografia", deletedAt: "2026-08-29T12:00:00.000Z" }]
    : [];

  return (
    <LocaleProvider locale={PRODUCT_LOCALE}>
      <AdminPanel initialDocs={docs} deletedPages={excluidas} groups={["Sistema"]} theme={TEMA_FIXO} />
    </LocaleProvider>
  );
}
