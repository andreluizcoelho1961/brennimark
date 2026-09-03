import { parseDocBlocks } from "../../content/doc-blocks";
import type { DocPageEntry, DocPageImage, DocStatus } from "../../content/docs";
import type { BrandvilleInstance, BrandvilleTheme } from "../../brandville/types";

/**
 * Traduz linhas do banco para as formas que a aplicação já usa.
 *
 * Funções puras, sem Supabase, para que a tradução — que é onde um campo se
 * perde em silêncio — seja testável sem banco.
 *
 * Regra que atravessa tudo aqui: **dado malformado nunca vira conteúdo
 * aprovado**. Uma linha que não passa na validação é descartada, e a página
 * some do manual em vez de aparecer com valor indefinido. Num produto cuja
 * promessa é procedência, exibir algo que não se sabe de onde veio é pior do
 * que não exibir.
 */

const STATUS: DocStatus[] = ["ready", "draft", "pending"];
const TEMA_OBRIGATORIO = [
  "background", "backgroundSecondary", "surface", "surfaceLight",
  "foreground", "muted", "accent", "accentSecondary", "border", "focus",
] as const;

function texto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length > 0;
}

/**
 * O teto de `chatRole`/`analysisRole` (o "papel" que a marca declara para
 * o assistente) — decisão registrada em
 * docs/plan/p2-benchmark-multimodal-2026-09-03.md: espaço para um
 * parágrafo de instruções; mais que isso deveria virar configuração
 * estruturada, não continuar como um campo de texto solto.
 *
 * A MESMA constante que a migração `20260903180000_brand_ai_role_length_limit.sql`
 * grava como `check (char_length(...) <= 1000)` no banco, e que
 * `src/lib/ai/execucao.ts` usa para limitar quanto a reserva de orçamento
 * confia no comprimento do papel. Três lugares, um número — divergir seria
 * a reserva assumir um teto que o banco não garante, ou o contrário.
 */
export const MAX_CARACTERES_DO_PAPEL_DA_MARCA = 1_000;

/**
 * Conta CARACTERES — pontos de código Unicode — não unidades UTF-16. O
 * `.length` nativo do JavaScript conta unidades UTF-16: um emoji fora do
 * plano básico (como 😀) ocupa DUAS unidades, então `"😀".repeat(1000).length`
 * dá 2000, não 1000. O `char_length` do Postgres conta pontos de código —
 * `Array.from` (que itera por code point, não por unidade UTF-16) é o
 * equivalente correto em JS. Sem isto, o teto do TypeScript seria mais
 * restritivo que o do banco para qualquer texto com esses caracteres, e as
 * duas camadas contariam coisas diferentes com o mesmo nome.
 */
export function contarCaracteres(valor: string): number {
  return Array.from(valor).length;
}

/**
 * Como `texto()`, mas também recusa um valor além do teto validado — um
 * papel longo demais é tratado como malformado, do mesmo jeito que um
 * papel ausente: cai para "", nunca é truncado em silêncio.
 */
function papelDaMarca(valor: unknown): valor is string {
  return texto(valor) && contarCaracteres(valor) <= MAX_CARACTERES_DO_PAPEL_DA_MARCA;
}

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function parseTheme(valor: unknown): BrandvilleTheme | null {
  if (!objeto(valor)) return null;
  // Tema incompleto reprova: um campo faltando pintaria a interface com valor
  // indefinido, e o defeito apareceria só na tela do cliente.
  for (const campo of TEMA_OBRIGATORIO) {
    if (!texto(valor[campo])) return null;
  }
  return {
    ...(valor as unknown as BrandvilleTheme),
    fontStack: texto(valor.fontStack) ? valor.fontStack : "var(--font-ui)",
  };
}

function parseStatusLabels(valor: unknown): Record<DocStatus, string> | undefined {
  if (!objeto(valor)) return undefined;
  // Tudo ou nada: rótulo aplicado pela metade deixa a interface em dois idiomas.
  if (!STATUS.every((s) => texto(valor[s]))) return undefined;
  return { ready: String(valor.ready), draft: String(valor.draft), pending: String(valor.pending) };
}

function parseImages(valor: unknown): DocPageImage[] | undefined {
  if (!Array.isArray(valor) || valor.length === 0) return undefined;
  const ok = valor.every((item) => objeto(item) && texto(item.src) && typeof item.alt === "string");
  return ok ? (valor as DocPageImage[]) : undefined;
}

export type ActiveBrand = Omit<BrandvilleInstance, "docs"> & { id: string };

export function parseBrandRow(row: unknown): ActiveBrand | null {
  if (!objeto(row)) return null;
  if (!texto(row.id) || !texto(row.key) || !texto(row.name)) return null;

  const theme = parseTheme(row.theme);
  if (!theme) return null;

  const navegacao = objeto(row.navigation) ? row.navigation : {};
  const metadados = objeto(row.metadata) ? row.metadata : {};
  const ia = objeto(row.ai) ? row.ai : {};
  const legal = objeto(row.legal) ? row.legal : {};
  const rotulos = parseStatusLabels(row.status_labels);

  return {
    key: row.key,
    brand: {
      name: row.name,
      shortName: texto(row.short_name) ? row.short_name : row.name,
      descriptor: texto(row.descriptor) ? row.descriptor : "",
    },
    metadata: {
      title: texto(metadados.title) ? metadados.title : row.name,
      description: texto(metadados.description) ? metadados.description : "",
      language: texto(row.language) ? row.language : "pt-BR",
    },
    navigation: {
      groups: Array.isArray(navegacao.groups) ? (navegacao.groups as string[]) : [],
      groupCodes: objeto(navegacao.groupCodes) ? (navegacao.groupCodes as Record<string, string>) : {},
      defaultDocSlug: texto(navegacao.defaultDocSlug) ? navegacao.defaultDocSlug : "",
      utilityLinks: Array.isArray(navegacao.utilityLinks)
        ? (navegacao.utilityLinks as BrandvilleInstance["navigation"]["utilityLinks"])
        : [],
    },
    theme,
    ai: {
      knowledgeMode: ia.knowledgeMode === "full" ? "full" : "docs",
      chatRole: papelDaMarca(ia.chatRole) ? ia.chatRole : "",
      analysisRole: papelDaMarca(ia.analysisRole) ? ia.analysisRole : "",
    },
    legal: { footerNotice: texto(legal.footerNotice) ? legal.footerNotice : "" },
    ...(rotulos ? { statusLabels: rotulos } : {}),
    id: row.id,
  };
}

export function parseDocumentRow(row: unknown): DocPageEntry | null {
  if (!objeto(row)) return null;
  if (!texto(row.slug) || !texto(row.title) || !texto(row.group_name)) return null;
  // Status fora do vocabulário reprova a linha inteira. Assumir um valor aqui
  // apresentaria como pronto algo que a marca não aprovou.
  if (!STATUS.includes(row.status as DocStatus)) return null;

  const corpo = Array.isArray(row.body) && row.body.every((p) => typeof p === "string")
    ? (row.body as string[])
    : undefined;

  return {
    slug: row.slug,
    group: row.group_name,
    title: row.title,
    status: row.status as DocStatus,
    ...(corpo && corpo.length ? { body: corpo } : {}),
    ...(parseImages(row.images) ? { images: parseImages(row.images)! } : {}),
    // Bloco malformado não derruba a página: o texto continua servindo.
    ...(parseDocBlocks(row.blocks) ? { blocks: parseDocBlocks(row.blocks)! } : {}),
  };
}
