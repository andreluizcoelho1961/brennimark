"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FORMATOS, FORMATOS_GRATIS, GRUPOS, formatoPorId, textoDoFormato, type Formato, type TipoDeGrid } from "@/lib/grids/formatos";
import { calcularGrid, escolhasPadrao, formatar, type Escolhas, type Grid, type Proporcao } from "@/lib/grids/calcular";
import { montarIdml } from "@/lib/grids/idml";
import { montarPdf } from "@/lib/grids/pdf";
import { salvarArquivo } from "@/lib/assets/zip-no-navegador";
import { Dica } from "@/components/shell/Dica";
import { textoDaDica } from "@/components/shell/dicas";
import { useCadastroParaBaixar } from "./CadastroParaBaixar";

/** As dicas dos controles (15/10/2026): textos em `components/shell/dicas.ts`. */
const dicaDe = (chave: string) => textoDaDica(chave, false) ?? "";


/**
 * O Brennimark Grids, versão GRATUITA (13/10/2026): escolhe o formato e o tipo
 * de grid, ajusta com a prévia ao vivo e baixa o IDML (InDesign, Affinity
 * Publisher) e o PDF de referência. Só o grid — logo, cores e estilos da marca
 * são do assinante (ESPEC-BRENNIMARK-GRIDS §6).
 *
 * Os números de partida são a "proposta do Brennimark" (tabela aprovada pelo
 * André em 13/10), e a tela diz isso. Tudo roda no navegador.
 */

const ROTULO = "font-mono text-[11px] uppercase tracking-[0.08em] text-platform-text-muted";
const PASSO = "font-display text-[17px] font-semibold tracking-tight text-platform-text";
const CAMPO = "w-full rounded-[var(--radius-control)] border border-platform-border bg-platform-panel px-3 py-2 text-sm text-platform-text";

/** Os nomes e as dicas vêm do catálogo (`ui.tipo.<id>`, `ui.proporcao.<chave>`, `ui.zonasDoGrid.<chave>`). */
const TIPOS: { id: TipoDeGrid }[] = [{ id: "manuscrito" }, { id: "colunas" }, { id: "modular" }, { id: "hierarquico" }];

const PROPORCOES: { id: Proporcao; chave: string }[] = [
  { id: "unidade", chave: "unidade" },
  { id: "2:3:4:6", chave: "classica" },
  { id: "van-de-graaf", chave: "vanDeGraaf" },
  { id: "aurea", chave: "aurea" },
];

const ZONAS: { chave: string; pesos: number[] }[] = [
  { chave: "z1", pesos: [1, 2] },
  { chave: "z2", pesos: [2, 3] },
  { chave: "z3", pesos: [1, 1.618] },
  { chave: "z4", pesos: [1, 2, 1] },
  { chave: "z5", pesos: [1, 3, 1.2] },
  { chave: "z6", pesos: [1, 4] },
];

const COR = {
  coluna: "rgba(0, 158, 219, 0.14)",
  traco: "#009edb",
  base: "rgba(140, 191, 242, 0.7)",
  margem: "#d933b3",
  zona: "#734dd9",
  segura: "#e62626",
  dobra: "#1a994d",
  sobreposto: "#e61a8c",
  rotacionado: "#ff8c00",
};

function numero(v: string, padrao: number) {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : padrao;
}

/**
 * O modo do ASSINANTE (14/10/2026): o mesmo Grids, com o grid vindo das regras
 * da marca, a origem dita na tela, a seção da marca (logo, cores, regras) e o
 * pacote com logo, cores e estilos. Quem monta é `GridsDoAssinante`.
 */
export type ContextoDoGrid = { grid: Grid; formato: Formato; escolhas: Escolhas };
export type ModoMarca = {
  aplicar: (f: Formato) => Escolhas;
  origem: (f: Formato, e: Escolhas) => string;
  secao: (d: ContextoDoGrid & { mudar: (parte: Partial<Escolhas>) => void }) => ReactNode;
  sobrePrevia?: (d: ContextoDoGrid) => ReactNode;
  baixar: (d: ContextoDoGrid) => void;
  /** O PDF com a marca, igual ao que o InDesign abre (15/10/2026). */
  baixarPdf?: (d: ContextoDoGrid) => void;
  baixando: boolean;
};

