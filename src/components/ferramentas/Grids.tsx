"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FORMATOS, GRUPOS, formatoPorId, type TipoDeGrid } from "@/lib/grids/formatos";
import { calcularGrid, escolhasPadrao, formatar, type Escolhas, type Proporcao } from "@/lib/grids/calcular";
import { montarIdml } from "@/lib/grids/idml";
import { montarPdf } from "@/lib/grids/pdf";
import { salvarArquivo } from "@/lib/assets/zip-no-navegador";

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

const TIPOS: { id: TipoDeGrid; nome: string; dica: string }[] = [
  { id: "manuscrito", nome: "Manuscrito", dica: "um bloco de texto" },
  { id: "colunas", nome: "Colunas", dica: "colunas e medianiz" },
  { id: "modular", nome: "Modular", dica: "colunas × linhas" },
  { id: "hierarquico", nome: "Hierárquico", dica: "zonas pelo conteúdo" },
];

const PROPORCOES: { id: Proporcao; nome: string }[] = [
  { id: "unidade", nome: "Margens da proposta (unidade)" },
  { id: "2:3:4:6", nome: "2 : 3 : 4 : 6 (clássica de livro)" },
  { id: "van-de-graaf", nome: "Cânone de Van de Graaf" },
  { id: "aurea", nome: "Seção áurea" },
];

