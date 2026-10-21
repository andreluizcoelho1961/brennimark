"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Ativacao = { id: string; codigo_dispositivo: string; ativada_em: string; revogada_em: string | null };
type Licenca = {
  id: string; numero: string; plano: "beta" | "individual" | "studio"; max_dispositivos: number;
  titular_nome: string; titular_email: string; agencia: string;
  emitida_em: string; expira_em: string; revogada_em: string | null; ativacoes: Ativacao[];
};
type Emitido = { certificado: unknown; arquivo: string };

const CAMPO = "border border-platform-border bg-platform-bg px-3 py-2 text-sm text-platform-text focus:border-platform-signal focus:outline-none";
const BOTAO = "bg-platform-signal px-4 py-2 font-display text-[11px] font-black uppercase text-platform-bg disabled:opacity-50";
const BOTAO_LINHA = "border border-platform-border px-4 py-2 font-display text-[11px] font-black uppercase text-platform-text disabled:opacity-50";
const ROTULO = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-platform-text-muted";
const PLANOS = { beta: "Beta", individual: "Individual", studio: "Estúdio" } as const;

const data = (v: string) => new Date(v).toLocaleDateString("pt-BR");

function situacao(l: Licenca): "revogada" | "vencida" | "ativa" {
  if (l.revogada_em) return "revogada";
  return new Date(l.expira_em).getTime() <= Date.now() ? "vencida" : "ativa";
}

async function enviar(corpo: unknown): Promise<{ ok: true; dados: unknown } | { ok: false; mensagem: string }> {
  const r = await fetch("/api/console/fonts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).catch(() => null);
  if (!r) return { ok: false, mensagem: "Sem conexão: nada mudou." };
  const d = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, dados: d } : { ok: false, mensagem: d.message ?? "Não foi possível concluir." };
}

