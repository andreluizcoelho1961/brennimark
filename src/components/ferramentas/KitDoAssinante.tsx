"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { carregarDesenho, type Desenho } from "@/lib/kit/desenhar-no-navegador";
import type { DesenhosDaMarca, VarianteDoKit } from "@/lib/kit/materiais-do-kit";
import {
  CHAVES_DAS_REGRAS, NOME_DA_REGRA, chavesQueFaltam, regrasParaOKit, valorLegivel, type ChaveDaRegra, type RegraDoLogo,
} from "@/lib/kit/regras";
import { KitAvulso } from "./KitAvulso";

/**
 * O Kit do ASSINANTE (10/10/2026) — "ele conhece as regras do manual e usa".
 *
 * Ao abrir: lê as regras e os desenhos dos Materiais; baixa os originais pela
 * rota do kit da biblioteca (que registra o download antes de assinar o
 * endereço); se falta regra, pede ao manual UMA vez (a IA lê as páginas e o
 * banco grava rascunho). Daí em diante é o mesmo Kit, em modo fixo.
 *
 * Só regra aprovada é aplicada em silêncio. O rascunho é aplicado, mas o
 * painel diz "lida pela IA — confira", com a página para conferir.
 */

type Estado = {
  marca: string;
  regras: RegraDoLogo[];
  desenhos: DesenhosDaMarca;
  coresDaMarca: string[];
  podeEditar: boolean;
  podeAprovar: boolean;
};

type Carregados = { logo: Desenho | null; simbolo: Desenho | null; negativo: Desenho | null };

