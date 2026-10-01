"use client";

import { useCallback, useEffect, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import {
  MAXIMO_DO_TEXTO, MAXIMO_DO_TITULO, situacao, tituloVisivel, type Acao, type Complemento,
} from "@/lib/complementos/complementos";
import { TextoEmMarkdown } from "./TextoEmMarkdown";

const CAMPO = "w-full border border-platform-border bg-platform-bg px-3 py-2 text-base text-platform-text focus:border-platform-signal focus:outline-none sm:text-sm";
const ROTULO = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-platform-text-muted";
const BOTAO = "border border-platform-text bg-platform-text px-4 py-2 text-sm font-bold text-platform-bg disabled:cursor-not-allowed disabled:opacity-40";
const BOTAO_LEVE = "border border-platform-border px-3 py-1.5 text-sm text-platform-text hover:border-platform-text disabled:cursor-not-allowed disabled:opacity-40";
const SELO = "border border-platform-border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide";

type Versao = { id: string; versao: number; acao: "publicado" | "arquivado" | "reativado"; titulo: string; texto: string; autor_email: string; created_at: string };
type Edicao = { id: string | null; titulo: string; texto: string };

function useT() {
  const isEnglish = useIsEnglish();
  return useCallback((pt: string, en: string) => (isEnglish ? en : pt), [isEnglish]);
}

function useData() {
  const isEnglish = useIsEnglish();
  return (iso: string) => new Intl.DateTimeFormat(isEnglish ? "en-US" : "pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

/**
 * Complementos — o terceiro segmento da barra (direção §20, 01/10/2026).
 *
 * Quem consulta lê os publicados. Quem edita escreve em Markdown com prévia ao
 * lado, salva rascunho e PUBLICA — publicar é aprovar (decisão 75): só então o
 * texto aparece para os outros e o Vini passa a usá-lo. O manual continua sendo
 * a referência; o complemento acrescenta.
 *
 * Cada complemento tem a âncora do seu endereço (`#<slug>`): é para onde leva
 * a citação "Complemento: título" do Vini.
 */
export function Complementos() {
  const alvo = useAlvo();
  const t = useT();
  const [dados, setDados] = useState<{ podeEditar: boolean; complementos: Complemento[] } | null>(null);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);
  const [editando, setEditando] = useState<Edicao | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const resposta = await fetch(comAlvo("/api/complementos", alvo), { cache: "no-store" }).catch(() => null);
      const corpo = resposta ? await resposta.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (resposta?.ok) setDados({ podeEditar: Boolean(corpo.podeEditar), complementos: corpo.complementos ?? [] });
      else setErro(corpo.message ?? t("Não foi possível carregar os complementos.", "Couldn't load the supplements."));
    })();
    return () => { cancelado = true; };
  }, [alvo, versao, t]);

  // A citação do Vini leva a `#<slug>`: depois que a lista chega, rola até ele.
  useEffect(() => {
    if (!dados || typeof window === "undefined" || !window.location.hash) return;
    document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView({ block: "start" });
  }, [dados]);

  const recarregar = () => setVersao((v) => v + 1);
  const visiveis = (dados?.complementos ?? []).filter((c) => dados?.podeEditar || situacao(c) !== "rascunho");

  return (
    <div data-complementos className="mx-auto max-w-[52rem] px-[var(--space-shell-5)] py-[var(--space-shell-6)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-platform-border pb-3">
        <h1 className="font-display text-2xl font-black uppercase text-platform-text">{t("Complementos", "Supplements")}</h1>
        {dados && <span className="font-mono text-[12px] text-platform-text-muted">C · {String(visiveis.length).padStart(2, "0")}</span>}
      </div>
      <p className="mt-3 max-w-[46rem] text-sm leading-relaxed text-platform-text-muted">
        {t("Textos da marca para o que o manual não cobre. O manual continua sendo a referência: o complemento acrescenta, e o Vini cita os dois quando falam do mesmo assunto.",
           "The brand's texts for what the manual doesn't cover. The manual stays the reference: a supplement adds to it, and Vini cites both when they cover the same subject.")}
      </p>

      {erro && <p role="alert" className="mt-6 text-sm text-platform-text">{erro}</p>}
      {!dados && !erro && <p className="mt-6 text-sm text-platform-text-muted">{t("Carregando…", "Loading…")}</p>}

      {dados?.podeEditar && !editando && (
        <button type="button" data-novo-complemento onClick={() => setEditando({ id: null, titulo: "", texto: "" })} className={`mt-6 ${BOTAO}`}>
          {t("+ Novo complemento", "+ New supplement")}
        </button>
      )}
      {editando && editando.id === null && (
        <Editor edicao={editando} aoFechar={() => setEditando(null)} aoSalvar={() => { setEditando(null); recarregar(); }} />
      )}

      {dados && visiveis.length === 0 && !editando && (
        <p data-sem-complementos className="mt-8 text-sm text-platform-text-muted">
          {dados.podeEditar
            ? t("Nenhum complemento ainda. Quando a equipe perguntar o que o manual não responde, escreva aqui — depois de publicado, o Vini passa a responder com ele.",
                "No supplements yet. When the team asks what the manual doesn't answer, write it here — once published, Vini answers with it.")
            : t("Esta marca ainda não tem complementos.", "This brand has no supplements yet.")}
        </p>
      )}

      <div className="mt-8 space-y-12">
        {visiveis.map((c) =>
          editando?.id === c.id ? (
            <Editor key={c.id} edicao={editando} aoFechar={() => setEditando(null)} aoSalvar={() => { setEditando(null); recarregar(); }} />
          ) : (
            <ComplementoLido key={c.id} c={c} podeEditar={dados!.podeEditar} recarregar={recarregar}
              editar={() => setEditando({ id: c.id, titulo: c.rascunho?.titulo ?? c.titulo ?? "", texto: c.rascunho?.texto ?? c.texto ?? "" })} />
          ),
        )}
      </div>
    </div>
  );
}

