"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { carregarDesenho, type Desenho } from "@/lib/kit/desenhar-no-navegador";
import {
  PAPEIS, nomeDaVariante, opcoesDoPapel, type DesenhosDaMarca, type Papel, type VarianteDoKit,
} from "@/lib/kit/materiais-do-kit";
import {
  CHAVES_DAS_REGRAS, NOME_DA_REGRA, chavesQueFaltam, regrasParaOKit, valorLegivel, type ChaveDaRegra, type RegraDoLogo,
} from "@/lib/kit/regras";
import { KitAvulso } from "./KitAvulso";
import { Dica } from "@/components/shell/Dica";
import { textoDaDica } from "@/components/shell/dicas";

/** As dicas dos controles (15/10/2026): textos em `components/shell/dicas.ts`. */
const dicaDe = (chave: string) => textoDaDica(chave, false) ?? "";


/**
 * O Kit do ASSINANTE (10/10/2026) — "ele conhece as regras do manual e usa".
 *
 * Ao abrir: lê as regras e os desenhos dos Materiais; baixa os originais pela
 * rota do kit da biblioteca (que registra o download antes de assinar o
 * endereço); se falta regra, pede ao manual UMA vez (a IA lê as páginas e o
 * banco grava rascunho). Daí em diante é o mesmo Kit, em modo fixo.
 *
 * As versões (10/10/2026): o Kit escolhe a melhor de cada papel — logotipo
 * horizontal, vertical, símbolo, fundo escuro — e a pessoa pode trocar, pelas
 * miniaturas dos Materiais. Só a versão escolhida é baixada (e o download,
 * registrado); a escolha vale para a visita, não é guardada.
 *
 * Só regra aprovada é aplicada em silêncio. O rascunho é aplicado, mas o
 * painel diz "lida pela IA — confira", com a página para conferir.
 */

type Estado = {
  marca: string;
  regras: RegraDoLogo[];
  desenhos: DesenhosDaMarca;
  versoes: VarianteDoKit[];
  coresDaMarca: string[];
  /** A substituta aprovada do uso "texto" (14/10/2026): a fonte da assinatura. */
  fonteDaAssinatura?: { nome: string; origem: string } | null;
  podeEditar: boolean;
  podeAprovar: boolean;
};

type Carregados = Record<Papel, Desenho | null>;
type Escolha = Record<Papel, string | null>;

