"use client";

import { useEffect, useMemo, useState } from "react";
import {
  dinheiro, emReais, milhares, tamanho, totaisPorConta, usoDoLimite,
  type LinhaDeArmazenamento, type LinhaDeIa, type LinhaDeLimite,
} from "@/lib/console/custos";

type Dados = { mes: string; ia: LinhaDeIa[]; armazenamento: LinhaDeArmazenamento[]; limites: LinhaDeLimite[] };

const CAMPO = "border border-platform-border bg-platform-bg px-3 py-2 text-sm text-platform-text focus:border-platform-signal focus:outline-none";
const ROTULO = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-platform-text-muted";
const TH = "py-2 pr-4 font-medium";

function mesAtual(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
}

/**
 * O painel de custos (Console, etapa 1 — 28/09/2026). Só lê.
 *
 * O custo é o do razão pelo preço de tabela: ESTIMATIVA até ser conciliado
 * com a fatura do provedor. A tela diz isso no topo, e marca as execuções cujo
 * provedor não informou tokens (o custo delas é o da reserva).
 *
 * A cotação do dólar é digitada por quem olha e fica só nesta tela — o
 * produto não inventa câmbio.
 */
export function PainelDeCustos() {
  const [mes, setMes] = useState(mesAtual);
  const [cotacao, setCotacao] = useState("");
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const resposta = await fetch(`/api/console/custos?mes=${encodeURIComponent(mes)}`, { cache: "no-store" }).catch(() => null);
      const corpo = resposta ? await resposta.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (resposta?.ok) { setDados(corpo); setErro(""); }
      else { setDados(null); setErro(resposta ? (corpo.message ?? "Não foi possível ler os custos.") : "Sem conexão: não foi possível ler os custos."); }
    })();
    return () => { cancelado = true; };
  }, [mes]);

  const taxa = Number(cotacao.replace(",", "."));
  const cot = taxa > 0 ? taxa : null;
  const contas = useMemo(() => (dados ? totaisPorConta(dados.ia, dados.armazenamento) : []), [dados]);
  const total = contas.reduce((s, c) => ({
    custo: s.custo + c.custo_micros, exec: s.exec + c.execucoes, bytes: s.bytes + c.bytes, semUso: s.semUso + c.sem_uso_medido,
    incerto: s.incerto + c.custo_incerto_micros, recusadas: s.recusadas + c.recusadas,
  }), { custo: 0, exec: 0, bytes: 0, semUso: 0, incerto: 0, recusadas: 0 });
  const modelos = useMemo(() => {
    const mapa = new Map<string, { chave: string; execucoes: number; tokens_entrada: number; tokens_saida: number; custo_micros: number }>();
    for (const l of dados?.ia ?? []) {
      const chave = `${l.provider ?? "?"} · ${l.model ?? "?"}`;
      const m = mapa.get(chave) ?? { chave, execucoes: 0, tokens_entrada: 0, tokens_saida: 0, custo_micros: 0 };
      m.execucoes += l.execucoes; m.tokens_entrada += l.tokens_entrada; m.tokens_saida += l.tokens_saida; m.custo_micros += l.custo_micros;
      mapa.set(chave, m);
    }
    return [...mapa.values()].sort((a, b) => b.custo_micros - a.custo_micros);
  }, [dados]);

  const alertas = (dados?.limites ?? []).filter((l) => usoDoLimite(l).estado !== "ok");

  return (
    <div data-painel-de-custos className="space-y-10">
      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className={ROTULO}>Mês</span>
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className={CAMPO} />
        </label>
        <label className="block">
          <span className={ROTULO}>Cotação do dólar (opcional)</span>
          <input value={cotacao} onChange={(e) => setCotacao(e.target.value)} inputMode="decimal" placeholder="ex.: 5,40" maxLength={8} className={`${CAMPO} w-40`} />
        </label>
      </div>

      <p data-aviso-de-estimativa className="max-w-[60rem] border-l-2 border-platform-border pl-3 text-xs leading-relaxed text-platform-text-muted">
        Custo de IA pelo <strong>preço de tabela</strong> de cada modelo, registrado a cada execução: é uma estimativa até ser
        conciliado com a fatura do provedor. Na fase de testes, com IA gratuita, nada foi de fato cobrado. Custos fixos
        (Vercel, Supabase, domínio) não passam por aqui.
      </p>

      {erro && <p role="alert" className="text-sm text-platform-text">{erro}</p>}
      {!dados && !erro && <p className="text-sm text-platform-text-muted">Carregando…</p>}

      {dados && (
        <>
          <section aria-label="Resumo do mês" className="grid gap-4 sm:grid-cols-3">
            <div className="border border-platform-border p-4">
              <p className={ROTULO}>IA no mês</p>
              <p data-total-custo className="font-display text-2xl font-black text-platform-text">{dinheiro(total.custo)}</p>
              {emReais(total.custo, cot) && <p className="text-sm text-platform-text-muted">{emReais(total.custo, cot)}</p>}
              {total.incerto > 0 && (
                <p data-custo-medido-e-incerto className="mt-1 text-xs text-platform-text-muted">
                  {dinheiro(total.custo - total.incerto)} medido + até {dinheiro(total.incerto)} incerto
                </p>
              )}
            </div>
            <div className="border border-platform-border p-4">
              <p className={ROTULO}>Execuções de IA</p>
              <p data-total-execucoes className="font-display text-2xl font-black text-platform-text">{milhares(total.exec)}</p>
              {total.exec > 0 && <p className="text-sm text-platform-text-muted">{dinheiro(Math.round(total.custo / total.exec))} por execução</p>}
            </div>
            <div className="border border-platform-border p-4">
              <p className={ROTULO}>Armazenamento</p>
              <p data-total-armazenamento className="font-display text-2xl font-black text-platform-text">{tamanho(total.bytes)}</p>
              <p className="text-sm text-platform-text-muted">na última fotografia do mês</p>
            </div>
          </section>

          {total.semUso > 0 && (
            <p data-aviso-sem-uso className="text-sm font-bold text-platform-text">
              {total.semUso} {total.semUso === 1 ? "execução liquidada sem" : "execuções liquidadas sem"} tokens informados pelo provedor: somam {dinheiro(total.incerto)}, o valor reservado — é o teto, não o medido, e se concilia com a fatura.
            </p>
          )}
          {total.recusadas > 0 && (
            <p data-recusadas className="text-sm text-platform-text-muted">
              {total.recusadas} {total.recusadas === 1 ? "pedido recusado" : "pedidos recusados"} pelo provedor sem processar (sobrecarga, limite): custo zero.
            </p>
          )}

          <section aria-label="Limites de hoje">
            <h2 className="font-display text-sm font-black uppercase tracking-wider text-platform-text">Limites de hoje</h2>
            <p className="mt-1 text-xs text-platform-text-muted">O teto diário de IA de cada conta e quanto já foi usado hoje (dia em UTC, a mesma conta que o portão faz).</p>
            {alertas.length > 0 && (
              <p data-alerta-de-limite role="status" className="mt-3 text-sm font-bold text-platform-text">
                {alertas.length === 1 ? "1 conta pede atenção" : `${alertas.length} contas pedem atenção`}: {alertas.map((l) => l.marca ? `${l.conta} · ${l.marca}` : l.conta).join(", ")}.
              </p>
            )}
            <div className="mt-3 overflow-x-auto">
              <table data-tabela-limites className="w-full min-w-[40rem] text-left text-sm">
                <thead><tr className="border-b border-platform-border text-[11px] uppercase tracking-wider text-platform-text-muted">
                  <th className={TH}>Conta</th><th className={TH}>Limite</th><th className={TH}>Usado hoje</th><th className={TH}>Situação</th>
                </tr></thead>
                <tbody>
                  {dados.limites.map((l) => {
                    const uso = usoDoLimite(l);
                    return (
                      <tr key={`${l.workspace_id}-${l.brand_id ?? "conta"}-${l.period}`} data-limite={uso.estado} className="border-b border-platform-border">
                        <td className="py-2 pr-4 text-platform-text">{l.conta}{l.marca ? ` · ${l.marca}` : ""}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{dinheiro(l.limit_micros, l.currency)} / {l.period === "daily" ? "dia" : l.period}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{dinheiro(l.gasto_hoje_micros, l.currency)} · {uso.pct}%</td>
                        <td className="py-2 pr-4 text-platform-text">{uso.estado === "desligado" ? "IA desligada" : uso.estado === "esgotado" ? "Esgotado" : uso.estado === "alerta" ? "Perto do limite" : "Normal"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-label="Por conta e marca">
            <h2 className="font-display text-sm font-black uppercase tracking-wider text-platform-text">Por conta e marca</h2>
            {contas.length === 0
              ? <p className="mt-3 text-sm text-platform-text-muted">Nenhum consumo neste mês.</p>
              : (
                <div className="mt-3 overflow-x-auto">
                  <table data-tabela-contas className="w-full min-w-[44rem] text-left text-sm">
                    <thead><tr className="border-b border-platform-border text-[11px] uppercase tracking-wider text-platform-text-muted">
                      <th className={TH}>Conta / marca</th><th className={TH}>Execuções</th><th className={TH}>Tokens (entrada / saída)</th><th className={TH}>Custo de IA</th><th className={TH}>Armazenamento</th>
                    </tr></thead>
                    <tbody>
                      {contas.map((c) => (
                        <FragmentoDeConta key={c.workspace_id} conta={c} cot={cot} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </section>

          {modelos.length > 0 && (
            <section aria-label="Por modelo">
              <h2 className="font-display text-sm font-black uppercase tracking-wider text-platform-text">Por modelo</h2>
              <div className="mt-3 overflow-x-auto">
                <table data-tabela-modelos className="w-full min-w-[36rem] text-left text-sm">
                  <thead><tr className="border-b border-platform-border text-[11px] uppercase tracking-wider text-platform-text-muted">
                    <th className={TH}>Provedor · modelo</th><th className={TH}>Execuções</th><th className={TH}>Tokens (entrada / saída)</th><th className={TH}>Custo</th>
                  </tr></thead>
                  <tbody>
                    {modelos.map((m) => (
                      <tr key={m.chave} className="border-b border-platform-border">
                        <td className="py-2 pr-4 font-mono text-xs text-platform-text">{m.chave}</td>
                        <td className="py-2 pr-4">{milhares(m.execucoes)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{milhares(m.tokens_entrada)} / {milhares(m.tokens_saida)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{dinheiro(m.custo_micros)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function FragmentoDeConta({ conta, cot }: { conta: ReturnType<typeof totaisPorConta>[number]; cot: number | null }) {
  return (
    <>
      <tr data-conta={conta.workspace_id} className="border-b border-platform-border bg-platform-panel">
        <td className="py-2 pr-4 font-bold text-platform-text">{conta.conta}</td>
        <td className="py-2 pr-4 font-bold">{milhares(conta.execucoes)}</td>
        <td className="py-2 pr-4 font-mono text-xs">{milhares(conta.tokens_entrada)} / {milhares(conta.tokens_saida)}</td>
        <td className="py-2 pr-4 font-mono text-xs font-bold">{dinheiro(conta.custo_micros)}{emReais(conta.custo_micros, cot) ? ` (${emReais(conta.custo_micros, cot)})` : ""}</td>
        <td className="py-2 pr-4 font-mono text-xs">{tamanho(conta.bytes)}</td>
      </tr>
      {conta.marcas.map((m) => (
        <tr key={`${conta.workspace_id}-${m.brand_id ?? "sem"}`} data-marca-da-conta className="border-b border-platform-border">
          <td className="py-2 pl-4 pr-4 text-platform-text-muted">{m.marca}</td>
          <td className="py-2 pr-4 text-platform-text-muted">{milhares(m.execucoes)}</td>
          <td className="py-2 pr-4" />
          <td className="py-2 pr-4 font-mono text-xs text-platform-text-muted">{dinheiro(m.custo_micros)}</td>
          <td className="py-2 pr-4 font-mono text-xs text-platform-text-muted">{tamanho(m.bytes)}</td>
        </tr>
      ))}
    </>
  );
}
