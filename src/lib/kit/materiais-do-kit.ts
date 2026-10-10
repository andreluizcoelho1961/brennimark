/**
 * De onde o Kit do assinante tira os desenhos (10/10/2026): os MATERIAIS da
 * marca, sem subir arquivo. Esta escolha é pura; a rota lê as variantes com a
 * sessão (a RLS decide quem vê) e o navegador busca os originais pela rota do
 * kit da biblioteca, que registra cada download antes de assinar o endereço
 * (ADR-0007 §2.4).
 *
 * - logotipo: item `logo`, a variante mais "padrão" — principal, horizontal,
 *   colorida, positiva, RGB (é tela) e, entre iguais, o vetor: SVG, depois
 *   PDF ou AI, e só então bitmap (`formatos.ts`);
 * - negativo: a mesma preferência, polaridade negativa;
 * - vertical: o melhor logotipo positivo de lockup vertical, se houver;
 * - símbolo: os Materiais não têm tipo "símbolo"; o mais próximo é `icone`
 *   (sem hierarquia nem lockup) — colorido, positivo, RGB, SVG.
 * Variante descontinuada não entra (a rota já filtra). Variante num formato
 * que o Kit não abre (EPS, Affinity, Corel) não entra; se só há logo assim,
 * `semLogoPorque` diz o arquivo e o motivo, em vez de "não tem logotipo".
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

import { formatoDoArquivo, pesoDoFormato } from "./formatos";

export type VarianteDoKit = {
  id: string;
  itemId: string;
  tipo: "logo" | "icone";
  arquivo: string;
  mime: string;
  hierarquia: string | null;
  lockup: string | null;
  cor: string | null;
  polaridade: string | null;
  espacoDeCor: string | null;
  /** O rótulo dado nos Materiais, se houver. */
  rotulo?: string | null;
  /** A miniatura dos Materiais (endereço assinado e curto), para a escolha. */
  miniatura?: string | null;
};

/** Os quatro papéis que a pessoa pode trocar no Kit do assinante. */
export type Papel = "logo" | "vertical" | "simbolo" | "negativo";
export const PAPEIS: readonly Papel[] = ["logo", "vertical", "simbolo", "negativo"];

export type DesenhosDaMarca = {
  /** O logotipo das faixas largas — o horizontal, quando há os dois. */
  logo: VarianteDoKit | null;
  /** O logotipo vertical, para quadrados e círculos sem símbolo. */
  vertical: VarianteDoKit | null;
  negativo: VarianteDoKit | null;
  simbolo: VarianteDoKit | null;
  /** Há logotipo positivo nos Materiais, mas em formato que o Kit não abre. */
  semLogoPorque: string | null;
};

export type OpcaoDoPapel = { variante: VarianteDoKit; abre: boolean; motivo: string | null };

function pontos(v: VarianteDoKit, polaridade: "positivo" | "negativo", lockup: "horizontal" | "vertical" = "horizontal"): number {
  if (v.polaridade && v.polaridade !== polaridade) return -1;
  let p = 0;
  if (v.hierarquia === "principal") p += 16;
  if (v.lockup === lockup) p += 8;
  if (v.cor === "colorido") p += 4;
  if (v.espacoDeCor === "rgb") p += 2;
  // Os atributos mandam; o formato desempata (0 a 2, sempre menor que 3).
  return p * 3 + pesoDoFormato(v.arquivo, v.mime);
}

function candidatas(variantes: readonly VarianteDoKit[], papel: Papel): VarianteDoKit[] {
  if (papel === "simbolo") return variantes.filter((v) => v.tipo === "icone" && v.polaridade !== "negativo");
  if (papel === "negativo") return variantes.filter((v) => v.tipo === "logo" && v.polaridade === "negativo");
  // No papel vertical, só o que é vertical: oferecer o horizontal ali era ruído
  // ("usar o logotipo acima" já cobre esse caso).
  if (papel === "vertical") return variantes.filter((v) => v.tipo === "logo" && v.polaridade !== "negativo" && v.lockup === "vertical");
  return variantes.filter((v) => v.tipo === "logo" && v.polaridade !== "negativo");
}

function pontosDoPapel(v: VarianteDoKit, papel: Papel): number {
  if (papel === "negativo") return pontos(v, "negativo");
  return pontos(v, "positivo", papel === "vertical" ? "vertical" : "horizontal");
}

/**
 * As opções de um papel, da melhor para a pior; as que o Kit não abre vêm no
 * fim, apagadas e com o motivo — para ninguém achar que a versão sumiu.
 */
export function opcoesDoPapel(variantes: readonly VarianteDoKit[], papel: Papel): OpcaoDoPapel[] {
  return candidatas(variantes, papel)
    .map((v) => {
      const f = formatoDoArquivo(v.arquivo, v.mime);
      return { variante: v, abre: f.tipo !== "fora", motivo: f.tipo === "fora" ? f.motivo : null, p: pontosDoPapel(v, papel) };
    })
    .sort((a, b) => Number(b.abre) - Number(a.abre) || b.p - a.p)
    .map(({ variante, abre, motivo }) => ({ variante, abre, motivo }));
}

function melhor(variantes: readonly VarianteDoKit[], papel: Papel): VarianteDoKit | null {
  return opcoesDoPapel(variantes, papel).find((o) => o.abre)?.variante ?? null;
}

const NOMES: Record<string, string> = {
  horizontal: "Horizontal", vertical: "Vertical", colorido: "colorido", monocromatico: "monocromático",
  positivo: "positivo", negativo: "negativo", cmyk: "CMYK", secundario: "secundário",
};

/** Como a versão aparece na escolha: o rótulo dos Materiais, ou os atributos e o formato. */
export function nomeDaVariante(v: VarianteDoKit): string {
  const ext = /\.([a-z0-9]+)$/i.exec(v.arquivo)?.[1]?.toUpperCase() ?? "";
  if (v.rotulo?.trim()) return `${v.rotulo.trim()}${ext ? ` · ${ext}` : ""}`;
  // "Positivo" é o normal: só o negativo se diz.
  const partes = [v.lockup, v.cor, v.polaridade === "negativo" ? v.polaridade : null, v.hierarquia === "secundario" ? v.hierarquia : null, v.espacoDeCor === "cmyk" ? v.espacoDeCor : null]
    .filter((x): x is string => Boolean(x)).map((x) => NOMES[x] ?? x);
  if (v.tipo === "icone" && partes.length === 0) partes.push("Símbolo");
  if (ext) partes.push(ext);
  const nome = partes.join(" · ");
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export function escolherDesenhos(variantes: readonly VarianteDoKit[]): DesenhosDaMarca {
  const logo = melhor(variantes, "logo");
  // O vertical só como papel próprio: se o melhor logotipo já é o vertical
  // (a marca não tem horizontal), ele cuida dos dois.
  const vertical = logo && logo.lockup !== "vertical"
    ? (opcoesDoPapel(variantes, "vertical").find((o) => o.abre)?.variante ?? null)
    : null;
  const negativo = melhor(variantes, "negativo");
  let semLogoPorque: string | null = null;
  if (!logo) {
    const fora = opcoesDoPapel(variantes, "logo").find((o) => !o.abre);
    if (fora) semLogoPorque = `O logotipo nos Materiais (${fora.variante.arquivo}) não abre aqui. ${fora.motivo ?? ""}`.trim();
  }
  return { logo, vertical, negativo, simbolo: melhor(variantes, "simbolo"), semLogoPorque };
}