export function KitDoAssinante() {
  const alvo = useAlvo();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [desenhos, setDesenhos] = useState<Carregados | null>(null);
  // As versões escolhidas nos Materiais: fixadas na primeira carga. Confirmar
  // ou corrigir uma regra recarrega as regras, não baixa o logo de novo.
  const [versoes, setVersoes] = useState<DesenhosDaMarca | null>(null);
  const [erro, setErro] = useState("");
  const [lendo, setLendo] = useState<"nao" | "lendo" | "feito">("nao");
  const [avisoDaLeitura, setAvisoDaLeitura] = useState("");
  const pediu = useRef(false);

  const carregar = useCallback(async () => {
    const r = await fetch(comAlvo("/api/kit/regras", alvo), { cache: "no-store" }).catch(() => null);
    const corpo = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setErro(corpo.message ?? "Não foi possível abrir o Kit agora."); return null; }
    setEstado(corpo as Estado);
    return corpo as Estado;
  }, [alvo]);

  // 1. Regras e desenhos.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await fetch(comAlvo("/api/kit/regras", alvo), { cache: "no-store" }).catch(() => null);
      const corpo = r ? await r.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (!r?.ok) setErro(corpo.message ?? "Não foi possível abrir o Kit agora.");
      else { setEstado(corpo as Estado); setVersoes((corpo as Estado).desenhos); }
    })();
    return () => { cancelado = true; };
  }, [alvo]);

  // 2. Os originais dos Materiais, cada um pela rota que registra o download.
  useEffect(() => {
    if (!versoes) return;
    let cancelado = false;
    async function original(v: VarianteDoKit | null): Promise<Desenho | null> {
      if (!v) return null;
      const r = await fetch(comAlvo("/api/assets/kit", alvo), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: v.itemId, ids: [v.id] }),
      });
      const corpo = await r.json().catch(() => ({}));
      const url = corpo?.arquivos?.[0]?.url as string | undefined;
      if (!r.ok || !url) throw new Error(corpo.message ?? "Não foi possível buscar o logo nos Materiais.");
      const blob = await (await fetch(url, { cache: "no-store" })).blob();
      return carregarDesenho(new File([blob], v.arquivo, { type: v.mime || blob.type }));
    }
    (async () => {
      try {
        const [logo, simbolo, negativo] = await Promise.all([
          original(versoes.logo), original(versoes.simbolo), original(versoes.negativo),
        ]);
        if (!cancelado) setDesenhos({ logo, simbolo, negativo });
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Não foi possível buscar o logo nos Materiais.");
      }
    })();
    return () => { cancelado = true; };
  }, [versoes, alvo]);

  // 3. Falta regra: o Kit lê o manual, uma vez por visita.
  useEffect(() => {
    if (!estado || pediu.current || chavesQueFaltam(estado.regras).length === 0) return;
    pediu.current = true;
    setLendo("lendo");
    (async () => {
      const r = await fetch(comAlvo("/api/kit/regras/ler", alvo), { method: "POST" }).catch(() => null);
      const corpo = r ? await r.json().catch(() => ({})) : {};
      if (r?.ok) {
        setEstado((atual) => (atual ? { ...atual, regras: corpo.regras ?? atual.regras } : atual));
        if (corpo.recente) setAvisoDaLeitura(corpo.message);
        else if (corpo.lidas === 0) setAvisoDaLeitura("O Kit leu o manual e não encontrou essas regras nas páginas que olhou.");
      } else {
        setAvisoDaLeitura(corpo.message ?? "Não foi possível ler o manual agora.");
      }
      setLendo("feito");
    })();
  }, [estado, alvo]);

  async function aprovar(id: string) {
    const r = await fetch(comAlvo("/api/kit/regras/aprovar", alvo), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }),
    }).catch(() => null);
    if (r?.ok) await carregar();
  }

  async function corrigir(chave: ChaveDaRegra, valor: number, pagina: number | null) {
    const r = await fetch(comAlvo("/api/kit/regras", alvo), {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chave, valor, pagina }),
    }).catch(() => null);
    const corpo = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) return corpo.message ?? "Não foi possível guardar.";
    await carregar();
    return "";
  }

  if (erro) return <p role="alert" className="m-6 text-sm text-platform-text">{erro}</p>;
  if (!estado || !desenhos) return <p data-kit-carregando className="m-6 text-sm text-platform-text-muted">Abrindo o Kit da marca…</p>;
  if (!desenhos.logo) {
    return (
      <div data-kit-sem-logo className="m-6 max-w-[40rem] rounded-[var(--radius-panel)] border border-dashed border-platform-border p-6 text-[15px] leading-relaxed text-platform-text-muted">
        Esta marca ainda não tem o logotipo nos Materiais (um item do tipo Logo, versão positiva, em SVG ou PNG). Assim que alguém cadastrar, o Kit monta todos os tamanhos a partir dele.
      </div>
    );
  }

  const aplicadas = regrasParaOKit(estado.regras);
  const fonte = (r: RegraDoLogo | undefined) =>
    r ? `do manual${r.pagina ? `, p. ${r.pagina}` : ""}${r.status === "ready" ? ", aprovada" : r.origem === "ia" ? ", lida pela IA e ainda não confirmada" : ", ainda não aprovada"}` : undefined;
  const regra = (c: ChaveDaRegra) => estado.regras.find((r) => r.chave === c);

  return (
    <KitAvulso
      fixo={{
        logo: desenhos.logo, simbolo: desenhos.simbolo, negativo: desenhos.negativo, nome: estado.marca,
        protecao: aplicadas.protecao, reducao: aplicadas.reducao,
        fontes: { protecao: fonte(regra("area_de_protecao")), logo: fonte(regra("reducao_minima_logo")), simbolo: fonte(regra("reducao_minima_simbolo")) },
        coresDaMarca: estado.coresDaMarca,
        painelDeRegras: (
          <PainelDeRegras
            regras={estado.regras} lendo={lendo === "lendo"} aviso={avisoDaLeitura}
            podeEditar={estado.podeEditar} podeAprovar={estado.podeAprovar}
            aoAprovar={aprovar} aoCorrigir={corrigir}
            linkDaPagina={(p) => alvo.workspaceSlug && alvo.brandKey ? `/w/${alvo.workspaceSlug}/b/${alvo.brandKey}/docs/original?pagina=${p}` : `/docs/original?pagina=${p}`}
          />
        ),
      }}
    />
  );
}

function PainelDeRegras({ regras, lendo, aviso, podeEditar, podeAprovar, aoAprovar, aoCorrigir, linkDaPagina }: {
  regras: RegraDoLogo[]; lendo: boolean; aviso: string; podeEditar: boolean; podeAprovar: boolean;
  aoAprovar: (id: string) => void; aoCorrigir: (c: ChaveDaRegra, v: number, p: number | null) => Promise<string>;
  linkDaPagina: (p: number) => string;
}) {
  return (
    <div data-kit-regras-do-manual className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-platform-border p-3">
      <div>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-platform-text-muted">Regras do manual</span>
        <p className="mt-1 text-[12.5px] leading-snug text-platform-text-muted">
          {lendo ? "Lendo o manual da marca…" : "O Kit aplica o que está no manual. Só a regra aprovada vale sem aviso."}
        </p>
      </div>
      {CHAVES_DAS_REGRAS.map((c) => (
        <LinhaDaRegra key={c} chave={c} regra={regras.find((r) => r.chave === c)} lendo={lendo}
          podeEditar={podeEditar} podeAprovar={podeAprovar} aoAprovar={aoAprovar} aoCorrigir={aoCorrigir} linkDaPagina={linkDaPagina} />
      ))}
      {aviso && <p className="text-[12.5px] leading-snug text-platform-text-muted">{aviso}</p>}
    </div>
  );
}

