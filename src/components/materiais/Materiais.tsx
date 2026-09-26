"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { useEncaixeDaBarra, useTelaLarga } from "@/components/documento-fonte/MolduraDoManual";
import { formatoDoArquivo, rotulo, TIPOS_DE_ITEM, type TipoDeItem } from "@/lib/assets/eixos";
import { lerPaginasDigitadas, type CitacaoDaRegra } from "@/lib/assets/regra";
import { FalhaDoKit, montarZip, salvarArquivo } from "@/lib/assets/zip-no-navegador";

/**
 * Materiais da marca — fatia 5 do plano da interface.
 *
 * Quem abre esta tela quer O ARQUIVO (spec de Materiais §1). Duas telas:
 *
 *   CATÁLOGO   lista com prévia (resposta 63 do André), cabeçalho de prancha
 *              com o código do conjunto só ali (resposta 62), fora de uso atrás
 *              de filtro (resposta 64);
 *   ITEM       página de KIT (revisão de 17/09): prévia, a regra citada ao lado
 *              do botão, "Baixar kit" como ação principal e "Escolher arquivos",
 *              discreto, para quem quer só um.
 *
 * Tudo aqui é moldura da PLATAFORMA (`--platform-*`); só a miniatura é da marca.
 */

type T = (pt: string, en: string) => string;
type Eixos = { hierarquia: string | null; lockup: string | null; cor: string | null; polaridade: string | null; espaco_de_cor: string | null };
export type Variante = {
  id: string; itemId: string; label: string; file_name: string; mime_type: string; size_bytes: number;
  created_at: string; baixavel: boolean; descontinuadoEm: string | null; eixos: Eixos; miniatura: string | null;
};
export type ItemDoCatalogo = { id: string; tipo: TipoDeItem; nome: string; descricao: string; ordem: number; regra: CitacaoDaRegra[] };
type Manual = { id: string; paginas: number } | null;

function useT(): T {
  const isEnglish = useIsEnglish();
  return useCallback((pt: string, en: string) => (isEnglish ? en : pt), [isEnglish]);
}

/** O acervo da marca, lido uma vez por tela. */
export function useMateriais() {
  const alvo = useAlvo();
  const t = useT();
  const [estado, setEstado] = useState<{
    carregando: boolean; erro: string; itens: ItemDoCatalogo[]; variantes: Variante[]; manual: Manual;
  }>({ carregando: true, erro: "", itens: [], variantes: [], manual: null });

  const buscar = useCallback(async (sinal?: AbortSignal) => {
    const resposta = await fetch(comAlvo("/api/assets", alvo), { cache: "no-store", signal: sinal }).catch(() => null);
    const dados = resposta ? await resposta.json().catch(() => ({})) : {};
    return resposta?.ok
      ? { carregando: false, erro: "", itens: dados.itens ?? [], variantes: dados.assets ?? [], manual: dados.manual ?? null }
      : { carregando: false, erro: dados.message ?? t("Não foi possível carregar os materiais.", "Couldn't load the materials."), itens: [], variantes: [], manual: null };
  }, [alvo, t]);

  useEffect(() => {
    const parar = new AbortController();
    async function abrir() {
      const lido = await buscar(parar.signal);
      if (!parar.signal.aborted) setEstado(lido);
    }
    void abrir();
    return () => parar.abort();
  }, [buscar]);

  return { ...estado, recarregar: async () => setEstado(await buscar()) };
}

function base(alvo: { workspaceSlug?: string; brandKey?: string }) {
  return alvo.workspaceSlug && alvo.brandKey ? `/w/${alvo.workspaceSlug}/b/${alvo.brandKey}/docs` : "/docs";
}

/**
 * A prévia de uma variante: a miniatura quando há; quando não há, o FORMATO e
 * uma linha dizendo por quê — nunca um quadrado cinza mudo (spec §5-A.1).
 */
