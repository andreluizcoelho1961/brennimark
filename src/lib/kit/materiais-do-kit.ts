/**
 * De onde o Kit do assinante tira os desenhos (10/10/2026): os MATERIAIS da
 * marca, sem subir arquivo. Esta escolha é pura; a rota lê as variantes com a
 * sessão (a RLS decide quem vê) e o navegador busca os originais pela rota do
 * kit da biblioteca, que registra cada download antes de assinar o endereço
 * (ADR-0007 §2.4).
 *
 * - logotipo: item `logo`, a variante mais "padrão" — principal, horizontal,
 *   colorida, positiva, RGB (é tela) e, entre iguais, SVG (é vetor);
 * - negativo: a mesma preferência, polaridade negativa;
 * - símbolo: os Materiais não têm tipo "símbolo"; o mais próximo é `icone`
 *   (sem hierarquia nem lockup) — colorido, positivo, RGB, SVG.
 * Variante descontinuada não entra (a rota já filtra).
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

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
};

export type DesenhosDaMarca = {
  logo: VarianteDoKit | null;
  negativo: VarianteDoKit | null;
  simbolo: VarianteDoKit | null;
};

function pontos(v: VarianteDoKit, polaridade: "positivo" | "negativo"): number {
  if (v.polaridade && v.polaridade !== polaridade) return -1;
  let p = 0;
  if (v.hierarquia === "principal") p += 16;
  if (v.lockup === "horizontal") p += 8;
  if (v.cor === "colorido") p += 4;
  if (v.espacoDeCor === "rgb") p += 2;
  if (/svg/i.test(v.mime) || /\.svg$/i.test(v.arquivo)) p += 1;
  return p;
}

function melhor(variantes: readonly VarianteDoKit[], tipo: VarianteDoKit["tipo"], polaridade: "positivo" | "negativo"): VarianteDoKit | null {
  let escolhida: VarianteDoKit | null = null;
  let maior = -1;
  for (const v of variantes) {
    if (v.tipo !== tipo || !/^image\/(svg\+xml|png|jpeg|webp)$/i.test(v.mime)) continue;
    const p = pontos(v, polaridade);
    if (p > maior) { maior = p; escolhida = v; }
  }
  return escolhida;
}

export function escolherDesenhos(variantes: readonly VarianteDoKit[]): DesenhosDaMarca {
  const logo = melhor(variantes, "logo", "positivo");
  const negativo = variantes.some((v) => v.tipo === "logo" && v.polaridade === "negativo") ? melhor(variantes, "logo", "negativo") : null;
  return { logo, negativo, simbolo: melhor(variantes, "icone", "positivo") };
}
