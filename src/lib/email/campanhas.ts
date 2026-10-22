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
export type Campanha = {
  id: string;
  rotulo: string;
  assunto: string;
  paragrafos: string[];
  /** `caminho` é relativo ao site (`/fonts`); o servidor monta o endereço inteiro. */
  botao?: { rotulo: string; caminho: string };
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
  },
];

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
