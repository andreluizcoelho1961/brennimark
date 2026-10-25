"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DALTONISMOS, compararComAMarca, contraste, fraseDaComparacao, hexParaRgb, lerCodigo, nomeDaCor, paletaEmAse, paletaEmCss, paletaEmJson,
  paletaEmTexto, rgbParaCmyk, rgbParaHex, rgbParaHsb, simularDaltonismo, veredito, type CorDaMarca, type CorNomeada, type Daltonismo, type Papel,
} from "@/lib/cores/cores";
import { salvarArquivo } from "@/lib/assets/zip-no-navegador";
import { Dica } from "@/components/shell/Dica";
import { textoDaDica } from "@/components/shell/dicas";
import { useCadastroParaBaixar } from "./CadastroParaBaixar";

/** As dicas dos controles (15/10/2026): textos em `components/shell/dicas.ts`. */
const dicaDe = (chave: string) => textoDaDica(chave, false) ?? "";


/**
 * O Brennimark Cores (10/10/2026) — especificação v2.2.
 *
 * Duas camadas, um componente (decisão do André):
 *   - MEDIR, para todo mundo: conta-gotas (Chrome e Edge no computador; no
 *     Safari e no Firefox, o seletor de cores do SISTEMA — no Mac, o painel
 *     de cores tem a lupa que pega a cor de qualquer lugar da tela),
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
/** Os trechos em negrito das instruções do Mac. */
const destaque = { b: (c: React.ReactNode) => <strong className="font-medium text-platform-text">{c}</strong> };
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
  const { pedir, dialogo } = useCadastroParaBaixar("cores", { ativo: !marca });
  const t = useTranslations("ferramentas.cores");
  const [cor, setCor] = useState("#FF4103");
  const [codigo, setCodigo] = useState("");
  const [erroDoCodigo, setErroDoCodigo] = useState("");
  const [papel, setPapel] = useState<Papel>("couche");
  const [historico, setHistorico] = useState<string[]>([]);
  const [textoSobre, setTextoSobre] = useState<string>("#FFFFFF");
  const [imagem, setImagem] = useState<HTMLImageElement | null>(null);
  const [temContaGotas, setTemContaGotas] = useState(false);
  const [noMac, setNoMac] = useState(false);
  // A dica some no clique (o quadro de cores do Safari abre embaixo) e volta
  // quando o mouse sai do botão.
  const [dicaFechada, setDicaFechada] = useState(false);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // O que só existe no navegador: o histórico guardado e o conta-gotas.
  useEffect(() => {
    const h = lerHistorico();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do armazenamento do navegador
    setHistorico(h);
    if (h[0]) setCor(h[0]);
    setTemContaGotas(typeof window !== "undefined" && "EyeDropper" in window);
    setNoMac(/Mac/i.test(navigator.userAgent) && !/iPhone|iPad/i.test(navigator.userAgent) && navigator.maxTouchPoints < 2);
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

  /**
   * O seletor de cores do sistema (10/10/2026). O Safari não dá o conta-gotas
   * de tela aos sites, mas abre o painel de cores do macOS, que tem a lupa. A
   * cor muda a cada movimento no painel: a amostra acompanha na hora, e o
   * histórico só guarda depois que a pessoa para de mexer.
   */
  function doSeletor(valor: string) {
    const hex = lerCodigo(valor);
    if (!hex) return;
    setCor(hex.toUpperCase());
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => usar(hex), 700);
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
    if (!hex) { setErroDoCodigo(t("erroCodigo")); return; }
    setErroDoCodigo("");
    usar(hex);
  }

  const [r, g, b] = hexParaRgb(cor);
  const hsb = rgbParaHsb(r, g, b);
  const cmyk = rgbParaCmyk(r, g, b, papel);
  const nome = nomeDaCor(cor, t);
  const razao = contraste(cor, textoSobre);
  const v = veredito(razao);
  const comparacao = useMemo(() => (marca ? compararComAMarca(cor, marca.paleta) : null), [cor, marca]);
  const decimal = t("separadorDecimal");
  const corDoManual = comparacao && comparacao.tipo !== "sem-paleta" && comparacao.tipo !== "diferente" ? comparacao.cor : null;

  const paraExportar: CorNomeada[] = marca && marca.paleta.some((c) => c.status === "ready")
    ? marca.paleta.filter((c) => c.status === "ready").map((c) => ({ nome: c.nome, hex: c.hex }))
    : historico.map((h) => ({ nome: nomeDaCor(h, t), hex: h }));
  const baseDoArquivo = marca && marca.paleta.some((c) => c.status === "ready") ? `${t("arquivoPaleta")}-${marca.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : t("arquivoPegas");

  const opcoesDeTexto: { hex: string; rotulo: string }[] = [
    { hex: "#FFFFFF", rotulo: t("branco") }, { hex: "#000000", rotulo: t("preto") },
    ...historico.filter((h) => h !== cor).slice(0, 3).map((h) => ({ hex: h, rotulo: h })),
    ...(marca?.paleta.filter((c) => c.status === "ready" && c.hex.toUpperCase() !== cor).slice(0, 4).map((c) => ({ hex: c.hex.toUpperCase(), rotulo: c.nome })) ?? []),
  ].filter((o, i, todas) => todas.findIndex((x) => x.hex === o.hex) === i);

  return (
    <div data-cores className="flex flex-col gap-6 p-6">
      {dialogo}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* ─── 1. A cor da vez ───────────────────────────────────────────── */}
        <section className={CAIXA} aria-labelledby="titulo-cor">
          <h2 id="titulo-cor" className={TITULO}>{t("titulos.cor")}</h2>
          <div className="flex flex-wrap items-stretch gap-4">
            <div data-cores-amostra aria-label={t("amostraAria", { cor })} className="h-32 w-40 flex-none rounded-[var(--radius-panel)] border border-platform-border" style={{ background: cor }} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span data-cores-nome className="text-[20px] font-semibold text-platform-text first-letter:uppercase">{nome}</span>
              <span data-cores-hex className="font-mono text-[15px] text-platform-text">{cor}</span>
              {corDoManual && <span className="text-[13px] text-platform-text-muted">{t("noManual", { nome: corDoManual.nome })}</span>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {temContaGotas ? (
              <Dica texto={dicaDe("cores-conta-gotas")} lado="cima"><button type="button" data-cores-conta-gotas onClick={contaGotas}
                className="rounded-[var(--radius-control)] bg-platform-signal px-4 py-2 text-sm font-semibold text-platform-bg">
                {t("contaGotas")}
              </button></Dica>
            ) : (
              <label onMouseLeave={() => setDicaFechada(false)} className="group relative cursor-pointer rounded-[var(--radius-control)] bg-platform-signal px-4 py-2 text-sm font-semibold text-platform-bg focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-platform-signal">
                {noMac ? t("contaGotasMac") : t("seletor")}
                {/* Transparente por cima do botão: o clique é da pessoa, e é o que o navegador exige para abrir o seletor. */}
                <input data-cores-seletor-do-sistema type="color" value={cor.toLowerCase()} onChange={(e) => doSeletor(e.target.value)}
                  onPointerDown={() => setDicaFechada(true)} onBlur={() => setDicaFechada(false)}
                  aria-describedby={noMac ? "dica-do-conta-gotas" : undefined}
                  aria-label={noMac ? t("seletorAriaMac") : t("seletorAria")}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                {noMac && (
                  // A dica (tooltip), acima do botão: aparece ao passar o mouse
                  // ou ao chegar pelo teclado (Tab).
                  <span id="dica-do-conta-gotas" role="tooltip" data-cores-dica
                    className={`pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-[300px] flex-col gap-1.5 rounded-[var(--radius-control)] bg-platform-text p-3 text-left text-[12.5px] font-normal leading-snug text-platform-bg shadow-lg ${dicaFechada ? "hidden" : "hidden group-hover:flex group-focus-within:flex"}`}>
                    <span className="font-semibold">{t("dicaMac.titulo")}</span>
                    <span>1&nbsp; {t("dicaMac.p1")}</span>
                    <span>2&nbsp; {t.rich("dicaMac.p2", { b: (c) => <strong>{c}</strong> })}</span>
                    <span>3&nbsp; {t.rich("dicaMac.p3", { b: (c) => <strong>{c}</strong> })}</span>
                  </span>
                )}
              </label>
            )}
            <Dica texto={dicaDe("cores-imagem")} lado="cima"><label className="cursor-pointer rounded-[var(--radius-control)] border border-platform-border px-4 py-2 text-sm text-platform-text">
              {t("subirImagem")}
              <input data-cores-print type="file" accept="image/*" className="sr-only" onChange={(e) => abrirImagem(e.target.files?.[0])} />
            </label></Dica>
          </div>
          {!temContaGotas && noMac ? (
            // O caminho até a lupa do macOS tem três cliques, e o segundo botão
            // muda de nome com o idioma do Mac — o André levou um tempo para
            // achar (10/10/2026). Os passos ficam escritos, um por linha.
            <ol data-cores-passos-do-mac className="flex list-none flex-col gap-1 text-[12.5px] leading-snug text-platform-text-muted">
              <li><span className="font-mono text-platform-text">1</span>&nbsp; {t.rich("passosMac.p1", destaque)}</li>
              <li><span className="font-mono text-platform-text">2</span>&nbsp; {t.rich("passosMac.p2", destaque)}</li>
              <li><span className="font-mono text-platform-text">3</span>&nbsp; {t.rich("passosMac.p3", destaque)}</li>
              <li className="pt-1">{t("passosMac.colar")}</li>
            </ol>
          ) : (
            <p className="text-[12.5px] leading-snug text-platform-text-muted">
              {temContaGotas ? t("dicaComContaGotas") : t("dicaSemContaGotas")}
            </p>
          )}
          {imagem && (
            <div className="overflow-auto rounded-[var(--radius-control)] border border-platform-border">
              <canvas ref={canvas} data-cores-imagem onClick={pegarDoPrint} className="block max-w-full cursor-crosshair" aria-label={t("imagemAria")} />
            </div>
          )}

          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); aplicarCodigo(); }}>
            <input data-cores-codigo value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder={t("codigoPlaceholder")}
              className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-platform-border bg-platform-panel px-3 py-2 font-mono text-sm" />
            <button type="submit" className="rounded-[var(--radius-control)] border border-platform-border px-4 py-2 text-sm">{t("usar")}</button>
          </form>
          {erroDoCodigo && <p role="alert" className="text-[13px] text-platform-danger">{erroDoCodigo}</p>}

          <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 text-sm">
            <Codigo rotulo="HEX" valor={cor} />
            <Codigo rotulo="RGB" valor={`${r} ${g} ${b}`} />
            <Codigo rotulo="HSB" valor={`${hsb[0]}° ${hsb[1]}% ${hsb[2]}%`} />
            <Codigo rotulo="CMYK" valor={corDoManual?.cmyk ?? cmyk.join(" ")} dado="cmyk"
              nota={corDoManual?.cmyk
                ? (corDoManual.pagina ? t("cmyk.doManualPagina", { n: corDoManual.pagina }) : t("cmyk.doManual"))
                : t("cmyk.aproximado", { papel: papel === "couche" ? t("cmyk.papelCouche") : t("cmyk.papelOffset") })} />
            {corDoManual?.pms && <Codigo rotulo="Pantone" valor={corDoManual.pms} nota={corDoManual.pagina ? t("cmyk.pantonePagina", { n: corDoManual.pagina }) : t("cmyk.pantone")} />}
          </dl>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-platform-text-muted">
            <span>{t("papelDoCmyk")}</span>
            {(["couche", "offset"] as const).map((p) => (
              <button key={p} type="button" data-cores-papel={p} aria-pressed={papel === p} onClick={() => setPapel(p)}
                className={`rounded-full border px-2.5 py-0.5 ${papel === p ? "border-platform-text text-platform-text" : "border-platform-border"}`}>
                {p === "couche" ? t("couche") : t("offset")}
              </button>
            ))}
          </div>
          <p className="text-[12px] leading-snug text-platform-text-muted">
            {marca ? t("notaCmykComMarca") : t("notaCmyk")}
          </p>
        </section>

        {/* ─── 2. Dá para ler? ──────────────────────────────────────────── */}
        <section className={CAIXA} aria-labelledby="titulo-leitura">
          <h2 id="titulo-leitura" className={TITULO}>{t("titulos.leitura")}</h2>
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
          <Dica texto={dicaDe("cores-contraste")} lado="cima"><p data-cores-contraste className="text-sm text-platform-text">{t("contraste")} <b className="font-mono">{razao.toFixed(2).replace(".", decimal)} : 1</b></p></Dica>
          <ul data-cores-veredito className="grid grid-cols-3 gap-2 text-center text-[12px]">
            <Selo rotulo={t("selos.textoPequeno")} valor={v.textoPequeno} />
            <Selo rotulo={t("selos.textoGrande")} valor={v.textoGrande} />
            <Selo rotulo={t("selos.iconesEBotoes")} valor={v.iconesEBotoes} />
          </ul>
          <div>
            <Dica texto={dicaDe("cores-daltonismo")} lado="cima"><p className={`${ROTULO} mb-2`}>{t("daltonismoTitulo")}</p></Dica>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DALTONISMOS) as Daltonismo[]).map((tipo) => (
                <figure key={tipo} data-cores-daltonismo={tipo} className="flex flex-col gap-1">
                  <Amostra fundo={simularDaltonismo(cor, tipo)} texto={simularDaltonismo(textoSobre, tipo)} pequena />
                  <figcaption className="text-[11px] leading-tight text-platform-text-muted">{t(`daltonismo.${tipo}`)}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ─── 3. A marca ─────────────────────────────────────────────────── */}
      <section data-cores-marca className={CAIXA} aria-labelledby="titulo-marca">
        <Dica texto={dicaDe("cores-comparar")} lado="cima"><h2 id="titulo-marca" className={TITULO}>{t("titulos.marca")}</h2></Dica>
        {marca && comparacao ? (
          <>
            <p data-cores-comparacao className="text-[15px] font-medium text-platform-text">{fraseDaComparacao(comparacao, t)}</p>
            {comparacao.tipo !== "sem-paleta" && comparacao.cor.pagina && (
              <a href={marca.linkDaPagina(comparacao.cor.pagina)} className="w-fit text-[13px] text-platform-text-muted underline">{t("verNoManual", { n: comparacao.cor.pagina })}</a>
            )}
            <div className="flex flex-wrap gap-3">
              {marca.paleta.map((c) => (
                <button key={`${c.nome}${c.hex}`} type="button" data-cores-paleta={c.hex} onClick={() => usar(c.hex)} title={t("usarCor", { nome: c.nome })}
                  className="flex w-28 flex-col gap-1 text-left">
                  <span className="h-12 w-full rounded-[var(--radius-control)] border border-platform-border" style={{ background: c.hex }} />
                  <span className="text-[12px] font-medium leading-tight text-platform-text">{c.nome}</span>
                  <span className="font-mono text-[11px] text-platform-text-muted">{c.hex.toUpperCase()}</span>
                  {c.status !== "ready" && <span className="text-[11px] text-platform-warning">{t("rascunho")}</span>}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 opacity-70">
            <p className="text-[15px] text-platform-text">{t("semMarca")}</p>
            <Link href="/assinar" prefetch={false} className="w-fit text-[13px] text-platform-text-muted underline">{t("conhecerPlanos")}</Link>
          </div>
        )}
      </section>

      {/* ─── Histórico e exportação ─────────────────────────────────────── */}
      <section className={CAIXA} aria-labelledby="titulo-historico">
        <h2 id="titulo-historico" className={TITULO}>{t("titulos.historico")}</h2>
        {historico.length === 0
          ? <p className="text-[13px] text-platform-text-muted">{t("historicoVazio")}</p>
          : (
            <div data-cores-historico className="flex flex-wrap gap-2">
              {historico.map((h) => (
                <button key={h} type="button" onClick={() => setCor(h)} title={`${nomeDaCor(h, t)} · ${h}`}
                  className={`h-10 w-10 rounded-[var(--radius-control)] border ${h === cor ? "border-platform-text ring-2 ring-platform-text/20" : "border-platform-border"}`} style={{ background: h }} />
              ))}
            </div>
          )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-platform-text-muted">
            {marca && marca.paleta.some((c) => c.status === "ready") ? t("levarPaleta") : t("levarPegas")}
          </span>
          <Exportar rotulo={t("ase")} dado="ase" desligado={paraExportar.length === 0}
            aoClicar={() => pedir(() => salvarArquivo(new Blob([paletaEmAse(paraExportar) as BlobPart], { type: "application/octet-stream" }), `${baseDoArquivo}.ase`))} />
          <Exportar rotulo="CSS" dado="css" desligado={paraExportar.length === 0}
            aoClicar={() => pedir(() => salvarArquivo(new Blob([paletaEmCss(paraExportar)], { type: "text/css" }), `${baseDoArquivo}.css`))} />
          <Exportar rotulo="JSON" dado="json" desligado={paraExportar.length === 0}
            aoClicar={() => pedir(() => salvarArquivo(new Blob([paletaEmJson(paraExportar)], { type: "application/json" }), `${baseDoArquivo}.json`))} />
          <Exportar rotulo="PNG" dado="png" desligado={paraExportar.length === 0} aoClicar={() => pedir(() => baixarPng(paraExportar, baseDoArquivo))} />
          <Copiar rotulo={t("copiarLista")} texto={paletaEmTexto(paraExportar)} desligado={paraExportar.length === 0} />
        </div>
      </section>
    </div>
  );
}

// ─── Peças ───────────────────────────────────────────────────────────────

function Codigo({ rotulo, valor, nota, dado }: { rotulo: string; valor: string; nota?: string; dado?: string }) {
  const t = useTranslations("ferramentas.cores");
  return (
    <>
      <dt className={ROTULO}>{rotulo}</dt>
      <dd className="flex min-w-0 flex-col">
        <span data-cores-valor={dado ?? rotulo.toLowerCase()} className="font-mono text-platform-text">{valor}</span>
        {nota && <span className="text-[11px] text-platform-text-muted">{nota}</span>}
      </dd>
      <dd><Copiar rotulo={t("copiar")} texto={valor} pequeno /></dd>
    </>
  );
}

function Copiar({ rotulo, texto, pequeno, desligado }: { rotulo: string; texto: string; pequeno?: boolean; desligado?: boolean }) {
  const t = useTranslations("ferramentas.cores");
  const [feito, setFeito] = useState(false);
  async function copiar() {
    try { await navigator.clipboard.writeText(texto); } catch { /* sem permissão: nada a fazer */ }
    setFeito(true);
    setTimeout(() => setFeito(false), 1400);
  }
  return (
    <Dica texto={dicaDe("cores-copiar")} lado="cima"><button type="button" onClick={copiar} disabled={desligado}
      className={`rounded-[var(--radius-control)] border border-platform-border text-platform-text disabled:opacity-40 ${pequeno ? "px-2 py-0.5 text-[12px]" : "px-3 py-1.5 text-[13px]"}`}>
      {feito ? t("copiado") : rotulo}
    </button></Dica>
  );
}

function Exportar({ rotulo, dado, aoClicar, desligado }: { rotulo: string; dado: string; aoClicar: () => void; desligado?: boolean }) {
  return (
    <Dica texto={dicaDe("cores-exportar")} lado="cima"><button type="button" data-cores-exportar={dado} onClick={aoClicar} disabled={desligado}
      className="rounded-[var(--radius-control)] border border-platform-border px-3 py-1.5 text-[13px] text-platform-text disabled:opacity-40">
      {rotulo}
    </button></Dica>
  );
}

function Amostra({ fundo, texto, pequena }: { fundo: string; texto: string; pequena?: boolean }) {
  const t = useTranslations("ferramentas.cores");
  return (
    <div className={`flex flex-col justify-center rounded-[var(--radius-control)] border border-platform-border ${pequena ? "h-14 px-2" : "h-24 px-3"}`} style={{ background: fundo, color: texto }}>
      <span className={pequena ? "text-[13px] font-semibold" : "text-[22px] font-semibold leading-tight"}>{t("amostra.titulo")}</span>
      {!pequena && <span className="text-[12px]">{t("amostra.texto")}</span>}
    </div>
  );
}

function Selo({ rotulo, valor }: { rotulo: string; valor: string }) {
  const t = useTranslations("ferramentas.cores");
  const passa = valor !== "falha";
  return (
    <li className={`flex flex-col gap-0.5 rounded-[var(--radius-control)] border px-2 py-1.5 ${passa ? "border-platform-border" : "border-platform-danger/40"}`}>
      <span className="text-platform-text-muted">{rotulo}</span>
      <b className={passa ? "text-platform-success" : "text-platform-danger"}>{t(`veredito.${valor}`)}</b>
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