export function Grids({ marca }: { marca?: ModoMarca } = {}) {
  const t = useTranslations("ferramentas.grids");
  const decimal = t("separadorDecimal");
  const { pedir, dialogo } = useCadastroParaBaixar("grids", { ativo: !marca });
  const [formatoId, setFormatoId] = useState("a4");
  const formato = formatoPorId(formatoId);
  const inicial = (f: Formato) => (marca ? marca.aplicar(f) : escolhasPadrao(f));
  const [escolhas, setEscolhas] = useState<Escolhas>(() => inicial(formatoPorId("a4")));
  const grid = useMemo(() => calcularGrid(formato, escolhas, t), [formato, escolhas, t]);
  const textoDe = (f: Formato) => textoDoFormato(f, t);
  const un = formato.unidade;
  const mudar = (parte: Partial<Escolhas>) => setEscolhas((e) => ({ ...e, ...parte }));
  // Sinal de "ligado" para os testes de navegador: escolher antes de o React
  // assumir a página perdia a escolha.
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => { raiz.current?.setAttribute("data-grids-vivo", ""); }, []);

  function trocarFormato(id: string) {
    const f = formatoPorId(id);
    setFormatoId(id);
    setEscolhas(inicial(f));
  }

  const base = `grid-${formato.id}-${escolhas.tipo}`;
  const baixar = (tipo: "idml" | "pdf") => {
    const bytes = tipo === "idml" ? montarIdml(grid, undefined, t) : montarPdf(grid);
    salvarArquivo(new Blob([bytes as BlobPart], { type: tipo === "idml" ? "application/vnd.adobe.indesign-idml-package" : "application/pdf" }), `${base}.${tipo}`);
  };

  const unidadeDoCampo = un === "mm" ? "mm" : "px";
  const campoNumero = (rotulo: string, valor: number, aoMudar: (n: number) => void, sufixo: string, atributo: string, passo = 1) => (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-platform-text-muted">{rotulo}</span>
      <span className="flex items-center gap-1.5">
        <input data-grids-campo={atributo} inputMode="decimal" className={CAMPO} defaultValue={String(valor).replace(".", decimal)} key={`${formato.id}-${atributo}-${valor}`}
          onBlur={(e) => aoMudar(numero(e.target.value, valor))} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} step={passo} />
        <span className="w-6 text-[12px] text-platform-text-muted">{sufixo}</span>
      </span>
    </label>
  );

  return (
    <div ref={raiz} data-grids className="grid min-h-[calc(100dvh-var(--shell-topbar))] lg:grid-cols-[400px_1fr]">
      {dialogo}
      <aside className="flex flex-col gap-7 border-platform-border p-6 lg:border-r">
        <section className="flex flex-col gap-3">
          <p className={ROTULO}>{t("ui.passo", { n: 1 })}</p>
          <h2 className={PASSO}>{t("ui.formato.titulo")}</h2>
          <Dica texto={dicaDe("grids-formato")} lado="baixo"><select data-grids-formato className={CAMPO} value={formatoId} onChange={(e) => trocarFormato(e.target.value)}>
            {GRUPOS.map((g) => (
              <optgroup key={g.id} label={t(`grupos.${g.id}`)}>
                {FORMATOS.filter((f) => f.grupo === g.id && (marca || FORMATOS_GRATIS.has(f.id))).map((f) => (
                  <option key={f.id} value={f.id}>{textoDe(f).nome} — {String(f.largura).replace(".", decimal)} × {String(f.altura).replace(".", decimal)} {f.unidade}</option>
                ))}
              </optgroup>
            ))}
            {!marca && <option disabled data-grids-formatos-bloqueados>{t("ui.formato.bloqueados", { n: FORMATOS.length - FORMATOS_GRATIS.size })}</option>}
          </select></Dica>
          <p data-grids-fonte className="text-[12px] leading-snug text-platform-text-muted">
            {t("ui.formato.medida", { fonte: textoDe(formato).fonte, corpo: textoDe(formato).corpo ? t("ui.formato.corpo", { corpo: textoDe(formato).corpo! }) : "" })}
          </p>
          {formato.livro && (
            <div className="grid grid-cols-2 gap-3">
              {campoNumero(t("ui.formato.lombada"), escolhas.livro.lombada, (v) => mudar({ livro: { ...escolhas.livro, lombada: Math.max(0, v) } }), "mm", "lombada")}
              {campoNumero(t("ui.formato.orelha"), escolhas.livro.orelha, (v) => mudar({ livro: { ...escolhas.livro, orelha: Math.max(0, v) } }), "mm", "orelha")}
              <p className="col-span-2 text-[12px] leading-snug text-platform-text-muted">{t("ui.formato.lombadaNota")}</p>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <p className={ROTULO}>{t("ui.passo", { n: 2 })}</p>
          <h2 className={PASSO}>{t("ui.tipo.titulo")}</h2>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("ui.tipo.aria")}>
            {TIPOS.map((tp) => (
              <Dica key={tp.id} texto={dicaDe("grids-tipo")} lado="cima"><button type="button" data-grids-tipo={tp.id} aria-pressed={escolhas.tipo === tp.id} onClick={() => mudar({ tipo: tp.id })}
                className={`flex flex-col items-start rounded-[var(--radius-control)] border px-3 py-2 text-left transition-colors ${escolhas.tipo === tp.id ? "border-platform-text" : "border-platform-border hover:border-platform-text"}`}>
                <span className="text-sm font-medium text-platform-text">{t(`ui.tipo.${tp.id}.nome`)}</span>
                <span className="text-[12px] text-platform-text-muted">{t(`ui.tipo.${tp.id}.dica`)}</span>
              </button></Dica>
            ))}
          </div>

          {escolhas.tipo === "manuscrito" && !formato.livro && (
            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-platform-text-muted">{t("ui.proporcao.rotulo")}</span>
              <select data-grids-proporcao className={CAMPO} value={escolhas.proporcao} onChange={(e) => mudar({ proporcao: e.target.value as Proporcao })}>
                {PROPORCOES.map((p) => <option key={p.id} value={p.id}>{t(`ui.proporcao.${p.chave}`)}</option>)}
              </select>
            </label>
          )}
          {escolhas.tipo === "hierarquico" && !formato.livro && (
            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-platform-text-muted">{t("ui.zonasDoGrid.rotulo")}</span>
              <select data-grids-zonas className={CAMPO} value={ZONAS.find((z) => z.pesos.join() === escolhas.zonas.join())?.chave ?? ""} onChange={(e) => mudar({ zonas: ZONAS.find((z) => z.chave === e.target.value)!.pesos })}>
                {!ZONAS.some((z) => z.pesos.join() === escolhas.zonas.join()) && <option value="">{escolhas.zonas.join(" : ")}</option>}
                {ZONAS.map((z) => <option key={z.chave} value={z.chave}>{t(`ui.zonasDoGrid.${z.chave}`)}</option>)}
              </select>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            {escolhas.tipo !== "manuscrito" && campoNumero(t("ui.campos.colunas"), escolhas.colunas, (v) => mudar({ colunas: Math.min(24, Math.max(1, Math.round(v))) }), "", "colunas")}
            {escolhas.tipo === "modular" && campoNumero(t("ui.campos.linhas"), escolhas.linhas, (v) => mudar({ linhas: Math.min(40, Math.max(1, Math.round(v))) }), "", "linhas")}
            {escolhas.tipo !== "manuscrito" && campoNumero(t("ui.campos.medianiz"), escolhas.medianiz, (v) => mudar({ medianiz: Math.max(0, v) }), unidadeDoCampo, "medianiz")}
            {campoNumero(t("ui.campos.linhaDeBase"), escolhas.linhaDeBase, (v) => mudar({ linhaDeBase: Math.max(1, v) }), un === "mm" ? "pt" : "px", "linha-de-base")}
          </div>
          {(escolhas.tipo !== "manuscrito" || escolhas.proporcao === "unidade" || formato.livro) && (
            <div className="grid grid-cols-4 gap-2">
              {campoNumero(t("ui.campos.sup"), escolhas.margens.sup, (v) => mudar({ margens: { ...escolhas.margens, sup: Math.max(0, v) } }), "", "margem-sup")}
              {campoNumero(t("ui.campos.inf"), escolhas.margens.inf, (v) => mudar({ margens: { ...escolhas.margens, inf: Math.max(0, v) } }), "", "margem-inf")}
              {campoNumero(t("ui.campos.esq"), escolhas.margens.esq, (v) => mudar({ margens: { ...escolhas.margens, esq: Math.max(0, v) } }), "", "margem-esq")}
              {campoNumero(t("ui.campos.dir"), escolhas.margens.dir, (v) => mudar({ margens: { ...escolhas.margens, dir: Math.max(0, v) } }), "", "margem-dir")}
              <p className="col-span-4 -mt-1 text-[12px] text-platform-text-muted">{t("ui.campos.margensEm", { un: unidadeDoCampo })}</p>
            </div>
          )}
        </section>

        {!formato.livro && !marca && (
          <section className="flex flex-col gap-3" data-grids-desconstrucao-bloqueada>
            <p className={ROTULO}>{t("ui.passo3Assinante")}</p>
            <h2 className={PASSO}>{t("ui.desconstrucao.titulo")}</h2>
            <p className="text-[12.5px] leading-snug text-platform-text-muted">{t("ui.desconstrucao.bloqueada")}</p>
          </section>
        )}

        {!formato.livro && marca && (
          <section className="flex flex-col gap-3">
            <p className={ROTULO}>{t("ui.passo3Opcional")}</p>
            <h2 className={PASSO}>{t("ui.desconstrucao.titulo")}</h2>
            <Dica texto={dicaDe("grids-sobreposto")} lado="cima"><label className="flex items-center gap-2 text-sm text-platform-text">
              <input type="checkbox" data-grids-sobreposto checked={escolhas.sobreposto.ativo} onChange={(e) => mudar({ sobreposto: { ...escolhas.sobreposto, ativo: e.target.checked } })} />
              {t("ui.desconstrucao.sobreposto")}
            </label></Dica>
            {escolhas.sobreposto.ativo && campoNumero(t("ui.desconstrucao.colunasSobreposto"), escolhas.sobreposto.colunas, (v) => mudar({ sobreposto: { ...escolhas.sobreposto, colunas: Math.min(24, Math.max(1, Math.round(v))) } }), "", "sobreposto-colunas")}
            <Dica texto={dicaDe("grids-rotacionado")} lado="cima"><label className="flex items-center gap-2 text-sm text-platform-text">
              <input type="checkbox" data-grids-rotacionado checked={escolhas.rotacionado.ativo} onChange={(e) => mudar({ rotacionado: { ...escolhas.rotacionado, ativo: e.target.checked } })} />
              {t("ui.desconstrucao.rotacionado")}
            </label></Dica>
            {escolhas.rotacionado.ativo && (
              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-platform-text-muted">{t("ui.desconstrucao.angulo", { a: escolhas.rotacionado.angulo })}</span>
                <input data-grids-angulo type="range" min={-45} max={45} value={escolhas.rotacionado.angulo} onChange={(e) => mudar({ rotacionado: { ...escolhas.rotacionado, angulo: +e.target.value } })} />
              </label>
            )}
            <p className="text-[12px] leading-snug text-platform-text-muted">{t("ui.desconstrucao.camadas")}</p>
          </section>
        )}

        {marca?.secao({ grid, formato, escolhas, mudar })}

        <section className="flex flex-col gap-3">
          <p className={ROTULO}>{t("ui.passo", { n: formato.livro ? 3 : 4 })}</p>
          <h2 className={PASSO}>{t("ui.baixar.titulo")}</h2>
          <Dica texto={dicaDe(marca ? "grids-baixar-idml" : "grids-baixar-idml-gratis")} lado="cima"><button type="button" data-grids-baixar-idml onClick={() => (marca ? marca.baixar({ grid, formato, escolhas }) : pedir(() => baixar("idml")))}
            disabled={grid.margensExcedem || Boolean(marca?.baixando)}
            className="rounded-[var(--radius-control)] bg-platform-signal px-4 py-2.5 text-sm font-semibold text-platform-bg disabled:opacity-40">
            {marca ? (marca.baixando ? t("ui.baixar.montando") : t("ui.baixar.idmlMarca")) : t("ui.baixar.idml")}
          </button></Dica>
          <Dica texto={dicaDe("grids-baixar-pdf")} lado="cima"><button type="button" data-grids-baixar-pdf onClick={() => (marca?.baixarPdf ? marca.baixarPdf({ grid, formato, escolhas }) : pedir(() => baixar("pdf")))} className="rounded-[var(--radius-control)] border border-platform-border px-4 py-2 text-sm text-platform-text">
            {t("ui.baixar.pdf")}
          </button></Dica>
          <p className="text-[12px] leading-snug text-platform-text-muted">
            {marca ? t("ui.baixar.notaMarca") : t("ui.baixar.notaGratis")}
          </p>
          <button type="button" data-grids-restaurar onClick={() => setEscolhas(inicial(formato))} className="self-start text-[12.5px] text-platform-text-muted underline">
            {marca ? t("ui.baixar.restaurarMarca") : t("ui.baixar.restaurarProposta")}
          </button>
        </section>
      </aside>

      <section className="flex min-w-0 flex-col gap-4 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[13px] text-platform-text-muted">
            <span className="font-medium text-platform-text">{textoDe(formato).nome}</span> · {t(`ui.tipo.${escolhas.tipo}.nome`)}
            {" · "}{t("ui.resumo.colunas", { n: grid.colunas.n })}{grid.linhas.length ? ` ${t("ui.resumo.linhas", { n: grid.linhas.length })}` : ""}
            {" · "}{t("ui.resumo.linhaDeBase", { v: escolhas.linhaDeBase, u: un === "mm" ? "pt" : "px" })}
          </p>
          {marca
            ? <p data-grids-origem className="text-[12.5px] text-platform-text-muted">{t("ui.resumo.origem", { origem: marca.origem(formato, escolhas) })}</p>
            : <p data-grids-proposta className="font-mono text-[11px] uppercase tracking-[0.08em] text-platform-text-muted">{t("ui.resumo.proposta")}</p>}
        </div>
        <Previa grid={grid} sobre={marca?.sobrePrevia?.({ grid, formato, escolhas })} />
        <Legenda grid={grid} />
        {textoDe(formato).seguraNota && <p className="text-[12.5px] text-platform-text-muted">{t("ui.resumo.areaSegura", { nota: textoDe(formato).seguraNota! })}</p>}
        {grid.avisos.map((a) => <p key={a} data-grids-aviso className="rounded-[var(--radius-control)] border border-platform-border px-3 py-2 text-[12.5px] text-platform-text">{a}</p>)}
        <p className="text-[12px] text-platform-text-muted">
          {t("ui.resumo.margens", { sup: formatar(grid.margens.sup, un, decimal), inf: formatar(grid.margens.inf, un, decimal), esq: formatar(grid.margens.esq, un, decimal), dir: formatar(grid.margens.dir, un, decimal) })}
          {grid.sangria > 0 ? t("ui.resumo.sangria", { v: formatar(grid.sangria, un, decimal) }) : ""}
        </p>
      </section>
    </div>
  );
}

function Previa({ grid: g, sobre }: { grid: ReturnType<typeof calcularGrid>; sobre?: ReactNode }) {
  const t = useTranslations("ferramentas.grids");
  const s = g.sangria;
  const fino = Math.max(g.largura, g.altura) / 900;
  const interior = { x: g.margens.esq, y: g.margens.sup, w: g.largura - g.margens.esq - g.margens.dir, h: g.altura - g.margens.sup - g.margens.inf };
  const bases: number[] = [];
  for (let v = g.linhaDeBase.inicio; v <= g.altura - g.margens.inf + 0.01 && bases.length < 400; v += g.linhaDeBase.passo) bases.push(v);
  const altoDasColunas = g.colunasNaMargem ? interior : { x: 0, y: g.margens.sup, w: 0, h: g.altura - g.margens.sup - g.margens.inf };
  return (
    <div className="grid place-items-center rounded-[var(--radius-panel)] border border-platform-border bg-[#e9edf0] p-6">
      <svg data-grids-previa viewBox={`${-s - fino * 4} ${-s - fino * 4} ${g.largura + 2 * s + fino * 8} ${g.altura + 2 * s + fino * 8}`}
        className="max-h-[70vh] w-full" role="img" aria-label={t("ui.resumo.previaAria")}>
        {s > 0 && <rect x={-s} y={-s} width={g.largura + 2 * s} height={g.altura + 2 * s} fill="none" stroke="#c9302c" strokeWidth={fino} strokeDasharray={`${fino * 4} ${fino * 3}`} />}
        <rect x={0} y={0} width={g.largura} height={g.altura} fill="#ffffff" stroke="#9aa5ad" strokeWidth={fino} />
        {g.linhas.length > 0
          ? g.colunas.faixas.flatMap(([a, b]) => g.linhas.map(([c, d]) => <rect key={`${a}-${c}`} x={a} y={c} width={b - a} height={d - c} fill={COR.coluna} />))
          : g.colunas.faixas.map(([a, b]) => <rect key={a} x={a} y={altoDasColunas.y} width={b - a} height={altoDasColunas.h} fill={COR.coluna} />)}
        {bases.map((v) => <line key={v} x1={interior.x} x2={interior.x + interior.w} y1={v} y2={v} stroke={COR.base} strokeWidth={fino * 0.5} />)}
        {g.colunasNaMargem && <rect x={interior.x} y={interior.y} width={interior.w} height={interior.h} fill="none" stroke={COR.margem} strokeWidth={fino} />}
        {g.zonas.map((z) => (
          <g key={z.nome}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} fill="none" stroke={g.colunasNaMargem ? COR.zona : COR.dobra} strokeWidth={fino * 1.4} strokeDasharray={`${fino * 6} ${fino * 4}`} />
            <text x={z.x + fino * 6} y={z.y + fino * 18} fontSize={fino * 13} fill={g.colunasNaMargem ? COR.zona : COR.dobra}>{z.nome}</text>
          </g>
        ))}
        {g.segura && <rect data-grids-segura x={g.segura.x} y={g.segura.y} width={g.segura.w} height={g.segura.h} fill="none" stroke={COR.segura} strokeWidth={fino * 1.4} strokeDasharray={`${fino * 6} ${fino * 4}`} />}
        {g.sobreposto.map(([a, b]) => (
          <g key={`s${a}`}>
            <line x1={a} x2={a} y1={interior.y} y2={interior.y + interior.h} stroke={COR.sobreposto} strokeWidth={fino} strokeDasharray={`${fino * 5} ${fino * 3}`} />
            <line x1={b} x2={b} y1={interior.y} y2={interior.y + interior.h} stroke={COR.sobreposto} strokeWidth={fino} strokeDasharray={`${fino * 5} ${fino * 3}`} />
          </g>
        ))}
        {g.rotacionado?.segmentos.map(([x1, y1, x2, y2], i) => <line key={`r${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={COR.rotacionado} strokeWidth={fino * 0.8} />)}
        {sobre}
      </svg>
    </div>
  );
}

function Legenda({ grid: g }: { grid: ReturnType<typeof calcularGrid> }) {
  const t = useTranslations("ferramentas.grids");
  const itens: [string, string][] = [[t("ui.legenda.colunasEModulos"), COR.traco], [t("ui.legenda.linhaDeBase"), COR.base]];
  if (g.colunasNaMargem) itens.push([t("ui.legenda.margens"), COR.margem]);
  if (g.zonas.length && g.colunasNaMargem) itens.push([t("ui.legenda.zonas"), COR.zona]);
  if (!g.colunasNaMargem) itens.push([t("ui.legenda.dobras"), COR.dobra]);
  if (g.segura) itens.push([t("ui.legenda.segura"), COR.segura]);
  if (g.sangria > 0) itens.push([t("ui.legenda.sangria"), "#c9302c"]);
  if (g.sobreposto.length) itens.push([t("ui.legenda.sobreposto"), COR.sobreposto]);
  if (g.rotacionado) itens.push([t("ui.legenda.rotacionado"), COR.rotacionado]);
  return (
    <ul data-grids-legenda className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-platform-text-muted">
      {itens.map(([nome, cor]) => (
        <li key={nome} className="flex items-center gap-1.5"><span className="inline-block h-[3px] w-4" style={{ background: cor }} />{nome}</li>
      ))}
    </ul>
  );
}
