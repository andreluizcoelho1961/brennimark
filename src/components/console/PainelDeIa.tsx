"use client";

import { useCallback, useEffect, useState } from "react";
import { dinheiro, usoDoLimite, type LinhaDeLimite } from "@/lib/console/custos";

type Oferta = { provider: string; model: string; label: string };
type Rota = { tarefa: "chat" | "analysis"; ordem: number; provider: string; model: string };
type Dados = {
  rotas: Rota[];
  parametros: { espera_chat_ms: number; espera_analysis_ms: number; limite_diario_padrao_micros: number; limite_mensal_padrao_micros: number };
  limites: LinhaDeLimite[];
  registro: { quando: string; quem: string; acao: string; alvo: string; antes: unknown; depois: unknown; motivo: string }[];
  oferta: { chat: Oferta[]; analysis: Oferta[] };
  chaves: { provider: string; variavel: string; presente: boolean }[];
};

const CAMPO = "border border-platform-border bg-platform-bg px-3 py-2 text-sm text-platform-text focus:border-platform-signal focus:outline-none";
const ROTULO = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-platform-text-muted";
const BOTAO = "bg-platform-signal px-4 py-2 font-display text-[11px] font-black uppercase text-platform-bg disabled:opacity-50";
const TITULO = "font-display text-sm font-black uppercase tracking-wider text-platform-text";
const TAREFAS = [
  { id: "chat", nome: "Conversa com o Vini", esperaPadrao: 20 },
  { id: "analysis", nome: "Análise de peça", esperaPadrao: 30 },
] as const;

