/**
 * A vitrine de planos da home: as quatro faixas da escada, cada uma com o
 * plano "com IA" (o Vini da plataforma) e o "traga a sua IA".
 *
 * O VALOR que a pessoa paga mora no Stripe (preço registrado no Console →
 * Cobrança); o que aparece aqui é a MESMA conta escrita à mão, porque a tabela
 * `precos_do_plano` guarda só o id do preço, não o valor. Mudou o preço no
 * Stripe → mude aqui no mesmo dia, ou a vitrine promete o que o checkout não
 * cobra. O código de cada plano precisa existir em `public.planos` com
 * `a_venda = true` (migration 20261108200726); `vitrine-de-planos.test.ts`
 * confere isso contra a migration.
 */
export type PlanoDaVitrine = { codigo: string; reais: number };

export type FaixaDaVitrine = {
  /** Chave de tradução do nome e da frase de público (`home.faixa_<id>_*`). */
  id: "faisca" | "ferro" | "forja" | "brasa";
  marcas: number;
  /** O Vini da plataforma: a franquia de perguntas por mês vem junto. */
  comIa: PlanoDaVitrine & { perguntasPorMes: number };
  /** A agência usa a própria chave de IA. */
  propria: PlanoDaVitrine;
  destaque?: boolean;
};

export const FAIXAS_DA_VITRINE: FaixaDaVitrine[] = [
  { id: "faisca", marcas: 1, comIa: { codigo: "uma-marca-com-ia", reais: 119, perguntasPorMes: 100 }, propria: { codigo: "uma-marca-sem-ia", reais: 79 } },
  { id: "ferro", marcas: 5, comIa: { codigo: "a-com-ia", reais: 199, perguntasPorMes: 300 }, propria: { codigo: "a-sem-ia", reais: 150 }, destaque: true },
  { id: "forja", marcas: 15, comIa: { codigo: "b-com-ia", reais: 520, perguntasPorMes: 1000 }, propria: { codigo: "b-sem-ia", reais: 400 } },
  { id: "brasa", marcas: 30, comIa: { codigo: "c-com-ia", reais: 890, perguntasPorMes: 2000 }, propria: { codigo: "c-sem-ia", reais: 690 } },
];
