"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { dinheiro } from "@/lib/console/custos";

type Conta = { workspace_id: string; conta: string; slug: string; marcas: number; pausada: boolean; gasto_mes_micros: number };
type Painel = { plataformaPausada: boolean; contas: Conta[] };
type Ficha = {
  conta: { id: string; nome: string; slug: string; criada_em: string };
  plataforma_pausada: boolean;
  pausada: boolean;
  pessoas: number;
  limites: { daily?: number; monthly?: number };
  uso: { hoje_micros: number; mes_micros: number; pedidos_hoje: number; pedidos_mes: number };
  marcas: { id: string; nome: string; chave: string; pausada: boolean; pedidos_mes: number }[];
};

const CAMPO = "border border-platform-border bg-platform-bg px-3 py-2 text-sm text-platform-text focus:border-platform-signal focus:outline-none";
const BOTAO = "bg-platform-signal px-4 py-2 font-display text-[11px] font-black uppercase text-platform-bg disabled:opacity-50";
const BOTAO_LINHA = "border border-platform-border px-4 py-2 font-display text-[11px] font-black uppercase text-platform-text disabled:opacity-50";
const TITULO = "font-display text-sm font-black uppercase tracking-wider text-platform-text";
const TH = "py-2 pr-4 font-bold";

async function enviar(corpo: unknown): Promise<string | null> {
  const r = await fetch("/api/console/operacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).catch(() => null);
  if (!r) return "Sem conexão: nada mudou.";
  if (r.ok) return null;
  const d = await r.json().catch(() => ({}));
  return d.message ?? "Não foi possível guardar a mudança.";
}

/**
 * Pausar ou retomar, sempre com motivo. `confirmacao` pede um segundo clique:
 * é o caso da trava geral, que para o Vini para todos os clientes de uma vez.
 */
function Alavanca({
  id, rotulo, corpo, confirmacao, emDestaque = true, aoConcluir,
}: {
  id: string; rotulo: string; corpo: Record<string, unknown>; confirmacao?: string; emDestaque?: boolean; aoConcluir: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function executar() {
    setEnviando(true);
    const erro = await enviar({ ...corpo, motivo });
    setEnviando(false);
    setConfirmando(false);
    if (erro) { setAviso(erro); return; }
    setAviso("Feito. O registro da equipe tem a mudança.");
    setMotivo("");
    aoConcluir();
  }

  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    if (confirmacao && !confirmando) { setConfirmando(true); return; }
    void executar();
  }

  return (
    <form data-alavanca={id} onSubmit={aoEnviar} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="min-w-[16rem] flex-1">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-platform-text-muted">Motivo</span>
        <input className={`${CAMPO} w-full`} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Fica no registro da equipe" />
      </label>
      {confirmando ? (
        <>
          <p className="w-full text-sm font-bold text-platform-text" role="alert">{confirmacao}</p>
          <button type="submit" className={BOTAO} disabled={enviando}>Confirmar</button>
          <button type="button" className={BOTAO_LINHA} onClick={() => setConfirmando(false)}>Cancelar</button>
        </>
      ) : (
        <button type="submit" className={emDestaque ? BOTAO : BOTAO_LINHA} disabled={enviando}>{rotulo}</button>
      )}
      {aviso && <p role="status" className="w-full text-sm text-platform-text">{aviso}</p>}
    </form>
  );
}

function FichaDaConta({ id, versao, aoMudar }: { id: string; versao: number; aoMudar: () => void }) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await fetch(`/api/console/operacao?conta=${id}`, { cache: "no-store" }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (r?.ok) { setFicha(d); setErro(""); } else setErro(d.message ?? "Não foi possível ler a ficha da conta.");
    })();
    return () => { cancelado = true; };
  }, [id, versao]);

  if (erro) return <p role="alert" className="text-sm text-platform-text">{erro}</p>;
  if (!ficha) return <p className="text-sm text-platform-text-muted">Carregando a ficha…</p>;

  const limite = (v?: number) => (typeof v === "number" ? dinheiro(v) : "sem limite");
  return (
    <section data-ficha-da-conta={ficha.conta.slug} aria-label={`Ficha de ${ficha.conta.nome}`} className="border border-platform-border p-5">
      <h3 className="font-display text-lg font-black text-platform-text">{ficha.conta.nome}</h3>
      <p className="font-mono text-xs text-platform-text-muted">{ficha.conta.slug} · desde {new Date(ficha.conta.criada_em).toLocaleDateString("pt-BR")}</p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
        <div><dt className="text-[11px] uppercase tracking-wide text-platform-text-muted">Pessoas</dt><dd data-ficha-pessoas className="font-bold text-platform-text">{ficha.pessoas}</dd></div>
        <div><dt className="text-[11px] uppercase tracking-wide text-platform-text-muted">Uso hoje</dt><dd className="font-mono text-platform-text">{dinheiro(ficha.uso.hoje_micros)} de {limite(ficha.limites.daily)} · {ficha.uso.pedidos_hoje} pedidos</dd></div>
        <div><dt className="text-[11px] uppercase tracking-wide text-platform-text-muted">Uso no mês</dt><dd className="font-mono text-platform-text">{dinheiro(ficha.uso.mes_micros)} de {limite(ficha.limites.monthly)} · {ficha.uso.pedidos_mes} pedidos</dd></div>
        <div><dt className="text-[11px] uppercase tracking-wide text-platform-text-muted">Vini nesta conta</dt><dd data-ficha-situacao className="font-bold text-platform-text">{ficha.pausada ? "Pausado" : "Ativo"}</dd></div>
      </dl>
      {ficha.plataforma_pausada && (
        <p className="mt-3 text-sm font-bold text-platform-text">A trava geral está ligada: o Vini está parado nesta conta também, seja qual for a situação abaixo.</p>
      )}

      <Alavanca
        id="conta"
        rotulo={ficha.pausada ? "Retomar o Vini nesta conta" : "Pausar o Vini nesta conta"}
        corpo={{ alvo: "conta", workspaceId: ficha.conta.id, pausado: !ficha.pausada }}
        emDestaque={!ficha.pausada}
        aoConcluir={aoMudar}
      />

      <h4 className="mt-6 text-[11px] font-bold uppercase tracking-wide text-platform-text-muted">Marcas ({ficha.marcas.length})</h4>
      {ficha.marcas.length === 0 ? (
        <p className="mt-2 text-sm text-platform-text-muted">Nenhuma marca nesta conta.</p>
      ) : (
        <ul className="mt-2 space-y-4">
          {ficha.marcas.map((m) => (
            <li key={m.id} data-marca={m.chave} className="border-t border-platform-border pt-3">
              <p className="text-sm text-platform-text">
                <b>{m.nome}</b> <span className="font-mono text-xs text-platform-text-muted">{m.chave}</span> · {m.pedidos_mes} pedidos no mês ·{" "}
                <span data-marca-situacao>{m.pausada ? "Vini pausado" : "Vini ativo"}</span>
              </p>
              <Alavanca
                id={`marca-${m.chave}`}
                rotulo={m.pausada ? "Retomar nesta marca" : "Pausar nesta marca"}
                corpo={{ alvo: "marca", brandId: m.id, pausado: !m.pausada }}
                emDestaque={false}
                aoConcluir={aoMudar}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * A operação no Console (etapa 3 — 30/09/2026): a trava geral, as contas e a
 * ficha de cada uma, com as pausas de conta e de marca. Toda ação pede motivo
 * e vai para o registro da equipe. A ficha só conta — nunca mostra conversa.
 */
export function PainelDeOperacao() {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);
  const [aberta, setAberta] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await fetch("/api/console/operacao", { cache: "no-store" }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (r?.ok) { setPainel(d); setErro(""); } else setErro(r ? (d.message ?? "Não foi possível ler a operação.") : "Sem conexão: não foi possível ler a operação.");
    })();
    return () => { cancelado = true; };
  }, [versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  if (erro) return <p role="alert" className="text-sm text-platform-text">{erro}</p>;
  if (!painel) return <p className="text-sm text-platform-text-muted">Carregando…</p>;

  return (
    <div data-painel-de-operacao className="space-y-12">
      <section aria-label="Trava geral" data-trava-geral={painel.plataformaPausada ? "ligada" : "desligada"}>
        <h2 className={TITULO}>Trava geral</h2>
        {painel.plataformaPausada ? (
          <p role="alert" className="mt-2 border-l-4 border-platform-signal pl-3 text-sm font-bold text-platform-text">
            O Vini está PAUSADO em todas as contas. Os clientes leem: &quot;O Vini está em manutenção no momento. Volta em breve.&quot;
          </p>
        ) : (
          <p className="mt-2 text-sm text-platform-text-muted">
            O Vini funciona para todas as contas. Use a trava num incidente — chave vazada, custo disparado, provedor fora do ar —
            para parar o Vini em todas as contas de uma vez.
          </p>
        )}
        <Alavanca
          id="plataforma"
          rotulo={painel.plataformaPausada ? "Retomar o Vini em todas as contas" : "Pausar o Vini em todas as contas"}
          corpo={{ alvo: "plataforma", pausado: !painel.plataformaPausada }}
          confirmacao={painel.plataformaPausada ? undefined : "Isto para o Vini para TODOS os clientes, agora. Confirma?"}
          aoConcluir={recarregar}
        />
      </section>

      <section aria-label="Contas">
        <h2 className={TITULO}>Contas</h2>
        <p className="mt-1 text-xs text-platform-text-muted">Uso do mês em UTC. Abra a ficha para ver pessoas, marcas e as pausas.</p>
        <div className="mt-3 overflow-x-auto">
          <table data-tabela-contas className="w-full min-w-[40rem] text-left text-sm">
            <thead><tr className="border-b border-platform-border text-[11px] uppercase tracking-wider text-platform-text-muted">
              <th className={TH}>Conta</th><th className={TH}>Marcas</th><th className={TH}>Uso no mês</th><th className={TH}>Vini</th><th className={TH}><span className="sr-only">Ficha</span></th>
            </tr></thead>
            <tbody>
              {painel.contas.map((c) => (
                <tr key={c.workspace_id} data-conta={c.slug} className="border-b border-platform-border">
                  <td className="py-2 pr-4 text-platform-text">{c.conta} <span className="font-mono text-xs text-platform-text-muted">{c.slug}</span></td>
                  <td className="py-2 pr-4">{c.marcas}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{dinheiro(c.gasto_mes_micros)}</td>
                  <td className="py-2 pr-4">{c.pausada ? "Pausado" : "Ativo"}</td>
                  <td className="py-2 pr-4">
                    <button type="button" className="text-sm font-bold text-platform-text underline" aria-expanded={aberta === c.workspace_id}
                      onClick={() => setAberta(aberta === c.workspace_id ? null : c.workspace_id)}>
                      {aberta === c.workspace_id ? "Fechar a ficha" : "Abrir a ficha"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {aberta && <div className="mt-6"><FichaDaConta id={aberta} versao={versao} aoMudar={recarregar} /></div>}
      </section>
    </div>
  );
}
