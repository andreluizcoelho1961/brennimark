"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { FonteDoIndice, ItemDeIndice } from "@/lib/documento-fonte/indice";

/**
 * As peças do manual que moram na MOLDURA — fatia 3 do plano da interface.
 *
 * O que age no PDF fica na barra de cima (Índice, Buscar, Zoom, •••); onde se
 * está fica no pé (o fólio) e na borda direita (a aba de capítulo). Esboço do
 * André de 17/09, spec da tela do manual §0.
 *
 * Tudo aqui é da PLATAFORMA: só tokens `--platform-*`. Nenhum controle herda
 * cor ou fonte da marca do cliente — o `leak-guard` confere no código-fonte.
 */

type T = (pt: string, en: string) => string;

/** O encaixe é da moldura e não muda enquanto o manual está aberto. */
const nuncaMuda = () => () => {};

/** Onde a barra de cima abre espaço para as ações da tela aberta. */
export const ID_DO_ENCAIXE = "acoes-da-tela";

/**
 * O encaixe da barra de cima, quando a tela está dentro da moldura.
 *
 * As ações do PDF são DESENHADAS lá, mas o estado continua no visualizador —
 * página, zoom, busca. É um portal, e não um contexto compartilhado pela
 * moldura inteira: a moldura não precisa saber que existe um PDF, e o
 * visualizador continua funcionando sozinho (bancada, testes) desenhando as
 * ações no próprio topo quando não há encaixe.
 */
export function useEncaixeDaBarra(): HTMLElement | null {
  // Lido no cliente: no servidor não há documento, e o encaixe é da moldura,
  // que já está na página quando o manual monta.
  return useSyncExternalStore(nuncaMuda, () => document.getElementById(ID_DO_ENCAIXE), () => null);
}

/**
 * Tela larga o bastante para a barra de cima carregar as ações.
 *
 * Abaixo disso a barra de cima guarda só o essencial da plataforma, e as ações
 * descem para uma faixa sobre o PDF. Uma instância só, nunca as duas: dois
 * índices abertos ao mesmo tempo seriam dois menus para o mesmo estado.
 */
// 1024 px, e não 768: a barra de cima já leva marca, segmentado e busca da
// plataforma, e as ações do manual pedem ~480 px. Abaixo disso, faixa.
const TELA_LARGA = "(min-width: 1024px)";

function assinarTela(avisar: () => void) {
  const consulta = window.matchMedia(TELA_LARGA);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}

export function useTelaLarga(): boolean {
  return useSyncExternalStore(assinarTela, () => window.matchMedia(TELA_LARGA).matches, () => false);
}

/** O item do índice em que a leitura está: o ÚLTIMO cujo início já passou. */
export function itemAtual(itens: readonly ItemDeIndice[], pagina: number): number {
  return itens.reduce((melhor, item, i) => (item.pagina <= pagina ? i : melhor), -1);
}

const BOTAO =
  "flex h-8 items-center gap-1 rounded-[var(--radius-control)] border border-platform-border px-2 text-[13px] text-platform-text hover:border-platform-signal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus aria-expanded:border-platform-signal";

/**
 * Menu que desce da barra. Fecha com Esc, com clique fora e ao escolher.
 *
 * Não é diálogo modal: o PDF continua usável, e o foco volta ao botão.
 */
