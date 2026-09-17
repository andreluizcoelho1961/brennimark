/**
 * Item e variante — o vocabulário e a regra dos eixos (ADR-0007 §2.2).
 *
 * QUEM DECIDE É O BANCO. O gatilho `private.conferir_eixos_da_variante` e as
 * constraints de `brand_assets` recusam o que estiver fora daqui, com nome. Este
 * módulo existe para a tela avisar ANTES de enviar 25 MB que vão ser recusados,
 * e para a rota traduzir a recusa do banco numa frase. Se os dois divergirem, o
 * banco vence e a pessoa recebe uma recusa menos clara — por isso a tabela
 * abaixo tem teste, e a prova do banco confere a mesma matriz.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`,
 * que não resolve apelido de caminho.
 */

export const TIPOS_DE_ITEM = ["logo", "icone", "paleta", "fonte", "gabarito", "foto", "ilustracao"] as const;
export type TipoDeItem = (typeof TIPOS_DE_ITEM)[number];

export const EIXOS = {
  hierarquia: ["principal", "secundario"],
  lockup: ["horizontal", "vertical"],
  cor: ["colorido", "monocromatico"],
  polaridade: ["positivo", "negativo"],
  espaco_de_cor: ["rgb", "cmyk"],
} as const;
export type Eixo = keyof typeof EIXOS;
export const NOMES_DOS_EIXOS = Object.keys(EIXOS) as Eixo[];

export type Eixos = { [E in Eixo]: (typeof EIXOS)[E][number] | null };

/** O que cada tipo exige, admite ou proíbe. "proibido" não é "opcional". */
export type Exigencia = "obrigatorio" | "opcional" | "proibido";

const P = "proibido" as const;
const O = "obrigatorio" as const;

export const EIXOS_POR_TIPO: Record<TipoDeItem, Record<Eixo, Exigencia>> = {
  logo:       { hierarquia: O, lockup: O, cor: O, polaridade: O, espaco_de_cor: O },
  icone:      { hierarquia: P, lockup: P, cor: O, polaridade: O, espaco_de_cor: O },
  paleta:     { hierarquia: P, lockup: P, cor: P, polaridade: P, espaco_de_cor: O },
  gabarito:   { hierarquia: P, lockup: P, cor: P, polaridade: P, espaco_de_cor: O },
  foto:       { hierarquia: P, lockup: P, cor: P, polaridade: P, espaco_de_cor: "opcional" },
  ilustracao: { hierarquia: P, lockup: P, cor: P, polaridade: P, espaco_de_cor: "opcional" },
  // Os eixos da fonte não importam: ela não aceita arquivo antes do termo.
  fonte:      { hierarquia: P, lockup: P, cor: P, polaridade: P, espaco_de_cor: P },
};

/**
 * Tipos que ainda não aceitam arquivo, e por quê.
 *
 * A fonte existe no vocabulário e na tela, mas o upload é recusado até existir
 * o termo de licença assinado (ADR-0007 §3, condição 1). O banco recusa do
 * mesmo jeito — isto só faz a tela dizer o motivo antes de pedir o arquivo.
 */
export const TIPOS_SEM_UPLOAD: Partial<Record<TipoDeItem, "exige-termo">> = { fonte: "exige-termo" };

export function ehTipoDeItem(valor: unknown): valor is TipoDeItem {
  return typeof valor === "string" && (TIPOS_DE_ITEM as readonly string[]).includes(valor);
}

/** Lê os eixos de um formulário ou corpo, aceitando só valores do vocabulário. */
export function lerEixos(ler: (nome: Eixo) => unknown): { eixos: Eixos } | { invalido: Eixo } {
  const eixos = {} as Record<Eixo, string | null>;
  for (const nome of NOMES_DOS_EIXOS) {
    const bruto = ler(nome);
    const valor = typeof bruto === "string" ? bruto.trim() : "";
    if (!valor) { eixos[nome] = null; continue; }
    if (!(EIXOS[nome] as readonly string[]).includes(valor)) return { invalido: nome };
    eixos[nome] = valor;
  }
  return { eixos: eixos as Eixos };
}

export type ResultadoDosEixos =
  | { ok: true }
  | { ok: false; motivo: "exige-termo" }
  | { ok: false; motivo: "falta"; eixo: Eixo }
  | { ok: false; motivo: "sobra"; eixo: Eixo };