function LinhaDaRegra({ chave, regra, lendo, podeEditar, podeAprovar, aoAprovar, aoCorrigir, linkDaPagina }: {
  chave: ChaveDaRegra; regra: RegraDoLogo | undefined; lendo: boolean; podeEditar: boolean; podeAprovar: boolean;
  aoAprovar: (id: string) => void; aoCorrigir: (c: ChaveDaRegra, v: number, p: number | null) => Promise<string>;
  linkDaPagina: (p: number) => string;
}) {
  const [editando, setEditando] = useState(false);
  const area = chave === "area_de_protecao";
  const [valor, setValor] = useState("");
  const [pagina, setPagina] = useState("");
  const [erro, setErro] = useState("");

  function abrir() {
    setValor(regra ? String(area ? Math.round(regra.valor * 100) : Math.round(regra.valor)) : "");
    setPagina(regra?.pagina ? String(regra.pagina) : "");
    setErro("");
    setEditando(true);
  }
  async function guardar() {
    const n = Number(valor.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) { setErro("Digite um número."); return; }
    const motivo = await aoCorrigir(chave, area ? n / 100 : n, pagina ? Number(pagina) : null);
    if (motivo) setErro(motivo); else setEditando(false);
  }

  const situacao = !regra ? null
    : regra.status === "ready" ? { texto: "aprovada", classe: "text-platform-success" }
      : regra.origem === "ia" ? { texto: "lida pela IA — confira", classe: "text-platform-warning" }
        : { texto: "rascunho — falta aprovar", classe: "text-platform-warning" };

  return (
    <div data-kit-regra={chave} className="flex flex-col gap-1 border-t border-platform-border pt-2.5 first-of-type:border-t-0">
      <span className="text-[13px] font-medium text-platform-text">{NOME_DA_REGRA[chave]}</span>
      {editando ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input aria-label={area ? "Porcentagem da altura do logo" : "Largura mínima em px"} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
              className="w-24 rounded-[var(--radius-control)] border border-platform-border bg-platform-panel px-2 py-1 text-sm" placeholder={area ? "%" : "px"} />
            <input aria-label="Página do manual" inputMode="numeric" value={pagina} onChange={(e) => setPagina(e.target.value.replace(/\D/g, ""))}
              className="w-20 rounded-[var(--radius-control)] border border-platform-border bg-platform-panel px-2 py-1 text-sm" placeholder="pág." />
          </div>
          <div className="flex gap-3 text-[12.5px]">
            <button type="button" onClick={guardar} className="font-medium text-platform-text underline">Guardar</button>
            <button type="button" onClick={() => setEditando(false)} className="text-platform-text-muted underline">Cancelar</button>
          </div>
          {erro && <p className="text-[12px] text-platform-danger">{erro}</p>}
        </div>
      ) : regra ? (
        <>
          <span data-kit-regra-valor className="text-[13px] text-platform-text">{valorLegivel(regra)}</span>
          {regra.descricao && <span className="text-[12px] leading-snug text-platform-text-muted">“{regra.descricao}”</span>}
          <span className="flex flex-wrap items-center gap-x-2 text-[12px]">
            {regra.pagina && <a href={linkDaPagina(regra.pagina)} className="text-platform-text-muted underline">manual, p. {regra.pagina}</a>}
            {situacao && <span data-kit-regra-situacao className={situacao.classe}>{situacao.texto}</span>}
          </span>
          <span className="flex gap-3 text-[12.5px]">
            {podeAprovar && regra.status === "draft" && <button type="button" data-kit-confirmar onClick={() => aoAprovar(regra.id)} className="font-medium text-platform-text underline">Confirmar</button>}
            {podeEditar && <button type="button" onClick={abrir} className="text-platform-text-muted underline">Corrigir</button>}
          </span>
        </>
      ) : (
        <span className="flex flex-wrap gap-x-2 text-[12.5px] text-platform-text-muted">
          {lendo ? "procurando no manual…" : "não encontrada no manual"}
          {!lendo && podeEditar && <button type="button" onClick={abrir} className="underline">Informar</button>}
        </span>
      )}
    </div>
  );
}