export function KitDoAssinante() {
  const alvo = useAlvo();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [desenhos, setDesenhos] = useState<Carregados | null>(null);
  // As versões dos Materiais: fixadas na primeira carga. Confirmar ou corrigir
  // uma regra recarrega as regras, não baixa o logo de novo.
  const [versoes, setVersoes] = useState<{ desenhos: DesenhosDaMarca; todas: VarianteDoKit[] } | null>(null);
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [falhas, setFalhas] = useState<Record<string, string>>({});
  const baixados = useRef(new Map<string, Promise<Desenho>>());
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
      else {
        const e = corpo as Estado;
        setEstado(e);
        setVersoes({ desenhos: e.desenhos, todas: e.versoes ?? [] });
        setEscolha({ logo: e.desenhos.logo?.id ?? null, vertical: e.desenhos.vertical?.id ?? null, simbolo: e.desenhos.simbolo?.id ?? null, negativo: e.desenhos.negativo?.id ?? null });
      }
    })();
    return () => { cancelado = true; };
  }, [alvo]);

  // 2. Os originais escolhidos, cada um pela rota que registra o download —
  // uma vez por versão: voltar a uma versão já vista não baixa de novo.
  useEffect(() => {
    if (!versoes || !escolha) return;
    let cancelado = false;
    const porId = new Map([...versoes.todas, ...PAPEIS.map((p) => versoes.desenhos[p]).filter((v): v is VarianteDoKit => Boolean(v))].map((v) => [v.id, v]));
    function original(id: string | null): Promise<Desenho | null> {
      const v = id ? porId.get(id) : undefined;
      if (!v) return Promise.resolve(null);
      let pronto = baixados.current.get(v.id);
      if (!pronto) {
        pronto = (async () => {
          const r = await fetch(comAlvo("/api/assets/kit", alvo), {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: v.itemId, ids: [v.id] }),
          });
          const corpo = await r.json().catch(() => ({}));
          const url = corpo?.arquivos?.[0]?.url as string | undefined;
          if (!r.ok || !url) throw new Error(corpo.message ?? "Não foi possível buscar o logo nos Materiais.");
          const blob = await (await fetch(url, { cache: "no-store" })).blob();
          return carregarDesenho(new File([blob], v.arquivo, { type: v.mime || blob.type }));
        })();
        // Falhou: esquece, para uma nova tentativa não reaproveitar o erro.
        pronto.catch(() => baixados.current.delete(v.id));
        baixados.current.set(v.id, pronto);
      }
      return pronto;
    }
    (async () => {
      const prontos = await Promise.all(PAPEIS.map(async (p) => {
        try { return [p, await original(escolha[p]), null] as const; }
        catch (e) { return [p, null, e instanceof Error ? e.message : "Não foi possível abrir esta versão."] as const; }
      }));
      if (cancelado) return;
      const erros = prontos.filter(([, , e]) => e);
      if (erros.length) {
        // A versão que não abre fica apagada na escolha, com o motivo, e o
        // papel volta ao automático (ou a "não usar").
        setFalhas((f) => ({ ...f, ...Object.fromEntries(erros.map(([p, , e]) => [escolha[p]!, e!])) }));
        const logoFalhou = erros.some(([p]) => p === "logo");
        if (logoFalhou && escolha.logo === versoes.desenhos.logo?.id) {
          setErro(erros.find(([p]) => p === "logo")![2]!);
          return;
        }
        setEscolha((atual) => atual && Object.fromEntries(PAPEIS.map((p) => [p, erros.some(([q]) => q === p)
          ? (p === "logo" ? versoes.desenhos.logo?.id ?? null : null) : atual[p]])) as Escolha);
        return;
      }
      setDesenhos(Object.fromEntries(prontos.map(([p, d]) => [p, d])) as Carregados);
    })();
    return () => { cancelado = true; };
  }, [versoes, escolha, alvo]);

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
        {versoes?.desenhos.semLogoPorque
          ?? "Esta marca ainda não tem o logotipo nos Materiais (um item do tipo Logo, versão positiva, em SVG, PDF, AI ou PNG). Assim que alguém cadastrar, o Kit monta todos os tamanhos a partir dele."}
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
        logo: desenhos.logo, vertical: desenhos.vertical, simbolo: desenhos.simbolo, negativo: desenhos.negativo, nome: estado.marca,
        protecao: aplicadas.protecao, reducao: aplicadas.reducao,
        fontes: { protecao: fonte(regra("area_de_protecao")), logo: fonte(regra("reducao_minima_logo")), simbolo: fonte(regra("reducao_minima_simbolo")) },
        coresDaMarca: estado.coresDaMarca,
        fonteDaAssinatura: estado.fonteDaAssinatura ?? null,
        seletorDeVersoes: versoes && escolha && (
          <SeletorDeVersoes
            todas={versoes.todas} escolha={escolha} falhas={falhas} automatica={versoes.desenhos}
            aoEscolher={(p, id) => setEscolha((atual) => (atual ? { ...atual, [p]: id } : atual))}
          />
        ),
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

const PAPEL: Record<Papel, { titulo: string; uso: string; semNada: string }> = {
  logo: { titulo: "Logotipo", uso: "capas, banners e e-mail", semNada: "" },
  vertical: { titulo: "Logotipo vertical", uso: "quadrados e círculos, quando não há símbolo", semNada: "Usar o logotipo acima" },
  simbolo: { titulo: "Símbolo", uso: "ícones, favicon e perfis", semNada: "Não usar" },
  negativo: { titulo: "Para fundo escuro", uso: "quando o fundo escolhido é escuro", semNada: "O Kit faz em branco" },
};

/**
 * A escolha das versões, pelas miniaturas dos Materiais. A miniatura é um PNG
 * pequeno, não o arquivo: mostrar não baixa nada. A versão em formato que o
 * Kit não abre aparece apagada, com o motivo.
 */
