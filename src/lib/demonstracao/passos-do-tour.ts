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
  id: "boas-vindas" | "manual" | "materiais" | "complementos" | "kit" | "cores" | "grids" | "vini" | "vini-prompt" | "vini-peca" | "assinatura" | "fim";
  /** O elemento que o balão aponta; ausente = balão no centro. */
  seletor?: string;
  /** Onde o balão se apoia, quando não é o próprio elemento (ex.: a janela inteira do Vini, que é grande). */
  ancora?: string;
  /** O que a tela precisa ter antes do passo: a janela do Vini aberta (passos dos controles dele) ou recolhida (passos que vêm depois). */
  prepara?: "abrir-vini" | "fechar-vini";
  /** O passo oferece abrir a ferramenta: o endereço sai do próprio elemento apontado (um link). */
  abrir?: boolean;
  titulo: { "pt-BR": string; en: string };
  texto: { "pt-BR": string; en: string };
  /** Uma lista curta sob o texto (o que a assinatura traz e o visitante não enxerga). */
  itens?: { "pt-BR": readonly string[]; en: readonly string[] };
};

/*
 * Os textos das ferramentas partem das dicas dos menus que o André aprovou em
 * 15/10/2026 (`components/shell/dicas.ts`) e acrescentam COMO funciona, em uma
 * ou duas frases: o tour precisa ensinar, não só apontar.
 */
