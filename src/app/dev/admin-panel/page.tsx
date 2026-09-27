import { notFound } from "next/navigation";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { LocaleProvider } from "@/platform/locale-client";
import { PRODUCT_LOCALE } from "@/platform/locale";
import type { DocPageEntry } from "@/content/docs";
import type { BrennimarkTheme } from "@/brennimark/types";
import type { CorDaPaleta } from "@/lib/paleta/paleta";

export const metadata = { robots: { index: false, follow: false } };

const TEMA_FIXO: BrennimarkTheme = {
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
const MARCA_FIXA = { id: "00000000-0000-4000-8000-000000000001", nome: "Marca de Bancada" };

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

// A ficha da paleta de bancada: cores inventadas, nenhuma de cliente.
const PALETA_FIXA: CorDaPaleta[] = [
  { id: "c0000000-0000-4000-8000-000000000001", nome: "Vermelho Bancada", papel: "principal", segmento: "", hex: "#C8102E", rgb: "200 16 46", cmyk: "0 100 80 5", pms: "186 C", pagina: 12, ordem: 0, status: "ready", aprovadoEm: "2026-09-27T12:00:00.000Z", origem: "pessoa" },
  { id: "c0000000-0000-4000-8000-000000000002", nome: "Branco", papel: "principal", segmento: "", hex: "#FFFFFF", rgb: null, cmyk: null, pms: null, pagina: 12, ordem: 1, status: "ready", aprovadoEm: "2026-09-27T12:00:00.000Z", origem: "pessoa" },
  { id: "c0000000-0000-4000-8000-000000000003", nome: "Azul Noite", papel: "apoio", segmento: "Varejo", hex: "#0B1F3A", rgb: null, cmyk: "100 80 30 60", pms: null, pagina: 13, ordem: 2, status: "draft", aprovadoEm: null, origem: "ia" },
  { id: "c0000000-0000-4000-8000-000000000004", nome: "Só Pantone", papel: "apoio", segmento: "", hex: null, rgb: null, cmyk: null, pms: "7545 C", pagina: 13, ordem: 3, status: "draft", aprovadoEm: null, origem: "pessoa" },
];

export default async function AdminPanelLab({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; papel?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { estado, papel } = await searchParams;
  // `?papel=editora` edita e não aprova; `?papel=aprovadora` aprova e não
  // edita (ADR-0002). Sem o parâmetro, as duas capacidades — a dona.
  const paleta = {
    cores: PALETA_FIXA,
    podeEditar: papel !== "aprovadora",
    podeAprovar: papel !== "editora",
  };

  // `?estado=com-excluida` é o servidor devolvendo o que devolveria depois de
  // um recarregamento: uma página viva e outra já excluída.
  const comExcluida = estado === "com-excluida";
  const docs = comExcluida ? VIVAS.slice(0, 1) : VIVAS;
  const excluidas = comExcluida
    ? [{ slug: "tipografia", title: "Tipografia", deletedAt: "2026-08-29T12:00:00.000Z" }]
    : [];

  return (
    <LocaleProvider locale={PRODUCT_LOCALE}>
      <AdminPanel initialDocs={docs} deletedPages={excluidas} groups={["Sistema"]} theme={TEMA_FIXO} marca={MARCA_FIXA} paleta={paleta} />
    </LocaleProvider>
  );
}
