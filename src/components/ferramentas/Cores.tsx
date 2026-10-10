"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DALTONISMOS, compararComAMarca, contraste, fraseDaComparacao, hexParaRgb, lerCodigo, nomeDaCor, paletaEmAse, paletaEmCss, paletaEmJson,
  paletaEmTexto, rgbParaCmyk, rgbParaHex, rgbParaHsb, simularDaltonismo, veredito, type CorDaMarca, type CorNomeada, type Daltonismo, type Papel,
} from "@/lib/cores/cores";
import { salvarArquivo } from "@/lib/assets/zip-no-navegador";

/**
 * O Brennimark Cores (10/10/2026) — especificação v2.2.
 *
 * Duas camadas, um componente (decisão do André):
 *   - MEDIR, para todo mundo: conta-gotas (Chrome e Edge no computador),
 *     colar um print ou subir imagem, digitar um código; nome em português,
 *     códigos, contraste, daltonismo, histórico e exportação;
 *   - "É A COR DA MARCA?", para o assinante (`marca`): compara com a paleta do
 *     manual. Só cor aprovada vale como cor da marca; rascunho aparece
 *     identificado; o código e o Pantone declarados no manual vêm citados.
 *
 * Tudo roda no navegador. O print colado não sai do computador.
 */

export type MarcaDoCores = {
  nome: string;
  paleta: CorDaMarca[];
  linkDaPagina: (pagina: number) => string;
};

const ROTULO = "font-mono text-[11px] uppercase tracking-[0.08em] text-platform-text-muted";
const TITULO = "font-display text-[17px] font-semibold tracking-tight text-platform-text";
const CAIXA = "flex flex-col gap-3 rounded-[var(--radius-panel)] border border-platform-border bg-platform-panel p-4";
const CHAVE_DO_HISTORICO = "brennimark:cores:historico";

type EyeDropperDoNavegador = { open: () => Promise<{ sRGBHex: string }> };