export const PASSOS_DO_TOUR: readonly Passo[] = [
  {
    id: "boas-vindas",
    titulo: { "pt-BR": "Bem-vindo ao tour", en: "Welcome to the tour" },
    texto: {
      "pt-BR": "Esta é uma marca de demonstração. Em poucos minutos você vê como o Brennimark organiza o manual, os arquivos, as ferramentas e o Vini.",
      en: "This is a demo brand. In a few minutes you'll see how Brennimark organizes the manual, the files, the tools and Vini.",
    },
  },
  {
    id: "manual",
    seletor: '[data-parte-do-segmentado="manual"]',
    titulo: { "pt-BR": "O manual", en: "The manual" },
    texto: {
      "pt-BR": "Leia o manual como o estúdio diagramou, com índice e busca. Cada página tem um status: pronta, rascunho ou pendente. O Vini só afirma o que está aprovado.",
      en: "Read the manual as the studio laid it out, with index and search. Every page has a status: ready, draft or pending. Vini only states what is approved.",
    },
  },
  {
    id: "materiais",
    seletor: '[data-parte-do-segmentado="materiais"]',
    titulo: { "pt-BR": "Materiais", en: "Materials" },
    texto: {
      "pt-BR": "Logos, fotos, paleta e fontes num só lugar. Cada arquivo vem com a regra de uso junto, e cada download fica registrado.",
      en: "Logos, photos, palette and fonts in one place. Each file comes with its usage rule, and every download is logged.",
    },
  },
  {
    id: "complementos",
    seletor: '[data-parte-do-segmentado="complementos"]',
    titulo: { "pt-BR": "Complementos", en: "Supplements" },
    texto: {
      "pt-BR": "Regras que o manual não cobre, escritas pela própria marca e publicadas por versão. O Vini também consulta os complementos ao responder.",
      en: "Rules the manual doesn't cover, written by the brand itself and published by version. Vini also reads the supplements when answering.",
    },
  },
  {
    id: "kit",
    seletor: '[data-item-da-coluna$="/docs/kit"]',
    abrir: true,
    titulo: { "pt-BR": "Kit da marca", en: "Brand kit" },
    texto: {
      "pt-BR": "Gera o logo em todos os tamanhos de site, redes, e-mail e apresentação, respeitando as regras do manual. Escolha a aba do destino, veja a prévia e baixe tudo num .zip organizado por pasta.",
      en: "Makes the logo in every size for site, social, email and slides, following the manual's rules. Pick a destination tab, preview it and download everything as a .zip organized by folder.",
    },
  },
  {
    id: "cores",
    seletor: '[data-item-da-coluna$="/docs/cores"]',
    abrir: true,
    titulo: { "pt-BR": "Cores da marca", en: "Brand colors" },
    texto: {
      "pt-BR": "Mede qualquer cor (com o conta-gotas ou num print) e diz se ela é da marca e qual a mais próxima. Mostra o contraste do texto, como um daltônico a vê e copia HEX, RGB e CMYK.",
      en: "Measures any color (with the eyedropper or on a screenshot) and tells whether it's the brand's and which is closest. Shows text contrast and color-blind views, and copies HEX, RGB and CMYK.",
    },
  },
  {
    id: "grids",
    seletor: '[data-item-da-coluna$="/docs/grids"]',
    abrir: true,
    titulo: { "pt-BR": "Grids da marca", en: "Brand grids" },
    texto: {
      "pt-BR": "Monta o documento do InDesign (.idml) com o grid, o logo, as cores e as fontes da marca. Escolha o formato (impresso, rede social, digital ou apresentação) e o tipo de grid, ajuste e baixe.",
      en: "Builds the InDesign document (.idml) with the brand's grid, logo, colors and fonts. Pick the format (print, social, digital or slides) and the grid type, adjust it and download.",
    },
  },
  {
    id: "vini",
    seletor: "[data-botao-do-vini]",
    titulo: { "pt-BR": "O Vini: converse com o manual", en: "Vini: talk to the manual" },
    texto: {
      "pt-BR": "Pergunte qualquer coisa sobre a marca. O Vini lê o manual inteiro e responde citando a página e o status da regra, sem inventar o que não está documentado. No tour são 2 perguntas.",
      en: "Ask anything about the brand. Vini reads the whole manual and answers citing the page and the rule's status, without inventing what isn't documented. The tour gives you 2 questions.",
    },
  },
  {
    id: "vini-prompt",
    prepara: "abrir-vini",
    seletor: "[data-abrir-prompt]",
    ancora: "[data-vini-janela]",
    titulo: { "pt-BR": "Prompts com o DNA da marca", en: "Prompts with the brand's DNA" },
    texto: {
      "pt-BR": "Descreva a peça que vai criar (imagem, vídeo ou texto) e o Vini escreve o prompt para a sua IA já com as cores, a tipografia e as regras da marca. A peça nasce na marca, sem retrabalho. Para assinantes: aqui no tour você só vê como é.",
      en: "Describe the piece you'll create (image, video or text) and Vini writes the prompt for your AI already with the brand's colors, typography and rules. The piece is born on-brand, with no rework. For subscribers: in the tour you only see how it works.",
    },
  },
  {
    id: "vini-peca",
    prepara: "abrir-vini",
    seletor: "[data-clipe-da-peca]",
    ancora: "[data-vini-janela]",
    titulo: { "pt-BR": "Avalie uma peça antes de entregar", en: "Check a piece before you deliver" },
    texto: {
      "pt-BR": "Envie uma peça pronta e o Vini confere se ela segue o manual: logo, cores, tipografia e margens. Ele aponta o que está fora e cita a página, para você corrigir antes de o cliente ver. Menos idas e voltas, menos refações. Para assinantes.",
      en: "Upload a finished piece and Vini checks whether it follows the manual: logo, colors, typography and margins. He points out what's off and cites the page, so you fix it before the client sees it. Fewer rounds, less rework. For subscribers.",
    },
  },
  {
    id: "assinatura",
    prepara: "fechar-vini",
    titulo: { "pt-BR": "E mais, para quem assina", en: "And more, for subscribers" },
    texto: {
      "pt-BR": "O que você viu é o uso do dia a dia. Quem assina também cuida da marca por dentro:",
      en: "What you've seen is everyday use. Subscribers also run the brand from the inside:",
    },
    itens: {
      "pt-BR": [
        "Importar o manual em PDF da sua marca, e ele vira tudo isso.",
        "Pessoas e acesso por marca: cada um vê só o que pode.",
        "Links de entrega com prazo, para enviar materiais a quem não tem conta.",
        "Registros: quem acessou, baixou e mudou o quê, e quando.",
        "Brennimark Fonts (beta): o gerenciador de fontes por marca.",
      ],
      en: [
        "Import your brand's PDF manual, and it becomes all of this.",
        "People and access per brand: everyone sees only what they should.",
        "Expiring delivery links, to send materials to people without an account.",
        "Records: who accessed, downloaded and changed what, and when.",
        "Brennimark Fonts (beta): the per-brand font manager.",
      ],
    },
  },
  {
    id: "fim",
    prepara: "fechar-vini",
    titulo: { "pt-BR": "Gostou?", en: "Like it?" },
    texto: {
      "pt-BR": "Importe o manual da sua marca e deixe o Brennimark trabalhar por ela: manual, materiais, ferramentas e o Vini, tudo com as regras da sua marca.",
      en: "Import your own brand manual and let Brennimark work for it: manual, materials, tools and Vini, all with your brand's rules.",
    },
  },
];

