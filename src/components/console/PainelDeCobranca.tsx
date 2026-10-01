"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Plano = {
  codigo: string; nome: string; maximo_de_marcas: number | null; teto_mensal_do_vini_micros: number;
  armazenamento_bytes: number | null; a_venda: boolean; ordem: number; assinaturas: number;
};
type Preco = { id: string; plano: string; id_externo: string; moeda: string; intervalo: string; ativo: boolean; criado_em: string };
type Assinatura = {
  conta: string; workspace_id: string; plano: string; situacao: "ativa" | "em_atraso" | "cancelada";
  em_atraso_desde: string | null; periodo_pago_ate: string | null; cancelar_no_fim: boolean; moeda: string | null;
  titular_email: string; desde: string;
};
type Painel = { planos: Plano[]; precos: Preco[]; assinaturas: Assinatura[] };

const CAMPO = "border border-platform-border bg-platform-bg px-3 py-2 text-sm text-platform-text focus:border-platform-signal focus:outline-none";
const BOTAO = "bg-platform-signal px-4 py-2 font-display text-[11px] font-black uppercase text-platform-bg disabled:opacity-50";
const BOTAO_LINHA = "border border-platform-border px-4 py-2 font-display text-[11px] font-black uppercase text-platform-text disabled:opacity-50";
const TITULO = "font-display text-sm font-black uppercase tracking-wider text-platform-text";
const ROTULO = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-platform-text-muted";
const TH = "py-2 pr-4 font-bold";
const GB = 1024 ** 3;

const SITUACAO: Record<Assinatura["situacao"], string> = { ativa: "Ativa", em_atraso: "Em atraso", cancelada: "Cancelada" };
const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

async function enviar(corpo: unknown): Promise<{ erro: string | null; dados: Record<string, unknown> }> {
  const r = await fetch("/api/console/cobranca", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).catch(() => null);
  if (!r) return { erro: "Sem conexão: nada mudou.", dados: {} };
  const dados = await r.json().catch(() => ({}));
  return { erro: r.ok ? null : dados.message ?? "Não foi possível guardar a mudança.", dados };
}

/** Um plano: o que ele inclui, editável, com motivo. */
function EditorDePlano({ plano, aoConcluir }: { plano: Plano | null; aoConcluir: () => void }) {
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEnviando(true);
    const { erro } = await enviar({
      tipo: "definir_plano", codigo: f.get("codigo"), nome: f.get("nome"), maximoDeMarcas: f.get("maximoDeMarcas"),
      tetoMensalDoViniDolares: f.get("teto"), armazenamentoGb: f.get("armazenamentoGb"), aVenda: f.get("aVenda") === "on",
      ordem: f.get("ordem"), motivo: f.get("motivo"),
    });
    setEnviando(false);
    setAviso(erro ?? "Feito. O registro da equipe tem a mudança.");
    if (!erro) aoConcluir();
  }

  const id = plano?.codigo ?? "novo";
  return (
    <form data-editor-de-plano={id} onSubmit={aoEnviar} className="grid gap-3 border border-platform-border p-4 sm:grid-cols-4">
      <label><span className={ROTULO}>Código</span>
        <input name="codigo" defaultValue={plano?.codigo} readOnly={!!plano} className={`${CAMPO} w-full ${plano ? "opacity-60" : ""}`} placeholder="ex.: agencia-grande" /></label>
      <label><span className={ROTULO}>Nome</span><input name="nome" defaultValue={plano?.nome} className={`${CAMPO} w-full`} /></label>
      <label><span className={ROTULO}>Máximo de marcas</span>
        <input name="maximoDeMarcas" inputMode="numeric" defaultValue={plano?.maximo_de_marcas ?? ""} placeholder="vazio = sem limite" className={`${CAMPO} w-full`} /></label>
      <label><span className={ROTULO}>Teto do Vini (US$/mês)</span>
        <input name="teto" inputMode="decimal" defaultValue={plano ? plano.teto_mensal_do_vini_micros / 1_000_000 : ""} className={`${CAMPO} w-full`} /></label>
      <label><span className={ROTULO}>Armazenamento (GB)</span>
        <input name="armazenamentoGb" inputMode="numeric" defaultValue={plano?.armazenamento_bytes ? Math.round(plano.armazenamento_bytes / GB) : ""} placeholder="vazio = a definir" className={`${CAMPO} w-full`} /></label>
      <label><span className={ROTULO}>Ordem no site</span>
        <input name="ordem" inputMode="numeric" defaultValue={plano?.ordem ?? 9} className={`${CAMPO} w-full`} /></label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-platform-text">
        <input type="checkbox" name="aVenda" defaultChecked={plano?.a_venda ?? false} /> À venda no site
      </label>
      <label className="sm:col-span-3"><span className={ROTULO}>Motivo</span>
        <input name="motivo" className={`${CAMPO} w-full`} placeholder="Fica no registro da equipe" /></label>
      <div className="self-end"><button type="submit" className={BOTAO} disabled={enviando}>{plano ? "Guardar plano" : "Criar plano"}</button></div>
      {plano && plano.assinaturas > 0 && (
        <p className="text-xs text-platform-text-muted sm:col-span-4">
          {plano.assinaturas} {plano.assinaturas === 1 ? "conta assina" : "contas assinam"} este plano. Mudar o teto do Vini aqui vale para
          quem entrar ou trocar de plano; o teto de quem já assina se ajusta na própria conta (aba IA e limites).
        </p>
      )}
      {aviso && <p role="status" className="text-sm text-platform-text sm:col-span-4">{aviso}</p>}
    </form>
  );
}