function baixar(emitido: Emitido) {
  const blob = new Blob([JSON.stringify(emitido.certificado, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = emitido.arquivo;
  a.click();
  URL.revokeObjectURL(url);
}

/** O certificado gerado: o arquivo que o André envia ao testador. */
function Certificado({ emitido }: { emitido: Emitido }) {
  const texto = JSON.stringify(emitido.certificado, null, 2);
  return (
    <div data-certificado className="mt-3 border border-platform-border p-3">
      <p className="text-sm font-bold text-platform-text">Certificado gerado. Envie este arquivo ao testador.</p>
      <textarea readOnly aria-label="Certificado" className={`${CAMPO} mt-2 h-32 w-full font-mono text-xs`} value={texto} />
      <div className="mt-2 flex gap-3">
        <button type="button" className={BOTAO} onClick={() => baixar(emitido)}>Baixar {emitido.arquivo}</button>
        <button type="button" className={BOTAO_LINHA} onClick={() => void navigator.clipboard?.writeText(texto)}>Copiar</button>
      </div>
    </div>
  );
}

/** Um formulário de ação: sempre com motivo; mostra o aviso e, quando há, o certificado. */
function Acao({
  id, rotulo, corpo, campo, emDestaque = false, aoConcluir,
}: {
  id: string; rotulo: string; corpo: Record<string, unknown>;
  campo?: { chave: string; rotulo: string; placeholder: string };
  emDestaque?: boolean; aoConcluir: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [valor, setValor] = useState("");
  const [aviso, setAviso] = useState("");
  const [emitido, setEmitido] = useState<Emitido | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const r = await enviar({ ...corpo, ...(campo ? { [campo.chave]: valor } : {}), motivo });
    setEnviando(false);
    if (!r.ok) { setAviso(r.mensagem); setEmitido(null); return; }
    const d = r.dados as Partial<Emitido>;
    if (d.certificado) setEmitido(d as Emitido); else setEmitido(null);
    setAviso("Feito. O registro da equipe tem a ação.");
    setMotivo(""); setValor("");
    aoConcluir();
  }

  return (
    <form data-acao={id} onSubmit={aoEnviar} className="mt-3 flex flex-wrap items-end gap-3">
      {campo && (
        <label className="min-w-[18rem] flex-1">
          <span className={ROTULO}>{campo.rotulo}</span>
          <input className={`${CAMPO} w-full font-mono`} value={valor} onChange={(e) => setValor(e.target.value)} placeholder={campo.placeholder} />
        </label>
      )}
      <label className="min-w-[14rem] flex-1">
        <span className={ROTULO}>Motivo</span>
        <input className={`${CAMPO} w-full`} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Fica no registro da equipe" />
      </label>
      <button type="submit" className={emDestaque ? BOTAO : BOTAO_LINHA} disabled={enviando}>{rotulo}</button>
      {aviso && <p role="status" className="w-full text-sm text-platform-text">{aviso}</p>}
      {emitido && <div className="w-full"><Certificado emitido={emitido} /></div>}
    </form>
  );
}

function NovaLicenca({ aoCriar }: { aoCriar: () => void }) {
  const [plano, setPlano] = useState<"beta" | "individual" | "studio">("individual");
  const [dispositivos, setDispositivos] = useState("2");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [agencia, setAgencia] = useState("");
  const [dias, setDias] = useState("90");
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  function mudarPlano(p: "beta" | "individual" | "studio") {
    setPlano(p);
    if (p !== "studio") setDispositivos("2");
  }

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const r = await enviar({ acao: "criar", plano, dispositivos: Number(dispositivos), nome, email, agencia, dias: Number(dias), motivo });
    setEnviando(false);
    if (!r.ok) { setAviso(r.mensagem); return; }
    const { numero } = r.dados as { numero: string };
    setAviso(`Licença ${numero} criada.`);
    setNome(""); setEmail(""); setAgencia(""); setMotivo("");
    aoCriar();
  }

  return (
    <form data-nova-licenca onSubmit={aoEnviar} aria-label="Nova licença" className="border border-platform-border p-5">
      <h2 className="font-display text-sm font-black uppercase tracking-wider text-platform-text">Nova licença</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label><span className={ROTULO}>Plano</span>
          <select className={`${CAMPO} w-full`} value={plano} onChange={(e) => mudarPlano(e.target.value as "beta" | "individual" | "studio")}>
            <option value="individual">Individual (até 2 computadores)</option>
            <option value="beta">Beta (até 2 computadores)</option>
            <option value="studio">Estúdio (N computadores)</option>
          </select></label>
        <label><span className={ROTULO}>Computadores</span>
          <input className={`${CAMPO} w-full`} type="number" min={1} max={plano === "studio" ? 1000 : 2} value={dispositivos} onChange={(e) => setDispositivos(e.target.value)} /></label>
        <label><span className={ROTULO}>Validade (dias)</span>
          <input className={`${CAMPO} w-full`} type="number" min={1} max={90} value={dias} onChange={(e) => setDias(e.target.value)} /></label>
        <label><span className={ROTULO}>Nome do testador</span>
          <input className={`${CAMPO} w-full`} value={nome} onChange={(e) => setNome(e.target.value)} /></label>
        <label><span className={ROTULO}>E-mail</span>
          <input className={`${CAMPO} w-full`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label><span className={ROTULO}>Agência ou estúdio (opcional)</span>
          <input className={`${CAMPO} w-full`} value={agencia} onChange={(e) => setAgencia(e.target.value)} /></label>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="min-w-[16rem] flex-1"><span className={ROTULO}>Motivo</span>
          <input className={`${CAMPO} w-full`} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Fica no registro da equipe" /></label>
        <button type="submit" className={BOTAO} disabled={enviando}>Criar licença</button>
      </div>
      <p className="mt-2 text-xs text-platform-text-muted">A validade conta a partir de agora: ativar o computador mais tarde não estende o prazo.</p>
      {aviso && <p role="status" className="mt-2 text-sm text-platform-text">{aviso}</p>}
    </form>
  );
}

function CartaoDaLicenca({ l, aoMudar }: { l: Licenca; aoMudar: () => void }) {
  const estado = situacao(l);
  const ativas = l.ativacoes.filter((a) => !a.revogada_em);
  return (
    <section data-licenca={l.numero} data-situacao={estado} aria-label={`Licença ${l.numero}`} className="border border-platform-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-base font-bold text-platform-text">{l.numero}</h3>
        <span data-situacao-texto className="text-[11px] font-bold uppercase tracking-wide text-platform-text">
          {estado === "ativa" ? "Ativa" : estado === "vencida" ? "Vencida" : "Revogada"}
        </span>
      </div>
      <p className="mt-1 text-sm text-platform-text">
        {l.titular_nome} <span className="text-platform-text-muted">· {l.titular_email}{l.agencia ? ` · ${l.agencia}` : ""}</span>
      </p>
      <p className="mt-1 text-xs text-platform-text-muted">
        {PLANOS[l.plano]} · <span data-lugares>{ativas.length} de {l.max_dispositivos} computadores</span> · emitida em {data(l.emitida_em)} · vale até {data(l.expira_em)}
      </p>

      {l.ativacoes.length > 0 && (
        <ul className="mt-3 space-y-3">
          {l.ativacoes.map((a) => (
            <li key={a.id} data-ativacao={a.id} className="border-t border-platform-border pt-3">
              <p className="text-sm text-platform-text">
                <span className="font-mono text-xs">{a.codigo_dispositivo.slice(0, 14)}…</span> · ativado em {data(a.ativada_em)} ·{" "}
                <span data-ativacao-situacao>{a.revogada_em ? `revogado em ${data(a.revogada_em)}` : "ativo"}</span>
              </p>
              {!a.revogada_em && estado === "ativa" && (
                <>
                  <Acao id={`certificado-${a.id}`} rotulo="Gerar o certificado de novo" corpo={{ acao: "certificado", ativacaoId: a.id }} aoConcluir={aoMudar} />
                  <Acao id={`revogar-${a.id}`} rotulo="Revogar este computador" corpo={{ acao: "revogar-ativacao", ativacaoId: a.id }} aoConcluir={aoMudar} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {estado === "ativa" && (
        <>
          <h4 className="mt-5 text-[11px] font-bold uppercase tracking-wide text-platform-text-muted">Ativar um computador</h4>
          <Acao
            id={`ativar-${l.numero}`} rotulo="Gerar certificado" emDestaque aoConcluir={aoMudar}
            corpo={{ acao: "ativar", licencaId: l.id }}
            campo={{ chave: "codigo", rotulo: "Código do computador (tela Sobre do aplicativo)", placeholder: "Cole o código inteiro" }}
          />
          <h4 className="mt-5 text-[11px] font-bold uppercase tracking-wide text-platform-text-muted">Revogar a licença inteira</h4>
          <p className="text-xs text-platform-text-muted">Impede novas emissões. Certificados já entregues valem até o fim do prazo, porque o aplicativo confere offline.</p>
          <Acao id={`revogar-licenca-${l.numero}`} rotulo="Revogar a licença" corpo={{ acao: "revogar-licenca", licencaId: l.id }} aoConcluir={aoMudar} />
        </>
      )}
    </section>
  );
}

export function PainelDeFonts() {
  const [licencas, setLicencas] = useState<Licenca[] | null>(null);
  const [chave, setChave] = useState(true);
  const [erro, setErro] = useState("");

  const [versao, setVersao] = useState(0);
  const carregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await fetch("/api/console/fonts", { cache: "no-store" }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (r?.ok) { setLicencas(d.licencas); setChave(d.chaveConfigurada !== false); setErro(""); }
      else setErro(d.message ?? "Não foi possível ler as licenças.");
    })();
    return () => { cancelado = true; };
  }, [versao]);

  return (
    <div className="space-y-6">
      {!chave && (
        <p role="alert" data-sem-chave className="border border-platform-border p-4 text-sm font-bold text-platform-text">
          A chave de assinatura (BRENNIMARK_CHAVE_LICENCAS_FONTS) não está configurada neste ambiente. Dá para criar licenças, mas não emitir certificados.
        </p>
      )}
      <NovaLicenca aoCriar={carregar} />
      {erro && <p role="alert" className="text-sm text-platform-text">{erro}</p>}
      {licencas === null && !erro && <p className="text-sm text-platform-text-muted">Carregando as licenças…</p>}
      {licencas?.length === 0 && <p className="text-sm text-platform-text-muted">Nenhuma licença ainda.</p>}
      {licencas?.map((l) => <CartaoDaLicenca key={l.id} l={l} aoMudar={carregar} />)}
    </div>
  );
}
