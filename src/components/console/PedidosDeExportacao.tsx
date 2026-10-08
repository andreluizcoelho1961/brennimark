"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PRAZO_DA_EXPORTACAO_DIAS, prazoDaExportacao } from "@/lib/cobranca/exportacao";

type Pedido = {
  id: string; workspace_id: string; conta: string; pedido_em: string; pedido_por: string | null;
  entregue_em: string | null; titular_email: string | null;
};

const CAMPO = "border border-platform-border bg-platform-bg px-3 py-2 text-sm text-platform-text focus:border-platform-signal focus:outline-none";
const BOTAO = "bg-platform-signal px-4 py-2 font-display text-[11px] font-black uppercase text-platform-bg disabled:opacity-50";
const TITULO = "font-display text-sm font-black uppercase tracking-wider text-platform-text";
const TH = "py-2 pr-4 font-bold";
const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

/** Marcar como entregue, com motivo (fica no registro da equipe). */
function MarcarEntregue({ pedido, aoConcluir }: { pedido: Pedido; aoConcluir: () => void }) {
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    const motivo = new FormData(e.currentTarget).get("motivo");
    const r = await fetch("/api/console/exportacoes", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pedido.id, motivo }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (r?.ok) aoConcluir();
    else setErro(d.message ?? "Não foi possível marcar a entrega.");
  }
  return (
    <form onSubmit={aoEnviar} className="flex flex-wrap items-center gap-2">
      <input name="motivo" required minLength={3} maxLength={500} placeholder="Como foi entregue" aria-label={`Como foi entregue a exportação de ${pedido.conta}`} className={CAMPO} />
      <button type="submit" disabled={enviando} className={BOTAO}>{enviando ? "Marcando…" : "Marcar entregue"}</button>
      {erro && <span role="alert" className="text-xs text-platform-text">{erro}</span>}
    </form>
  );
}

/**
 * Os pedidos de exportação (08/10/2026). Os abertos primeiro, do mais antigo:
 * o prazo de 15 dias dos Termos corre desde o pedido.
 */
export function PedidosDeExportacao() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);
  const carregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await fetch("/api/console/exportacoes", { cache: "no-store" }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (r?.ok) { setPedidos(d.pedidos ?? []); setErro(""); } else setErro(d.message ?? "Não foi possível ler os pedidos.");
    })();
    return () => { cancelado = true; };
  }, [versao]);

  return (
    <section aria-label="Pedidos de exportação" data-pedidos-de-exportacao>
      <h2 className={TITULO}>Pedidos de exportação</h2>
      <p className="mt-1 text-sm text-platform-text-muted">
        Quem administra uma conta pede em Configurações › Plano, e a equipe recebe um e-mail. Entregue os arquivos originais e um índice
        do conteúdo em até {PRAZO_DA_EXPORTACAO_DIAS} dias e marque aqui.
      </p>
      {erro && <p role="alert" className="mt-3 text-sm text-platform-text">{erro}</p>}
      {pedidos && pedidos.length === 0 && <p className="mt-3 text-sm text-platform-text-muted">Nenhum pedido.</p>}
      {pedidos && pedidos.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm text-platform-text">
            <thead className="text-[11px] uppercase tracking-wide text-platform-text-muted">
              <tr><th className={TH}>Conta</th><th className={TH}>Pedido em</th><th className={TH}>Prazo</th><th className={TH}>Quem pediu</th><th className={TH}>Entrega</th></tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} data-pedido-de-exportacao={p.id} className="border-t border-platform-border">
                  <td className="py-2 pr-4 font-bold">{p.conta}</td>
                  <td className="py-2 pr-4 font-mono">{data(p.pedido_em)}</td>
                  <td className="py-2 pr-4 font-mono">{data(prazoDaExportacao(p.pedido_em))}</td>
                  <td className="py-2 pr-4">{p.pedido_por ?? p.titular_email ?? "—"}</td>
                  <td className="py-2 pr-4">{p.entregue_em ? `Entregue em ${data(p.entregue_em)}` : <MarcarEntregue pedido={p} aoConcluir={carregar} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