export function Previa({ t, variante, grande = false }: { t: T; variante: Variante | undefined; grande?: boolean }) {
  const moldura = grande
    ? "flex aspect-[4/3] w-full items-center justify-center rounded-[var(--radius-control)] border border-platform-border bg-platform-panel p-[var(--space-shell-5)]"
    : "flex h-14 w-20 flex-none items-center justify-center rounded-[var(--radius-control)] border border-platform-border bg-platform-panel p-1";
  if (!variante) {
    return <div className={moldura}><span className="text-[11px] text-platform-text-muted">{t("Sem arquivo", "No file")}</span></div>;
  }
  if (variante.miniatura) {
    // A miniatura é um PNG gerado no envio, e não o arquivo: mostrá-la não
    // entrega o original. `object-contain`: o logo inteiro, sem recorte.
    // eslint-disable-next-line @next/next/no-img-element
    return <div className={moldura}><img src={variante.miniatura} alt="" className="max-h-full max-w-full object-contain" /></div>;
  }
  const formato = formatoDoArquivo(variante.file_name);
  const eps = /eps|postscript/i.test(`${formato} ${variante.mime_type}`);
  return (
    <div className={`${moldura} flex-col gap-1 text-center`} data-sem-previa>
      <span className="font-mono text-[12px] font-semibold uppercase text-platform-text">{formato}</span>
      {grande && (
        <span className="max-w-[18rem] text-[12px] leading-snug text-platform-text-muted">
          {eps
            ? t("EPS não gera prévia: é PostScript, que nem o navegador nem o servidor desenham.", "EPS has no preview: it's PostScript, which neither the browser nor the server draws.")
            : t("Este arquivo foi enviado sem prévia.", "This file was uploaded without a preview.")}
        </span>
      )}
    </div>
  );
}

/** O capítulo e o status da regra, como a tela do manual os cita. */
function CitacaoDaRegraLink({ t, citacao }: { t: T; citacao: CitacaoDaRegra }) {
  const alvo = useAlvo();
  const router = useRouter();
  const href = `${base(alvo)}/original?pagina=${citacao.pagina}`;
  const rascunho = citacao.status === "draft" || citacao.status === "pending";
  return (
    <Link
      href={href}
      data-regra-citada={citacao.pagina}
      // `ir` novo a cada clique: a mesma citação, clicada de novo depois de
      // rolar para longe, tem de levar de novo (a mesma regra do Vini).
      onClick={(e) => { e.preventDefault(); router.push(`${href}&ir=${Date.now().toString(36)}`); }}
      className="group flex items-baseline gap-2 text-[13px] text-platform-text hover:underline"
    >
      <span className="min-w-0 truncate">{citacao.titulo ?? t("Manual", "Manual")}</span>
      <span className="shrink-0 font-mono text-[12px] tabular-nums text-platform-text-muted">{t(`p. ${citacao.pagina}`, `p. ${citacao.pagina}`)} →</span>
      {rascunho && (
        <span className="shrink-0 font-display text-[9px] font-bold uppercase tracking-wide text-platform-warning">
          {citacao.status === "draft" ? t("Rascunho", "Draft") : t("Pendente", "Pending")}
        </span>
      )}
    </Link>
  );
}

// ─── Catálogo ───────────────────────────────────────────────────────────────