function RegistrarPreco({ planos, aoConcluir }: { planos: Plano[]; aoConcluir: () => void }) {
  const [aviso, setAviso] = useState("");
  async function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { erro } = await enviar({ tipo: "registrar_preco", plano: f.get("plano"), idExterno: f.get("idExterno"), moeda: f.get("moeda"), motivo: f.get("motivo") });
    setAviso(erro ?? "Preço ligado. O anterior da mesma moeda ficou inativo.");
    if (!erro) { e.currentTarget.reset(); aoConcluir(); }
  }
  return (
    <form data-registrar-preco onSubmit={aoEnviar} className="mt-3 flex flex-wrap items-end gap-3">
      <label><span className={ROTULO}>Plano</span>
        <select name="plano" className={CAMPO}>{planos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}</select></label>
      <label><span className={ROTULO}>Moeda</span>
        <select name="moeda" className={CAMPO}><option value="BRL">BRL</option><option value="USD">USD</option></select></label>
      <label className="min-w-[14rem] flex-1"><span className={ROTULO}>Preço no Stripe</span>
        <input name="idExterno" className={`${CAMPO} w-full font-mono`} placeholder="price_…" /></label>
      <label className="min-w-[14rem] flex-1"><span className={ROTULO}>Motivo</span>
        <input name="motivo" className={`${CAMPO} w-full`} placeholder="Fica no registro da equipe" /></label>
      <button type="submit" className={BOTAO}>Ligar preço</button>
      {aviso && <p role="status" className="w-full text-sm text-platform-text">{aviso}</p>}
    </form>
  );
}