function Suspenso({
  rotulo,
  conteudoDoBotao,
  aberto,
  aoAlternar,
  alinhar = "esquerda",
  children,
}: {
  rotulo: string;
  conteudoDoBotao: ReactNode;
  aberto: boolean;
  aoAlternar: (aberto: boolean) => void;
  alinhar?: "esquerda" | "direita";
  children: ReactNode;
}) {
  const raiz = useRef<HTMLDivElement | null>(null);
  const botao = useRef<HTMLButtonElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      aoAlternar(false);
      botao.current?.focus();
    };
    const aoClicar = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) aoAlternar(false);
    };
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("pointerdown", aoClicar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("pointerdown", aoClicar);
    };
  }, [aberto, aoAlternar]);

  return (
    <div ref={raiz} className="relative">
      <button
        ref={botao}
        type="button"
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => aoAlternar(!aberto)}
        className={BOTAO}
      >
        {conteudoDoBotao}
      </button>
      {aberto && (
        <div
          id={id}
          className={`absolute top-[calc(100%+6px)] z-50 min-w-[14rem] rounded-[var(--radius-control)] border border-platform-border bg-platform-panel text-platform-text shadow-lg ${
            alinhar === "direita" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** O índice suspenso: filtro em índice longo, capítulo atual à vista. */
function IndiceSuspenso({
  t,
  itens,
  fonte,
  paginaAtual,
  aoEscolher,
}: {
  t: T;
  itens: readonly ItemDeIndice[];
  fonte: FonteDoIndice;
  paginaAtual: number;
  aoEscolher: (pagina: number) => void;
}) {
  const [filtro, setFiltro] = useState("");
  const ativo = itemAtual(itens, paginaAtual);
  const lista = useRef<HTMLUListElement | null>(null);
  // Mais de ~15 itens pede filtro (spec §0.4): o Bradesco tem 20, a GE centenas.
  const comFiltro = itens.length > 15;

  const visiveis = useMemo(() => {
    const termo = filtro.trim().toLocaleLowerCase();
    return itens
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => !termo || item.titulo.toLocaleLowerCase().includes(termo));
  }, [itens, filtro]);

  // Ao abrir, a lista já rolada até o capítulo em que a leitura está.
  useEffect(() => {
    lista.current?.querySelector("[aria-current='true']")?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <nav aria-label={t("Índice do manual", "Manual contents")} className="flex max-h-[min(70dvh,32rem)] w-[min(24rem,90vw)] flex-col">
      {comFiltro && (
        <label className="border-b border-platform-border p-[var(--space-shell-2)]">
          <span className="sr-only">{t("Filtrar o índice", "Filter the contents")}</span>
          <input
            autoFocus
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder={t("Filtrar capítulos", "Filter chapters")}
            className="h-8 w-full rounded-[var(--radius-control)] border border-platform-border bg-platform-bg px-2 text-[13px]"
          />
        </label>
      )}
      <ul ref={lista} className="min-h-0 flex-1 overflow-y-auto py-1">
        {visiveis.map(({ item, i }) => (
          <li key={`${item.pagina}-${item.titulo}-${i}`}>
            <button
              type="button"
              data-indice-item
              aria-current={i === ativo ? "true" : undefined}
              onClick={() => aoEscolher(item.pagina)}
              className={`flex w-full items-baseline gap-3 px-[var(--space-shell-3)] py-[6px] text-left text-[13px] hover:bg-platform-bg ${
                i === ativo ? "font-semibold text-platform-text" : "text-platform-text-muted"
              } ${item.nivel === 2 ? "pl-[var(--space-shell-5)]" : ""}`}
            >
              <span className="min-w-0 flex-1 truncate">{item.titulo}</span>
              {/* Página alinhada à direita, em mono — como sumário de livro. */}
              <span className="shrink-0 font-mono text-[12px] tabular-nums text-platform-text-muted">{item.pagina}</span>
            </button>
          </li>
        ))}
        {visiveis.length === 0 && (
          <li className="px-[var(--space-shell-3)] py-2 text-[12px] text-platform-text-muted">
            {t("Nenhum capítulo com esse nome.", "No chapter by that name.")}
          </li>
        )}
      </ul>
      {/*
        Sumário do estúdio e índice proposto pela máquina não se apresentam com
        o mesmo silêncio — a mesma distinção que tirou as páginas remontadas do
        caminho de leitura (ADR-0006).
      */}
      <p
        data-indice-fonte={fonte}
        className="border-t border-platform-border px-[var(--space-shell-3)] py-[var(--space-shell-2)] text-[11px] text-platform-text-muted"
      >
        {fonte === "marcadores"
          ? t("Sumário do próprio documento.", "The document's own outline.")
          : t("Índice proposto pela extração.", "Contents proposed by extraction.")}
      </p>
    </nav>
  );
}

export type EstadoDaBusca = "ocioso" | "buscando" | "sem-resultado" | { pagina: number };

/** As ações do PDF: Índice ▾ · Buscar · − Zoom ▾ + · •••. */
export function AcoesDoManual({
  t,
  indice,
  indiceAberto,
  aoAlternarIndice,
  paginaAtual,
  aoIrPara,
  termo,
  aoMudarTermo,
  aoBuscarProxima,
  busca,
  escalaEfetiva,
  ajustadoALargura,
  aoZoom,
  aoEscala,
  aoAjustarLargura,
  miniaturasAbertas,
  aoAlternarMiniaturas,
  aoTelaCheia,
  enderecoDoDownload,
}: {
  t: T;
  indice: { fonte: FonteDoIndice; itens: readonly ItemDeIndice[] };
  indiceAberto: boolean;
  aoAlternarIndice: (aberto: boolean) => void;
  paginaAtual: number;
  aoIrPara: (pagina: number) => void;
  termo: string;
  aoMudarTermo: (termo: string) => void;
  aoBuscarProxima: () => void;
  busca: EstadoDaBusca;
  escalaEfetiva: number;
  ajustadoALargura: boolean;
  aoZoom: (direcao: 1 | -1) => void;
  aoEscala: (escala: number) => void;
  aoAjustarLargura: () => void;
  miniaturasAbertas: boolean;
  aoAlternarMiniaturas: () => void;
  aoTelaCheia: () => void;
  /** Ausente na bancada: sem marca, não há download registrável. */
  enderecoDoDownload?: string;
}) {
  const [zoomAberto, setZoomAberto] = useState(false);
  const [maisAberto, setMaisAberto] = useState(false);
  const porcentagem = `${Math.round(escalaEfetiva * 100)}%`;

  const aviso =
    busca === "buscando" ? t("Buscando…", "Searching…")
    : busca === "sem-resultado" ? t("Não encontrado", "Not found")
    : typeof busca === "object" ? t(`p. ${busca.pagina}`, `p. ${busca.pagina}`)
    : "";

  return (
    <div data-acoes-do-manual className="flex min-w-0 flex-wrap items-center gap-[var(--space-shell-2)] lg:flex-nowrap">
      {/*
        O índice só aparece quando existe. Um botão que abre lista vazia
        promete um sumário que o documento não tem — 23 de 30 manuais reais não
        trazem marcadores.
      */}
      {indice.itens.length > 0 && (
        <Suspenso
          rotulo={t("Índice", "Contents")}
          conteudoDoBotao={<>{t("Índice", "Contents")}<span aria-hidden className="text-[10px]">▾</span></>}
          aberto={indiceAberto}
          aoAlternar={aoAlternarIndice}
        >
          <IndiceSuspenso
            t={t}
            itens={indice.itens}
            fonte={indice.fonte}
            paginaAtual={paginaAtual}
            aoEscolher={(pagina) => {
              aoIrPara(pagina);
              aoAlternarIndice(false);
            }}
          />
        </Suspenso>
      )}

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          aoBuscarProxima();
        }}
        className="flex items-center gap-1"
      >
        <label className="flex items-center">
          <span className="sr-only">{t("Buscar no manual", "Search the manual")}</span>
          <input
            value={termo}
            onChange={(e) => aoMudarTermo(e.target.value)}
            placeholder={t("Buscar", "Search")}
            enterKeyHint="search"
            className="h-8 w-32 rounded-[var(--radius-control)] border border-platform-border bg-platform-bg px-2 text-[13px] text-platform-text lg:w-44"
          />
        </label>
        <span aria-live="polite" data-busca-aviso className="min-w-[4.5rem] text-[12px] text-platform-text-muted">
          {aviso}
        </span>
      </form>

      <div className="flex items-center gap-1">
        <button type="button" onClick={() => aoZoom(-1)} aria-label={t("Diminuir zoom", "Zoom out")} className={BOTAO}>
          −
        </button>
        <Suspenso
          rotulo={t(`Zoom, ${porcentagem}`, `Zoom, ${porcentagem}`)}
          conteudoDoBotao={<><span className="font-mono text-[12px] tabular-nums">{porcentagem}</span><span aria-hidden className="text-[10px]">▾</span></>}
          aberto={zoomAberto}
          aoAlternar={setZoomAberto}
        >
          <ul className="py-1 text-[13px]">
            <li>
              <button
                type="button"
                aria-pressed={ajustadoALargura}
                onClick={() => { aoAjustarLargura(); setZoomAberto(false); }}
                className="w-full px-[var(--space-shell-3)] py-[6px] text-left hover:bg-platform-bg aria-pressed:font-semibold"
              >
                {t("Ajustar à largura", "Fit to width")}
              </button>
            </li>
            {[0.5, 0.75, 1, 1.25, 1.5, 2, 3].map((escala) => (
              <li key={escala}>
                <button
                  type="button"
                  onClick={() => { aoEscala(escala); setZoomAberto(false); }}
                  className="w-full px-[var(--space-shell-3)] py-[6px] text-left font-mono text-[12px] tabular-nums hover:bg-platform-bg"
                >
                  {Math.round(escala * 100)}%
                </button>
              </li>
            ))}
          </ul>
        </Suspenso>
        <button type="button" onClick={() => aoZoom(1)} aria-label={t("Aumentar zoom", "Zoom in")} className={BOTAO}>
          +
        </button>
      </div>

      <Suspenso
        rotulo={t("Mais ações do manual", "More manual actions")}
        conteudoDoBotao={<span aria-hidden>•••</span>}
        aberto={maisAberto}
        aoAlternar={setMaisAberto}
        alinhar="direita"
      >
        <ul className="py-1 text-[13px]">
          <li>
            <button
              type="button"
              aria-pressed={miniaturasAbertas}
              onClick={() => { aoAlternarMiniaturas(); setMaisAberto(false); }}
              className="w-full px-[var(--space-shell-3)] py-[6px] text-left hover:bg-platform-bg"
            >
              {miniaturasAbertas ? t("Esconder miniaturas", "Hide thumbnails") : t("Mostrar miniaturas", "Show thumbnails")}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => { aoTelaCheia(); setMaisAberto(false); }}
              className="w-full px-[var(--space-shell-3)] py-[6px] text-left hover:bg-platform-bg"
            >
              {t("Tela cheia", "Full screen")}
            </button>
          </li>
          {enderecoDoDownload && (
            <li className="border-t border-platform-border">
              {/*
                Link comum, e não `fetch`: a rota responde com redirecionamento
                para o endereço assinado, e o navegador baixa. O registro
                acontece ANTES de o endereço existir — ver a rota.
              */}
              <a
                href={enderecoDoDownload}
                data-baixar-manual
                onClick={() => setMaisAberto(false)}
                className="block px-[var(--space-shell-3)] py-[6px] hover:bg-platform-bg"
              >
                {t("Baixar o PDF", "Download the PDF")}
              </a>
            </li>
          )}
        </ul>
      </Suspenso>
    </div>
  );
}

/**
 * O fólio, no pé: página · zoom · arquivo. A página é o campo onde se digita.
 *
 * O campo acompanha a rolagem mas nunca atropela quem digita: não-controlado,
 * atualizado por referência só quando não tem o foco. Sincronizar por efeito
 * reescrevia o que a pessoa digitava; remontar por `key` derrubava o foco.
 */
export function Folio({
  t,
  paginaAtual,
  total,
  ajustadoALargura,
  escalaEfetiva,
  nomeDoArquivo,
  aoIrPara,
}: {
  t: T;
  paginaAtual: number;
  total: number;
  ajustadoALargura: boolean;
  escalaEfetiva: number;
  nomeDoArquivo?: string;
  aoIrPara: (pagina: number) => void;
}) {
  const campo = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (campo.current && document.activeElement !== campo.current) campo.current.value = String(paginaAtual);
  }, [paginaAtual]);

  return (
    <form
      data-folio
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(campo.current?.value);
        if (Number.isFinite(n)) aoIrPara(n);
        campo.current?.blur();
      }}
      className="flex h-9 flex-none items-center gap-[var(--space-shell-2)] border-t border-platform-border bg-platform-panel px-[var(--space-shell-3)] text-[12px] text-platform-text-muted"
    >
      <span className="flex items-center gap-1">
        <label htmlFor="pagina-atual" className="sr-only">{t("Ir para a página", "Go to page")}</label>
        <input
          id="pagina-atual"
          ref={campo}
          defaultValue={String(paginaAtual)}
          inputMode="numeric"
          className="h-7 w-12 rounded-[var(--radius-control)] border border-platform-border bg-platform-bg px-1 text-center font-mono text-[12px] tabular-nums text-platform-text"
        />
        <span className="font-mono tabular-nums">{t("de", "of")} {total || "—"}</span>
      </span>
      <span aria-hidden>·</span>
      <span className="font-mono tabular-nums">
        {ajustadoALargura ? t("ajustado", "fit") : `${Math.round(escalaEfetiva * 100)}%`}
      </span>
      {nomeDoArquivo && (
        <>
          <span aria-hidden>·</span>
          <span data-folio-arquivo className="min-w-0 truncate" title={nomeDoArquivo}>{nomeDoArquivo}</span>
        </>
      )}
    </form>
  );
}

/**
 * A aba de capítulo, na borda direita: onde a leitura está.
 *
 * Vem do ÍNDICE — nunca de número inventado. Sem capítulo conhecido (manual
 * sem índice, ou antes do primeiro capítulo), a aba não aparece: uma aba vazia
 * afirmaria uma estrutura que não existe. Clicar abre o índice.
 */
export function AbaDeCapitulo({
  t,
  itens,
  paginaAtual,
  aoAbrirIndice,
}: {
  t: T;
  itens: readonly ItemDeIndice[];
  paginaAtual: number;
  aoAbrirIndice: () => void;
}) {
  const i = itemAtual(itens, paginaAtual);
  if (i < 0) return null;
  const capitulo = itens[i].titulo;
  return (
    <button
      type="button"
      data-aba-de-capitulo
      onClick={aoAbrirIndice}
      aria-label={t(`Capítulo atual: ${capitulo}. Abrir o índice`, `Current chapter: ${capitulo}. Open contents`)}
      className="flex w-7 flex-none items-start justify-center border-l border-platform-border bg-platform-panel py-[var(--space-shell-3)] text-platform-text-muted hover:text-platform-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-platform-focus"
    >
      <span className="max-h-full truncate text-[11px] font-semibold uppercase tracking-[0.12em] [writing-mode:vertical-rl]">
        {capitulo}
      </span>
    </button>
  );
}