export const CHAVE_DE_VISTO = "bm-tour-guiado-visto";

/** O Vini avisa a faixa do tour que uma pergunta foi feita (ou recusada): ela pergunta o estado de novo. */
export const EVENTO_DO_TOUR = "bm-tour-atualizar";

export function proximoPasso(atual: number, total: number): number | "fim" {
  return atual + 1 >= total ? "fim" : atual + 1;
}

export function passoAnterior(atual: number): number {
  return Math.max(0, atual - 1);
}

export type Retangulo = { topo: number; esquerda: number; largura: number; altura: number };
export type Tamanho = { largura: number; altura: number };
export type Posicao = { topo: number; esquerda: number; modo: "centro" | "abaixo" | "acima" | "direita" | "esquerda" };

const FOLGA = 12;
const MARGEM = 12;

/**
 * Onde o balão fica. Sem alvo, no centro. `ancora` é onde o balão se apoia
 * quando o elemento destacado está dentro de algo maior (a janela do Vini): o
 * balão fica ao lado desse conjunto, na altura do elemento destacado.
 *
 *   - encostado na borda esquerda (a coluna da plataforma): à direita;
 *   - encostado na borda direita (a janela do Vini): à esquerda;
 *   - nos demais, abaixo se couber, senão acima, centralizado e preso às margens.
 *
 * Se não cabe em lugar nenhum (tela estreita, alvo gigante), cai no centro.
 */
export function posicaoDoBalao(alvo: Retangulo | null, janela: Tamanho, balao: Tamanho, ancora?: Retangulo | null): Posicao {
  const centro: Posicao = {
    topo: Math.max(MARGEM, (janela.altura - balao.altura) / 2),
    esquerda: Math.max(MARGEM, (janela.largura - balao.largura) / 2),
    modo: "centro",
  };
  if (!alvo || alvo.largura <= 0 || alvo.altura <= 0) return centro;
  const base = ancora && ancora.largura > 0 && ancora.altura > 0 ? ancora : alvo;

  const alinhado = () => Math.min(
    Math.max(MARGEM, alvo.topo + alvo.altura / 2 - balao.altura / 2),
    Math.max(MARGEM, janela.altura - balao.altura - MARGEM),
  );

  // A coluna lateral: o balão abre ao lado, e não por baixo, onde cobriria os outros itens.
  if (base.esquerda < janela.largura * 0.2) {
    const aDireita = base.esquerda + base.largura + FOLGA;
    if (aDireita + balao.largura + MARGEM <= janela.largura) return { topo: alinhado(), esquerda: aDireita, modo: "direita" };
  }
  // A janela do Vini, na ponta direita: o balão abre à esquerda dela.
  if (ancora && base.esquerda + base.largura > janela.largura * 0.7) {
    const aEsquerda = base.esquerda - FOLGA - balao.largura;
    if (aEsquerda >= MARGEM) return { topo: alinhado(), esquerda: aEsquerda, modo: "esquerda" };
  }

  const esquerda = Math.min(
    Math.max(MARGEM, base.esquerda + base.largura / 2 - balao.largura / 2),
    Math.max(MARGEM, janela.largura - balao.largura - MARGEM),
  );
  const abaixo = base.topo + base.altura + FOLGA;
  if (abaixo + balao.altura + MARGEM <= janela.altura) return { topo: abaixo, esquerda, modo: "abaixo" };
  const acima = base.topo - FOLGA - balao.altura;
  if (acima >= MARGEM) return { topo: acima, esquerda, modo: "acima" };
  return centro;
}

export function jaFoiVisto(guardado: string | null): boolean {
  return guardado === "1";
}