function DesativarPreco({ preco, aoConcluir }: { preco: Preco; aoConcluir: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState("");
  async function desativar() {
    const { erro } = await enviar({ tipo: "desativar_preco", id: preco.id, motivo });
    setAviso(erro ?? "");
    if (!erro) aoConcluir();
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input aria-label={`Motivo para desativar ${preco.id_externo}`} className={`${CAMPO} w-40`} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo" />
      <button type="button" className={BOTAO_LINHA} onClick={desativar}>Desativar</button>
      {aviso && <span role="alert" className="text-xs text-platform-text">{aviso}</span>}
    </span>
  );
}

/**
 * O link de primeiro acesso do titular: abre a sessão e leva à tela de criar a
 * senha. Só serve para titular que nasceu da compra e nunca entrou — o banco
 * decide e registra. Vale pouco tempo; gere quando for mandar.
 */
function LinkDeAcesso({ workspaceId }: { workspaceId: string }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [link, setLink] = useState("");
  const [aviso, setAviso] = useState("");
  async function gerar() {
    setLink("");
    const { erro, dados } = await enviar({ tipo: "link_de_acesso", workspaceId, motivo });
    setAviso(erro ?? "");
    if (!erro && typeof dados.url === "string") setLink(dados.url);
  }
  if (!aberto) return <button type="button" className={BOTAO_LINHA} onClick={() => setAberto(true)}>Link de acesso</button>;
  return (
    <div data-link-de-acesso className="flex min-w-[18rem] flex-col gap-2">
      <span className="flex flex-wrap gap-2">
        <input aria-label="Motivo do link de acesso" className={`${CAMPO} flex-1`} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo" />
        <button type="button" className={BOTAO} onClick={gerar}>Gerar</button>
      </span>
      {aviso && <span role="alert" className="text-xs text-platform-text">{aviso}</span>}
      {link && (
        <>
          <span className="text-xs text-platform-text">Mande à pessoa agora: o link vale cerca de 1 hora e leva à tela de criar a senha.</span>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={`${CAMPO} font-mono text-xs`} aria-label="Link de primeiro acesso" />
        </>
      )}
    </div>
  );
}

/** O link de pagamento do piloto: qualquer plano, inclusive o Piloto, que não está à venda. */
function LinkDePiloto({ planos }: { planos: Plano[] }) {
  const [link, setLink] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEnviando(true);
    setLink("");
    const { erro, dados } = await enviar({ tipo: "link_de_piloto", plano: f.get("plano"), moeda: f.get("moeda"),
      nome: f.get("nome"), email: f.get("email"), empresa: f.get("empresa") });
    setEnviando(false);
    setAviso(erro ?? "");
    if (!erro && typeof dados.url === "string") setLink(dados.url);
  }
  return (
    <form data-link-de-piloto onSubmit={aoEnviar} className="mt-3 grid gap-3 sm:grid-cols-3">
      <label><span className={ROTULO}>Plano</span>
        <select name="plano" defaultValue="piloto" className={`${CAMPO} w-full`}>{planos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}{p.a_venda ? "" : " (fora de venda)"}</option>)}</select></label>
      <label><span className={ROTULO}>Moeda</span>
        <select name="moeda" className={`${CAMPO} w-full`}><option value="BRL">BRL (cartão ou Pix)</option><option value="USD">USD (cartão)</option></select></label>
      <label><span className={ROTULO}>Empresa (nome da conta)</span><input name="empresa" className={`${CAMPO} w-full`} /></label>
      <label><span className={ROTULO}>Nome de quem assina</span><input name="nome" className={`${CAMPO} w-full`} /></label>
      <label><span className={ROTULO}>E-mail de quem assina</span><input name="email" type="email" className={`${CAMPO} w-full`} /></label>
      <div className="self-end"><button type="submit" className={BOTAO} disabled={enviando}>{enviando ? "Gerando…" : "Gerar link"}</button></div>
      {aviso && <p role="alert" className="text-sm text-platform-text sm:col-span-3">{aviso}</p>}
      {link && (
        <div className="sm:col-span-3" data-link-gerado>
          <p className="text-sm text-platform-text">Link pronto. Vale por 24 horas; depois, gere outro.</p>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={`${CAMPO} mt-2 w-full font-mono text-xs`} aria-label="Link de pagamento" />
        </div>
      )}
    </form>
  );
}