async function enviar(corpo: unknown): Promise<string | null> {
  const r = await fetch("/api/console/ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).catch(() => null);
  if (!r) return "Sem conexão: nada foi guardado.";
  if (r.ok) return null;
  const d = await r.json().catch(() => ({}));
  return d.message ?? "Não foi possível guardar a mudança.";
}

/**
 * A IA da plataforma no Console (etapa 2 — 29/09/2026). Só a equipe; cada
 * mudança pede MOTIVO e vai para o registro. Chaves: só se existem.
 */
export function PainelDeIa() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await fetch("/api/console/ia", { cache: "no-store" }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (r?.ok) { setDados(d); setErro(""); } else setErro(r ? (d.message ?? "Não foi possível ler a IA da plataforma.") : "Sem conexão: não foi possível ler a IA da plataforma.");
    })();
    return () => { cancelado = true; };
  }, [versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  if (erro) return <p role="alert" className="text-sm text-platform-text">{erro}</p>;
  if (!dados) return <p className="text-sm text-platform-text-muted">Carregando…</p>;

  const faltam = dados.chaves.filter((c) => !c.presente && dados.rotas.some((r) => r.provider === c.provider));

  return (
    <div data-painel-de-ia className="space-y-12">
      <section aria-label="Chaves">
        <h2 className={TITULO}>Chaves dos provedores</h2>
        <p className="mt-1 max-w-[52rem] text-xs text-platform-text-muted">
          As chaves ficam nas variáveis de ambiente da Vercel — nunca no banco nem nesta tela. Aqui aparece só se cada uma existe.
          Na fase de testes, use chaves de contas gratuitas (projeto do Google sem faturamento ligado).
        </p>
        {faltam.length > 0 && (
          <p data-chave-faltando role="status" className="mt-3 text-sm font-bold text-platform-text">
            Falta a chave de {faltam.map((c) => c.provider).join(", ")}, usado nas rotas: o Vini não consegue usar esse provedor.
          </p>
        )}
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {dados.chaves.map((c) => (
            <li key={c.provider} data-chave={c.provider} data-presente={c.presente ? "sim" : "nao"} className="border border-platform-border px-3 py-2 text-sm">
              <span className="font-bold text-platform-text">{c.provider}</span>
              <span className="ml-2 text-platform-text-muted">{c.presente ? "✓ configurada" : "ausente"}</span>
              <span className="block font-mono text-[11px] text-platform-text-muted">{c.variavel}</span>
            </li>
          ))}
        </ul>
      </section>

      {TAREFAS.map((t) => (
        <FormularioDeRotas key={t.id} tarefa={t.id} nome={t.nome}
          atuais={dados.rotas.filter((r) => r.tarefa === t.id).sort((a, b) => a.ordem - b.ordem)}
          esperaMs={t.id === "chat" ? dados.parametros.espera_chat_ms : dados.parametros.espera_analysis_ms}
          oferta={dados.oferta[t.id]} aoSalvar={recarregar} />
      ))}

      <FormularioDePadrao parametros={dados.parametros} aoSalvar={recarregar} />

      <section aria-label="Limites por conta">
        <h2 className={TITULO}>Limites por conta</h2>
        <p className="mt-1 text-xs text-platform-text-muted">O teto de IA de cada conta, por dia e por mês (UTC), e quanto já foi usado no período.</p>
        <div className="mt-3 overflow-x-auto">
          <table data-tabela-limites-editaveis className="w-full min-w-[48rem] text-left text-sm">
            <thead><tr className="border-b border-platform-border text-[11px] uppercase tracking-wider text-platform-text-muted">
              <th className="py-2 pr-4 font-medium">Conta</th><th className="py-2 pr-4 font-medium">Período</th><th className="py-2 pr-4 font-medium">Usado</th><th className="py-2 pr-4 font-medium">Novo limite (US$) e motivo</th>
            </tr></thead>
            <tbody>
              {dados.limites.filter((l) => l.brand_id === null).sort((a, b) => a.conta.localeCompare(b.conta) || a.period.localeCompare(b.period)).map((l) => (
                <LinhaDeLimiteEditavel key={`${l.workspace_id}-${l.period}`} limite={l} aoSalvar={recarregar} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Registro da equipe">
        <h2 className={TITULO}>Registro da equipe</h2>
        <p className="mt-1 text-xs text-platform-text-muted">Toda mudança feita no Console, com quem, o antes, o depois e o motivo. Nada aqui se apaga.</p>
        {dados.registro.length === 0
          ? <p className="mt-3 text-sm text-platform-text-muted">Nenhuma mudança registrada ainda.</p>
          : (
            <div className="mt-3 overflow-x-auto">
              <table data-tabela-registro-da-equipe className="w-full min-w-[48rem] text-left text-sm">
                <thead><tr className="border-b border-platform-border text-[11px] uppercase tracking-wider text-platform-text-muted">
                  <th className="py-2 pr-4 font-medium">Quando</th><th className="py-2 pr-4 font-medium">Quem</th><th className="py-2 pr-4 font-medium">O quê</th><th className="py-2 pr-4 font-medium">Antes → depois</th><th className="py-2 pr-4 font-medium">Motivo</th>
                </tr></thead>
                <tbody>
                  {dados.registro.map((r, i) => (
                    <tr key={`${r.quando}-${i}`} className="border-b border-platform-border align-top">
                      <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-platform-text-muted">{new Date(r.quando).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                      <td className="py-2 pr-4">{r.quem}</td>
                      <td className="py-2 pr-4">{r.acao}{r.alvo ? ` · ${r.alvo}` : ""}</td>
                      <td className="py-2 pr-4 font-mono text-[11px] text-platform-text-muted">{JSON.stringify(r.antes)} → {JSON.stringify(r.depois)}</td>
                      <td className="py-2 pr-4">{r.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </div>
  );
}

function FormularioDeRotas({ tarefa, nome, atuais, esperaMs, oferta, aoSalvar }: {
  tarefa: "chat" | "analysis"; nome: string; atuais: Rota[]; esperaMs: number; oferta: Oferta[]; aoSalvar: () => void;
}) {
  const chave = (r: { provider: string; model: string }) => `${r.provider}|${r.model}`;
  const [escolhas, setEscolhas] = useState<string[]>(() => [0, 1, 2].map((i) => (atuais[i] ? chave(atuais[i]) : "")));
  const [espera, setEspera] = useState(String(Math.round(esperaMs / 1000)));
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true); setMsg("");
    const rotas = escolhas.filter(Boolean).map((c) => ({ provider: c.split("|")[0], model: c.split("|").slice(1).join("|") }));
    const falha = await enviar({ acao: "rotas", tarefa, rotas, esperaMs: Math.round(Number(espera.replace(",", ".")) * 1000), motivo });
    setOcupado(false);
    if (falha) { setMsg(falha); return; }
    setMotivo(""); setMsg("Guardado. O registro tem a mudança.");
    aoSalvar();
  }

  return (
    <section aria-label={nome}>
      <h2 className={TITULO}>{nome}</h2>
      <p className="mt-1 text-xs text-platform-text-muted">
        Os modelos em ordem: o primeiro responde; os outros entram se ele falhar. Só aparecem modelos com preço verificado{tarefa === "analysis" ? " e que enxergam imagem" : ""}.
      </p>
      <form data-rotas={tarefa} onSubmit={salvar} className="mt-3 grid gap-3 md:grid-cols-4">
        {[0, 1, 2].map((i) => (
          <label key={i} className="block">
            <span className={ROTULO}>{i === 0 ? "Principal" : `Reserva ${i}`}</span>
            <select value={escolhas[i]} onChange={(e) => setEscolhas((a) => a.map((v, j) => (j === i ? e.target.value : v)))} className={`${CAMPO} w-full`}>
              <option value="">{i === 0 ? "— escolha —" : "— nenhuma —"}</option>
              {oferta.map((o) => <option key={chave(o)} value={chave(o)}>{o.label} ({o.provider})</option>)}
            </select>
          </label>
        ))}
        <label className="block">
          <span className={ROTULO}>Espera pelo 1º trecho (s)</span>
          <input value={espera} onChange={(e) => setEspera(e.target.value)} inputMode="numeric" maxLength={3} className={`${CAMPO} w-full`} />
        </label>
        <label className="block md:col-span-3">
          <span className={ROTULO}>Motivo da mudança</span>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} placeholder="ex.: Gemini em pico de demanda" className={`${CAMPO} w-full`} />
        </label>
        <div className="flex items-end gap-3 md:col-span-4">
          <button type="submit" disabled={ocupado} className={BOTAO}>{ocupado ? "Guardando…" : "Guardar rotas"}</button>
          {msg && <p role="status" className="text-sm text-platform-text-muted">{msg}</p>}
        </div>
      </form>
    </section>
  );
}

function FormularioDePadrao({ parametros, aoSalvar }: { parametros: Dados["parametros"]; aoSalvar: () => void }) {
  const [diario, setDiario] = useState(String(parametros.limite_diario_padrao_micros / 1_000_000));
  const [mensal, setMensal] = useState(String(parametros.limite_mensal_padrao_micros / 1_000_000));
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const falha = await enviar({ acao: "padrao", diario, mensal, motivo });
    if (falha) { setMsg(falha); return; }
    setMotivo(""); setMsg("Guardado. Vale para as contas criadas daqui em diante.");
    aoSalvar();
  }

  return (
    <section aria-label="Limites padrão">
      <h2 className={TITULO}>Limites padrão das contas novas</h2>
      <p className="mt-1 text-xs text-platform-text-muted">Toda conta nova nasce com estes tetos. As contas que já existem não mudam.</p>
      <form data-limites-padrao onSubmit={salvar} className="mt-3 grid gap-3 md:grid-cols-4">
        <label className="block"><span className={ROTULO}>Por dia (US$)</span><input value={diario} onChange={(e) => setDiario(e.target.value)} className={`${CAMPO} w-full`} /></label>
        <label className="block"><span className={ROTULO}>Por mês (US$)</span><input value={mensal} onChange={(e) => setMensal(e.target.value)} className={`${CAMPO} w-full`} /></label>
        <label className="block md:col-span-2"><span className={ROTULO}>Motivo da mudança</span><input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} className={`${CAMPO} w-full`} /></label>
        <div className="flex items-end gap-3 md:col-span-4">
          <button type="submit" className={BOTAO}>Guardar padrão</button>
          {msg && <p role="status" className="text-sm text-platform-text-muted">{msg}</p>}
        </div>
      </form>
    </section>
  );
}

function LinhaDeLimiteEditavel({ limite, aoSalvar }: { limite: LinhaDeLimite; aoSalvar: () => void }) {
  const [valor, setValor] = useState(String(limite.limit_micros / 1_000_000));
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState("");
  const uso = usoDoLimite(limite);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const falha = await enviar({ acao: "limite", workspaceId: limite.workspace_id, periodo: limite.period, valor, motivo });
    if (falha) { setMsg(falha); return; }
    setMotivo(""); setMsg("Guardado.");
    aoSalvar();
  }

  return (
    <tr data-limite-da-conta={`${limite.workspace_id}-${limite.period}`} className="border-b border-platform-border align-top">
      <td className="py-2 pr-4 text-platform-text">{limite.conta}</td>
      <td className="py-2 pr-4">{limite.period === "monthly" ? "mês" : "dia"}</td>
      <td className="py-2 pr-4 font-mono text-xs">{dinheiro(limite.gasto_hoje_micros)} de {dinheiro(limite.limit_micros)} · {uso.pct}%</td>
      <td className="py-2 pr-4">
        <form onSubmit={salvar} className="flex flex-wrap items-center gap-2">
          <input aria-label={`Novo limite de ${limite.conta} por ${limite.period === "monthly" ? "mês" : "dia"}`} value={valor} onChange={(e) => setValor(e.target.value)} className={`${CAMPO} w-24`} />
          <input aria-label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="motivo" maxLength={500} className={`${CAMPO} w-48`} />
          <button type="submit" className="border border-platform-border px-3 py-2 font-display text-[11px] font-bold uppercase text-platform-text hover:border-platform-signal">Guardar</button>
          {msg && <span role="status" className="text-xs text-platform-text-muted">{msg}</span>}
        </form>
      </td>
    </tr>
  );
}
