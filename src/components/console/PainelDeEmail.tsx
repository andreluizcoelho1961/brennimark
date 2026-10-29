"use client";

import { useEffect, useState } from "react";
import { CARGOS, EQUIPES } from "@/lib/cadastro/cadastro";
import { CAMPANHAS, personalizar } from "@/lib/email/campanhas";
import { TETO_POR_ENVIO } from "@/lib/email/marketing";

type Resumo = { elegiveis: number; alcance: number; enviados: number; falhas: number };

const CAMPO = "border border-platform-border bg-platform-bg px-3 py-2 text-sm text-platform-text focus:border-platform-signal focus:outline-none";
const BOTAO = "bg-platform-signal px-4 py-2 font-display text-[11px] font-black uppercase text-platform-bg disabled:opacity-50";
const BOTAO_LINHA = "border border-platform-border px-4 py-2 font-display text-[11px] font-black uppercase text-platform-text disabled:opacity-50";
const ROTULO = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-platform-text-muted";

async function chamar(corpo: unknown): Promise<{ ok: true; dados: Record<string, unknown> } | { ok: false; mensagem: string }> {
  const r = await fetch("/api/console/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).catch(() => null);
  if (!r) return { ok: false, mensagem: "Sem conexão: nada mudou." };
  const d = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, dados: d } : { ok: false, mensagem: d.message ?? "Não foi possível concluir." };
}

function alternar(lista: string[], id: string): string[] {
  return lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];
}

/**
 * O e-mail de marketing no Console: escolher a campanha, ver quantas pessoas
 * ela alcança, mandar um teste para o seu próprio e-mail e enviar aos poucos.
 * Quem recebe e quantas vezes decide o banco; aqui só se escolhe e se confirma.
 */
