/**
 * Como a resposta terminou — e o aviso quando não terminou.
 *
 * No ensaio de 19/09 o Vini parou no meio da frase ("(such as the Sony") e a
 * janela mostrou o pedaço como se fosse a resposta inteira. O provedor diz
 * POR QUE parou (`finishReason`: terminou, bateu no teto, filtro de conteúdo…),
 * e ninguém lia. Resposta pela metade apresentada como completa é o erro que a
 * honestidade editorial proíbe: o diretor de arte não sabe o que faltou.
 *
 * O chat responde em texto corrido, com os cabeçalhos já enviados quando o
 * motivo fica conhecido. Então o servidor acrescenta, AO FIM do fluxo, uma
 * marca que a janela reconhece, tira do texto e transforma em aviso. A marca
 * começa com um separador invisível (U+2063) para nunca coincidir com texto
 * que um modelo escreveria.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

const INICIO = "⁣[[brennimark:incompleta:";
const FIM = "]]";

/** Os motivos que significam "terminou de verdade". */
const TERMINOU = new Set(["stop"]);

/** O que o servidor acrescenta ao fluxo, ou `null` quando terminou bem. */
export function marcaDeFim(motivo: string | null | undefined): string | null {
  const limpo = (motivo ?? "unknown").replace(/[^a-z-]/gi, "").slice(0, 32) || "unknown";
  return TERMINOU.has(limpo) ? null : `${INICIO}${limpo}${FIM}`;
}

/**
 * Separa o texto da marca. Durante o fluxo, um pedaço da marca pode chegar
 * antes do resto — ele também sai do texto, para a pessoa nunca ver
 * `[[brennimark:` piscando no fim da resposta.
 */
export function separarFim(texto: string): { texto: string; interrompida: string | null } {
  const onde = texto.lastIndexOf(INICIO);
  if (onde >= 0) {
    const resto = texto.slice(onde + INICIO.length);
    const fecha = resto.indexOf(FIM);
    return {
      texto: texto.slice(0, onde),
      interrompida: fecha >= 0 ? resto.slice(0, fecha) || "unknown" : null,
    };
  }
  // Prefixo parcial da marca no fim do texto (o fluxo ainda não trouxe o resto).
  for (let n = Math.min(INICIO.length - 1, texto.length); n > 0; n--) {
    if (texto.endsWith(INICIO.slice(0, n))) return { texto: texto.slice(0, -n), interrompida: null };
  }
  return { texto, interrompida: null };
}

/** O aviso, dito à pessoa sem jargão de provedor. */
export function avisoDeInterrupcao(motivo: string, ingles = false): string {
  const porque: Record<string, [string, string]> = {
    length: ["a resposta passou do tamanho máximo", "the answer went past the maximum length"],
    "content-filter": ["o filtro de conteúdo do provedor interrompeu", "the provider's content filter stopped it"],
    error: ["o provedor encontrou um erro", "the provider hit an error"],
  };
  const par = porque[motivo];
  if (ingles) {
    return `This answer stopped before finishing${par ? ` — ${par[1]}` : ""}. What's above may be incomplete; try again or rephrase.`;
  }
  return `Esta resposta parou antes de terminar${par ? ` — ${par[0]}` : ""}. O que está acima pode estar incompleto; tente de novo ou reformule.`;
}
