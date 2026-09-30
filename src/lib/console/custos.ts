/**
 * O painel de custos do Console da Brennimark — etapa 1 (28/09/2026).
 *
 * Decisão do André: a IA é da plataforma, e a Brennimark precisa de
 * "controle financeiro absoluto" — quanto cada conta e cada marca consome, por
 * mês. Aqui fica o que é puro: o intervalo do mês, os totais e a formatação.
 * Quem pode ver decide o banco (funções `console_*`, só para a equipe).
 *
 * O custo vem do razão pelo PREÇO DE TABELA do catálogo, e não da fatura do
 * provedor: é estimativa até ser conciliado com a fatura do mês — a tela diz
 * isso. Na fase de testes (IA gratuita), nada foi de fato cobrado.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type LinhaDeIa = {
  workspace_id: string; conta: string; brand_id: string | null; marca: string | null;
  provider: string | null; model: string | null; currency: string;
  execucoes: number; tokens_entrada: number; tokens_saida: number;
  custo_micros: number; sem_uso_medido: number;
  /** A parte do custo liquidada pelo TETO (sem uso medido): incerta, a conciliar. */
  custo_incerto_micros?: number;
  /** Execuções que o provedor recusou sem processar: custo zero, medido. */
  recusadas?: number;
};

export type LinhaDeArmazenamento = {
  workspace_id: string; conta: string; brand_id: string | null; marca: string | null;
  bucket_id: string; dia: string; objetos: number; bytes: number;
};

export type LinhaDeLimite = {
  workspace_id: string; conta: string; brand_id: string | null; marca: string | null;
  /** `null` só em linha de MARCA: existe para a trava, sem teto próprio (30/09/2026). */
  period: string; limit_micros: number | null; currency: string; kill_switch: boolean; gasto_hoje_micros: number;
};

/** "2026-09" → o mês de Brasília em UTC: [início, fim). Mês torto vira o atual. */
export function intervaloDoMes(mes: string | null | undefined, agora = new Date()): { mes: string; inicio: string; fim: string } {
  const atual = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(agora).slice(0, 7);
  const valido = /^\d{4}-(0[1-9]|1[0-2])$/.test(mes ?? "") ? mes! : atual;
  const [ano, m] = valido.split("-").map(Number);
  const proximo = m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, "0")}`;
  return {
    mes: valido,
    inicio: new Date(`${valido}-01T00:00:00-03:00`).toISOString(),
    fim: new Date(`${proximo}-01T00:00:00-03:00`).toISOString(),
  };
}

/** O último dia do mês (ou hoje, se o mês é o atual) — para a fotografia de armazenamento. */
export function diaDeReferencia(mes: string, agora = new Date()): string {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
  const [ano, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(ano, m, 0)).toISOString().slice(0, 10);
  return ultimo < hoje ? ultimo : hoje;
}

export type TotalDeConta = {
  workspace_id: string; conta: string;
  execucoes: number; tokens_entrada: number; tokens_saida: number;
  custo_micros: number; sem_uso_medido: number; custo_incerto_micros: number; recusadas: number; bytes: number;
  marcas: { brand_id: string | null; marca: string; execucoes: number; custo_micros: number; bytes: number }[];
};

/**
 * Tudo por conta, e dentro dela por marca — as linhas de IA (várias por
 * modelo) e de armazenamento (várias por tipo de arquivo) somadas. Ordem: quem
 * custa mais primeiro.
 */
export function totaisPorConta(ia: readonly LinhaDeIa[], armazenamento: readonly LinhaDeArmazenamento[], semMarca = "Sem marca"): TotalDeConta[] {
  const contas = new Map<string, TotalDeConta>();
  const conta = (id: string, nome: string) => {
    if (!contas.has(id)) contas.set(id, { workspace_id: id, conta: nome, execucoes: 0, tokens_entrada: 0, tokens_saida: 0, custo_micros: 0, sem_uso_medido: 0, custo_incerto_micros: 0, recusadas: 0, bytes: 0, marcas: [] });
    return contas.get(id)!;
  };
  const marca = (c: TotalDeConta, id: string | null, nome: string | null) => {
    let m = c.marcas.find((x) => x.brand_id === id);
    if (!m) { m = { brand_id: id, marca: nome ?? semMarca, execucoes: 0, custo_micros: 0, bytes: 0 }; c.marcas.push(m); }
    return m;
  };
  for (const l of ia) {
    const c = conta(l.workspace_id, l.conta);
    c.execucoes += l.execucoes; c.tokens_entrada += l.tokens_entrada; c.tokens_saida += l.tokens_saida;
    c.custo_micros += l.custo_micros; c.sem_uso_medido += l.sem_uso_medido;
    c.custo_incerto_micros += l.custo_incerto_micros ?? 0; c.recusadas += l.recusadas ?? 0;
    const m = marca(c, l.brand_id, l.marca);
    m.execucoes += l.execucoes; m.custo_micros += l.custo_micros;
  }
  for (const l of armazenamento) {
    const c = conta(l.workspace_id, l.conta);
    c.bytes += l.bytes;
    marca(c, l.brand_id, l.marca).bytes += l.bytes;
  }
  const lista = [...contas.values()];
  for (const c of lista) c.marcas.sort((a, b) => b.custo_micros - a.custo_micros || b.bytes - a.bytes);
  return lista.sort((a, b) => b.custo_micros - a.custo_micros || b.bytes - a.bytes);
}

/** Micro-unidades → "US$ 1,79". Menos de um centavo aparece com quatro casas. */
export function dinheiro(micros: number, moeda = "USD"): string {
  const valor = micros / 1_000_000;
  const casas = valor !== 0 && Math.abs(valor) < 0.01 ? 4 : 2;
  const simbolo = moeda === "USD" ? "US$" : moeda === "BRL" ? "R$" : moeda;
  return `${simbolo} ${valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
}

/** Com a cotação que a pessoa digitar: "≈ R$ 9,40". Sem cotação, nada. */
export function emReais(micros: number, cotacao: number | null): string | null {
  if (!cotacao || !(cotacao > 0)) return null;
  return `≈ ${dinheiro(micros * cotacao, "BRL")}`;
}

export function tamanho(bytes: number): string {
  const unidades = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < unidades.length - 1) { v /= 1024; i += 1; }
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: i === 0 ? 0 : 1 })} ${unidades[i]}`;
}

export function milhares(n: number): string {
  return n.toLocaleString("pt-BR");
}

/** Quanto do limite do dia já foi usado; "alerta" a partir de 80%. */
export function usoDoLimite(l: Pick<LinhaDeLimite, "limit_micros" | "gasto_hoje_micros" | "kill_switch">): { pct: number; estado: "ok" | "alerta" | "esgotado" | "desligado" } {
  if (l.kill_switch) return { pct: 0, estado: "desligado" };
  // Sem teto próprio (linha de marca que só existe para a trava): nada a esgotar.
  if (l.limit_micros === null) return { pct: 0, estado: "ok" };
  const pct = l.limit_micros > 0 ? Math.round((l.gasto_hoje_micros / l.limit_micros) * 100) : 100;
  return { pct, estado: pct >= 100 ? "esgotado" : pct >= 80 ? "alerta" : "ok" };
}