const ZONAS: { nome: string; pesos: number[] }[] = [
  { nome: "1 : 2", pesos: [1, 2] },
  { nome: "2 : 3", pesos: [2, 3] },
  { nome: "1 : φ (áurea)", pesos: [1, 1.618] },
  { nome: "1 : 2 : 1", pesos: [1, 2, 1] },
  { nome: "1 : 3 : 1,2 (logo · mensagem · chamada)", pesos: [1, 3, 1.2] },
  { nome: "1 : 4", pesos: [1, 4] },
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

export function Grids() {
  const [formatoId, setFormatoId] = useState("a4");
  const formato = formatoPorId(formatoId);
  const [escolhas, setEscolhas] = useState<Escolhas>(() => escolhasPadrao(formatoPorId("a4")));
  const grid = useMemo(() => calcularGrid(formato, escolhas), [formato, escolhas]);
  const un = formato.unidade;
  const mudar = (parte: Partial<Escolhas>) => setEscolhas((e) => ({ ...e, ...parte }));
  // Sinal de "ligado" para os testes de navegador: escolher antes de o React
  // assumir a página perdia a escolha.
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => { raiz.current?.setAttribute("data-grids-vivo", ""); }, []);

  function trocarFormato(id: string) {
    const f = formatoPorId(id);
    setFormatoId(id);
    setEscolhas(escolhasPadrao(f));
  }

  const base = `grid-${formato.id}-${escolhas.tipo}`;
  const baixar = (tipo: "idml" | "pdf") => {
    const bytes = tipo === "idml" ? montarIdml(grid) : montarPdf(grid);
    salvarArquivo(new Blob([bytes as BlobPart], { type: tipo === "idml" ? "application/vnd.adobe.indesign-idml-package" : "application/pdf" }), `${base}.${tipo}`);
  };

  const unidadeDoCampo = un === "mm" ? "mm" : "px";
  const campoNumero = (rotulo: string, valor: number, aoMudar: (n: number) => void, sufixo: string, atributo: string, passo = 1) => (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-platform-text-muted">{rotulo}</span>
      <span className="flex items-center gap-1.5">
        <input data-grids-campo={atributo} inputMode="decimal" className={CAMPO} defaultValue={String(valor).replace(".", ",")} key={`${formato.id}-${atributo}-${valor}`}
          onBlur={(e) => aoMudar(numero(e.target.value, valor))} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} step={passo} />
        <span className="w-6 text-[12px] text-platform-text-muted">{sufixo}</span>
      </span>
    </label>
  );

  return (
    <div ref={raiz} data-grids className="grid min-h-[calc(100dvh-var(--shell-topbar))] lg:grid-cols-[400px_1fr]">
      <aside className="flex flex-col gap-7 border-platform-border p-6 lg:border-r">
        <section className="flex flex-col gap-3">
          <p className={ROTULO}>Passo 1</p>
          <h2 className={PASSO}>O formato</h2>
          <select data-grids-formato className={CAMPO} value={formatoId} onChange={(e) => trocarFormato(e.target.value)}>
            {GRUPOS.map((g) => (
              <optgroup key={g.id} label={g.nome}>
                {FORMATOS.filter((f) => f.grupo === g.id).map((f) => (
                  <option key={f.id} value={f.id}>{f.nome} — {String(f.largura).replace(".", ",")} × {String(f.altura).replace(".", ",")} {f.unidade}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <p data-grids-fonte className="text-[12px] leading-snug text-platform-text-muted">
            Medida: {formato.fonte}.{formato.corpo ? ` Corpo de texto da proposta: ${formato.corpo}.` : ""}
          </p>
          {formato.livro && (
            <div className="grid grid-cols-2 gap-3">
              {campoNumero("Lombada", escolhas.livro.lombada, (v) => mudar({ livro: { ...escolhas.livro, lombada: Math.max(0, v) } }), "mm", "lombada")}
              {campoNumero("Orelha (cada)", escolhas.livro.orelha, (v) => mudar({ livro: { ...escolhas.livro, orelha: Math.max(0, v) } }), "mm", "orelha")}
              <p className="col-span-2 text-[12px] leading-snug text-platform-text-muted">A lombada depende do papel e do número de páginas: confirme a medida com a gráfica.</p>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <p className={ROTULO}>Passo 2</p>
          <h2 className={PASSO}>O tipo de grid</h2>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de grid">
            {TIPOS.map((t) => (
              <button key={t.id} type="button" data-grids-tipo={t.id} aria-pressed={escolhas.tipo === t.id} onClick={() => mudar({ tipo: t.id })}
                className={`flex flex-col items-start rounded-[var(--radius-control)] border px-3 py-2 text-left transition-colors ${escolhas.tipo === t.id ? "border-platform-text" : "border-platform-border hover:border-platform-text"}`}>
                <span className="text-sm font-medium text-platform-text">{t.nome}</span>
                <span className="text-[12px] text-platform-text-muted">{t.dica}</span>
              </button>
            ))}
          </div>

          {escolhas.tipo === "manuscrito" && !formato.livro && (
            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-platform-text-muted">Proporção das margens</span>
              <select data-grids-proporcao className={CAMPO} value={escolhas.proporcao} onChange={(e) => mudar({ proporcao: e.target.value as Proporcao })}>
                {PROPORCOES.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
          )}
          {escolhas.tipo === "hierarquico" && !formato.livro && (
            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-platform-text-muted">Divisão das zonas</span>
              <select data-grids-zonas className={CAMPO} value={ZONAS.find((z) => z.pesos.join() === escolhas.zonas.join())?.nome ?? ""} onChange={(e) => mudar({ zonas: ZONAS.find((z) => z.nome === e.target.value)!.pesos })}>
                {!ZONAS.some((z) => z.pesos.join() === escolhas.zonas.join()) && <option value="">{escolhas.zonas.join(" : ")}</option>}
                {ZONAS.map((z) => <option key={z.nome} value={z.nome}>{z.nome}</option>)}
              </select>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            {escolhas.tipo !== "manuscrito" && campoNumero("Colunas", escolhas.colunas, (v) => mudar({ colunas: Math.min(24, Math.max(1, Math.round(v))) }), "", "colunas")}
            {escolhas.tipo === "modular" && campoNumero("Linhas", escolhas.linhas, (v) => mudar({ linhas: Math.min(40, Math.max(1, Math.round(v))) }), "", "linhas")}
            {escolhas.tipo !== "manuscrito" && campoNumero("Medianiz", escolhas.medianiz, (v) => mudar({ medianiz: Math.max(0, v) }), unidadeDoCampo, "medianiz")}
            {campoNumero("Linha de base", escolhas.linhaDeBase, (v) => mudar({ linhaDeBase: Math.max(1, v) }), un === "mm" ? "pt" : "px", "linha-de-base")}
          </div>
          {(escolhas.tipo !== "manuscrito" || escolhas.proporcao === "unidade" || formato.livro) && (
            <div className="grid grid-cols-4 gap-2">
              {campoNumero("Superior", escolhas.margens.sup, (v) => mudar({ margens: { ...escolhas.margens, sup: Math.max(0, v) } }), "", "margem-sup")}
              {campoNumero("Inferior", escolhas.margens.inf, (v) => mudar({ margens: { ...escolhas.margens, inf: Math.max(0, v) } }), "", "margem-inf")}
              {campoNumero("Esquerda", escolhas.margens.esq, (v) => mudar({ margens: { ...escolhas.margens, esq: Math.max(0, v) } }), "", "margem-esq")}
              {campoNumero("Direita", escolhas.margens.dir, (v) => mudar({ margens: { ...escolhas.margens, dir: Math.max(0, v) } }), "", "margem-dir")}
              <p className="col-span-4 -mt-1 text-[12px] text-platform-text-muted">Margens em {unidadeDoCampo}.</p>
            </div>
          )}
        </section>

        {!formato.livro && (
          <section className="flex flex-col gap-3">
            <p className={ROTULO}>Passo 3 · opcional</p>
            <h2 className={PASSO}>Desconstrução</h2>
            <label className="flex items-center gap-2 text-sm text-platform-text">
              <input type="checkbox" data-grids-sobreposto checked={escolhas.sobreposto.ativo} onChange={(e) => mudar({ sobreposto: { ...escolhas.sobreposto, ativo: e.target.checked } })} />
              Grid sobreposto
            </label>
            {escolhas.sobreposto.ativo && campoNumero("Colunas do grid sobreposto", escolhas.sobreposto.colunas, (v) => mudar({ sobreposto: { ...escolhas.sobreposto, colunas: Math.min(24, Math.max(1, Math.round(v))) } }), "", "sobreposto-colunas")}
            <label className="flex items-center gap-2 text-sm text-platform-text">
              <input type="checkbox" data-grids-rotacionado checked={escolhas.rotacionado.ativo} onChange={(e) => mudar({ rotacionado: { ...escolhas.rotacionado, ativo: e.target.checked } })} />
              Grid rotacionado
            </label>
            {escolhas.rotacionado.ativo && (
              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-platform-text-muted">Ângulo · {escolhas.rotacionado.angulo}°</span>
                <input data-grids-angulo type="range" min={-45} max={45} value={escolhas.rotacionado.angulo} onChange={(e) => mudar({ rotacionado: { ...escolhas.rotacionado, angulo: +e.target.value } })} />
              </label>
            )}
            <p className="text-[12px] leading-snug text-platform-text-muted">Cada um vem numa camada própria do InDesign, que não imprime: ligue e desligue no painel Camadas.</p>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <p className={ROTULO}>Passo {formato.livro ? 3 : 4}</p>
          <h2 className={PASSO}>Baixar</h2>
          <button type="button" data-grids-baixar-idml onClick={() => baixar("idml")} disabled={grid.avisos.some((a) => a.startsWith("As margens somam"))}
            className="rounded-[var(--radius-control)] bg-platform-signal px-4 py-2.5 text-sm font-semibold text-platform-bg disabled:opacity-40">
            Baixar para o InDesign (.idml)
          </button>
          <button type="button" data-grids-baixar-pdf onClick={() => baixar("pdf")} className="rounded-[var(--radius-control)] border border-platform-border px-4 py-2 text-sm text-platform-text">
            PDF de referência (outros programas)
          </button>
          <p className="text-[12px] leading-snug text-platform-text-muted">O .idml também abre no Affinity Publisher. Logo, cores e estilos de texto da marca já posicionados: no plano de assinatura.</p>
          <button type="button" data-grids-restaurar onClick={() => setEscolhas(escolhasPadrao(formato))} className="self-start text-[12.5px] text-platform-text-muted underline">
            Voltar à proposta do Brennimark
          </button>
        </section>
      </aside>

      <section className="flex min-w-0 flex-col gap-4 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[13px] text-platform-text-muted">
            <span className="font-medium text-platform-text">{formato.nome}</span> · {TIPOS.find((t) => t.id === escolhas.tipo)!.nome}
            {" · "}{grid.colunas.n} {grid.colunas.n === 1 ? "coluna" : "colunas"}{grid.linhas.length ? ` × ${grid.linhas.length} linhas` : ""}
            {" · "}linha de base {un === "mm" ? `${escolhas.linhaDeBase} pt` : `${escolhas.linhaDeBase} px`}
          </p>
          <p data-grids-proposta className="font-mono text-[11px] uppercase tracking-[0.08em] text-platform-text-muted">proposta do Brennimark</p>
        </div>
        <Previa grid={grid} />
        <Legenda grid={grid} />
        {formato.seguraNota && <p className="text-[12.5px] text-platform-text-muted">Área segura: {formato.seguraNota}.</p>}
        {grid.avisos.map((a) => <p key={a} data-grids-aviso className="rounded-[var(--radius-control)] border border-platform-border px-3 py-2 text-[12.5px] text-platform-text">{a}</p>)}
        <p className="text-[12px] text-platform-text-muted">
          Margens: {formatar(grid.margens.sup, un)} · {formatar(grid.margens.inf, un)} · {formatar(grid.margens.esq, un)} · {formatar(grid.margens.dir, un)}
          {grid.sangria > 0 ? ` · sangria ${formatar(grid.sangria, un)}` : ""}
        </p>
      </section>
    </div>
  );
}

function Previa({ grid: g }: { grid: ReturnType<typeof calcularGrid> }) {
  const s = g.sangria;
  const fino = Math.max(g.largura, g.altura) / 900;
  const interior = { x: g.margens.esq, y: g.margens.sup, w: g.largura - g.margens.esq - g.margens.dir, h: g.altura - g.margens.sup - g.margens.inf };
  const bases: number[] = [];
  for (let v = g.linhaDeBase.inicio; v <= g.altura - g.margens.inf + 0.01 && bases.length < 400; v += g.linhaDeBase.passo) bases.push(v);
  const altoDasColunas = g.colunasNaMargem ? interior : { x: 0, y: g.margens.sup, w: 0, h: g.altura - g.margens.sup - g.margens.inf };
  return (
    <div className="grid place-items-center rounded-[var(--radius-panel)] border border-platform-border bg-[#e9edf0] p-6">
      <svg data-grids-previa viewBox={`${-s - fino * 4} ${-s - fino * 4} ${g.largura + 2 * s + fino * 8} ${g.altura + 2 * s + fino * 8}`}
        className="max-h-[70vh] w-full" role="img" aria-label="Prévia do grid">
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
      </svg>
    </div>
  );
}

function Legenda({ grid: g }: { grid: ReturnType<typeof calcularGrid> }) {
  const itens: [string, string][] = [["colunas e módulos", COR.traco], ["linha de base", COR.base]];
  if (g.colunasNaMargem) itens.push(["margens", COR.margem]);
  if (g.zonas.length && g.colunasNaMargem) itens.push(["zonas", COR.zona]);
  if (!g.colunasNaMargem) itens.push(["dobras", COR.dobra]);
  if (g.segura) itens.push(["área segura da plataforma", COR.segura]);
  if (g.sangria > 0) itens.push(["sangria", "#c9302c"]);
  if (g.sobreposto.length) itens.push(["grid sobreposto", COR.sobreposto]);
  if (g.rotacionado) itens.push(["grid rotacionado", COR.rotacionado]);
  return (
    <ul data-grids-legenda className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-platform-text-muted">
      {itens.map(([nome, cor]) => (
        <li key={nome} className="flex items-center gap-1.5"><span className="inline-block h-[3px] w-4" style={{ background: cor }} />{nome}</li>
      ))}
    </ul>
  );
}
