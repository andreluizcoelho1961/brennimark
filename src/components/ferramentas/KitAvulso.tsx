"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GRUPOS_DO_KIT, ITENS_DO_KIT, type Grupo, type ItemDoKit } from "@/lib/kit/tamanhos";
import { assinaturaHtml, type DadosDaAssinatura } from "@/lib/kit/pacote";
import {
  carregarDesenho, contarArquivos, desenharItem, medirItem, fundoEscuro, itensDoPacote, montarPacote, type Desenho, type Escolhas, type Fundo,
} from "@/lib/kit/desenhar-no-navegador";
import { salvarArquivo } from "@/lib/assets/zip-no-navegador";

/**
 * O Brennimark Kit, versão AVULSA (gratuita, no site) — 09/10/2026.
 *
 * A pessoa sobe o logo e baixa, num clique, todos os tamanhos do dia a dia
 * (especificação v2). Três passos numa tela só: logo, ajustes, baixar; à
 * direita, a prévia de cada grupo em contexto e a lista de arquivos.
 *
 * Esta versão não lê manual nenhum: margens padrão, ajustáveis. A versão do
 * assinante, dentro da plataforma, lê os Materiais e aplica as regras do
 * manual com citação — fatia seguinte.
 */

const ROTULO = "font-mono text-[11px] uppercase tracking-[0.08em] text-platform-text-muted";
const PASSO = "font-display text-[17px] font-semibold tracking-tight text-platform-text";
const CAMPO = "w-full rounded-[var(--radius-control)] border border-platform-border bg-platform-panel px-3 py-2 text-sm text-platform-text";
const PILULA = "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] transition-colors";

type Arquivo = "logo" | "simbolo" | "negativo";

