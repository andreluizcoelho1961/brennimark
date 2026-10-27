/**
 * O tour guiado da plataforma (27/10/2026): os passos e a conta de onde o balão
 * fica. A parte visual está em `components/demonstracao/TourGuiado.tsx`; aqui só
 * o que se testa sem navegador.
 *
 * Cada passo aponta para um elemento da tela por seletor (as âncoras já existem:
 * as abas do manual e o botão do Vini). Se o elemento não está na tela, o balão
 * aparece no centro — o tour nunca fica preso por causa de uma página diferente.
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export type Passo = {
  id: "boas-vindas" | "manual" | "materiais" | "vini" | "fim";
  /** O elemento que o balão aponta; ausente = balão no centro. */
  seletor?: string;
  titulo: { "pt-BR": string; en: string };
  texto: { "pt-BR": string; en: string };
};

export const PASSOS_DO_TOUR: readonly Passo[] = [
  {
    id: "boas-vindas",
    titulo: { "pt-BR": "Bem-vindo ao tour", en: "Welcome to the tour" },
    texto: {
      "pt-BR": "Esta é uma marca de demonstração. Em um minuto você vê como o Brennimark organiza o manual, os arquivos e o Vini.",
      en: "This is a demo brand. In one minute you'll see how Brennimark organizes the manual, the files and Vini.",
    },
  },
  {
    id: "manual",
    seletor: '[data-parte-do-segmentado="manual"]',
    titulo: { "pt-BR": "O manual", en: "The manual" },
    texto: {
      "pt-BR": "Leia o manual como o estúdio diagramou, com índice e busca. Cada página tem um status: pronta, rascunho ou pendente.",
      en: "Read the manual as the studio laid it out, with index and search. Every page has a status: ready, draft or pending.",
    },
  },
  {
    id: "materiais",
    seletor: '[data-parte-do-segmentado="materiais"]',
    titulo: { "pt-BR": "Materiais", en: "Materials" },
    texto: {
      "pt-BR": "Logos, fotos, paleta e fontes num só lugar. Baixe cada arquivo com a regra de uso junto.",
      en: "Logos, photos, palette and fonts in one place. Download each file with its usage rule attached.",
    },
  },
  {
    id: "vini",
    seletor: "[data-vini]",
    titulo: { "pt-BR": "O Vini", en: "Vini" },
    texto: {
      "pt-BR": "Pergunte ao Vini sobre a marca. Ele cita a página do manual e o status da regra. No tour são 2 perguntas.",
      en: "Ask Vini about the brand. He cites the manual page and the status of the rule. The tour gives you 2 questions.",
    },
  },
  {
    id: "fim",
    titulo: { "pt-BR": "Gostou?", en: "Like it?" },
    texto: {
      "pt-BR": "Importe o manual da sua marca e deixe o Brennimark trabalhar por ela.",
      en: "Import your own brand manual and let Brennimark work for it.",
    },
  },
];

export const CHAVE_DE_VISTO = "bm-tour-guiado-visto";

export function proximoPasso(atual: number, total: number): number | "fim" {
  return atual + 1 >= total ? "fim" : atual + 1;
}

export function passoAnterior(atual: number): number {
  return Math.max(0, atual - 1);
}

export type Retangulo = { topo: number; esquerda: number; largura: number; altura: number };
export type Tamanho = { largura: number; altura: number };
export type Posicao = { topo: number; esquerda: number; modo: "centro" | "abaixo" | "acima" };

const FOLGA = 12;
const MARGEM = 12;

/**
 * Onde o balão fica. Sem alvo, no centro. Com alvo, abaixo dele se couber, senão
 * acima; na horizontal, centralizado no alvo e preso às margens da tela. Se não
 * cabe nem acima nem abaixo (alvo gigante), cai no centro.
 */
export function posicaoDoBalao(alvo: Retangulo | null, janela: Tamanho, balao: Tamanho): Posicao {
  const centro: Posicao = {
    topo: Math.max(MARGEM, (janela.altura - balao.altura) / 2),
    esquerda: Math.max(MARGEM, (janela.largura - balao.largura) / 2),
    modo: "centro",
  };
  if (!alvo || alvo.largura <= 0 || alvo.altura <= 0) return centro;

  const esquerda = Math.min(
    Math.max(MARGEM, alvo.esquerda + alvo.largura / 2 - balao.largura / 2),
    Math.max(MARGEM, janela.largura - balao.largura - MARGEM),
  );
  const abaixo = alvo.topo + alvo.altura + FOLGA;
  if (abaixo + balao.altura + MARGEM <= janela.altura) return { topo: abaixo, esquerda, modo: "abaixo" };
  const acima = alvo.topo - FOLGA - balao.altura;
  if (acima >= MARGEM) return { topo: acima, esquerda, modo: "acima" };
  return centro;
}

export function jaFoiVisto(guardado: string | null): boolean {
  return guardado === "1";
}
