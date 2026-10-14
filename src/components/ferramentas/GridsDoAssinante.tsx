"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { Grids, type ContextoDoGrid, type ModoMarca } from "./Grids";
import type { Formato } from "@/lib/grids/formatos";
import { aplicarRegras, fraseDaOrigem, regraDasEscolhas, type RegraDeGrid } from "@/lib/grids/regras";
import {
  CANTOS, coresParaODocumento, estilosDoFormato, larguraPadraoDoLogo, leiaMeDoGrid, linhasDosEstilos, margensComProtecao, posicionarLogo,
  type Canto, type CorDaPaleta,
} from "@/lib/grids/marca";
import { medirLogo, montarPacoteDoGrid, nomeNosLinks, type LogoMedido } from "@/lib/grids/logo-no-navegador";
import { formatar, type Escolhas } from "@/lib/grids/calcular";
import { nomeDaVariante, type VarianteDoKit } from "@/lib/kit/materiais-do-kit";
import { salvarArquivo } from "@/lib/assets/zip-no-navegador";
import type { FonteDaMarca } from "@/lib/tipografia/tipografia";

/**
 * O Grids do ASSINANTE (14/10/2026) — "o documento pronto para diagramar, com
 * as regras do manual".
 *
 * Ao abrir: lê as regras de grid, o logo dos Materiais, a paleta aprovada e as
 * regras do logo; baixa o original do logo pela rota do kit da biblioteca (que
 * registra o download antes de assinar o endereço) e o mede como o InDesign
 * vai enxergá-lo; se a marca não tem regra de grid nenhuma, pede ao manual UMA
 * vez (a IA lê as páginas, o banco grava rascunho).
 *
 * De onde vem o grid de cada formato: regra do formato > regra geral >
 * proposta do Brennimark — e a tela diz qual, com página e situação. Só regra
 * aprovada vale em silêncio (ADR-0004 §3.2). A fonte dos estilos vem da
 * tipografia APROVADA da marca (14/10/2026); a tela diz qual entrou.
 */

type Estado = {
  marca: string;
  regras: RegraDeGrid[];
  versoesDoLogo: VarianteDoKit[];
  foraDoInDesign: string[];
  paleta: CorDaPaleta[];
  coresEmRascunho: number;
  /** A tipografia APROVADA da marca (14/10/2026): a fonte dos estilos. */
  tipografia?: FonteDaMarca[];
  fontesEmRascunho?: number;
  regrasDoLogo: { protecao: number; reducao: { logo: number | null } };
  podeEditar: boolean;
  podeAprovar: boolean;
};

type LogoCarregado = { id: string; medido: LogoMedido; bytes: Uint8Array; nome: string; versao: string };

const ROTULO = "font-mono text-[11px] uppercase tracking-[0.08em] text-platform-text-muted";
const PASSO = "font-display text-[17px] font-semibold tracking-tight text-platform-text";
const CAMPO = "w-full rounded-[var(--radius-control)] border border-platform-border bg-platform-panel px-3 py-2 text-sm text-platform-text";
const BOTAO_LINK = "text-[12.5px] font-medium text-platform-text underline";

const iguais = (a: Escolhas, b: Escolhas) => JSON.stringify(a) === JSON.stringify(b);

