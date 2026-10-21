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
    assunto: "O beta do Brennimark Fonts abriu: 50 convites, 90 dias grátis",
    paragrafos: [
      "Olá, {nome}.",
      "O Brennimark Fonts, o aplicativo para organizar, visualizar e ativar as fontes da sua biblioteca, está abrindo o beta para os 50 primeiros convidados.",
      "O beta é gratuito por 90 dias. A sua biblioteca continua no seu computador: o aplicativo não envia as suas fontes para lugar nenhum.",
      "Para pedir o seu convite, use o botão abaixo.",
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