function SeletorDeVersoes({ todas, escolha, falhas, automatica, aoEscolher }: {
  todas: VarianteDoKit[]; escolha: Escolha; falhas: Record<string, string>; automatica: DesenhosDaMarca;
  aoEscolher: (p: Papel, id: string | null) => void;
}) {
  return (
    <>
      {PAPEIS.map((papel) => {
        const opcoes = opcoesDoPapel(todas, papel);
        if (papel !== "logo" && opcoes.length === 0) return null;
        const info = PAPEL[papel];
        return (
          <fieldset key={papel} data-kit-papel={papel} className="flex flex-col gap-1.5 border-t border-platform-border pt-2.5 first:border-t-0 first:pt-0">
            <legend className="contents">
              <span className="text-[13px] font-medium text-platform-text">{info.titulo}</span>
            </legend>
            <span className="text-[12px] leading-snug text-platform-text-muted">{info.uso}</span>
            <div className="flex flex-wrap gap-2">
              {opcoes.map(({ variante: v, abre, motivo }) => {
                const falha = falhas[v.id];
                const desligada = !abre || Boolean(falha);
                const marcada = escolha[papel] === v.id;
                const nome = nomeDaVariante(v);
                return (
                  <Dica key={v.id} texto={dicaDe("kit-versao")} lado="cima"><button type="button" data-kit-opcao={v.id} aria-pressed={marcada} disabled={desligada}
                    title={motivo ?? falha ?? (automatica[papel]?.id === v.id ? `${nome} (escolha do Kit)` : nome)}
                    onClick={() => aoEscolher(papel, v.id)}
                    className={`flex w-[104px] flex-col items-center gap-1 rounded-[var(--radius-control)] border p-1.5 text-center transition-colors ${marcada ? "border-platform-text" : "border-platform-border"} ${desligada ? "cursor-not-allowed opacity-45" : "hover:border-platform-text"}`}>
                    <span className={`grid h-12 w-full place-items-center overflow-hidden rounded-[6px] ${papel === "negativo" ? "bg-[#111418]" : "bg-white"}`}>
                      {v.miniatura
                        // eslint-disable-next-line @next/next/no-img-element -- endereço assinado e curto do Storage; o otimizador da Vercel não deve guardá-lo
                        ? <img src={v.miniatura} alt="" className="max-h-11 max-w-[92px] object-contain" />
                        : <span className={`font-mono text-[11px] ${papel === "negativo" ? "text-white/70" : "text-black/50"}`}>{/\.([a-z0-9]+)$/i.exec(v.arquivo)?.[1]?.toUpperCase() ?? "?"}</span>}
                    </span>
                    <span className="line-clamp-2 text-[11px] leading-tight text-platform-text-muted">{nome}</span>
                  </button></Dica>
                );
              })}
              {papel !== "logo" && (
                <button type="button" data-kit-opcao="nenhuma" aria-pressed={escolha[papel] === null} onClick={() => aoEscolher(papel, null)}
                  className={`flex w-[104px] items-center justify-center rounded-[var(--radius-control)] border p-1.5 text-center text-[11px] leading-tight text-platform-text-muted transition-colors hover:border-platform-text ${escolha[papel] === null ? "border-platform-text" : "border-platform-border"}`}>
                  {info.semNada}
                </button>
              )}
            </div>
            {opcoes.filter((o) => !o.abre || falhas[o.variante.id]).slice(0, 1).map((o) => (
              <p key={o.variante.id} className="text-[11.5px] leading-snug text-platform-text-muted">{o.variante.arquivo}: {falhas[o.variante.id] ?? o.motivo}</p>
            ))}
          </fieldset>
        );
      })}
      <p className="text-[12px] leading-snug text-platform-text-muted">Vêm dos Materiais da marca. O Kit já marcou a melhor de cada; troque se quiser.</p>
    </>
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
            {podeAprovar && regra.status === "draft" && <Dica texto={dicaDe("kit-confirmar")} lado="cima"><button type="button" data-kit-confirmar onClick={() => aoAprovar(regra.id)} className="font-medium text-platform-text underline">Confirmar</button></Dica>}
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