function ComplementoLido({ c, podeEditar, recarregar, editar }: { c: Complemento; podeEditar: boolean; recarregar: () => void; editar: () => void }) {
  const alvo = useAlvo();
  const t = useT();
  const data = useData();
  const [confirmar, setConfirmar] = useState<Acao | null>(null);
  const [agindo, setAgindo] = useState(false);
  const [erro, setErro] = useState("");
  const [historico, setHistorico] = useState<Versao[] | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);
  const s = situacao(c);

  async function agir(acao: Acao) {
    setAgindo(true);
    setErro("");
    const resposta = await fetch(comAlvo(`/api/complementos/${c.id}`, alvo), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao }),
    }).catch(() => null);
    const corpo = resposta ? await resposta.json().catch(() => ({})) : {};
    setAgindo(false);
    setConfirmar(null);
    if (resposta?.ok) recarregar();
    else setErro(corpo.message ?? t("Não foi possível concluir. Tente de novo.", "Couldn't complete it. Try again."));
  }

  async function abrirHistorico() {
    setVerHistorico((v) => !v);
    if (historico) return;
    const resposta = await fetch(comAlvo(`/api/complementos/${c.id}/versoes`, alvo), { cache: "no-store" }).catch(() => null);
    const corpo = resposta ? await resposta.json().catch(() => ({})) : {};
    setHistorico(resposta?.ok ? (corpo.versoes ?? []) : []);
  }

  const acaoDoHistorico = (a: Versao["acao"]) => ({ publicado: t("publicada", "published"), arquivado: t("arquivada", "archived"), reativado: t("reativada", "reactivated") })[a];
  const textoDaConfirmacao: Partial<Record<Acao, string>> = {
    publicar: t("Publicar? Todos que alcançam a marca passam a ler, e o Vini passa a usar este texto.", "Publish? Everyone with access reads it, and Vini starts using it."),
    descartar: c.versao === 0
      ? t("Descartar? Este complemento nunca foi publicado e some por inteiro.", "Discard? This supplement was never published and goes away entirely.")
      : t("Descartar a edição? O publicado continua como está.", "Discard the edit? The published text stays as is."),
    arquivar: t("Arquivar? Sai da leitura e do Vini; o texto e o histórico ficam.", "Archive? It leaves reading and Vini; the text and history stay."),
  };

  return (
    <article id={c.slug} data-complemento={c.slug} data-situacao={s} className="scroll-mt-24">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-lg font-black uppercase tracking-wide text-platform-text">{tituloVisivel(c)}</h2>
        {podeEditar && s === "rascunho" && <span data-selo="rascunho" className={`${SELO} text-platform-warning`}>{t("Rascunho · só quem edita vê", "Draft · only editors see it")}</span>}
        {podeEditar && s === "publicado-com-rascunho" && <span data-selo="edicao" className={`${SELO} text-platform-warning`}>{t("Edição não publicada", "Unpublished edit")}</span>}
        {podeEditar && s === "arquivado" && <span data-selo="arquivado" className={SELO}>{t("Arquivado · fora da leitura e do Vini", "Archived · out of reading and Vini")}</span>}
      </div>
      {c.publicado_em && (
        <p className="mt-1 text-xs text-platform-text-muted">
          {t(`Versão ${c.versao} · publicada em ${data(c.publicado_em)}`, `Version ${c.versao} · published ${data(c.publicado_em)}`)}
          {podeEditar && c.publicado_por_email ? ` · ${c.publicado_por_email}` : ""}
        </p>
      )}

      {c.texto && <div className="mt-4"><TextoEmMarkdown texto={c.texto} /></div>}

      {podeEditar && c.rascunho && (
        <div data-rascunho className="mt-4 border border-dashed border-platform-border p-4">
          <p className={ROTULO}>{c.versao === 0 ? t("Rascunho — ainda não publicado", "Draft — not published yet") : t("Edição em rascunho — o publicado acima segue valendo", "Draft edit — the published text above still applies")}</p>
          {c.rascunho.titulo !== c.titulo && c.versao > 0 && <p className="mb-2 text-sm font-bold">{c.rascunho.titulo}</p>}
          {c.rascunho.texto.trim()
            ? <TextoEmMarkdown texto={c.rascunho.texto} />
            : <p className="text-sm text-platform-text-muted">{t("(sem texto ainda)", "(no text yet)")}</p>}
          <p className="mt-2 text-xs text-platform-text-muted">{t(`Salvo em ${data(c.rascunho.atualizado_em)} · ${c.rascunho.atualizado_por_email}`, `Saved ${data(c.rascunho.atualizado_em)} · ${c.rascunho.atualizado_por_email}`)}</p>
        </div>
      )}

      {podeEditar && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {confirmar ? (
            <>
              <span className="text-sm">{textoDaConfirmacao[confirmar]}</span>
              <button type="button" data-confirmar={confirmar} disabled={agindo} onClick={() => void agir(confirmar)} className={BOTAO}>{t("Confirmar", "Confirm")}</button>
              <button type="button" onClick={() => setConfirmar(null)} className="text-sm underline">{t("cancelar", "cancel")}</button>
            </>
          ) : s === "arquivado" ? (
            <button type="button" data-acao="reativar" disabled={agindo} onClick={() => void agir("reativar")} className={BOTAO_LEVE}>{t("Reativar", "Reactivate")}</button>
          ) : (
            <>
              <button type="button" data-acao="editar" onClick={editar} className={BOTAO_LEVE}>{t("Editar", "Edit")}</button>
              {c.rascunho && <button type="button" data-acao="publicar" onClick={() => setConfirmar("publicar")} className={BOTAO}>{t("Publicar", "Publish")}</button>}
              {c.rascunho && <button type="button" data-acao="descartar" onClick={() => setConfirmar("descartar")} className={BOTAO_LEVE}>{t("Descartar rascunho", "Discard draft")}</button>}
              {c.versao > 0 && <button type="button" data-acao="arquivar" onClick={() => setConfirmar("arquivar")} className={BOTAO_LEVE}>{t("Arquivar", "Archive")}</button>}
            </>
          )}
          {c.versao > 0 && !confirmar && (
            <button type="button" data-ver-historico onClick={() => void abrirHistorico()} aria-expanded={verHistorico} className="text-sm underline">
              {verHistorico ? t("Fechar histórico", "Close history") : t("Histórico", "History")}
            </button>
          )}
        </div>
      )}
      {erro && <p role="alert" className="mt-2 text-sm font-bold">{erro}</p>}

      {verHistorico && (
        <div data-historico={c.slug} className="mt-4 border-l-2 border-platform-border pl-4">
          {!historico && <p className="text-sm text-platform-text-muted">{t("Carregando…", "Loading…")}</p>}
          {historico?.map((v) => (
            <details key={v.id} data-versao={`${v.versao}-${v.acao}`} className="py-1">
              <summary className="cursor-pointer text-sm">
                {t(`Versão ${v.versao} ${acaoDoHistorico(v.acao)}`, `Version ${v.versao} ${acaoDoHistorico(v.acao)}`)}
                <span className="text-platform-text-muted"> · {data(v.created_at)} · {v.autor_email}</span>
              </summary>
              <div className="mt-2 border border-platform-border p-3">
                <p className="mb-2 text-sm font-bold">{v.titulo}</p>
                <TextoEmMarkdown texto={v.texto} />
              </div>
            </details>
          ))}
        </div>
      )}
    </article>
  );
}