function lerHistorico(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_DO_HISTORICO) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^#[0-9A-F]{6}$/.test(x)).slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function Cores({ marca }: { marca?: MarcaDoCores } = {}) {
  const [cor, setCor] = useState("#FF4103");
  const [codigo, setCodigo] = useState("");
  const [erroDoCodigo, setErroDoCodigo] = useState("");
  const [papel, setPapel] = useState<Papel>("couche");
  const [historico, setHistorico] = useState<string[]>([]);
  const [textoSobre, setTextoSobre] = useState<string>("#FFFFFF");
  const [imagem, setImagem] = useState<HTMLImageElement | null>(null);
  const [temContaGotas, setTemContaGotas] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  // O que só existe no navegador: o histórico guardado e o conta-gotas.
  useEffect(() => {
    const h = lerHistorico();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do armazenamento do navegador
    setHistorico(h);
    if (h[0]) setCor(h[0]);
    setTemContaGotas(typeof window !== "undefined" && "EyeDropper" in window);
  }, []);

  const usar = useCallback((hex: string) => {
    const h = hex.toUpperCase();
    setCor(h);
    setHistorico((atual) => {
      const novo = [h, ...atual.filter((x) => x !== h)].slice(0, 12);
      try { localStorage.setItem(CHAVE_DO_HISTORICO, JSON.stringify(novo)); } catch { /* sem armazenamento: só esta visita */ }
      return novo;
    });
  }, []);

  async function contaGotas() {
    const Construtor = (window as unknown as { EyeDropper?: new () => EyeDropperDoNavegador }).EyeDropper;
    if (!Construtor) return;
    try {
      const { sRGBHex } = await new Construtor().open();
      const hex = lerCodigo(sRGBHex);
      if (hex) usar(hex);
    } catch { /* a pessoa apertou Esc */ }
  }

  function abrirImagem(arquivo: File | Blob | null | undefined) {
    if (!arquivo || !arquivo.type.startsWith("image/")) return;
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => { setImagem(img); URL.revokeObjectURL(url); };
    img.src = url;
  }

  // Colar um print (Cmd+V) em qualquer lugar da página.
  useEffect(() => {
    const aoColar = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (item) { e.preventDefault(); abrirImagem(item.getAsFile()); }
    };
    window.addEventListener("paste", aoColar);
    return () => window.removeEventListener("paste", aoColar);
  }, []);

  // Desenha o print no canvas, cabendo na largura.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !imagem) return;
    const k = Math.min(1, 900 / imagem.naturalWidth);
    c.width = Math.round(imagem.naturalWidth * k);
    c.height = Math.round(imagem.naturalHeight * k);
    c.getContext("2d", { willReadFrequently: true })!.drawImage(imagem, 0, 0, c.width, c.height);
  }, [imagem]);

  function pegarDoPrint(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * c.width);
    const y = Math.floor(((e.clientY - r.top) / r.height) * c.height);
    const [pr, pg, pb] = c.getContext("2d", { willReadFrequently: true })!.getImageData(x, y, 1, 1).data;
    usar(rgbParaHex(pr, pg, pb));
  }

  function aplicarCodigo() {
    const hex = lerCodigo(codigo);
    if (!hex) { setErroDoCodigo("Não reconheci esse código. Use HEX (#FF4103), RGB (255 65 3), HSB ou CMYK."); return; }
    setErroDoCodigo("");
    usar(hex);
  }

  const [r, g, b] = hexParaRgb(cor);
  const hsb = rgbParaHsb(r, g, b);
  const cmyk = rgbParaCmyk(r, g, b, papel);
  const nome = nomeDaCor(cor);
  const razao = contraste(cor, textoSobre);
  const v = veredito(razao);
  const comparacao = useMemo(() => (marca ? compararComAMarca(cor, marca.paleta) : null), [cor, marca]);
  const corDoManual = comparacao && comparacao.tipo !== "sem-paleta" && comparacao.tipo !== "diferente" ? comparacao.cor : null;

  const paraExportar: CorNomeada[] = marca && marca.paleta.some((c) => c.status === "ready")
    ? marca.paleta.filter((c) => c.status === "ready").map((c) => ({ nome: c.nome, hex: c.hex }))
    : historico.map((h) => ({ nome: nomeDaCor(h), hex: h }));
  const baseDoArquivo = marca && marca.paleta.some((c) => c.status === "ready") ? `paleta-${marca.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "cores-pegas";

  const opcoesDeTexto: { hex: string; rotulo: string }[] = [
    { hex: "#FFFFFF", rotulo: "Branco" }, { hex: "#000000", rotulo: "Preto" },
    ...historico.filter((h) => h !== cor).slice(0, 3).map((h) => ({ hex: h, rotulo: h })),
    ...(marca?.paleta.filter((c) => c.status === "ready" && c.hex.toUpperCase() !== cor).slice(0, 4).map((c) => ({ hex: c.hex.toUpperCase(), rotulo: c.nome })) ?? []),
  ].filter((o, i, todas) => todas.findIndex((x) => x.hex === o.hex) === i);

  return (
    <div data-cores className="flex flex-col gap-6 p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* ─── 1. A cor da vez ───────────────────────────────────────────── */}
        <section className={CAIXA} aria-labelledby="titulo-cor">
          <h2 id="titulo-cor" className={TITULO}>A cor</h2>
          <div className="flex flex-wrap items-stretch gap-4">
            <div data-cores-amostra aria-label={`Amostra ${cor}`} className="h-32 w-40 flex-none rounded-[var(--radius-panel)] border border-platform-border" style={{ background: cor }} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span data-cores-nome className="text-[20px] font-semibold text-platform-text first-letter:uppercase">{nome}</span>
              <span data-cores-hex className="font-mono text-[15px] text-platform-text">{cor}</span>
              {corDoManual && <span className="text-[13px] text-platform-text-muted">No manual: {corDoManual.nome}</span>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" data-cores-conta-gotas onClick={contaGotas} disabled={!temContaGotas}
              className="rounded-[var(--radius-control)] bg-platform-signal px-4 py-2 text-sm font-semibold text-platform-bg disabled:opacity-40">
              Conta-gotas na tela
            </button>
            <label className="cursor-pointer rounded-[var(--radius-control)] border border-platform-border px-4 py-2 text-sm text-platform-text">
              Subir imagem
              <input data-cores-print type="file" accept="image/*" className="sr-only" onChange={(e) => abrirImagem(e.target.files?.[0])} />
            </label>
          </div>
          <p className="text-[12.5px] leading-snug text-platform-text-muted">
            {temContaGotas
              ? "O conta-gotas pega a cor de qualquer lugar da tela, inclusive de outros programas. Ou cole um print aqui (⌘V)."
              : "Este navegador não tem conta-gotas de tela (só Chrome e Edge, no computador). Tire um print, cole aqui (⌘V) e clique na cor."}
          </p>
          {imagem && (
            <div className="overflow-auto rounded-[var(--radius-control)] border border-platform-border">
              <canvas ref={canvas} data-cores-imagem onClick={pegarDoPrint} className="block max-w-full cursor-crosshair" aria-label="Clique na cor que quer medir" />
            </div>
          )}

          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); aplicarCodigo(); }}>
            <input data-cores-codigo value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ou digite: #FF4103, 255 65 3, cmyk(0 85 100 0)"
              className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-platform-border bg-platform-panel px-3 py-2 font-mono text-sm" />
            <button type="submit" className="rounded-[var(--radius-control)] border border-platform-border px-4 py-2 text-sm">Usar</button>
          </form>
          {erroDoCodigo && <p role="alert" className="text-[13px] text-platform-danger">{erroDoCodigo}</p>}

          <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 text-sm">
            <Codigo rotulo="HEX" valor={cor} />
            <Codigo rotulo="RGB" valor={`${r} ${g} ${b}`} />
            <Codigo rotulo="HSB" valor={`${hsb[0]}° ${hsb[1]}% ${hsb[2]}%`} />
            <Codigo rotulo="CMYK" valor={corDoManual?.cmyk ?? cmyk.join(" ")} dado="cmyk"
              nota={corDoManual?.cmyk ? `do manual${corDoManual.pagina ? `, p. ${corDoManual.pagina}` : ""}` : `aproximado · ${papel === "couche" ? "couché (revestido)" : "offset (não revestido)"}`} />
            {corDoManual?.pms && <Codigo rotulo="Pantone" valor={corDoManual.pms} nota={`declarado no manual${corDoManual.pagina ? `, p. ${corDoManual.pagina}` : ""}`} />}
          </dl>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-platform-text-muted">
            <span>Papel do CMYK:</span>
            {(["couche", "offset"] as const).map((p) => (
              <button key={p} type="button" data-cores-papel={p} aria-pressed={papel === p} onClick={() => setPapel(p)}
                className={`rounded-full border px-2.5 py-0.5 ${papel === p ? "border-platform-text text-platform-text" : "border-platform-border"}`}>
                {p === "couche" ? "Couché" : "Offset"}
              </button>
            ))}
          </div>
          <p className="text-[12px] leading-snug text-platform-text-muted">
            O CMYK é sempre uma conversão aproximada: para impressão, vale o CMYK do manual ou o da prova da gráfica. Pantone o Cores não sugere — a referência é o guia físico da Pantone{marca ? ", ou o que o manual declara" : ""}.
          </p>
        </section>

        {/* ─── 2. Dá para ler? ──────────────────────────────────────────── */}
        <section className={CAIXA} aria-labelledby="titulo-leitura">
          <h2 id="titulo-leitura" className={TITULO}>Dá para ler?</h2>
          <div className="flex flex-wrap gap-1.5">
            {opcoesDeTexto.map((o) => (
              <button key={o.hex} type="button" data-cores-texto={o.hex} aria-pressed={textoSobre === o.hex} onClick={() => setTextoSobre(o.hex)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] ${textoSobre === o.hex ? "border-platform-text text-platform-text" : "border-platform-border text-platform-text-muted"}`}>
                <i aria-hidden className="h-3 w-3 rounded-full border border-platform-border" style={{ background: o.hex }} />{o.rotulo}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Amostra fundo={cor} texto={textoSobre} />
            <Amostra fundo={textoSobre} texto={cor} />
          </div>
          <p data-cores-contraste className="text-sm text-platform-text">Contraste <b className="font-mono">{razao.toFixed(2).replace(".", ",")} : 1</b></p>
          <ul data-cores-veredito className="grid grid-cols-3 gap-2 text-center text-[12px]">
            <Selo rotulo="Texto pequeno" valor={v.textoPequeno} />
            <Selo rotulo="Texto grande" valor={v.textoGrande} />
            <Selo rotulo="Ícones e botões" valor={v.iconesEBotoes} />
          </ul>
          <div>
            <p className={`${ROTULO} mb-2`}>Para quem não enxerga certas cores</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DALTONISMOS) as Daltonismo[]).map((t) => (
                <figure key={t} data-cores-daltonismo={t} className="flex flex-col gap-1">
                  <Amostra fundo={simularDaltonismo(cor, t)} texto={simularDaltonismo(textoSobre, t)} pequena />
                  <figcaption className="text-[11px] leading-tight text-platform-text-muted">{DALTONISMOS[t].nome}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ─── 3. A marca ─────────────────────────────────────────────────── */}
      <section data-cores-marca className={CAIXA} aria-labelledby="titulo-marca">
        <h2 id="titulo-marca" className={TITULO}>É a cor da marca?</h2>
        {marca && comparacao ? (
          <>
            <p data-cores-comparacao className="text-[15px] font-medium text-platform-text">{fraseDaComparacao(comparacao)}</p>
            {comparacao.tipo !== "sem-paleta" && comparacao.cor.pagina && (
              <a href={marca.linkDaPagina(comparacao.cor.pagina)} className="w-fit text-[13px] text-platform-text-muted underline">Ver no manual, p. {comparacao.cor.pagina}</a>
            )}
            <div className="flex flex-wrap gap-3">
              {marca.paleta.map((c) => (
                <button key={`${c.nome}${c.hex}`} type="button" data-cores-paleta={c.hex} onClick={() => usar(c.hex)} title={`Usar ${c.nome}`}
                  className="flex w-28 flex-col gap-1 text-left">
                  <span className="h-12 w-full rounded-[var(--radius-control)] border border-platform-border" style={{ background: c.hex }} />
                  <span className="text-[12px] font-medium leading-tight text-platform-text">{c.nome}</span>
                  <span className="font-mono text-[11px] text-platform-text-muted">{c.hex.toUpperCase()}</span>
                  {c.status !== "ready" && <span className="text-[11px] text-platform-warning">rascunho</span>}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 opacity-70">
            <p className="text-[15px] text-platform-text">No Brennimark, o Cores diz se essa é a cor da sua marca — e mostra o código e o Pantone que o manual declara.</p>
            <a href="/assinar" className="w-fit text-[13px] text-platform-text-muted underline">Conhecer os planos</a>
          </div>
        )}
      </section>

      {/* ─── Histórico e exportação ─────────────────────────────────────── */}
      <section className={CAIXA} aria-labelledby="titulo-historico">
        <h2 id="titulo-historico" className={TITULO}>Cores pegas</h2>
        {historico.length === 0
          ? <p className="text-[13px] text-platform-text-muted">As cores que você pegar ficam aqui, guardadas só neste navegador.</p>
          : (
            <div data-cores-historico className="flex flex-wrap gap-2">
              {historico.map((h) => (
                <button key={h} type="button" onClick={() => setCor(h)} title={`${nomeDaCor(h)} · ${h}`}
                  className={`h-10 w-10 rounded-[var(--radius-control)] border ${h === cor ? "border-platform-text ring-2 ring-platform-text/20" : "border-platform-border"}`} style={{ background: h }} />
              ))}
            </div>
          )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-platform-text-muted">
            Levar {marca && marca.paleta.some((c) => c.status === "ready") ? "a paleta aprovada da marca" : "as cores pegas"}:
          </span>
          <Exportar rotulo="ASE (Adobe)" dado="ase" desligado={paraExportar.length === 0}
            aoClicar={() => salvarArquivo(new Blob([paletaEmAse(paraExportar) as BlobPart], { type: "application/octet-stream" }), `${baseDoArquivo}.ase`)} />
          <Exportar rotulo="CSS" dado="css" desligado={paraExportar.length === 0}
            aoClicar={() => salvarArquivo(new Blob([paletaEmCss(paraExportar)], { type: "text/css" }), `${baseDoArquivo}.css`)} />
          <Exportar rotulo="JSON" dado="json" desligado={paraExportar.length === 0}
            aoClicar={() => salvarArquivo(new Blob([paletaEmJson(paraExportar)], { type: "application/json" }), `${baseDoArquivo}.json`)} />
          <Exportar rotulo="PNG" dado="png" desligado={paraExportar.length === 0} aoClicar={() => baixarPng(paraExportar, baseDoArquivo)} />
          <Copiar rotulo="Copiar lista" texto={paletaEmTexto(paraExportar)} desligado={paraExportar.length === 0} />
        </div>
      </section>
    </div>
  );
}

// ─── Peças ───────────────────────────────────────────────────────────────

function Codigo({ rotulo, valor, nota, dado }: { rotulo: string; valor: string; nota?: string; dado?: string }) {
  return (
    <>
      <dt className={ROTULO}>{rotulo}</dt>
      <dd className="flex min-w-0 flex-col">
        <span data-cores-valor={dado ?? rotulo.toLowerCase()} className="font-mono text-platform-text">{valor}</span>
        {nota && <span className="text-[11px] text-platform-text-muted">{nota}</span>}
      </dd>
      <dd><Copiar rotulo="Copiar" texto={valor} pequeno /></dd>
    </>
  );
}

function Copiar({ rotulo, texto, pequeno, desligado }: { rotulo: string; texto: string; pequeno?: boolean; desligado?: boolean }) {
  const [feito, setFeito] = useState(false);
  async function copiar() {
    try { await navigator.clipboard.writeText(texto); } catch { /* sem permissão: nada a fazer */ }
    setFeito(true);
    setTimeout(() => setFeito(false), 1400);
  }
  return (
    <button type="button" onClick={copiar} disabled={desligado}
      className={`rounded-[var(--radius-control)] border border-platform-border text-platform-text disabled:opacity-40 ${pequeno ? "px-2 py-0.5 text-[12px]" : "px-3 py-1.5 text-[13px]"}`}>
      {feito ? "Copiado ✓" : rotulo}
    </button>
  );
}

function Exportar({ rotulo, dado, aoClicar, desligado }: { rotulo: string; dado: string; aoClicar: () => void; desligado?: boolean }) {
  return (
    <button type="button" data-cores-exportar={dado} onClick={aoClicar} disabled={desligado}
      className="rounded-[var(--radius-control)] border border-platform-border px-3 py-1.5 text-[13px] text-platform-text disabled:opacity-40">
      {rotulo}
    </button>
  );
}

function Amostra({ fundo, texto, pequena }: { fundo: string; texto: string; pequena?: boolean }) {
  return (
    <div className={`flex flex-col justify-center rounded-[var(--radius-control)] border border-platform-border ${pequena ? "h-14 px-2" : "h-24 px-3"}`} style={{ background: fundo, color: texto }}>
      <span className={pequena ? "text-[13px] font-semibold" : "text-[22px] font-semibold leading-tight"}>Aa Marca</span>
      {!pequena && <span className="text-[12px]">Texto pequeno de exemplo, para leitura.</span>}
    </div>
  );
}

function Selo({ rotulo, valor }: { rotulo: string; valor: string }) {
  const passa = valor !== "não passa";
  return (
    <li className={`flex flex-col gap-0.5 rounded-[var(--radius-control)] border px-2 py-1.5 ${passa ? "border-platform-border" : "border-platform-danger/40"}`}>
      <span className="text-platform-text-muted">{rotulo}</span>
      <b className={passa ? "text-platform-success" : "text-platform-danger"}>{valor}</b>
    </li>
  );
}

function baixarPng(cores: readonly CorNomeada[], base: string) {
  const largura = 300, altura = 380;
  const c = document.createElement("canvas");
  c.width = largura * cores.length;
  c.height = altura;
  const x = c.getContext("2d")!;
  cores.forEach((cor, i) => {
    x.fillStyle = cor.hex;
    x.fillRect(i * largura, 0, largura, 300);
    x.fillStyle = "#ffffff";
    x.fillRect(i * largura, 300, largura, 80);
    x.fillStyle = "#111111";
    x.font = "600 22px Arial, sans-serif";
    x.fillText(cor.nome.slice(0, 22), i * largura + 18, 334);
    x.font = "18px monospace";
    x.fillText(cor.hex.toUpperCase(), i * largura + 18, 362);
  });
  c.toBlob((blob) => blob && salvarArquivo(blob, `${base}.png`), "image/png");
}