export function CatalogoDeMateriais({ podeGerenciar, raiz }: {
  podeGerenciar: boolean;
  /** Onde moram as páginas dos itens. A bancada (`/dev/materiais`) passa a dela. */
  raiz?: string;
}) {
  const t = useT();
  const en = useIsEnglish();
  const alvo = useAlvo();
  const { carregando, erro, itens, variantes } = useMateriais();
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<TipoDeItem | "">("");
  const encaixe = useEncaixeDaBarra();
  const telaLarga = useTelaLarga();

  const emUsoPorItem = useMemo(() => {
    const mapa = new Map<string, Variante[]>();
    for (const v of variantes) if (!v.descontinuadoEm) mapa.set(v.itemId, [...(mapa.get(v.itemId) ?? []), v]);
    return mapa;
  }, [variantes]);

  const visiveis = itens.filter((item) =>
    (!tipo || item.tipo === tipo) && (!busca.trim() || item.nome.toLocaleLowerCase().includes(busca.trim().toLocaleLowerCase())));

  const acoes = (
    <div data-acoes-de-materiais className="flex flex-wrap items-center gap-[var(--space-shell-2)]">
      <label className="flex items-center">
        <span className="sr-only">{t("Buscar nos materiais", "Search materials")}</span>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("Buscar", "Search")}
          className="h-8 w-40 rounded-[var(--radius-control)] border border-platform-border bg-platform-bg px-2 text-[13px] text-platform-text" />
      </label>
      <label className="flex items-center">
        <span className="sr-only">{t("Tipo", "Type")}</span>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeItem | "")}
          className="h-8 rounded-[var(--radius-control)] border border-platform-border bg-platform-bg px-2 text-[13px] text-platform-text">
          <option value="">{t("Todos os tipos", "All types")}</option>
          {TIPOS_DE_ITEM.map((ti) => <option key={ti} value={ti}>{rotulo(ti, en)}</option>)}
        </select>
      </label>
    </div>
  );

  return (
    <section className="px-[var(--space-shell-5)] py-[var(--space-shell-5)] text-platform-text" data-catalogo-de-materiais>
      {encaixe && telaLarga ? createPortal(acoes, encaixe) : <div className="mb-[var(--space-shell-4)]">{acoes}</div>}

      {/* Cabeçalho de prancha: título à esquerda, conjunto e contagem em mono à
          direita — a folha dos manuais impressos (spec §3, aprovado). O código
          é NOSSO, do catálogo; nunca citação de regra do cliente. */}
      <header className="flex items-baseline justify-between gap-4 border-b border-platform-border pb-[var(--space-shell-3)]">
        <h1 className="font-display text-[13px] font-bold uppercase tracking-[0.12em]">{t("Materiais da marca", "Brand materials")}</h1>
        <span className="font-mono text-[12px] tabular-nums text-platform-text-muted" data-prancha-contagem>
          M · {String(itens.length).padStart(2, "0")} {t(itens.length === 1 ? "item" : "itens", itens.length === 1 ? "item" : "items")}
        </span>
      </header>

      {carregando && <p className="py-[var(--space-shell-5)] text-[13px] text-platform-text-muted">{t("Carregando…", "Loading…")}</p>}
      {erro && <p role="alert" className="py-[var(--space-shell-5)] text-[13px]">{erro}</p>}
      {!carregando && !erro && itens.length === 0 && (
        <p className="py-[var(--space-shell-5)] text-[13px] text-platform-text-muted">
          {podeGerenciar
            ? t("Esta marca ainda não tem materiais. Crie o primeiro item e envie os arquivos logo abaixo.", "This brand has no materials yet. Create the first item and upload its files below.")
            : t("Esta marca ainda não tem materiais publicados.", "This brand has no published materials yet.")}
        </p>
      )}

      <ul className="divide-y divide-platform-border">
        {visiveis.map((item) => {
          const emUso = emUsoPorItem.get(item.id) ?? [];
          const capa = emUso.find((v) => v.miniatura) ?? emUso[0];
          return (
            <li key={item.id}>
              <Link href={`${raiz ?? `${base(alvo)}/biblioteca`}/${item.id}`} data-item-do-catalogo={item.id}
                className="flex items-center gap-[var(--space-shell-4)] py-[var(--space-shell-3)] hover:bg-platform-panel focus-visible:outline-2 focus-visible:outline-platform-focus">
                <Previa t={t} variante={capa} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{item.nome}</span>
                  <span className="block text-[12px] text-platform-text-muted">{rotulo(item.tipo, en)}</span>
                </span>
                <span className="font-mono text-[12px] tabular-nums text-platform-text-muted">
                  {emUso.length} {t(emUso.length === 1 ? "arquivo" : "arquivos", emUso.length === 1 ? "file" : "files")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!carregando && itens.length > 0 && visiveis.length === 0 && (
        <p className="py-[var(--space-shell-4)] text-[13px] text-platform-text-muted">{t("Nenhum item com esse filtro.", "No item matches this filter.")}</p>
      )}
    </section>
  );
}

// ─── Página do item ─────────────────────────────────────────────────────────

export function PaginaDoItem({ itemId, podeEditar, raiz }: { itemId: string; podeEditar: boolean; raiz?: string }) {
  const t = useT();
  const en = useIsEnglish();
  const alvo = useAlvo();
  const { carregando, erro, itens, variantes, manual, recarregar } = useMateriais();
  const item = itens.find((i) => i.id === itemId);
  const [verForaDeUso, setVerForaDeUso] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [baixando, setBaixando] = useState<string>("");
  const [aviso, setAviso] = useState("");

  const doItem = variantes.filter((v) => v.itemId === itemId);
  const emUso = doItem.filter((v) => !v.descontinuadoEm);
  const foraDeUso = doItem.filter((v) => v.descontinuadoEm);
  const capa = emUso.find((v) => v.miniatura) ?? emUso[0];
  const listaParaEscolher = verForaDeUso ? doItem : emUso;

  async function baixar(ids: string[] | null) {
    setAviso("");
    // Um arquivo só, escolhido a dedo, baixa direto — sem compactar (spec §5-A.1).
    if (ids && ids.length === 1) {
      window.location.href = comAlvo(`/api/assets/${ids[0]}/download`, alvo);
      return;
    }
    setBaixando(t("Preparando o kit…", "Preparing the kit…"));
    try {
      const resposta = await fetch(comAlvo("/api/assets/kit", alvo), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { itemId, ids } : { itemId }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.message ?? t("Não foi possível preparar o kit.", "Couldn't prepare the kit."));
      const zip = await montarZip(dados.arquivos, (prontos, total) =>
        setBaixando(t(`Baixando ${prontos} de ${total}…`, `Downloading ${prontos} of ${total}…`)));
      salvarArquivo(zip, dados.nome);
    } catch (e) {
      setAviso(e instanceof FalhaDoKit
        ? t(`Um arquivo do kit não veio (${e.caminho}); nada foi salvo pela metade. Tente de novo.`, `A kit file didn't arrive (${e.caminho}); nothing was saved half-done. Try again.`)
        : e instanceof Error ? e.message : t("Não foi possível baixar.", "Couldn't download."));
    } finally {
      setBaixando("");
    }
  }

  if (carregando) return <p className="p-[var(--space-shell-5)] text-[13px] text-platform-text-muted">{t("Carregando…", "Loading…")}</p>;
  if (erro) return <p role="alert" className="p-[var(--space-shell-5)] text-[13px] text-platform-text">{erro}</p>;
  if (!item) {
    return (
      <p className="p-[var(--space-shell-5)] text-[13px] text-platform-text">
        {t("Este item não existe nesta marca.", "This item doesn't exist in this brand.")}{" "}
        <Link href={raiz ?? `${base(alvo)}/biblioteca`} className="underline">{t("Voltar aos materiais", "Back to materials")}</Link>
      </p>
    );
  }

  return (
    <article className="px-[var(--space-shell-5)] py-[var(--space-shell-5)] text-platform-text" data-pagina-do-item={item.id}>
      <nav aria-label={t("Caminho", "Breadcrumb")} className="text-[12px] text-platform-text-muted">
        <Link href={raiz ?? `${base(alvo)}/biblioteca`} className="hover:underline">{t("Materiais", "Materials")}</Link> / {item.nome}
      </nav>
      <header className="mt-2 flex items-baseline justify-between gap-4 border-b border-platform-border pb-[var(--space-shell-3)]">
        <h1 className="font-display text-[13px] font-bold uppercase tracking-[0.12em]">{item.nome}</h1>
        <span className="font-mono text-[12px] tabular-nums text-platform-text-muted">
          {rotulo(item.tipo, en)} · {emUso.length} {t(emUso.length === 1 ? "arquivo" : "arquivos", emUso.length === 1 ? "file" : "files")}
        </span>
      </header>

      <div className="mt-[var(--space-shell-5)] grid gap-[var(--space-shell-5)] lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Previa t={t} variante={capa} grande />

        <aside className="flex flex-col gap-[var(--space-shell-4)]">
          {/*
            A regra COLADA ao download (plano, fatia 5): quem baixa vê, no mesmo
            gesto, onde o manual diz como usar. É citação, não autoria — sem
            regra ligada, a tela diz isso, e não inventa.
          */}
          <section data-regra-do-item aria-labelledby="regra-titulo" className="border-l-2 border-platform-border pl-[var(--space-shell-3)]">
            <h2 id="regra-titulo" className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-platform-text-muted">{t("Regra de uso", "Usage rule")}</h2>
            {item.regra.length > 0 ? (
              <ul className="mt-2 space-y-1">{item.regra.map((c) => <li key={c.pagina}><CitacaoDaRegraLink t={t} citacao={c} /></li>)}</ul>
            ) : (
              <p className="mt-2 text-[12px] text-platform-text-muted">{t("Nenhuma página do manual foi ligada a este item.", "No manual page is linked to this item.")}</p>
            )}
            {podeEditar && <EditorDaRegra t={t} itemId={item.id} atuais={item.regra.map((c) => c.pagina)} manual={manual} aoSalvar={recarregar} />}
          </section>

          {/*
            Um arquivo em uso baixa DIRETO, pela rota que registra — sem ZIP
            (spec §5-A.1). O botão já dizia "Baixar o arquivo" e entregava um
            ZIP com três pastas até um `.ai` só (ensaio de 26/09/2026).
          */}
          <button type="button" data-baixar-kit disabled={emUso.length === 0 || Boolean(baixando)}
            onClick={() => void baixar(emUso.length === 1 ? [emUso[0].id] : null)}
            className="flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-platform-text px-[var(--space-shell-4)] text-[14px] font-semibold text-platform-bg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus disabled:opacity-40">
            {baixando || (emUso.length === 1
              ? t("Baixar o arquivo", "Download the file")
              : t(`Baixar kit · ${emUso.length} arquivos (ZIP)`, `Download kit · ${emUso.length} files (ZIP)`))}
          </button>
          {aviso && <p role="alert" data-aviso-do-kit className="text-[12px] text-platform-text">{aviso}</p>}

          {/* Com um arquivo só não há o que escolher. Com um em uso e outros
              fora de uso, a lista continua: é por ela que se chega aos antigos. */}
          {doItem.length > 1 && (
            <button type="button" onClick={() => setEscolhendo((v) => !v)} aria-expanded={escolhendo} data-escolher-arquivos
              className="self-start text-[12px] text-platform-text-muted underline-offset-2 hover:text-platform-text hover:underline">
              {escolhendo ? t("Fechar a lista", "Close the list") : t("Escolher arquivos", "Choose files")}
            </button>
          )}
        </aside>
      </div>

      {escolhendo && (
        <section className="mt-[var(--space-shell-5)] border-t border-platform-border pt-[var(--space-shell-4)]" data-lista-de-arquivos>
          <div className="mb-[var(--space-shell-3)] flex flex-wrap items-center justify-between gap-2">
            {foraDeUso.length > 0 ? (
              <label className="flex items-center gap-2 text-[12px] text-platform-text-muted">
                <input type="checkbox" checked={verForaDeUso} onChange={(e) => setVerForaDeUso(e.target.checked)} />
                {t(`Mostrar fora de uso (${foraDeUso.length})`, `Show out of use (${foraDeUso.length})`)}
              </label>
            ) : <span />}
            <button type="button" disabled={marcados.length === 0 || Boolean(baixando)} onClick={() => void baixar(marcados)} data-baixar-selecionados
              className="h-8 rounded-[var(--radius-control)] border border-platform-border px-3 text-[13px] hover:border-platform-signal-soft disabled:opacity-40">
              {marcados.length <= 1
                ? t("Baixar selecionado", "Download selected")
                : t(`Baixar ${marcados.length} selecionados (ZIP)`, `Download ${marcados.length} selected (ZIP)`)}
            </button>
          </div>
          <ul className="divide-y divide-platform-border">
            {listaParaEscolher.map((v) => (
              <li key={v.id} className="flex items-center gap-[var(--space-shell-3)] py-2">
                <input type="checkbox" aria-label={v.file_name} disabled={!v.baixavel} checked={marcados.includes(v.id)}
                  onChange={(e) => setMarcados((m) => (e.target.checked ? [...m, v.id] : m.filter((x) => x !== v.id)))} />
                <Previa t={t} variante={v} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{v.file_name}</span>
                  <span className="block text-[11px] text-platform-text-muted">
                    {Object.values(v.eixos).filter(Boolean).map((e) => rotulo(e!, en)).join(" · ") || "—"}
                  </span>
                </span>
                {v.descontinuadoEm && (
                  <span className="font-display text-[9px] font-bold uppercase tracking-wide text-platform-warning">{t("Fora de uso", "Out of use")}</span>
                )}
                <span className="font-mono text-[11px] uppercase text-platform-text-muted">{formatoDoArquivo(v.file_name)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

/** Quem edita liga o item às páginas do manual — até cinco. */
function EditorDaRegra({ t, itemId, atuais, manual, aoSalvar }: {
  t: T; itemId: string; atuais: number[]; manual: Manual; aoSalvar: () => void;
}) {
  const alvo = useAlvo();
  const [texto, setTexto] = useState(atuais.join(", "));
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMensagem("");
    const resposta = await fetch(comAlvo("/api/admin/assets/itens/regra", alvo), {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: itemId, paginas: lerPaginasDigitadas(texto) }),
    });
    const dados = await resposta.json().catch(() => ({}));
    setSalvando(false);
    if (resposta.ok) { setMensagem(t("Regra guardada.", "Rule saved.")); aoSalvar(); }
    else setMensagem(dados.message ?? t("Não foi possível guardar.", "Couldn't save."));
  }

  return (
    <form onSubmit={salvar} className="mt-3 flex flex-wrap items-center gap-2" data-editor-da-regra>
      <label className="flex items-center gap-2 text-[12px] text-platform-text-muted">
        {t("Páginas do manual", "Manual pages")}
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="12, 14" inputMode="numeric"
          className="h-8 w-28 rounded-[var(--radius-control)] border border-platform-border bg-platform-bg px-2 font-mono text-[12px] text-platform-text" />
      </label>
      <button type="submit" disabled={salvando} className="h-8 rounded-[var(--radius-control)] border border-platform-border px-2 text-[12px] hover:border-platform-signal-soft disabled:opacity-40">
        {t("Guardar", "Save")}
      </button>
      <span className="basis-full text-[11px] text-platform-text-muted" aria-live="polite">
        {mensagem || (manual ? t(`Até 5, de 1 a ${manual.paginas}.`, `Up to 5, from 1 to ${manual.paginas}.`) : t("Importe o manual para ligar páginas.", "Import the manual to link pages."))}
      </span>
    </form>
  );
}
