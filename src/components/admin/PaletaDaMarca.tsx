"use client";

import { useId, useMemo, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { ordenarPaleta, type CorDaPaleta, type Papel } from "@/lib/paleta/paleta";

/**
 * A ficha da paleta da marca — 27/09/2026.
 *
 * Uma pessoa confere as cores do manual UMA vez, e daí em diante o Vini
 * responde por ela ("quantas cores tem a marca?"). Editar e aprovar são
 * capacidades separadas (ADR-0002): quem edita redige, sempre como rascunho;
 * só quem aprova aprova. A tela mostra o que cada um pode; o banco decide.
 *
 * A amostra é a ÚNICA cor da marca nesta tela, e é conteúdo, não controle:
 * botões, selos e foco usam os tokens da plataforma.
 */

type Rascunho = {
  id: string | null;
  nome: string;
  papel: Papel;
  segmento: string;
  hex: string;
  rgb: string;
  cmyk: string;
  pms: string;
  pagina: string;
  ordem: string;
};

const VAZIO: Rascunho = { id: null, nome: "", papel: "apoio", segmento: "", hex: "", rgb: "", cmyk: "", pms: "", pagina: "", ordem: "0" };

function paraRascunho(cor: CorDaPaleta): Rascunho {
  return {
    id: cor.id, nome: cor.nome, papel: cor.papel, segmento: cor.segmento,
    hex: cor.hex ?? "", rgb: cor.rgb ?? "", cmyk: cor.cmyk ?? "", pms: cor.pms ?? "",
    pagina: cor.pagina === null ? "" : String(cor.pagina), ordem: String(cor.ordem),
  };
}

const CAMPO = "w-full border border-platform-border bg-platform-bg px-3 py-2 text-sm text-platform-text focus:border-platform-signal focus:outline-none";
const ROTULO = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-platform-text-muted";
const BOTAO = "border border-platform-border px-3 py-2 font-display text-[11px] font-bold uppercase text-platform-text hover:border-platform-signal disabled:opacity-40";
const BOTAO_FORTE = "bg-platform-signal px-4 py-2 font-display text-[11px] font-black uppercase text-platform-bg disabled:opacity-50";

export function PaletaDaMarca({
  coresIniciais,
  podeEditar,
  podeAprovar,
}: {
  coresIniciais: CorDaPaleta[];
  podeEditar: boolean;
  podeAprovar: boolean;
}) {
  const titulo = useId();
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const t = (en: string, pt: string) => (isEnglish ? en : pt);
  const [cores, setCores] = useState(() => ordenarPaleta(coresIniciais));
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const resumo = useMemo(() => {
    const principais = cores.filter((c) => c.papel === "principal").length;
    const aprovadas = cores.filter((c) => c.status === "ready").length;
    return { principais, apoio: cores.length - principais, aprovadas, rascunhos: cores.length - aprovadas };
  }, [cores]);
  const emRascunho = cores.filter((c) => c.status === "draft");
  const manual = alvo.workspaceSlug && alvo.brandKey ? `/w/${alvo.workspaceSlug}/b/${alvo.brandKey}/docs/original` : null;

  async function pedir(url: string, metodo: string, corpo: unknown) {
    const resposta = await fetch(comAlvo(url, alvo), {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = await resposta.json().catch(() => ({}));
    return { ok: resposta.ok, dados };
  }

  function trocar(atualizada: CorDaPaleta) {
    setCores((antes) => ordenarPaleta([...antes.filter((c) => c.id !== atualizada.id), atualizada]));
  }

  async function salvar() {
    if (!editando) return;
    setOcupado(true);
    setMensagem("");
    const { id, ...campos } = editando;
    const { ok, dados } = await pedir("/api/admin/paleta", id ? "PATCH" : "POST", id ? { id, ...campos } : campos);
    setOcupado(false);
    if (!ok) {
      setMensagem(dados.message ?? t("Couldn't save the color.", "Não foi possível guardar a cor."));
      return;
    }
    trocar(dados.cor as CorDaPaleta);
    setEditando(null);
    setMensagem(t("Color saved as draft.", "Cor guardada como rascunho."));
  }

  async function remover(cor: CorDaPaleta) {
    if (!window.confirm(t(`Remove "${cor.nome}" from the palette?`, `Remover "${cor.nome}" da paleta?`))) return;
    setOcupado(true);
    setMensagem("");
    const { ok, dados } = await pedir("/api/admin/paleta", "DELETE", { id: cor.id });
    setOcupado(false);
    if (!ok) {
      setMensagem(dados.message ?? t("Couldn't remove the color.", "Não foi possível remover a cor."));
      return;
    }
    setCores((antes) => antes.filter((c) => c.id !== cor.id));
    if (editando?.id === cor.id) setEditando(null);
  }

  async function aprovar(ids: string[]) {
    setOcupado(true);
    setMensagem("");
    const { ok, dados } = await pedir("/api/admin/paleta/aprovar", "POST", { ids });
    setOcupado(false);
    if (!ok) {
      setMensagem(dados.message ?? t("Couldn't approve.", "Não foi possível aprovar."));
      return;
    }
    const aprovadas = (dados.aprovadas ?? []) as CorDaPaleta[];
    setCores((antes) => ordenarPaleta(antes.map((c) => aprovadas.find((a) => a.id === c.id) ?? c)));
    setMensagem(aprovadas.length === 1
      ? t("1 color approved.", "1 cor aprovada.")
      : t(`${aprovadas.length} colors approved.`, `${aprovadas.length} cores aprovadas.`));
  }

  const campo = (chave: keyof Rascunho, rotulo: string, extra: { placeholder?: string; inputMode?: "numeric"; maxLength?: number } = {}) => (
    <label className="block">
      <span className={ROTULO}>{rotulo}</span>
      <input
        value={editando?.[chave] ?? ""}
        onChange={(e) => setEditando((r) => (r ? { ...r, [chave]: e.target.value } : r))}
        className={CAMPO}
        {...extra}
      />
    </label>
  );

  return (
    <section data-paleta-da-marca aria-labelledby={titulo} className="mt-16 border-t border-platform-border pt-12">
      <p className="font-display text-xs font-black uppercase tracking-[0.24em] text-platform-text">{t("Colors", "Cores")}</p>
      <h2 id={titulo} className="mt-3 font-display text-3xl font-black uppercase text-platform-text">{t("Brand palette", "Paleta da marca")}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-platform-text-muted">
        {t(
          "The palette sheet, checked against the manual. The assistant answers about colors from it. Every color starts as a draft; only who approves this brand approves it, and changing an approved color returns it to draft.",
          "A ficha das cores, conferida contra o manual. O Vini responde sobre cores por ela. Toda cor nasce como rascunho; só quem aprova esta marca a aprova, e alterar uma cor aprovada a devolve a rascunho.",
        )}
      </p>

      {cores.length > 0 && (
        <p data-resumo-da-paleta className="mt-6 text-sm text-platform-text">
          {t(
            `${cores.length} color(s) · ${resumo.principais} primary, ${resumo.apoio} support · ${resumo.aprovadas} approved, ${resumo.rascunhos} draft`,
            `${cores.length} ${cores.length === 1 ? "cor" : "cores"} · ${resumo.principais} ${resumo.principais === 1 ? "principal" : "principais"}, ${resumo.apoio} de apoio · ${resumo.aprovadas} ${resumo.aprovadas === 1 ? "aprovada" : "aprovadas"}, ${resumo.rascunhos} em rascunho`,
          )}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {podeEditar && !editando && (
          <button type="button" data-adicionar-cor disabled={ocupado} onClick={() => { setMensagem(""); setEditando({ ...VAZIO, ordem: String(cores.length) }); }} className={BOTAO_FORTE}>
            {t("Add color", "Adicionar cor")}
          </button>
        )}
        {podeAprovar && emRascunho.length > 1 && (
          <button type="button" data-aprovar-todas disabled={ocupado} onClick={() => aprovar(emRascunho.map((c) => c.id))} className={BOTAO}>
            {t(`Approve all drafts (${emRascunho.length})`, `Aprovar todos os rascunhos (${emRascunho.length})`)}
          </button>
        )}
        {mensagem && <p role="status" className="text-sm text-platform-text-muted">{mensagem}</p>}
      </div>

      {editando && (
        <div data-formulario-da-cor className="mt-6 border border-platform-border bg-platform-panel p-4 md:p-6">
          <p className="font-display text-xs font-black uppercase tracking-wider text-platform-text">
            {editando.id ? t("Edit color", "Editar cor") : t("New color", "Nova cor")}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">{campo("nome", t("Name", "Nome"), { maxLength: 80, placeholder: t("e.g. Bradesco Red", "ex.: Vermelho Bradesco") })}</div>
            <label className="block">
              <span className={ROTULO}>{t("Role", "Papel")}</span>
              <select value={editando.papel} onChange={(e) => setEditando((r) => (r ? { ...r, papel: e.target.value as Papel } : r))} className={CAMPO}>
                <option value="principal">{t("Primary", "Principal")}</option>
                <option value="apoio">{t("Support", "Apoio")}</option>
              </select>
            </label>
            {campo("segmento", t("Segment (optional)", "Segmento (opcional)"), { maxLength: 80 })}
            {campo("hex", "HEX", { placeholder: "#CC092F", maxLength: 12 })}
            {campo("rgb", "RGB", { placeholder: "204 9 47", maxLength: 40 })}
            {campo("cmyk", "CMYK", { placeholder: "0 100 85 0", maxLength: 40 })}
            {campo("pms", "PMS", { placeholder: "186 C", maxLength: 40 })}
            {campo("pagina", t("Manual page", "Página do manual"), { inputMode: "numeric", maxLength: 5 })}
            {campo("ordem", t("Order", "Ordem"), { inputMode: "numeric", maxLength: 5 })}
          </div>
          <p className="mt-3 text-xs text-platform-text-muted">
            {t("Fill in at least one code. Codes are kept as the manual writes them.", "Preencha ao menos um código. Os códigos ficam como o manual os escreve.")}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" data-salvar-cor disabled={ocupado} onClick={salvar} className={BOTAO_FORTE}>
              {ocupado ? t("Saving…", "Salvando…") : t("Save color", "Salvar cor")}
            </button>
            <button type="button" disabled={ocupado} onClick={() => setEditando(null)} className={BOTAO}>{t("Cancel", "Cancelar")}</button>
          </div>
        </div>
      )}

      {cores.length === 0 && !editando && (
        <p className="mt-6 text-sm text-platform-text-muted">
          {t("No colors in the sheet yet. Until there are, the assistant reads colors from the manual text.", "Nenhuma cor na ficha ainda. Enquanto não houver, o Vini lê as cores pelo texto do manual.")}
        </p>
      )}

      {cores.length > 0 && (
        <ul className="mt-6 divide-y divide-platform-border border border-platform-border">
          {cores.map((cor) => (
            <li key={cor.id} data-cor-da-paleta={cor.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <span
                aria-hidden
                className="h-12 w-12 shrink-0 border border-platform-border"
                style={cor.hex
                  ? { backgroundColor: cor.hex }
                  : { backgroundImage: "repeating-linear-gradient(45deg, transparent 0 6px, currentColor 6px 7px)", color: "var(--platform-border)" }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-platform-text">
                  {cor.nome}
                  <span className="ml-2 font-normal text-platform-text-muted">
                    {cor.papel === "principal" ? t("primary", "principal") : t("support", "apoio")}
                    {cor.segmento ? ` · ${cor.segmento}` : ""}
                  </span>
                </p>
                <p className="mt-1 break-words font-mono text-xs text-platform-text-muted">
                  {[cor.hex && `HEX ${cor.hex}`, cor.rgb && `RGB ${cor.rgb}`, cor.cmyk && `CMYK ${cor.cmyk}`, cor.pms && `PMS ${cor.pms}`].filter(Boolean).join(" · ")}
                  {cor.pagina !== null && (manual
                    ? <> · <a href={`${manual}?pagina=${cor.pagina}`} className="underline hover:text-platform-text">p. {cor.pagina}</a></>
                    : ` · p. ${cor.pagina}`)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  data-status-da-cor={cor.status}
                  className={`border px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider ${cor.status === "ready" ? "border-platform-text text-platform-text" : "border-dashed border-platform-border text-platform-text-muted"}`}
                >
                  {cor.status === "ready" ? t("Approved", "Aprovada") : t("Draft", "Rascunho")}
                </span>
                {podeAprovar && cor.status === "draft" && (
                  <button type="button" data-aprovar-cor disabled={ocupado} onClick={() => aprovar([cor.id])} className={BOTAO}>{t("Approve", "Aprovar")}</button>
                )}
                {podeEditar && (
                  <>
                    <button type="button" data-editar-cor disabled={ocupado} onClick={() => { setMensagem(""); setEditando(paraRascunho(cor)); }} className={BOTAO}>{t("Edit", "Editar")}</button>
                    <button type="button" data-remover-cor disabled={ocupado} onClick={() => remover(cor)} className={BOTAO}>{t("Remove", "Remover")}</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
