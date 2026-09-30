/**
 * Configurações › Consumo — o que a conta usou, para quem a administra
 * (30/09/2026).
 *
 * Decisão do André: o assinante vê USO e quanto do TETO já foi usado, e nunca
 * dinheiro. O custo que existe é estimativa pelo preço de tabela, na fase de
 * testes nada foi cobrado, e os planos ainda não têm valor — mostrar dólar
 * agora ancoraria um preço que ninguém decidiu. Por isso nada aqui devolve
 * micros: o valor em dinheiro entra, vira percentual e para aqui.
 *
 * Duas réguas de tempo, de propósito:
 * - as CONTAGENS do mês usam o mês de Brasília, como o Console
 *   (`intervaloDoMes`);
 * - o TETO usa o dia e o mês em UTC, porque é assim que a reserva
 *   (`reservar_execucao_de_ia_server`) confere. Um percentual calculado em
 *   outro fuso diria "sobra" quando o banco já recusa.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export { intervaloDoMes, diaDeReferencia, tamanho, milhares } from "../console/custos";

/** Uma execução do Vini, como o razão guarda — só o que a contagem precisa. */
export type ExecucaoDoMes = { brand_id: string | null; task: string };

/** Uma linha do razão desde o início do mês UTC — para o teto. */
export type GastoDoRazao = {
  status: string;
  reserved_micros: number;
  settled_micros: number | null;
  created_at: string;
};

export type ArmazenamentoDaMarca = { brand_id: string | null; bucket_id: string; bytes: number };

export type Orcamento = {
  brand_id: string | null;
  period: string;
  limit_micros: number | null;
  kill_switch: boolean;
};

export type EstadoDoTeto = "ok" | "alerta" | "esgotado";

export type Teto = { periodo: "dia" | "mes"; pct: number; estado: EstadoDoTeto };

export type ConsumoDaMarca = {
  id: string | null;
  nome: string;
  perguntas: number;
  analises: number;
  prompts: number;
  manuais_bytes: number;
  materiais_bytes: number;
  pecas_bytes: number;
  pausada: boolean;
};

export type Consumo = {
  mes: string;
  marcas: ConsumoDaMarca[];
  totais: Omit<ConsumoDaMarca, "id" | "nome" | "pausada">;
  tetos: Teto[];
  contaPausada: boolean;
  /** O dia da fotografia de armazenamento usada, ou `null` se não há nenhuma. */
  fotografia: string | null;
};

const TAREFA: Record<string, "perguntas" | "analises" | "prompts"> = {
  assist: "perguntas",
  "analyse-image": "analises",
  prompt: "prompts",
};

const BUCKET: Record<string, "manuais_bytes" | "materiais_bytes" | "pecas_bytes"> = {
  "brand-imports": "manuais_bytes",
  "brand-assets": "materiais_bytes",
  "analysis-evidence": "pecas_bytes",
};

/** O início do dia e do mês em UTC — a régua da reserva (`date_trunc` no banco). */
export function inicioUtc(agora = new Date()): { dia: string; mes: string } {
  const a = agora.getUTCFullYear();
  const m = agora.getUTCMonth();
  return {
    dia: new Date(Date.UTC(a, m, agora.getUTCDate())).toISOString(),
    mes: new Date(Date.UTC(a, m, 1)).toISOString(),
  };
}

/** Percentual do teto, com a mesma soma da reserva: o consolidado, ou o reservado se ainda não consolidou. */
export function percentualDoTeto(gasto: readonly GastoDoRazao[], desde: string, limite: number): { pct: number; estado: EstadoDoTeto } {
  const usado = gasto
    .filter((g) => (g.status === "reserved" || g.status === "settled") && g.created_at >= desde)
    .reduce((s, g) => s + (g.status === "settled" ? (g.settled_micros ?? 0) : g.reserved_micros), 0);
  const pct = limite > 0 ? Math.round((usado / limite) * 100) : 100;
  return { pct, estado: pct >= 100 ? "esgotado" : pct >= 80 ? "alerta" : "ok" };
}

export function resumoDoConsumo({
  mes,
  marcas,
  execucoes,
  gasto,
  armazenamento,
  orcamentos,
  fotografia,
  agora = new Date(),
  semMarca = "Sem marca",
  marcaApagada = "Marca apagada",
}: {
  mes: string;
  /** Todas as marcas da conta: marca sem uso aparece com zero, e não some. */
  marcas: readonly { id: string; nome: string }[];
  execucoes: readonly ExecucaoDoMes[];
  gasto: readonly GastoDoRazao[];
  armazenamento: readonly ArmazenamentoDaMarca[];
  orcamentos: readonly Orcamento[];
  fotografia: string | null;
  agora?: Date;
  semMarca?: string;
  marcaApagada?: string;
}): Consumo {
  const linhas = new Map<string | null, ConsumoDaMarca>();
  const linha = (id: string | null, nome: string) => {
    let l = linhas.get(id);
    if (!l) {
      l = { id, nome, perguntas: 0, analises: 0, prompts: 0, manuais_bytes: 0, materiais_bytes: 0, pecas_bytes: 0, pausada: false };
      linhas.set(id, l);
    }
    return l;
  };
  const nomes = new Map(marcas.map((m) => [m.id, m.nome]));
  // Marca que existia e foi apagada ainda pode ter armazenamento na fotografia
  // (a tabela guarda o histórico sem FK para `brands`).
  const doId = (id: string | null) => linha(id, id === null ? semMarca : (nomes.get(id) ?? marcaApagada));

  for (const m of marcas) linha(m.id, m.nome);
  for (const e of execucoes) {
    const campo = TAREFA[e.task];
    if (campo) doId(e.brand_id)[campo] += 1;
  }
  for (const a of armazenamento) {
    const campo = BUCKET[a.bucket_id];
    if (campo) doId(a.brand_id)[campo] += a.bytes;
  }

  const pausadas = new Set(orcamentos.filter((o) => o.brand_id !== null && o.kill_switch).map((o) => o.brand_id));
  for (const l of linhas.values()) l.pausada = l.id !== null && pausadas.has(l.id);

  const lista = [...linhas.values()]
    // As marcas da conta primeiro, na ordem de nome; depois o que não é marca viva.
    .sort((a, b) => Number(!nomes.has(a.id ?? "")) - Number(!nomes.has(b.id ?? "")) || a.nome.localeCompare(b.nome, "pt-BR"));

  const totais = lista.reduce(
    (t, l) => ({
      perguntas: t.perguntas + l.perguntas,
      analises: t.analises + l.analises,
      prompts: t.prompts + l.prompts,
      manuais_bytes: t.manuais_bytes + l.manuais_bytes,
      materiais_bytes: t.materiais_bytes + l.materiais_bytes,
      pecas_bytes: t.pecas_bytes + l.pecas_bytes,
    }),
    { perguntas: 0, analises: 0, prompts: 0, manuais_bytes: 0, materiais_bytes: 0, pecas_bytes: 0 },
  );

  const inicio = inicioUtc(agora);
  const tetos: Teto[] = [];
  for (const [period, periodo, desde] of [["daily", "dia", inicio.dia], ["monthly", "mes", inicio.mes]] as const) {
    const o = orcamentos.find((x) => x.brand_id === null && x.period === period);
    if (o && o.limit_micros !== null) tetos.push({ periodo, ...percentualDoTeto(gasto, desde, o.limit_micros) });
  }

  return {
    mes,
    marcas: lista,
    totais,
    tetos,
    contaPausada: orcamentos.some((o) => o.brand_id === null && o.kill_switch),
    fotografia,
  };
}