export function PainelDeCobranca() {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [erro, setErro] = useState("");
  const [novoPlano, setNovoPlano] = useState(false);

  const [versao, setVersao] = useState(0);
  const carregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await fetch("/api/console/cobranca", { cache: "no-store" }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (r?.ok) { setPainel(d); setErro(""); } else setErro(d.message ?? "Não foi possível ler a cobrança.");
    })();
    return () => { cancelado = true; };
  }, [versao]);

  if (erro) return <p role="alert" className="text-sm text-platform-text">{erro}</p>;
  if (!painel) return <p className="text-sm text-platform-text-muted">Carregando a cobrança…</p>;

  const ativos = painel.precos.filter((p) => p.ativo);
  const inativos = painel.precos.filter((p) => !p.ativo);

  return (
    <div className="space-y-10">
      <section aria-label="Assinaturas" data-assinaturas>
        <h2 className={TITULO}>Assinaturas</h2>
        {painel.assinaturas.length === 0 ? (
          <p className="mt-3 text-sm text-platform-text-muted">Nenhuma assinatura ainda. A primeira aparece aqui quando um pagamento for confirmado.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm text-platform-text">
              <thead className="text-[11px] uppercase tracking-wide text-platform-text-muted">
                <tr><th className={TH}>Conta</th><th className={TH}>Plano</th><th className={TH}>Situação</th><th className={TH}>Pago até</th><th className={TH}>Titular</th><th className={TH}>Desde</th><th className={TH}>Primeiro acesso</th></tr>
              </thead>
              <tbody>
                {painel.assinaturas.map((a) => (
                  <tr key={a.workspace_id} data-assinatura={a.workspace_id} className="border-t border-platform-border">
                    <td className="py-2 pr-4 font-bold">{a.conta}</td>
                    <td className="py-2 pr-4">{painel.planos.find((p) => p.codigo === a.plano)?.nome ?? a.plano}</td>
                    <td className="py-2 pr-4" data-situacao={a.situacao}>
                      {SITUACAO[a.situacao]}
                      {a.situacao === "em_atraso" && ` desde ${data(a.em_atraso_desde)}`}
                      {a.situacao === "ativa" && a.cancelar_no_fim && " · cancela no fim do período"}
                    </td>
                    <td className="py-2 pr-4 font-mono">{data(a.periodo_pago_ate)}</td>
                    <td className="py-2 pr-4">{a.titular_email}</td>
                    <td className="py-2 pr-4 font-mono">{data(a.desde)}</td>
                    <td className="py-2 pr-4"><LinkDeAcesso workspaceId={a.workspace_id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Planos" data-planos>
        <h2 className={TITULO}>Planos</h2>
        <p className="mt-1 text-sm text-platform-text-muted">
          Os limites de cada plano. O valor cobrado mora no Stripe; aqui fica o que o plano inclui. Valores provisórios até o modelo comercial fechar.
        </p>
        <div className="mt-3 space-y-3">
          {painel.planos.map((p) => <EditorDePlano key={p.codigo} plano={p} aoConcluir={carregar} />)}
          {novoPlano ? <EditorDePlano plano={null} aoConcluir={() => { setNovoPlano(false); carregar(); }} />
            : <button type="button" className={BOTAO_LINHA} onClick={() => setNovoPlano(true)}>Novo plano</button>}
        </div>
      </section>

      <section aria-label="Preços do Stripe" data-precos>
        <h2 className={TITULO}>Preços no Stripe</h2>
        <p className="mt-1 text-sm text-platform-text-muted">
          Crie o produto e o preço mensal no painel do Stripe e cole aqui o identificador (price_…). Um preço ativo por plano e moeda; o novo
          substitui o anterior, que fica inativo porque assinaturas antigas continuam nele.
        </p>
        {ativos.length === 0 ? (
          <p className="mt-3 text-sm font-bold text-platform-text" data-sem-precos>Nenhum preço ligado: a compra pelo site mostra &ldquo;ainda não está aberta&rdquo;.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm text-platform-text">
            <thead className="text-[11px] uppercase tracking-wide text-platform-text-muted">
              <tr><th className={TH}>Plano</th><th className={TH}>Moeda</th><th className={TH}>Preço</th><th className={TH}>Ligado em</th><th className={TH}></th></tr>
            </thead>
            <tbody>
              {ativos.map((p) => (
                <tr key={p.id} data-preco={p.id_externo} className="border-t border-platform-border">
                  <td className="py-2 pr-4">{painel.planos.find((x) => x.codigo === p.plano)?.nome ?? p.plano}</td>
                  <td className="py-2 pr-4">{p.moeda}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{p.id_externo}</td>
                  <td className="py-2 pr-4 font-mono">{data(p.criado_em)}</td>
                  <td className="py-2 pr-4"><DesativarPreco preco={p} aoConcluir={carregar} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {inativos.length > 0 && (
          <details className="mt-3 text-sm text-platform-text-muted">
            <summary className="cursor-pointer">{inativos.length} {inativos.length === 1 ? "preço inativo" : "preços inativos"}</summary>
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {inativos.map((p) => <li key={p.id}>{p.plano} · {p.moeda} · {p.id_externo}</li>)}
            </ul>
          </details>
        )}
        <RegistrarPreco planos={painel.planos} aoConcluir={carregar} />
      </section>

      <section aria-label="Link de pagamento do piloto">
        <h2 className={TITULO}>Link de pagamento do piloto</h2>
        <p className="mt-1 text-sm text-platform-text-muted">
          Para um cliente piloto: gere o link, mande para a pessoa, e a conta nasce quando o pagamento for confirmado. Serve qualquer
          plano, inclusive os que não estão à venda no site.
        </p>
        <LinkDePiloto planos={painel.planos} />
      </section>
    </div>
  );
}