/** Só dígitos e uma vírgula/ponto: o campo aceita "25" ou "12,5". */
function soNumero(v: string): string {
  return v.replace(/[^\d.,]/g, "").replace(/([.,].*)[.,]/g, "$1").slice(0, 6);
}
function numero(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function KitAvulso() {
  const [logo, setLogo] = useState<Desenho | null>(null);
  const [simbolo, setSimbolo] = useState<Desenho | null>(null);
  const [negativo, setNegativo] = useState<Desenho | null>(null);
  const [erro, setErro] = useState("");
  const [fundo, setFundo] = useState<Fundo>({ tipo: "branco", cor: "#0b4f9e" });
  const [margem, setMargem] = useState(14);
  const [usarSimbolo, setUsarSimbolo] = useState(true);
  const [protecao, setProtecao] = useState("");
  const [reducaoLogo, setReducaoLogo] = useState("");
  const [reducaoSimbolo, setReducaoSimbolo] = useState("");
  const [aba, setAba] = useState<Grupo>("site");
  const [nome, setNome] = useState("");
  const [dados, setDados] = useState<DadosDaAssinatura & { enderecoDoLogo: string }>({
    nome: "Seu nome", cargo: "Cargo", telefone: "(51) 0000-0000", site: "suaempresa.com.br", empresa: "", enderecoDoLogo: "",
  });
  const [gerando, setGerando] = useState<{ prontos: number; total: number } | null>(null);

  const escolhas: Escolhas | null = useMemo(
    () => (logo ? {
      logo, simbolo, negativo, fundo, margem: margem / 100, usarSimboloNosPequenos: usarSimbolo,
      protecao: numero(protecao) / 100,
      reducao: { logo: numero(reducaoLogo) || null, simbolo: numero(reducaoSimbolo) || null },
    } : null),
    [logo, simbolo, negativo, fundo, margem, usarSimbolo, protecao, reducaoLogo, reducaoSimbolo],
  );

  async function receber(tipo: Arquivo, arquivo: File | undefined) {
    if (!arquivo) return;
    setErro("");
    try {
      const d = await carregarDesenho(arquivo);
      if (tipo === "logo") {
        setLogo(d);
        if (!nome) setNome(arquivo.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/\b(logo|logotipo|marca)\b/gi, "").trim());
      }
      if (tipo === "simbolo") setSimbolo(d);
      if (tipo === "negativo") setNegativo(d);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível abrir este arquivo.");
    }
  }

  async function baixar(grupos: Grupo[]) {
    if (!escolhas) return;
    setGerando({ prontos: 0, total: itensDoPacote(grupos, escolhas).length });
    try {
      const blob = await montarPacote(grupos, escolhas, nome.trim(), { ...dados, empresa: dados.empresa || nome }, (prontos, total) => setGerando({ prontos, total }));
      const base = `kit-${(nome.trim() || "marca").toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "marca"}`;
      salvarArquivo(blob, grupos.length === 1 ? `${base}-${grupos[0]}.zip` : `${base}.zip`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível montar o pacote.");
    } finally {
      setGerando(null);
    }
  }

  const avisosDoFundo = escolhas && fundoEscuro(fundo) && !negativo
    ? ["Sobre fundo escuro, o Kit faz o logo em branco: as partes escuras viram branco e as claras deixam o fundo aparecer. Se a marca tem versão negativa própria, envie-a no passo 1."]
    : [];
  const avisosDoLogo = [...(logo?.avisos ?? []), ...(simbolo?.avisos ?? [])];
  const abaixoDaReducao = escolhas ? itensDoPacote(GRUPOS_DO_KIT.map((g) => g.id), escolhas).filter((i) => medirItem(i, escolhas).abaixoDe).length : 0;
  const totalDeArquivos = escolhas ? contarArquivos(GRUPOS_DO_KIT.map((g) => g.id), escolhas) : null;

  return (
    <div data-kit className="grid min-h-[calc(100dvh-var(--shell-topbar))] lg:grid-cols-[380px_1fr]">
      {/* ─── Passos ─────────────────────────────────────────────────────── */}
      <aside className="flex flex-col gap-8 border-platform-border p-6 lg:border-r">
        <section className="flex flex-col gap-3">
          <p className={ROTULO}>Passo 1</p>
          <h2 className={PASSO}>O logo</h2>
          <Envio rotulo="Logotipo" dica="SVG é o ideal · PNG a partir de 1024 px" atributo="logo" desenho={logo} aoEscolher={(f) => receber("logo", f)} grande />
          <details className="text-sm text-platform-text-muted">
            <summary className="cursor-pointer">Tem símbolo separado ou versão negativa?</summary>
            <div className="mt-3 flex flex-col gap-3">
              <Envio rotulo="Símbolo (opcional)" dica="usado nos ícones e perfis" atributo="simbolo" desenho={simbolo} aoEscolher={(f) => receber("simbolo", f)} aoTirar={() => setSimbolo(null)} />
              <Envio rotulo="Versão para fundo escuro (opcional)" dica="senão, o Kit faz o logo em branco" atributo="negativo" desenho={negativo} aoEscolher={(f) => receber("negativo", f)} aoTirar={() => setNegativo(null)} escuro />
            </div>
          </details>
          <label className="flex flex-col gap-1">
            <span className={ROTULO}>Nome da marca</span>
            <input data-kit-nome className={CAMPO} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Acme" />
          </label>
          {erro && <p role="alert" className="text-sm text-platform-danger">{erro}</p>}
          {avisosDoLogo.map((a) => <Aviso key={a} texto={a} />)}
        </section>

        <section className="flex flex-col gap-3">
          <p className={ROTULO}>Passo 2</p>
          <h2 className={PASSO}>Ajustes</h2>
          <div className="flex flex-col gap-2">
            <span className={ROTULO}>Fundo</span>
            <div className="flex flex-wrap gap-2">
              {([["branco", "Branco", "#ffffff"], ["escuro", "Escuro", "#111418"], ["cor", "Cor da marca", fundo.cor], ["transparente", "Transparente", ""]] as const).map(([tipo, rotulo, amostra]) => (
                <button key={tipo} type="button" data-kit-fundo={tipo} aria-pressed={fundo.tipo === tipo} onClick={() => setFundo({ ...fundo, tipo })}
                  className={`${PILULA} ${fundo.tipo === tipo ? "border-platform-text text-platform-text" : "border-platform-border text-platform-text-muted hover:text-platform-text"}`}>
                  <i aria-hidden className="h-3 w-3 rounded-full border border-platform-border" style={{ background: amostra || "repeating-conic-gradient(#999 0 25%,#ddd 0 50%) 0 0/6px 6px" }} />
                  {rotulo}
                </button>
              ))}
            </div>
            {fundo.tipo === "cor" && (
              <label className="flex items-center gap-2 text-sm text-platform-text-muted">
                <input type="color" value={fundo.cor} onChange={(e) => setFundo({ ...fundo, cor: e.target.value })} aria-label="Cor do fundo" />
                <input data-kit-cor className={`${CAMPO} w-32 font-mono`} value={fundo.cor} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && setFundo({ ...fundo, cor: e.target.value })} />
              </label>
            )}
            {fundo.tipo === "transparente" && <p className="text-[13px] text-platform-text-muted">Perfis de rede com fundo transparente ganham o fundo que a rede escolher (branco ou preto).</p>}
            {avisosDoFundo.map((a) => <Aviso key={a} texto={a} />)}
          </div>
          <label className="flex flex-col gap-1">
            <span className={ROTULO}>Margem · {margem}%</span>
            <input data-kit-margem type="range" min={4} max={30} value={margem} onChange={(e) => setMargem(+e.target.value)} />
          </label>
          {simbolo && (
            <label className="flex items-center gap-2 text-sm text-platform-text">
              <input type="checkbox" checked={usarSimbolo} onChange={(e) => setUsarSimbolo(e.target.checked)} />
              Usar o símbolo nos ícones e perfis
            </label>
          )}
          <div data-kit-regras className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-platform-border p-3">
            <div>
              <span className={ROTULO}>Regras da marca</span>
              <p className="mt-1 text-[12.5px] leading-snug text-platform-text-muted">Estão no manual da marca, nas páginas de área de proteção e redução mínima. Deixe em branco o que o manual não define.</p>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[13px] text-platform-text">Área de proteção · % da altura do logo</span>
              <input data-kit-protecao inputMode="decimal" className={CAMPO} value={protecao} onChange={(e) => setProtecao(soNumero(e.target.value))} placeholder="Ex.: 25 (um quarto da altura livre em volta)" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[13px] text-platform-text">Redução mínima do logotipo · largura em px</span>
              <input data-kit-reducao-logo inputMode="numeric" className={CAMPO} value={reducaoLogo} onChange={(e) => setReducaoLogo(soNumero(e.target.value))} placeholder="Ex.: 120" />
            </label>
            {simbolo && (
              <label className="flex flex-col gap-1">
                <span className="text-[13px] text-platform-text">Redução mínima do símbolo · largura em px</span>
                <input data-kit-reducao-simbolo inputMode="numeric" className={CAMPO} value={reducaoSimbolo} onChange={(e) => setReducaoSimbolo(soNumero(e.target.value))} placeholder="Ex.: 24" />
              </label>
            )}
          </div>
          {abaixoDaReducao > 0 && (
            <Aviso texto={`${abaixoDaReducao} arquivo(s) ficam abaixo da redução mínima que você informou — marcados na lista. Nos ícones pequenos, um símbolo separado costuma resolver.`} />
          )}
        </section>

        <section className="flex flex-col gap-3">
          <p className={ROTULO}>Passo 3</p>
          <h2 className={PASSO}>Baixar</h2>
          <button type="button" data-kit-baixar-tudo disabled={!escolhas || Boolean(gerando)} onClick={() => baixar(GRUPOS_DO_KIT.map((g) => g.id))}
            className="flex items-center justify-between rounded-[var(--radius-control)] bg-platform-signal px-4 py-3 text-sm font-semibold text-platform-bg disabled:opacity-40">
            <span>{gerando ? `Gerando… ${gerando.prontos} de ${gerando.total}` : "Baixar tudo (.zip)"}</span>
            {totalDeArquivos !== null && <span data-kit-total className="font-mono text-[11px] opacity-80">{totalDeArquivos} arquivos</span>}
          </button>
          <button type="button" data-kit-baixar-grupo disabled={!escolhas || Boolean(gerando)} onClick={() => baixar([aba])}
            className="rounded-[var(--radius-control)] border border-platform-border px-4 py-2.5 text-sm text-platform-text disabled:opacity-40">
            Só {GRUPOS_DO_KIT.find((g) => g.id === aba)!.nome.toLowerCase()}
          </button>
          <p className="rounded-[var(--radius-control)] border border-platform-border p-3 text-[13px] leading-relaxed text-platform-text-muted">
            Tudo é feito no seu computador: o logo não sai dele. No Brennimark, o Kit lê o manual da sua marca e aplica a área de proteção e a redução mínima sozinho.
          </p>
        </section>
      </aside>

      {/* ─── Prévia ─────────────────────────────────────────────────────── */}
      <section className="flex min-w-0 flex-col gap-6 p-6">
        <nav aria-label="Grupos de arquivos" className="flex flex-wrap gap-1 border-b border-platform-border">
          {GRUPOS_DO_KIT.map((g) => (
            <button key={g.id} type="button" data-kit-aba={g.id} aria-current={aba === g.id ? "true" : undefined} onClick={() => setAba(g.id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm ${aba === g.id ? "border-platform-text font-medium text-platform-text" : "border-transparent text-platform-text-muted hover:text-platform-text"}`}>
              {g.nome}
            </button>
          ))}
        </nav>
        {escolhas ? (
          <>
            <Cenas aba={aba} escolhas={escolhas} nome={nome} dados={dados} setDados={setDados} />
            <div>
              <p className={`${ROTULO} mb-3`}>Arquivos deste grupo</p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                {itensDoPacote([aba], escolhas).map((item) => <Miniatura key={item.arquivo} item={item} escolhas={escolhas} />)}
              </div>
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center rounded-[var(--radius-panel)] border border-dashed border-platform-border p-10 text-center text-platform-text-muted">
            <p className="max-w-[28rem] text-[15px] leading-relaxed">Envie o logo no passo 1. A prévia de cada arquivo aparece aqui, já no lugar onde ele vai ser usado.</p>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Peças ───────────────────────────────────────────────────────────────

function Aviso({ texto }: { texto: string }) {
  return <p data-kit-aviso className="rounded-[var(--radius-control)] border-l-2 border-platform-warning bg-platform-panel-muted px-3 py-2 text-[13px] leading-snug text-platform-text">{texto}</p>;
}

function Envio({ rotulo, dica, atributo, desenho, aoEscolher, aoTirar, grande, escuro }: {
  rotulo: string; dica: string; atributo: Arquivo; desenho: Desenho | null;
  aoEscolher: (f: File | undefined) => void; aoTirar?: () => void; grande?: boolean; escuro?: boolean;
}) {
  const [arrastando, setArrastando] = useState(false);
  const previa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const alvo = previa.current;
    if (!alvo) return;
    alvo.replaceChildren();
    if (desenho) {
      const c = desenho.fonte;
      const img = document.createElement("img");
      img.src = c.toDataURL("image/png");
      img.alt = "";
      // Altura explícita: dentro de uma grade, `max-h-full` não segura a imagem.
      img.style.maxHeight = grande ? "88px" : "48px";
      img.style.maxWidth = "100%";
      img.style.objectFit = "contain";
      alvo.appendChild(img);
    }
  }, [desenho, grande]);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => { e.preventDefault(); setArrastando(false); aoEscolher(e.dataTransfer.files[0]); }}
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-panel)] border border-dashed p-4 text-center ${arrastando ? "border-platform-text" : "border-platform-border"}`}
    >
      <input data-kit-arquivo={atributo} type="file" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => aoEscolher(e.target.files?.[0])} />
      <div ref={previa} className={`grid w-full place-items-center rounded-[var(--radius-control)] ${grande ? "h-24" : "h-14"} ${escuro ? "bg-[#111418]" : ""}`} />
      <span className="text-sm font-medium text-platform-text">{desenho ? `${rotulo} ✓` : rotulo}</span>
      <span className="text-[12px] text-platform-text-muted">{desenho ? "clique para trocar" : `arraste aqui ou clique · ${dica}`}</span>
      {desenho && aoTirar && <button type="button" onClick={(e) => { e.preventDefault(); aoTirar(); }} className="text-[12px] text-platform-text-muted underline">tirar</button>}
    </label>
  );
}

/** Um canvas desenhado num contêiner — prévia de um item, numa escala. */
function Tela({ item, escolhas, escala, className, estilo }: { item: ItemDoKit; escolhas: Escolhas; escala: number; className?: string; estilo?: React.CSSProperties }) {
  const alvo = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const c = desenharItem(item, escolhas, escala);
    if (className) c.className = className;
    Object.assign(c.style, estilo ?? {});
    alvo.current?.replaceChildren(c);
  }, [item, escolhas, escala, className, estilo]);
  return <span ref={alvo} className="contents" />;
}

function Miniatura({ item, escolhas }: { item: ItemDoKit; escolhas: Escolhas }) {
  const escala = Math.min(1, 200 / Math.max(item.largura, item.altura || item.largura));
  const xadrez = item.formato === "transparente" || escolhas.fundo.tipo === "transparente";
  const abaixoDe = medirItem(item, escolhas).abaixoDe;
  return (
    <figure data-kit-miniatura={item.arquivo} className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-platform-border bg-platform-panel p-2.5">
      <div className="grid h-28 place-items-center overflow-hidden rounded-[var(--radius-control)]"
        style={xadrez ? { background: "repeating-conic-gradient(#e3e8ea 0 25%,#fff 0 50%) 0 0/14px 14px" } : undefined}>
        <Tela item={item} escolhas={escolhas} escala={escala} className={`max-h-28 max-w-full ${item.formato === "circulo" ? "rounded-full" : ""}`} />
      </div>
      <figcaption className="flex flex-col gap-0.5">
        <b className="text-[12.5px] font-medium text-platform-text">{item.nome}</b>
        <span className="font-mono text-[11px] text-platform-text-muted">{item.largura} × {item.altura || "auto"}</span>
        {item.obs && <span className="text-[11px] leading-snug text-platform-text-muted">{item.obs}</span>}
        {abaixoDe && <span data-kit-abaixo className="text-[11px] font-medium leading-snug text-platform-warning">abaixo da redução mínima ({abaixoDe} px)</span>}
        {item.fonte.tipo === "conferido" && (
          <a href={item.fonte.url} target="_blank" rel="noreferrer" className="text-[11px] text-platform-text-muted underline">medida conferida na documentação</a>
        )}
      </figcaption>
    </figure>
  );
}

const item = (arquivo: string) => ITENS_DO_KIT.find((i) => i.arquivo === arquivo)!;

function Cena({ titulo, legenda, children }: { titulo: string; legenda: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-platform-border bg-platform-panel p-4">
      <div>
        <h3 className="text-sm font-medium text-platform-text">{titulo}</h3>
        <p className="font-mono text-[11px] text-platform-text-muted">{legenda}</p>
      </div>
      {children}
    </div>
  );
}

function Cenas({ aba, escolhas, nome, dados, setDados }: {
  aba: Grupo; escolhas: Escolhas; nome: string;
  dados: DadosDaAssinatura & { enderecoDoLogo: string };
  setDados: (d: DadosDaAssinatura & { enderecoDoLogo: string }) => void;
}) {
  const marca = nome.trim() || "Sua marca";
  const grade = "grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4";

  if (aba === "site") return (
    <div className={grade}>
      <Cena titulo="Na aba do navegador" legenda="favicon 16 · 32 · 48">
        <div className="overflow-hidden rounded-[var(--radius-control)] bg-[#dfe3e6] text-[#222]">
          <div className="flex gap-1.5 px-2 pt-2">
            <div className="flex min-w-44 items-center gap-2 rounded-t-[7px] bg-white px-3 py-1.5 text-[12px]">
              <Tela item={item("favicon-32.png")} escolhas={escolhas} escala={1} estilo={{ width: "16px", height: "16px" }} />{marca}
            </div>
            <div className="px-3 py-1.5 text-[12px] text-[#555]">Nova aba</div>
          </div>
          <div className="flex items-end gap-4 bg-white p-3">
            {(["favicon-16.png", "favicon-32.png", "favicon-48.png"] as const).map((n, i) => (
              <figure key={n} className="flex flex-col items-center gap-1 font-mono text-[10px] text-[#555]">
                <Tela item={item(n)} escolhas={escolhas} escala={1} estilo={{ width: `${[48, 64, 72][i]}px`, imageRendering: "pixelated", border: "1px solid #ddd" }} />
                {[16, 32, 48][i]} px
              </figure>
            ))}
          </div>
        </div>
      </Cena>
      <Cena titulo="Link colado no WhatsApp" legenda="imagem de compartilhamento 1200 × 630">
        <div className="rounded-[var(--radius-control)] bg-[#e7f6dc] p-2 text-[#111]">
          <Tela item={item("compartilhamento-1200x630.png")} escolhas={escolhas} escala={0.4} estilo={{ width: "100%", borderRadius: "6px", display: "block" }} />
          <b className="mt-1.5 block text-[13px]">{marca}</b>
          <small className="text-[11px] text-[#555]">{dados.site}</small>
        </div>
      </Cena>
    </div>
  );

  if (aba === "redes") return (
    <div className={grade}>
      <Cena titulo="Perfil no Instagram" legenda="recorte em círculo">
        <div className="mx-auto w-56 rounded-[26px] border-[6px] border-[#111] bg-white p-4 text-[#111]">
          <div className="flex items-center gap-3">
            <Tela item={item("instagram-perfil-1080.png")} escolhas={escolhas} escala={0.12} estilo={{ width: "64px", height: "64px", borderRadius: "50%", border: "1px solid #ddd" }} />
            <div><b className="text-[13px]">{marca.toLowerCase().replace(/\s+/g, "")}</b><small className="block text-[11px] text-[#666]">perfil da marca</small></div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-0.5">{Array.from({ length: 6 }, (_, i) => <i key={i} className="aspect-square bg-[#eee]" />)}</div>
        </div>
      </Cena>
      <Cena titulo="Página no LinkedIn" legenda="capa 1128 × 191 + logo 400">
        <div className="overflow-hidden rounded-[var(--radius-control)] border border-[#ddd] bg-white text-[#111]">
          <Tela item={item("linkedin-capa-1128x191.png")} escolhas={escolhas} escala={0.5} estilo={{ width: "100%", display: "block" }} />
          <div className="px-3.5 pb-3.5">
            <Tela item={item("linkedin-logo-400.png")} escolhas={escolhas} escala={0.2} estilo={{ width: "72px", height: "72px", marginTop: "-30px", border: "3px solid #fff", borderRadius: "4px", display: "block" }} />
            <b className="mt-1.5 block text-[15px]">{marca}</b>
            <small className="text-[11.5px] text-[#666]">Empresa · Porto Alegre</small>
          </div>
        </div>
      </Cena>
    </div>
  );

  if (aba === "endomarketing") return (
    <div className={grade}>
      <Cena titulo="Videochamada" legenda="fundo 1920 × 1080 · o centro fica livre para o rosto">
        <div className="relative aspect-video overflow-hidden rounded-[var(--radius-control)]">
          <Tela item={item("fundo-videochamada-1920x1080.png")} escolhas={escolhas} escala={0.25} estilo={{ width: "100%", height: "100%", display: "block" }} />
          <div aria-hidden className="absolute bottom-0 left-1/2 h-[72%] w-[34%] -translate-x-1/2" style={{ background: "radial-gradient(circle at 50% 28%,#c9a68a 0 17%,transparent 17.5%),radial-gradient(ellipse at 50% 100%,#2f4b58 0 48%,transparent 48.5%)" }} />
          <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[11px] text-white">{dados.nome}</span>
        </div>
      </Cena>
      <Cena titulo="Equipe no Teams" legenda="ícone de equipe 240">
        <div className="flex items-center gap-3 rounded-[var(--radius-control)] bg-[#f3f2f1] p-3 text-[#252423]">
          <Tela item={item("teams-equipe-240.png")} escolhas={escolhas} escala={0.5} estilo={{ width: "40px", height: "40px", borderRadius: "6px" }} />
          <div><b className="text-[13px]">Comunicação interna</b><small className="block text-[11px] text-[#605e5c]">{marca} · equipe</small></div>
        </div>
      </Cena>
    </div>
  );

  if (aba === "email") return <CenaDoEmail escolhas={escolhas} dados={dados} setDados={setDados} marca={marca} />;

  return (
    <Cena titulo="Para apresentação" legenda="PNG transparente, 2000 px">
      <p className="text-[13.5px] leading-relaxed text-platform-text-muted">
        Versões para fundo claro, fundo escuro e uma cor só{escolhas.logo.svg ? ", e o SVG original" : ""}.{" "}
        {escolhas.negativo ? "A versão para fundo escuro usa o arquivo negativo que você enviou." : "A versão para fundo escuro é o logo em branco feito pelo Kit; se a marca tem negativo próprio, envie-o no passo 1."}
      </p>
    </Cena>
  );
}

function CenaDoEmail({ escolhas, dados, setDados, marca }: {
  escolhas: Escolhas; marca: string;
  dados: DadosDaAssinatura & { enderecoDoLogo: string };
  setDados: (d: DadosDaAssinatura & { enderecoDoLogo: string }) => void;
}) {
  const [copiada, setCopiada] = useState(false);
  const logoDaAssinatura = useMemo(() => desenharItem(item("assinatura-logo-600.png"), escolhas).toDataURL("image/png"), [escolhas]);
  const html = assinaturaHtml({ ...dados, empresa: dados.empresa || marca }, dados.enderecoDoLogo.trim() || logoDaAssinatura);
  const caixa = useRef<HTMLDivElement>(null);

  async function copiar() {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([caixa.current?.innerText ?? ""], { type: "text/plain" }),
      })]);
    } catch {
      const r = document.createRange();
      if (caixa.current) r.selectNode(caixa.current);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(r);
      document.execCommand("copy");
    }
    setCopiada(true);
    setTimeout(() => setCopiada(false), 1800);
  }

  const campo = (chave: keyof typeof dados, rotulo: string) => (
    <label className="flex flex-col gap-1">
      <span className={ROTULO}>{rotulo}</span>
      <input data-kit-assinatura={chave} className={CAMPO} value={dados[chave]} onChange={(e) => setDados({ ...dados, [chave]: e.target.value })} />
    </label>
  );

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
      <Cena titulo="Os dados da assinatura" legenda="aparecem na prévia ao lado">
        <div className="grid gap-3">
          {campo("nome", "Nome")}{campo("cargo", "Cargo")}{campo("telefone", "Telefone")}{campo("site", "Site")}
          {campo("enderecoDoLogo", "Endereço do logo no site (opcional)")}
          <p className="text-[12px] leading-snug text-platform-text-muted">
            Para o logo aparecer para quem recebe, ele precisa estar no site da empresa: suba o <code>assinatura-logo-600.png</code> e cole o endereço acima antes de copiar.
          </p>
        </div>
      </Cena>
      <Cena titulo="A assinatura no e-mail" legenda="copie e cole no Gmail, no Outlook ou no Apple Mail">
        <div className="rounded-[var(--radius-control)] bg-white p-4 text-[13px] leading-normal text-[#222]" style={{ fontFamily: "Arial, sans-serif" }}>
          Olá, segue o material.<br />Abraço,
          <hr className="my-2.5 border-[#ddd]" />
          {/* Gerado por `assinaturaHtml`, que escapa tudo o que a pessoa digita. */}
          <div ref={caixa} data-kit-assinatura-previa dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <button type="button" data-kit-copiar onClick={copiar} className="rounded-[var(--radius-control)] border border-platform-border px-4 py-2 text-sm text-platform-text">
          {copiada ? "Copiada ✓" : "Copiar assinatura"}
        </button>
        <p className="text-[12px] leading-snug text-platform-text-muted">
          Gmail: Configurações → Ver todas → Assinatura → colar. Outlook: Configurações → Contas → Assinaturas → colar. Apple Mail: Ajustes → Assinaturas → colar e desmarcar “fonte padrão”.
        </p>
      </Cena>
    </div>
  );
}