/** A mesma matriz do gatilho do banco, na mesma ordem de perguntas. */
export function conferirEixos(tipo: TipoDeItem, eixos: Eixos): ResultadoDosEixos {
  if (TIPOS_SEM_UPLOAD[tipo]) return { ok: false, motivo: "exige-termo" };
  const regra = EIXOS_POR_TIPO[tipo];
  for (const nome of NOMES_DOS_EIXOS) {
    if (regra[nome] === "obrigatorio" && eixos[nome] === null) return { ok: false, motivo: "falta", eixo: nome };
    if (regra[nome] === "proibido" && eixos[nome] !== null) return { ok: false, motivo: "sobra", eixo: nome };
  }
  return { ok: true };
}

/**
 * A recusa do banco, traduzida.
 *
 * A rota recebe o nome da constraint (`error.details`/`message` do PostgREST
 * carregam o texto do `raise`), e devolve a frase. Nome desconhecido não vira
 * frase inventada: devolve `null` e a rota diz a mensagem genérica.
 */
export function motivoDaRecusa(textoDoErro: string | null | undefined):
  | "exige-termo" | "eixos" | "item-de-outra-marca" | "substituto-de-outro-item" | "vocabulario" | null {
  const texto = textoDoErro ?? "";
  if (/brand_assets_fonte_exige_termo|termo de licença/.test(texto)) return "exige-termo";
  if (/brand_assets_eixos_|espaco_de_cor_obrigatorio|exige hierarquia|exige cor|exige espaço|não se aplicam|eixos só do logo/.test(texto)) return "eixos";
  if (/brand_assets_item_fkey|item não existe nesta marca/.test(texto)) return "item-de-outra-marca";
  if (/substituto_do_mesmo_item|mesmo item/.test(texto)) return "substituto-de-outro-item";
  if (/brand_assets_(hierarquia|lockup|cor|polaridade|espaco_de_cor)_check/.test(texto)) return "vocabulario";
  return null;
}

const ROTULOS: Record<"pt" | "en", Record<string, string>> = {
  pt: {
    logo: "Logo", icone: "Ícone", paleta: "Paleta", fonte: "Fonte", gabarito: "Gabarito",
    foto: "Foto", ilustracao: "Ilustração",
    hierarquia: "Hierarquia", lockup: "Lockup", cor: "Cor", polaridade: "Polaridade", espaco_de_cor: "Espaço de cor",
    principal: "Principal", secundario: "Secundário", horizontal: "Horizontal", vertical: "Vertical",
    colorido: "Colorido", monocromatico: "Monocromático", positivo: "Positivo", negativo: "Negativo",
    rgb: "RGB", cmyk: "CMYK",
  },
  en: {
    logo: "Logo", icone: "Icon", paleta: "Palette", fonte: "Font", gabarito: "Template",
    foto: "Photo", ilustracao: "Illustration",
    hierarquia: "Hierarchy", lockup: "Lockup", cor: "Color", polaridade: "Polarity", espaco_de_cor: "Color space",
    principal: "Primary", secundario: "Secondary", horizontal: "Horizontal", vertical: "Vertical",
    colorido: "Full color", monocromatico: "Monochrome", positivo: "Positive", negativo: "Negative",
    rgb: "RGB", cmyk: "CMYK",
  },
};

export function rotulo(valor: string, ingles: boolean): string {
  return ROTULOS[ingles ? "en" : "pt"][valor] ?? valor;
}

/** Os eixos que ESTE tipo usa, na ordem da matriz — as colunas da tela. */
export function colunasDoTipo(tipo: TipoDeItem): Eixo[] {
  return NOMES_DOS_EIXOS.filter((nome) => EIXOS_POR_TIPO[tipo][nome] !== "proibido");
}

/** O formato é fato do arquivo, não eixo: vem da extensão, só para exibir. */
export function formatoDoArquivo(nomeDoArquivo: string): string {
  const ponto = nomeDoArquivo.lastIndexOf(".");
  return ponto > 0 && ponto < nomeDoArquivo.length - 1 ? nomeDoArquivo.slice(ponto + 1).toUpperCase() : "—";
}
