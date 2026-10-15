"use client";

import { useId, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import {
  NOMES_DOS_USOS, USOS, medidasDaFonte, nomeDaFonte, ordenarTipografia, type FonteDaMarca, type Uso,
} from "@/lib/tipografia/tipografia";

/**
 * A tipografia da marca — 14/10/2026. O mesmo modelo da ficha da paleta.
 *
 * Uma linha por USO (título, subtítulo, texto, legenda, destaque, apoio), com
 * segmento opcional. A IA lê as páginas de tipografia e propõe o que falta,
 * como rascunho; uma pessoa confere e aprova. Só a aprovada entra em silêncio
 * no Grids, no Kit e no Vini (ADR-0004 §3.2).
 *
 * Guarda o NOME da fonte, nunca o arquivo. A tela não desenha a fonte da
 * marca: ela não é hospedada (ADR-0007), e o nome escrito é o que o designer
 * procura no menu de fontes. Tudo aqui usa os tokens da plataforma.
 */

type Rascunho = {
  id: string | null;
  uso: Uso; segmento: string; familia: string; estilo: string; postscript: string; substituta: string;
  corpo: string; entrelinha: string; espacejamento: string; caixa_alta: "" | "sim" | "nao";
  descricao: string; pagina: string; ordem: string;
};

const VAZIO: Rascunho = {
  id: null, uso: "titulo", segmento: "", familia: "", estilo: "", postscript: "", substituta: "",
  corpo: "", entrelinha: "", espacejamento: "", caixa_alta: "", descricao: "", pagina: "", ordem: "0",
};

const textoDe = (v: number | null) => (v === null ? "" : String(v));

function paraRascunho(f: FonteDaMarca): Rascunho {
  return {
    id: f.id, uso: f.uso, segmento: f.segmento, familia: f.familia, estilo: f.estilo,
    postscript: f.postscript ?? "", substituta: f.substituta ?? "",
    corpo: textoDe(f.corpo), entrelinha: textoDe(f.entrelinha), espacejamento: textoDe(f.espacejamento),
    caixa_alta: f.caixaAlta === true ? "sim" : f.caixaAlta === false ? "nao" : "",
    descricao: f.descricao, pagina: textoDe(f.pagina), ordem: String(f.ordem),
  };
}

const CAMPO = "w-full border border-platform-border bg-platform-bg px-3 py-2 text-sm text-platform-text focus:border-platform-signal focus:outline-none disabled:opacity-60";
const ROTULO = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-platform-text-muted";
const BOTAO = "border border-platform-border px-3 py-2 font-display text-[11px] font-bold uppercase text-platform-text hover:border-platform-signal disabled:opacity-40";
const BOTAO_FORTE = "bg-platform-signal px-4 py-2 font-display text-[11px] font-black uppercase text-platform-bg disabled:opacity-50";

export function TipografiaDaMarca({
  fontesIniciais,
  podeEditar,
  podeAprovar,
}: {
  fontesIniciais: FonteDaMarca[];
  podeEditar: boolean;
  podeAprovar: boolean;
}) {
  const titulo = useId();
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const t = (en: string, pt: string) => (isEnglish ? en : pt);
  const nomeDoUso = (u: Uso) => (isEnglish ? NOMES_DOS_USOS[u].en : NOMES_DOS_USOS[u].pt);
  const [fontes, setFontes] = useState(() => ordenarTipografia(fontesIniciais));
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [paginasDaLeitura, setPaginasDaLeitura] = useState("");

  const emRascunho = fontes.filter((f) => f.status === "draft");
  const aprovadas = fontes.length - emRascunho.length;
  const usosVazios = USOS.filter((u) => !fontes.some((f) => f.uso === u));
  const manual = alvo.workspaceSlug && alvo.brandKey ? `/w/${alvo.workspaceSlug}/b/${alvo.brandKey}/docs/original` : null;

  // Sem rede, o `fetch` rejeita: vira recusa com mensagem, e nenhum botão
  // fica preso em "ocupado".
  async function pedir(url: string, metodo: string, corpo: unknown) {
    const resposta = await fetch(comAlvo(url, alvo), {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    }).catch(() => null);
    if (!resposta) return { ok: false, dados: { message: t("No connection: nothing was saved.", "Sem conexão: nada foi guardado.") } };
    const dados = await resposta.json().catch(() => ({}));
    return { ok: resposta.ok, dados };
  }

  function trocar(f: FonteDaMarca) {
    setFontes((antes) => ordenarTipografia([...antes.filter((x) => x.id !== f.id), f]));
  }

  async function salvar() {
    if (!editando) return;
    setOcupado(true);
    setMensagem("");
    const { id, ...campos } = editando;
    const { ok, dados } = await pedir("/api/admin/tipografia", id ? "PATCH" : "POST", id ? { id, ...campos } : campos);
    setOcupado(false);
    if (!ok) {
      setMensagem(dados.message ?? t("Couldn't save the font.", "Não foi possível guardar a fonte."));
      return;
    }
    trocar(dados.fonte as FonteDaMarca);
    setEditando(null);
    setMensagem(t("Font saved as draft.", "Fonte guardada como rascunho."));
  }

  async function remover(f: FonteDaMarca) {
    if (!window.confirm(t(`Remove "${nomeDaFonte(f)}" (${nomeDoUso(f.uso)})?`, `Remover "${nomeDaFonte(f)}" (${nomeDoUso(f.uso)})?`))) return;
    setOcupado(true);
    setMensagem("");
    const { ok, dados } = await pedir("/api/admin/tipografia", "DELETE", { id: f.id });
    setOcupado(false);
    if (!ok) {
      setMensagem(dados.message ?? t("Couldn't remove the font.", "Não foi possível remover a fonte."));
      return;
    }
    setFontes((antes) => antes.filter((x) => x.id !== f.id));
    if (editando?.id === f.id) setEditando(null);
  }

  async function aprovar(ids: string[]) {
    setOcupado(true);
    setMensagem("");
    const { ok, dados } = await pedir("/api/admin/tipografia/aprovar", "POST", { ids });
    setOcupado(false);
    if (!ok) {
      setMensagem(dados.message ?? t("Couldn't approve.", "Não foi possível aprovar."));
      return;
    }
    const lista = (dados.aprovadas ?? []) as FonteDaMarca[];
    setFontes((antes) => ordenarTipografia(antes.map((f) => lista.find((a) => a.id === f.id) ?? f)));
    setMensagem(lista.length === 1 ? t("1 font approved.", "1 fonte aprovada.") : t(`${lista.length} fonts approved.`, `${lista.length} fontes aprovadas.`));
  }

  /** A IA lê as páginas de tipografia e propõe o que falta. Leva de 20 a 60 segundos. */
  async function lerDoManual() {
    setLendo(true);
    setOcupado(true);
    setMensagem("");
    const { ok, dados } = await pedir("/api/admin/tipografia/ler", "POST", { paginas: paginasDaLeitura });
    setLendo(false);
    setOcupado(false);
    if (!ok) {
      setMensagem(dados.message ?? t("Couldn't read the typography.", "Não foi possível ler a tipografia."));
      return;
    }
    if (Array.isArray(dados.fontes)) setFontes(ordenarTipografia(dados.fontes as FonteDaMarca[]));
    const paginas = ((dados.paginas ?? []) as number[]).join(", ");
    const lidas = Number(dados.lidas ?? 0);
    const partes = [
      lidas > 0
        ? t(`${lidas} font(s) read from pages ${paginas}, as drafts — check each name on the page before approving.`,
          `${lidas} ${lidas === 1 ? "fonte lida" : "fontes lidas"} das páginas ${paginas}, como rascunho — confira cada nome na página antes de aprovar.`)
        : Number(dados.encontradas ?? 0) > 0
          ? t("Every use the AI read already has a font in the sheet.", "Todos os usos que a IA leu já têm fonte na ficha.")
          : dados.cortada
          // Lição da paleta (27/09): resposta cortada não é "não achou".
          ? t("The AI's answer was cut short before any font. Run again with fewer pages.", "A resposta da IA foi cortada antes de qualquer fonte. Rode de novo com menos páginas.")
          : t(`The AI found no typography on pages ${paginas}. Type the right pages and try again.`,
            `A IA não achou tipografia nas páginas ${paginas}. Digite as páginas certas e tente de novo.`),
    ];
    if (lidas > 0 && Number(dados.repetidas ?? 0) > 0) {
      partes.push(t(`${dados.repetidas} use(s) already had a font and were kept.`, `${dados.repetidas} ${dados.repetidas === 1 ? "uso já tinha fonte e foi mantido" : "usos já tinham fonte e foram mantidos"}.`));
    }
    if (dados.cortada && Number(dados.encontradas ?? 0) > 0) {
      partes.push(t("The AI's answer was cut short: something may be missing. Run again with fewer pages.", "A resposta da IA foi cortada: pode faltar fonte. Rode de novo com menos páginas."));
    }
    if ((dados.semImagem ?? []).length > 0) {
      partes.push(t(`Pages ${dados.semImagem.join(", ")} weren't prepared and were left out.`, `As páginas ${dados.semImagem.join(", ")} não estavam preparadas e ficaram de fora.`));
    }
    setMensagem(partes.join(" "));
  }

  const campo = (chave: keyof Rascunho, rotulo: string, extra: { placeholder?: string; inputMode?: "numeric" | "decimal"; maxLength?: number; disabled?: boolean } = {}) => (
    <label className="block">
      <span className={ROTULO}>{rotulo}</span>
      <input
        value={(editando?.[chave] as string | null) ?? ""}
        onChange={(e) => setEditando((r) => (r ? { ...r, [chave]: e.target.value } : r))}
        className={CAMPO}
        {...extra}
      />
    </label>
  );

  return (
    <section data-tipografia-da-marca aria-labelledby={titulo} className="mt-16 border-t border-platform-border pt-12">
      <p className="font-display text-xs font-black uppercase tracking-[0.24em] text-platform-text">{t("Typography", "Tipografia")}</p>
      <h2 id={titulo} className="mt-3 font-display text-3xl font-black uppercase text-platform-text">{t("Brand typography", "Tipografia da marca")}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-platform-text-muted">
        {t(
          "Which font goes in each use, as the manual says — the sheet Grids, Kit and Vini will draw on. Only the font name is kept, never the file: each person installs the font. Every font starts as a draft; only who approves this brand approves it.",
          "Que fonte vai em cada uso, como o manual diz — a ficha de onde o Grids, o Kit e o Vini vão tirar a fonte. Guarda só o nome da fonte, nunca o arquivo: cada pessoa instala a fonte. Toda fonte nasce como rascunho; só quem aprova esta marca a aprova.",
        )}
      </p>

      {fontes.length > 0 && (
        <p data-resumo-da-tipografia className="mt-6 text-sm text-platform-text">
          {t(
            `${fontes.length} font(s) · ${aprovadas} approved, ${emRascunho.length} draft${usosVazios.length > 0 ? ` · no font for: ${usosVazios.map(nomeDoUso).join(", ")}` : ""}`,
            `${fontes.length} ${fontes.length === 1 ? "fonte" : "fontes"} · ${aprovadas} ${aprovadas === 1 ? "aprovada" : "aprovadas"}, ${emRascunho.length} em rascunho${usosVazios.length > 0 ? ` · sem fonte: ${usosVazios.map(nomeDoUso).join(", ")}` : ""}`,
          )}
        </p>
      )}

      {podeEditar && !editando && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" data-adicionar-fonte disabled={ocupado} onClick={() => { setMensagem(""); setEditando({ ...VAZIO, uso: usosVazios[0] ?? "titulo", ordem: String(fontes.length) }); }} className={BOTAO_FORTE}>
            {t("Add font", "Adicionar fonte")}
          </button>
        </div>
      )}

      {podeEditar && !editando && (
        <div data-leitura-da-tipografia className="mt-6 border border-dashed border-platform-border p-4">
          <p className="text-sm text-platform-text">
            {t("Let the AI read the typography pages and fill in the missing uses.", "Deixe a IA ler as páginas de tipografia e preencher os usos que faltam.")}
          </p>
          <p className="mt-1 text-xs text-platform-text-muted">
            {t(
              "They come in as drafts, marked as read by AI, and never replace a font already in the sheet. Check each name against the page before approving. The manual must be prepared for Vini first.",
              "Elas entram como rascunho, marcadas como lidas pela IA, e nunca trocam uma fonte que já está na ficha. Confira cada nome na página antes de aprovar. O manual precisa estar preparado para o Vini.",
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block w-full sm:w-64">
              <span className={ROTULO}>{t("Typography pages (optional)", "Páginas de tipografia (opcional)")}</span>
              <input
                value={paginasDaLeitura}
                onChange={(e) => setPaginasDaLeitura(e.target.value)}
                placeholder={t("e.g. 30, 31 — blank finds them", "ex.: 30, 31 — em branco, a IA acha")}
                inputMode="numeric"
                maxLength={30}
                className={CAMPO}
              />
            </label>
            <button type="button" data-ler-tipografia disabled={ocupado} onClick={lerDoManual} className={BOTAO}>
              {lendo ? t("Reading the pages…", "Lendo as páginas…") : t("Read from the manual", "Ler do manual")}
            </button>
          </div>
        </div>
      )}

      {editando && (
        <div data-formulario-da-fonte className="mt-6 border border-platform-border bg-platform-panel p-4 md:p-6">
          <p className="font-display text-xs font-black uppercase tracking-wider text-platform-text">
            {editando.id ? t("Edit font", "Editar fonte") : t("New font", "Nova fonte")}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className={ROTULO}>{t("Use", "Uso")}</span>
              <select
                value={editando.uso}
                disabled={Boolean(editando.id)}
                onChange={(e) => setEditando((r) => (r ? { ...r, uso: e.target.value as Uso } : r))}
                className={CAMPO}
              >
                {USOS.map((u) => <option key={u} value={u}>{nomeDoUso(u)}</option>)}
              </select>
            </label>
            {campo("segmento", t("Segment (optional)", "Segmento (opcional)"), { maxLength: 60, placeholder: t("e.g. print", "ex.: impresso"), disabled: Boolean(editando.id) })}
            {campo("familia", t("Family", "Família"), { maxLength: 120, placeholder: "ex.: Inter" })}
            {campo("estilo", t("Style", "Estilo"), { maxLength: 60, placeholder: "ex.: Bold" })}
            {campo("postscript", t("PostScript name (optional)", "Nome PostScript (opcional)"), { maxLength: 127, placeholder: "ex.: Inter-Bold" })}
            {campo("substituta", t("Substitute font (optional)", "Fonte substituta (opcional)"), { maxLength: 120, placeholder: "ex.: Arial" })}
            {campo("corpo", t("Size, pt (optional)", "Corpo, pt (opcional)"), { inputMode: "decimal", maxLength: 8 })}
            {campo("entrelinha", t("Leading, pt (optional)", "Entrelinha, pt (opcional)"), { inputMode: "decimal", maxLength: 8 })}
            {campo("espacejamento", t("Tracking (optional)", "Espacejamento (opcional)"), { inputMode: "numeric", maxLength: 6, placeholder: "ex.: 20" })}
            <label className="block">
              <span className={ROTULO}>{t("All caps", "Caixa alta")}</span>
              <select value={editando.caixa_alta} onChange={(e) => setEditando((r) => (r ? { ...r, caixa_alta: e.target.value as Rascunho["caixa_alta"] } : r))} className={CAMPO}>
                <option value="">{t("Manual doesn't say", "O manual não diz")}</option>
                <option value="sim">{t("Yes", "Sim")}</option>
                <option value="nao">{t("No", "Não")}</option>
              </select>
            </label>
            {campo("pagina", t("Manual page", "Página do manual"), { inputMode: "numeric", maxLength: 5 })}
            {campo("ordem", t("Order", "Ordem"), { inputMode: "numeric", maxLength: 5 })}
            <div className="sm:col-span-2 lg:col-span-4">{campo("descricao", t("How the manual puts it (optional)", "Como o manual diz (opcional)"), { maxLength: 300 })}</div>
          </div>
          <p className="mt-3 text-xs text-platform-text-muted">
            {editando.id
              ? t("Use and segment don't change: to move a font to another use, remove it and add it again.", "Uso e segmento não mudam: para levar a fonte a outro uso, remova e adicione de novo.")
              : t("The family is required. The PostScript name is the exact one, without spaces; the substitute is the system font the manual allows where the brand font doesn't run.", "A família é obrigatória. O nome PostScript é o exato, sem espaços; a substituta é a fonte de sistema que o manual permite onde a da marca não roda.")}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" data-salvar-fonte disabled={ocupado} onClick={salvar} className={BOTAO_FORTE}>
              {ocupado ? t("Saving…", "Salvando…") : t("Save font", "Salvar fonte")}
            </button>
            <button type="button" disabled={ocupado} onClick={() => setEditando(null)} className={BOTAO}>{t("Cancel", "Cancelar")}</button>
          </div>
        </div>
      )}

      {/* Aprovar todas e a mensagem ficam colados à lista (15/10/2026): no topo,
          longe das fontes, o André não viu o botão e aprovou uma por uma. */}
      {((podeAprovar && emRascunho.length > 1) || mensagem) && (
      <div data-barra-da-lista className="mt-6 flex flex-wrap items-center gap-3">
        {podeAprovar && emRascunho.length > 1 && (
          <button type="button" data-aprovar-todas-as-fontes disabled={ocupado} onClick={() => aprovar(emRascunho.map((f) => f.id))} className={BOTAO_FORTE}>
            {t(`Approve all drafts (${emRascunho.length})`, `Aprovar todos os rascunhos (${emRascunho.length})`)}
          </button>
        )}
        {mensagem && <p role="status" className="text-sm text-platform-text-muted">{mensagem}</p>}
      </div>
      )}

      {fontes.length === 0 && !editando && (
        <p className="mt-6 text-sm text-platform-text-muted">
          {t("No fonts in the sheet yet. Until there are, Grids makes the text styles without the brand font.", "Nenhuma fonte na ficha ainda. Enquanto não houver, o Grids faz os estilos de texto sem a fonte da marca.")}
        </p>
      )}

      {fontes.length > 0 && (
        <ul className="mt-3 divide-y divide-platform-border border border-platform-border">
          {fontes.map((f) => {
            const detalhes = [
              ...(f.postscript ? [`PostScript ${f.postscript}`] : []),
              ...medidasDaFonte(f, isEnglish),
              ...(f.substituta ? [t(`substitute ${f.substituta}`, `substituta ${f.substituta}`)] : []),
            ];
            return (
              <li key={f.id} data-fonte-da-marca={f.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <p className="w-28 shrink-0 font-display text-[11px] font-bold uppercase tracking-wider text-platform-text-muted">
                  {nomeDoUso(f.uso)}
                  {f.segmento ? <span className="block normal-case tracking-normal">{f.segmento}</span> : null}
                </p>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-platform-text">
                    {nomeDaFonte(f)}
                    {f.origem === "ia" && (
                      <span data-origem-ia className="ml-2 border border-dashed border-platform-border px-1.5 py-0.5 align-middle font-display text-[10px] font-bold uppercase tracking-wider text-platform-text-muted">
                        {t("read by AI", "lida pela IA")}
                      </span>
                    )}
                  </p>
                  {(detalhes.length > 0 || f.pagina !== null) && (
                    <p className="mt-1 break-words font-mono text-xs text-platform-text-muted">
                      {detalhes.join(" · ")}
                      {f.pagina !== null && (
                        <>
                          {detalhes.length > 0 ? " · " : ""}
                          {manual ? <a href={`${manual}?pagina=${f.pagina}`} className="underline hover:text-platform-text">p. {f.pagina}</a> : `p. ${f.pagina}`}
                        </>
                      )}
                    </p>
                  )}
                  {f.descricao && <p className="mt-1 text-xs text-platform-text-muted">{f.descricao}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    data-status-da-fonte={f.status}
                    className={`border px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider ${f.status === "ready" ? "border-platform-text text-platform-text" : "border-dashed border-platform-border text-platform-text-muted"}`}
                  >
                    {f.status === "ready" ? t("Approved", "Aprovada") : t("Draft", "Rascunho")}
                  </span>
                  {podeAprovar && f.status === "draft" && (
                    <button type="button" data-aprovar-fonte disabled={ocupado} onClick={() => aprovar([f.id])} className={BOTAO}>{t("Approve", "Aprovar")}</button>
                  )}
                  {podeEditar && (
                    <button type="button" data-editar-fonte disabled={ocupado} onClick={() => { setMensagem(""); setEditando(paraRascunho(f)); }} className={BOTAO}>{t("Edit", "Editar")}</button>
                  )}
                  {podeEditar && f.status === "draft" && (
                    <button type="button" data-remover-fonte disabled={ocupado} onClick={() => remover(f)} className={BOTAO}>{t("Remove", "Remover")}</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