export function GridsDoAssinante() {
  const alvo = useAlvo();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [versaoId, setVersaoId] = useState<string | null>(null);
  const [logo, setLogo] = useState<LogoCarregado | null>(null);
  const [erroDoLogo, setErroDoLogo] = useState("");
  const [canto, setCanto] = useState<Canto>("inf-esq");
  const [baixando, setBaixando] = useState(false);
  const [lendo, setLendo] = useState<"nao" | "lendo" | "feito">("nao");
  const [avisoDaLeitura, setAvisoDaLeitura] = useState("");
  const [recado, setRecado] = useState("");
  // A leitura do manual trouxe regras: a tela recomeça uma vez, com elas.
  const [geracao, setGeracao] = useState(0);
  const pediu = useRef(false);
  const baixados = useRef(new Map<string, Promise<LogoCarregado>>());

  // 1. Regras e dados da marca.
  const carregar = useCallback(async () => {
    const r = await fetch(comAlvo("/api/grids/regras", alvo), { cache: "no-store" }).catch(() => null);
    const corpo = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setErro(corpo.message ?? "Não foi possível abrir os Grids agora."); return null; }
    return corpo as Estado;
  }, [alvo]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const e = await carregar();
      if (cancelado || !e) return;
      setEstado(e);
      setVersaoId((v) => v ?? e.versoesDoLogo[0]?.id ?? null);
    })();
    return () => { cancelado = true; };
  }, [carregar]);

  // 2. O original do logo, pela rota que registra o download, medido aqui.
  useEffect(() => {
    if (!estado || !versaoId) return;
    const v = estado.versoesDoLogo.find((x) => x.id === versaoId);
    if (!v) return;
    let cancelado = false;
    let pronto = baixados.current.get(v.id);
    if (!pronto) {
      pronto = (async () => {
        const r = await fetch(comAlvo("/api/assets/kit", alvo), {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: v.itemId, ids: [v.id] }),
        });
        const corpo = await r.json().catch(() => ({}));
        const url = corpo?.arquivos?.[0]?.url as string | undefined;
        if (!r.ok || !url) throw new Error(corpo.message ?? "Não foi possível buscar o logo nos Materiais.");
        const bytes = new Uint8Array(await (await fetch(url, { cache: "no-store" })).arrayBuffer());
        const medido = await medirLogo(bytes, v.arquivo, v.mime);
        return { id: v.id, medido, bytes, nome: nomeNosLinks(v.arquivo), versao: nomeDaVariante(v) };
      })();
      pronto.catch(() => baixados.current.delete(v.id));
      baixados.current.set(v.id, pronto);
    }
    pronto.then((l) => { if (!cancelado) { setLogo(l); setErroDoLogo(""); } })
      .catch((e) => { if (!cancelado) setErroDoLogo(e instanceof Error ? e.message : "Não foi possível abrir o logo."); });
    return () => { cancelado = true; };
  }, [estado, versaoId, alvo]);

  // 3. Sem regra de grid nenhuma: pede ao manual, uma vez por visita.
  useEffect(() => {
    if (!estado || pediu.current || estado.regras.length > 0) return;
    pediu.current = true;
    setLendo("lendo");
    (async () => {
      const r = await fetch(comAlvo("/api/grids/regras/ler", alvo), { method: "POST" }).catch(() => null);
      const corpo = r ? await r.json().catch(() => ({})) : {};
      if (r?.ok) {
        if (Array.isArray(corpo.regras) && corpo.regras.length) {
          setEstado((a) => (a ? { ...a, regras: corpo.regras } : a));
          setGeracao((g) => g + 1);
        }
        if (corpo.message) setAvisoDaLeitura(corpo.message);
        else if (corpo.lidas === 0) setAvisoDaLeitura("O Brennimark leu o manual e não encontrou regras de grid nas páginas que olhou. Vale a proposta do Brennimark.");
        else setAvisoDaLeitura(`O Brennimark leu o grid de ${corpo.lidas} ${corpo.lidas === 1 ? "formato" : "formatos"} no manual (p. ${(corpo.paginas ?? []).join(", ")}). Confira antes de aprovar.`);
      } else {
        setAvisoDaLeitura(corpo.message ?? "Não foi possível ler o manual agora.");
      }
      setLendo("feito");
    })();
  }, [estado, alvo]);

  const recarregarRegras = useCallback(async () => {
    const e = await carregar();
    if (e) setEstado((a) => (a ? { ...a, regras: e.regras } : e));
  }, [carregar]);

  async function aprovar(id: string) {
    setRecado("");
    const r = await fetch(comAlvo("/api/grids/regras/aprovar", alvo), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }),
    }).catch(() => null);
    if (r?.ok) { await recarregarRegras(); setRecado("Regra aprovada."); } else setRecado("Não foi possível aprovar agora.");
  }

  async function guardar(f: Formato, e: Escolhas, atual: RegraDeGrid | undefined) {
    setRecado("");
    const r = await fetch(comAlvo("/api/grids/regras", alvo), {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(regraDasEscolhas(f, e, { descricao: atual?.descricao, pagina: atual?.pagina ?? null })),
    }).catch(() => null);
    const corpo = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) { await recarregarRegras(); setRecado("Grid guardado como regra deste formato — em rascunho até alguém aprovar."); }
    else setRecado(corpo.message ?? "Não foi possível guardar.");
  }

  const modo: ModoMarca | null = useMemo(() => {
    if (!estado) return null;
    const regras = estado.regras;
    const protecao = estado.regrasDoLogo.protecao;
    const posicao = ({ grid }: ContextoDoGrid) => logo
      ? posicionarLogo(grid, { largura: larguraPadraoDoLogo(grid), aspecto: logo.medido.aspecto, canto, protecao, reducaoMinimaPx: estado.regrasDoLogo.reducao.logo })
      : null;
    return {
      aplicar: (f) => aplicarRegras(f, regras).escolhas,
      origem: (f, e) => {
        const a = aplicarRegras(f, regras);
        return iguais(a.escolhas, e) ? fraseDaOrigem(a.origem) : "ajustado na tela — ainda não guardado como regra da marca";
      },
      sobrePrevia: (c) => {
        const p = posicao(c);
        if (!p || !logo) return null;
        const fino = Math.max(c.grid.largura, c.grid.altura) / 900;
        return (
          <g data-grids-logo-previa>
            {p.protecao && <rect x={p.protecao.x} y={p.protecao.y} width={p.protecao.w} height={p.protecao.h} fill="none" stroke="#e62626" strokeWidth={fino} strokeDasharray={`${fino * 4} ${fino * 3}`} />}
            <image href={logo.medido.previa} x={p.quadro.x} y={p.quadro.y} width={p.quadro.w} height={p.quadro.h} preserveAspectRatio="xMidYMid meet" />
          </g>
        );
      },
      secao: (c) => {
        const p = posicao(c);
        const regra = regras.find((r) => r.formato === c.formato.id);
        const geral = regras.find((r) => r.formato === "todos");
        const valendo = regra ?? geral;
        const impresso = c.formato.unidade === "mm";
        const { cores, notas } = coresParaODocumento(estado.paleta, impresso);
        return (
          <section data-grids-marca className="flex flex-col gap-4">
            <div>
              <p className={ROTULO}>A marca no documento</p>
              <h2 className={PASSO}>{estado.marca}</h2>
            </div>

            <div data-grids-regras className="flex flex-col gap-1.5 rounded-[var(--radius-panel)] border border-platform-border p-3">
              <span className="text-[13px] font-medium text-platform-text">Regra de grid deste formato</span>
              {lendo === "lendo" && <span data-grids-lendo className="text-[12.5px] text-platform-text-muted">Lendo o grid no manual da marca…</span>}
              {valendo ? (
                <>
                  <span data-grids-regra-situacao className="text-[12.5px] text-platform-text">{fraseDaOrigem({ tipo: "regra", regra: valendo, geral: !regra })}</span>
                  {valendo.descricao && <span className="text-[12px] leading-snug text-platform-text-muted">“{valendo.descricao}”</span>}
                  {estado.podeAprovar && valendo.status === "draft" && (
                    <button type="button" data-grids-confirmar onClick={() => aprovar(valendo.id)} className={`self-start ${BOTAO_LINK}`}>Confirmar esta regra</button>
                  )}
                </>
              ) : (
                <span className="text-[12.5px] text-platform-text-muted">O manual não define o grid deste formato — vale a proposta do Brennimark.</span>
              )}
              {estado.podeEditar && (
                <button type="button" data-grids-guardar onClick={() => guardar(c.formato, c.escolhas, regra)} className={`self-start ${BOTAO_LINK}`}>
                  Guardar este grid como regra deste formato
                </button>
              )}
              {avisoDaLeitura && <span className="text-[12px] leading-snug text-platform-text-muted">{avisoDaLeitura}</span>}
              {recado && <span role="status" className="text-[12px] text-platform-text">{recado}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-platform-text">Logo</span>
              {estado.versoesDoLogo.length === 0 ? (
                <span data-grids-sem-logo className="text-[12.5px] leading-snug text-platform-text-muted">
                  A marca não tem logotipo nos Materiais em formato que o InDesign coloque (PDF, AI, SVG, PNG ou JPG).
                  {estado.foraDoInDesign.length > 0 && ` Há ${estado.foraDoInDesign.join(", ")}: exporte em PDF ou SVG e envie nos Materiais.`}
                </span>
              ) : (
                <>
                  {estado.versoesDoLogo.length > 1 && (
                    <select data-grids-versao className={CAMPO} value={versaoId ?? ""} onChange={(e) => setVersaoId(e.target.value)}>
                      {estado.versoesDoLogo.map((v) => <option key={v.id} value={v.id}>{nomeDaVariante(v)}</option>)}
                    </select>
                  )}
                  <select data-grids-canto className={CAMPO} value={canto} onChange={(e) => setCanto(e.target.value as Canto)} aria-label="Canto do logo">
                    {CANTOS.map((k) => <option key={k.id} value={k.id}>Logo no canto {k.nome.toLowerCase()}</option>)}
                  </select>
                  {!logo && !erroDoLogo && <span className="text-[12px] text-platform-text-muted">Abrindo o logo dos Materiais…</span>}
                  {erroDoLogo && <span role="alert" className="text-[12.5px] text-platform-text">{erroDoLogo}</span>}
                  {logo && (
                    <span data-grids-logo className="text-[12px] leading-snug text-platform-text-muted">
                      {logo.versao}. {protecao > 0 ? `Área de proteção: ${Math.round(protecao * 100)}% da altura do logo.` : "Sem área de proteção registrada (Kit da marca)."}
                    </span>
                  )}
                  {p?.avisos.map((a) => <span key={a} data-grids-aviso-logo className="text-[12.5px] leading-snug text-platform-text">{a}</span>)}
                  {p?.margemNecessaria && (
                    <button type="button" data-grids-ajustar-margens className={`self-start ${BOTAO_LINK}`}
                      onClick={() => c.mudar({ margens: margensComProtecao(c.escolhas, c.formato, canto, p.margemNecessaria!) })}>
                      Ajustar as margens à área de proteção ({formatar(p.margemNecessaria, c.grid.unidade)})
                    </button>
                  )}
                </>
              )}
            </div>

            <div data-grids-cores className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-platform-text">Cores {impresso ? "(CMYK do manual)" : "(RGB)"}</span>
              {cores.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {cores.map((cor) => (
                    <span key={cor.nome} title={cor.nome} className="flex items-center gap-1.5 rounded-full border border-platform-border px-2 py-1 text-[11.5px] text-platform-text">
                      <span className="h-3 w-3 rounded-full border border-platform-border" style={{ background: `rgb(${cor.rgb.join(",")})` }} />
                      {cor.nome.split(" — ")[0]}
                    </span>
                  ))}
                </div>
              ) : <span className="text-[12.5px] text-platform-text-muted">A paleta ainda não tem cores aprovadas.</span>}
              {notas.map((n) => <span key={n} className="text-[12px] leading-snug text-platform-text-muted">{n}</span>)}
              {estado.coresEmRascunho > 0 && <span className="text-[12px] text-platform-text-muted">{estado.coresEmRascunho === 1 ? "1 cor em rascunho não entra até ser aprovada." : `${estado.coresEmRascunho} cores em rascunho não entram até serem aprovadas.`}</span>}
            </div>

            <div data-grids-fontes className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-platform-text">Estilos de texto</span>
              {(estado.tipografia ?? []).length === 0 && (
                <span className="text-[12.5px] leading-snug text-platform-text-muted">A tipografia da marca ainda não tem fonte aprovada: os estilos saem no corpo e na entrelinha do grid, com a fonte padrão do InDesign.</span>
              )}
              {linhasDosEstilos(estilosDoFormato(c.formato, c.escolhas, estado.tipografia ?? [])).map((l) => (
                <span key={l} data-grids-estilo className="text-[12px] leading-snug text-platform-text-muted">{l}</span>
              ))}
              {(estado.fontesEmRascunho ?? 0) > 0 && (
                <span className="text-[12px] text-platform-text-muted">{estado.fontesEmRascunho === 1 ? "1 fonte em rascunho não entra até ser aprovada." : `${estado.fontesEmRascunho} fontes em rascunho não entram até serem aprovadas.`}</span>
              )}
            </div>
          </section>
        );
      },
      baixar: async (c) => {
        setBaixando(true);
        try {
          const p = posicao(c);
          const a = aplicarRegras(c.formato, regras);
          const origemDoGrid = iguais(a.escolhas, c.escolhas) ? fraseDaOrigem(a.origem) : `ajustado na tela a partir de: ${fraseDaOrigem(a.origem)}`;
          const { cores, notas } = coresParaODocumento(estado.paleta, c.formato.unidade === "mm");
          const marca = {
            origemDoGrid,
            logo: logo && p ? { arquivo: logo.nome, formato: logo.medido.formato, limites: logo.medido.limites, quadro: p.quadro, protecao: p.protecao } : null,
            cores,
            estilos: estilosDoFormato(c.formato, c.escolhas, estado.tipografia ?? []),
          };
          const slug = estado.marca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "marca";
          const base = `grid-${slug}-${c.formato.id}-${c.escolhas.tipo}`;
          const leiaMe = leiaMeDoGrid({
            marca: estado.marca, formato: c.formato, origemDoGrid, tipo: c.escolhas.tipo,
            logo: logo ? { arquivo: logo.nome, versao: logo.versao, protecao: protecao > 0 ? `${Math.round(protecao * 100)}% da altura do logo` : null } : null,
            cores, notasDasCores: notas, avisos: [...c.grid.avisos, ...(p?.avisos ?? [])],
            estilos: marca.estilos, fontesEmRascunho: estado.fontesEmRascunho ?? 0,
          });
          const zip = montarPacoteDoGrid({ base, grid: c.grid, marca, logo: logo ? { nome: logo.nome, bytes: logo.bytes } : null, leiaMe });
          salvarArquivo(new Blob([zip as BlobPart], { type: "application/zip" }), `${base}.zip`);
        } finally {
          setBaixando(false);
        }
      },
      baixando,
    };
  }, [estado, logo, canto, lendo, avisoDaLeitura, recado, versaoId, erroDoLogo, baixando]); // eslint-disable-line react-hooks/exhaustive-deps

  if (erro) return <p role="alert" className="m-6 text-sm text-platform-text">{erro}</p>;
  if (!estado || !modo) return <p data-grids-carregando className="m-6 text-sm text-platform-text-muted">Abrindo os Grids da marca…</p>;
  return <Grids key={geracao} marca={modo} />;
}
