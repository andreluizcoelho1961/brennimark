/**
 * As campanhas de e-mail de marketing (22/10/2026): o texto mora AQUI, no
 * código, com teste. O banco guarda só o identificador (`envios_de_email`), para
 * saber quem já recebeu o quê. Texto novo é uma campanha nova, com id novo: o
 * mesmo id nunca sai duas vezes para a mesma pessoa.
 *
 * `{nome}` vira o primeiro nome de quem recebe. Sem imagem, sem rastreio, sem
 * fonte externa: o mesmo desenho dos outros e-mails do produto.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export type Idioma = "pt-BR" | "en";

/** O texto de uma campanha num idioma. O português é o corpo da campanha; o inglês vai em `en`. */
export type TextoDaCampanha = { assunto: string; paragrafos: string[]; botao?: { rotulo: string; caminho: string } };

export type Campanha = {
  id: string;
  rotulo: string;
  assunto: string;
  paragrafos: string[];
  /** `caminho` é relativo ao site (`/fonts`); o servidor monta o endereço inteiro. */
  botao?: { rotulo: string; caminho: string };
  /**
   * A mesma campanha em inglês, OBRIGATÓRIA: quem se cadastrou pela tela em inglês recebe o
   * e-mail inteiro em inglês (texto e rodapé legal), nunca um corpo em português com rodapé
   * em inglês. O `caminho` do botão continua o do português; o servidor o leva ao site em
   * inglês.
   */
  en: { assunto: string; paragrafos: string[]; botao?: { rotulo: string } };
};

export const CAMPANHAS: readonly Campanha[] = [
  {
    id: "convite-fonts-beta",
    rotulo: "Convite do beta do Brennimark Fonts",
    assunto: "Brennimark Fonts: um kit por marca, um clique para ativar",
    paragrafos: [
      "Olá, {nome}.",
      "Brennimark Fonts. O gerenciador de fontes pensado para quem trabalha com marcas.",
      "Um kit tipográfico por cliente, versionado. Um clique, e as fontes da marca ficam ativas na sua sessão de trabalho, protegidas de conflito com as fontes que já estão no sistema.",
      "Escolha o documento e o kit, e abra o InDesign, o Illustrator ou o Photoshop com as fontes do cliente prontas.",
      "Prévia completa de glifos e OpenType. Fontes parecidas, encontradas na sua própria biblioteca. Pastas vigiadas. Mac e Windows.",
      "Beta para os 50 primeiros. Gratuito por 90 dias.",
    ],
    botao: { rotulo: "Pedir o meu convite", caminho: "/fonts" },
    en: {
      assunto: "Brennimark Fonts: one kit per brand, one click to activate",
      paragrafos: [
        "Hi, {nome}.",
        "Brennimark Fonts. The font manager built for people who work with brands.",
        "One type kit per client, versioned. One click, and the brand's fonts are active in your working session, protected from conflicts with the fonts already on your system.",
        "Pick the document and the kit, then open InDesign, Illustrator or Photoshop with the client's fonts ready.",
        "Full glyph and OpenType preview. Similar fonts, found in your own library. Watched folders. Mac and Windows.",
        "Beta for the first 50. Free for 90 days.",
      ],
      botao: { rotulo: "Request my invite" },
    },
  },
];

/** O texto da campanha no idioma de quem recebe. O caminho do botão é sempre o do português. */
export function textoDaCampanha(c: Campanha, idioma: Idioma): TextoDaCampanha {
  if (idioma === "en") {
    return { assunto: c.en.assunto, paragrafos: c.en.paragrafos, botao: c.botao && c.en.botao ? { rotulo: c.en.botao.rotulo, caminho: c.botao.caminho } : undefined };
  }
  return { assunto: c.assunto, paragrafos: c.paragrafos, botao: c.botao };
}

/** O idioma que o banco devolve por destinatário; qualquer coisa fora de `en` é o padrão do produto. */
export function idiomaDoDestinatario(valor: unknown): Idioma {
  return valor === "en" ? "en" : "pt-BR";
}

export function campanhaDe(id: unknown): Campanha | null {
  return CAMPANHAS.find((c) => c.id === id) ?? null;
}

/** O primeiro nome, sem inventar: nome vazio vira "tudo bem" no cumprimento, e nunca "undefined". */
export function primeiroNome(nome: string | null | undefined): string {
  const t = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  return t.length > 0 ? t : "";
}

/** Troca `{nome}`; sem nome, o cumprimento "Olá, ." fica "Olá." */
export function personalizar(texto: string, nome: string | null | undefined): string {
  const n = primeiroNome(nome);
  return texto.replace(", {nome}", n ? `, ${n}` : "").replace("{nome}", n);
}