/** O editor: título, Markdown à esquerda e a prévia à direita (empilhados no celular). */
function Editor({ edicao, aoFechar, aoSalvar }: { edicao: Edicao; aoFechar: () => void; aoSalvar: () => void }) {
  const alvo = useAlvo();
  const t = useT();
  const [titulo, setTitulo] = useState(edicao.titulo);
  const [texto, setTexto] = useState(edicao.texto);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    const resposta = await fetch(comAlvo(edicao.id ? `/api/complementos/${edicao.id}` : "/api/complementos", alvo), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edicao.id ? { acao: "salvar", titulo, texto } : { titulo, texto }),
    }).catch(() => null);
    const corpo = resposta ? await resposta.json().catch(() => ({})) : {};
    setSalvando(false);
    if (resposta?.ok) aoSalvar();
    else setErro(corpo.message ?? t("Não foi possível salvar. Tente de novo.", "Couldn't save. Try again."));
  }

  return (
    <form data-editor-de-complemento onSubmit={salvar} className="mt-6 space-y-4 border border-platform-border p-4">
      <label className="block"><span className={ROTULO}>{t("Título", "Title")}</span>
        <input data-titulo-do-complemento value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={MAXIMO_DO_TITULO}
          placeholder={t("Símbolo sobre fotografia", "Symbol over photography")} className={CAMPO} /></label>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block"><span className={ROTULO}>{t("Texto (Markdown)", "Text (Markdown)")}</span>
          <textarea data-texto-do-complemento value={texto} onChange={(e) => setTexto(e.target.value)} rows={14}
            placeholder={t("## Quando usar\n- Só sobre áreas escuras\n- **Nunca** sobre rosto", "## When to use\n- Only over dark areas\n- **Never** over faces")}
            className={`${CAMPO} font-mono text-[13px] leading-relaxed`} />
          <span className="mt-1 block text-right font-mono text-[11px] text-platform-text-muted">{texto.length.toLocaleString("pt-BR")} / {MAXIMO_DO_TEXTO.toLocaleString("pt-BR")}</span>
        </label>
        <div data-previa>
          <span className={ROTULO}>{t("Prévia", "Preview")}</span>
          <div className="min-h-[12rem] border border-platform-border bg-platform-panel p-3">
            {texto.trim() ? <TextoEmMarkdown texto={texto} /> : <p className="text-sm text-platform-text-muted">{t("A prévia aparece aqui.", "The preview appears here.")}</p>}
          </div>
        </div>
      </div>
      <p className="text-xs text-platform-text-muted">
        {t("Use ## para dividir em seções: cada seção vira um trecho que o Vini cita. Salvar guarda o rascunho; só Publicar mostra aos outros e entrega ao Vini.",
           "Use ## to split into sections: each section becomes a passage Vini cites. Saving keeps the draft; only Publish shows it to others and gives it to Vini.")}
      </p>
      {erro && <p role="alert" className="text-sm font-bold">{erro}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" data-salvar-rascunho disabled={salvando || !titulo.trim()} className={BOTAO}>{salvando ? t("Salvando…", "Saving…") : t("Salvar rascunho", "Save draft")}</button>
        <button type="button" onClick={aoFechar} className="text-sm underline">{t("Cancelar", "Cancel")}</button>
      </div>
    </form>
  );
}