export function PainelDeEmail() {
  const [campanhaId, setCampanhaId] = useState<string>(CAMPANHAS[0].id);
  const [cargos, setCargos] = useState<string[]>([]);
  const [equipes, setEquipes] = useState<string[]>([]);
  const [limite, setLimite] = useState("10");
  const [motivo, setMotivo] = useState("");
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [configurado, setConfigurado] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  // A confirmação vale só para a escolha em que foi pedida: mudou campanha, filtro ou quantidade, ela cai.
  const [confirmadaPara, setConfirmadaPara] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [versao, setVersao] = useState(0);

  const campanha = CAMPANHAS.find((c) => c.id === campanhaId) ?? CAMPANHAS[0];
  const escolha = JSON.stringify([campanhaId, cargos, equipes, limite]);
  const confirmando = confirmadaPara === escolha;

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await chamar({ acao: "resumo", campanha: campanhaId, cargos, equipes });
      if (cancelado) return;
      if (r.ok) {
        setResumo(r.dados.resumo as Resumo);
        setConfigurado(r.dados.configurado !== false);
      } else {
        setAviso({ tipo: "erro", texto: r.mensagem });
      }
    })();
    return () => { cancelado = true; };
  }, [campanhaId, cargos, equipes, versao]);

  const quantidade = Math.min(Number(limite) || 0, resumo?.alcance ?? 0);
  const limiteValido = Number.isInteger(Number(limite)) && Number(limite) >= 1 && Number(limite) <= TETO_POR_ENVIO;

  async function testar(idioma: "pt-BR" | "en") {
    setOcupado(true); setAviso(null);
    const r = await chamar({ acao: "teste", campanha: campanhaId, idioma });
    setAviso(r.ok ? { tipo: "ok", texto: `Teste enviado para ${String(r.dados.para)}. Confira a caixa de entrada e o spam.` } : { tipo: "erro", texto: r.mensagem });
    setOcupado(false);
  }

  async function enviar() {
    setOcupado(true); setAviso(null); setConfirmadaPara(null);
    const r = await chamar({ acao: "enviar", campanha: campanhaId, cargos, equipes, limite: Number(limite), motivo });
    if (r.ok) {
      const { tentados, enviados, falhas } = r.dados as { tentados: number; enviados: number; falhas: number };
      setAviso({ tipo: falhas > 0 ? "erro" : "ok", texto: `${enviados} de ${tentados} enviados${falhas > 0 ? `, ${falhas} falharam (voltam na próxima rodada)` : ""}.` });
      setMotivo("");
    } else {
      setAviso({ tipo: "erro", texto: r.mensagem });
    }
    setVersao((v) => v + 1);
    setOcupado(false);
  }

  return (
    <section aria-label="E-mail de marketing" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {!configurado && (
        <p role="alert" data-sem-email className="border border-platform-border p-3 text-sm text-platform-text lg:col-span-2">
          O envio de e-mail não está configurado neste ambiente (faltam as variáveis do Resend na Vercel). Teste e envio estão desligados.
        </p>
      )}

      <div>
        <label className="block">
          <span className={ROTULO}>Campanha</span>
          <select className={`${CAMPO} w-full`} value={campanhaId} onChange={(e) => setCampanhaId(e.target.value)}>
            {CAMPANHAS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
          </select>
        </label>

        <div data-previa className="mt-4 border border-platform-border p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-platform-text-muted">Assunto</p>
          <p className="mt-1 text-sm font-bold text-platform-text">{campanha.assunto}</p>
          <div className="mt-3 space-y-2 text-sm text-platform-text">
            {campanha.paragrafos.map((p, i) => <p key={i}>{personalizar(p, "Ana")}</p>)}
            {campanha.botao && <p className="font-bold">[ {campanha.botao.rotulo} ]</p>}
          </div>
          <p className="mt-3 text-xs text-platform-text-muted">
            Depois do texto vai o rodapé legal: por que a pessoa recebe, quem envia (nome, CNPJ e endereço), o link para sair ou apagar
            o cadastro e a Política. O Gmail e o iCloud também mostram “Cancelar inscrição” ao lado do remetente.
          </p>
        </div>
      </div>

      <div>
        <fieldset>
          <legend className={ROTULO}>Cargos (nenhum marcado = todos)</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {CARGOS.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-platform-text">
                <input type="checkbox" checked={cargos.includes(c.id)} onChange={() => setCargos(alternar(cargos, c.id))} /> {c.rotulo}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-4">
          <legend className={ROTULO}>Tamanho da equipe (nenhum marcado = todos)</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {EQUIPES.map((e) => (
              <label key={e.id} className="flex items-center gap-2 text-sm text-platform-text">
                <input type="checkbox" checked={equipes.includes(e.id)} onChange={() => setEquipes(alternar(equipes, e.id))} /> {e.rotulo}
              </label>
            ))}
          </div>
        </fieldset>

        <dl data-resumo className="mt-5 grid grid-cols-2 gap-3 text-sm text-platform-text">
          <div className="border border-platform-border p-3"><dt className="text-xs text-platform-text-muted">Elegíveis no total</dt><dd data-elegiveis className="text-lg font-bold">{resumo?.elegiveis ?? "–"}</dd></div>
          <div className="border border-platform-border p-3"><dt className="text-xs text-platform-text-muted">Faltam receber, com estes filtros</dt><dd data-alcance className="text-lg font-bold">{resumo?.alcance ?? "–"}</dd></div>
          <div className="border border-platform-border p-3"><dt className="text-xs text-platform-text-muted">Já enviados desta campanha</dt><dd data-enviados className="text-lg font-bold">{resumo?.enviados ?? "–"}</dd></div>
          <div className="border border-platform-border p-3"><dt className="text-xs text-platform-text-muted">Falhas (voltam na próxima rodada)</dt><dd data-falhas className="text-lg font-bold">{resumo?.falhas ?? "–"}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-platform-text-muted">Elegível é quem aceitou receber, confirmou o e-mail e não saiu. Cada pessoa recebe cada campanha uma única vez, no idioma da tela em que se cadastrou (texto e rodapé).</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-[8rem_1fr]">
          <label className="block">
            <span className={ROTULO}>Quantas agora</span>
            <input className={`${CAMPO} w-full`} type="number" min={1} max={TETO_POR_ENVIO} value={limite} onChange={(e) => setLimite(e.target.value)} />
          </label>
          <label className="block">
            <span className={ROTULO}>Motivo (fica no registro da equipe)</span>
            <input className={`${CAMPO} w-full`} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: primeira rodada do convite" />
          </label>
        </div>
        <p className="mt-1 text-xs text-platform-text-muted">No máximo {TETO_POR_ENVIO} por clique, para ir devagar.</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={BOTAO_LINHA} disabled={ocupado || !configurado} onClick={() => testar("pt-BR")}>Enviar teste para mim</button>
          <button type="button" className={BOTAO_LINHA} disabled={ocupado || !configurado} onClick={() => testar("en")}>Enviar teste em inglês</button>
          {!confirmando ? (
            <button type="button" className={BOTAO} disabled={ocupado || !configurado || !limiteValido || motivo.trim().length < 3 || quantidade < 1}
              onClick={() => setConfirmadaPara(escolha)}>
              Enviar para até {limiteValido ? Math.max(quantidade, 0) : 0} pessoas
            </button>
          ) : (
            <span data-confirmacao className="flex items-center gap-3 border border-platform-border p-2 text-sm text-platform-text">
              Enviar de verdade a {quantidade} pessoa{quantidade === 1 ? "" : "s"}? Não dá para desfazer.
              <button type="button" className={BOTAO} disabled={ocupado} onClick={enviar}>Confirmar envio</button>
              <button type="button" className={BOTAO_LINHA} onClick={() => setConfirmadaPara(null)}>Cancelar</button>
            </span>
          )}
        </div>

        {aviso && (
          <p role={aviso.tipo === "erro" ? "alert" : "status"} data-aviso={aviso.tipo} className="mt-4 border border-platform-border p-3 text-sm text-platform-text">
            {aviso.texto}
          </p>
        )}
      </div>
    </section>
  );
}
