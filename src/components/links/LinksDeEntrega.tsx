"use client";

import { useEffect, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { MAXIMO_DE_ARQUIVOS, PRAZO_MAXIMO_DIAS, PRAZO_PADRAO_DIAS, type SituacaoDoLink } from "@/lib/links/links";

const CAMPO = "border border-platform-border bg-platform-bg px-3 py-2 text-base text-platform-text focus:border-platform-signal focus:outline-none sm:text-sm";
const ROTULO = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-platform-text-muted";
const BOTAO = "border border-platform-text bg-platform-text px-4 py-2 text-sm font-bold text-platform-bg disabled:cursor-not-allowed disabled:opacity-40";
const BOTAO_LEVE = "border border-platform-border px-3 py-1.5 text-sm text-platform-text hover:border-platform-text disabled:cursor-not-allowed disabled:opacity-40";
const TH = "py-2 pr-4 font-bold";

type Marca = { id: string; nome: string; chave: string };
type Linha = {
  id: string; marca: string; nome: string; destinatario: string; criado_em: string; criado_por: string;
  expira_em: string; revogado_em: string | null; situacao: SituacaoDoLink; arquivos: number; downloads: number; ultimo_download: string | null;
};
type Acesso = { id: string; evento: "abriu" | "baixou"; nome: string | null; email: string | null; asset_label: string | null; file_name: string | null; created_at: string };
type ItemDaMarca = { id: string; tipo: string; nome: string };
type ArquivoDaMarca = { id: string; itemId: string; label: string; file_name: string; descontinuadoEm: string | null; baixavel: boolean };

function useT() {
  const isEnglish = useIsEnglish();
  return (pt: string, en: string) => (isEnglish ? en : pt);
}

function useDatas() {
  const isEnglish = useIsEnglish();
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(isEnglish ? "en-US" : "pt-BR", { timeZone: "America/Sao_Paulo", ...o });
  return {
    curta: (iso: string) => f({ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)),
    dia: (iso: string) => f({ day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso)),
  };
}

/**
 * Links de entrega — a tela da CONTA (ADR-0007 §2.5, 30/09/2026).
 *
 * Criar escolhe arquivos de UMA marca (de itens diferentes, se quiser), dá nome
 * e prazo, e mostra o endereço UMA vez: o banco guarda só o resumo do código.
 * A lista mostra a situação de cada link, quantos downloads teve, e encerra.
 * Quem vê e quem cria decide o banco (`administrar` na marca).
 */
export function LinksDeEntrega({ marcas, inicial }: { marcas: Marca[]; inicial?: { marca?: string; arquivos?: string[] } }) {
  const alvo = useAlvo();
  const t = useT();
  const datas = useDatas();
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);
  const [criando, setCriando] = useState(Boolean(inicial?.marca));
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const resposta = await fetch(comAlvo("/api/links", { workspaceSlug: alvo.workspaceSlug }), { cache: "no-store" }).catch(() => null);
      const dados = resposta ? await resposta.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (resposta?.ok) setLinhas(dados.links ?? []);
      else setErro(dados.message ?? t("Não foi possível carregar os links.", "Couldn't load the links."));
    })();
    return () => { cancelado = true; };
    // `t` muda a cada render; a busca depende da conta e da versão da lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo.workspaceSlug, versao]);

  const situacao = (s: SituacaoDoLink) => ({ ativo: t("Ativo", "Active"), expirado: t("Expirado", "Expired"), revogado: t("Encerrado", "Closed") })[s];

  return (
    <div data-links-de-entrega className="space-y-8">
      {criando ? (
        <CriarLink marcas={marcas} inicial={inicial} aoFechar={() => setCriando(false)} aoCriar={() => setVersao((v) => v + 1)} />
      ) : (
        <button type="button" data-novo-link onClick={() => setCriando(true)} className={BOTAO} disabled={marcas.length === 0}>
          {t("+ Novo link de entrega", "+ New delivery link")}
        </button>
      )}

      {erro && <p role="alert" className="text-sm text-platform-text">{erro}</p>}
      {!linhas && !erro && <p className="text-sm text-platform-text-muted">{t("Carregando…", "Loading…")}</p>}
      {linhas && linhas.length === 0 && (
        <p data-sem-links className="max-w-[46rem] text-sm leading-relaxed text-platform-text-muted">
          {t("Nenhum link ainda. Um link entrega arquivos escolhidos a quem não tem conta — a gráfica de um job, por exemplo —, com prazo, e registra quem baixou.",
             "No links yet. A link delivers chosen files to someone without an account — a print shop for a job, for instance —, with a deadline, and records who downloaded.")}
        </p>
      )}
      {linhas && linhas.length > 0 && (
        <div className="overflow-x-auto">
          <table data-tabela-links className="w-full min-w-[56rem] text-left text-sm">
            <thead>
              <tr className="border-b border-platform-border text-[11px] uppercase tracking-wider text-platform-text-muted">
                <th className={TH}>{t("Link", "Link")}</th><th className={TH}>{t("Marca", "Brand")}</th>
                <th className={TH}>{t("Criado", "Created")}</th><th className={TH}>{t("Prazo", "Deadline")}</th>
                <th className={TH}>{t("Situação", "Status")}</th><th className={TH}>{t("Arquivos", "Files")}</th>
                <th className={TH}>{t("Downloads", "Downloads")}</th><th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <LinhaDoLink key={l.id} l={l} aberto={aberto === l.id} alternar={() => setAberto((a) => (a === l.id ? null : l.id))}
                  situacao={situacao(l.situacao)} datas={datas} aoEncerrar={() => setVersao((v) => v + 1)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LinhaDoLink({ l, aberto, alternar, situacao, datas, aoEncerrar }: {
  l: Linha; aberto: boolean; alternar: () => void; situacao: string; datas: ReturnType<typeof useDatas>; aoEncerrar: () => void;
}) {
  const alvo = useAlvo();
  const t = useT();
  const [confirmar, setConfirmar] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [erro, setErro] = useState("");

  async function encerrar() {
    setEncerrando(true);
    const resposta = await fetch(comAlvo(`/api/links/${l.id}/revogar`, { workspaceSlug: alvo.workspaceSlug }), { method: "POST" }).catch(() => null);
    setEncerrando(false);
    setConfirmar(false);
    if (resposta?.ok) aoEncerrar();
    else setErro(t("Não foi possível encerrar. Tente de novo.", "Couldn't close it. Try again."));
  }

  return (
    <>
      <tr data-link={l.id} data-situacao={l.situacao} className="border-b border-platform-border align-top text-platform-text">
        <td className="py-2 pr-4">
          <p className="font-bold">{l.nome}</p>
          {l.destinatario && <p className="text-xs text-platform-text-muted">{t(`para ${l.destinatario}`, `to ${l.destinatario}`)}</p>}
        </td>
        <td className="py-2 pr-4">{l.marca}</td>
        <td className="py-2 pr-4 text-xs"><p className="tabular-nums">{datas.curta(l.criado_em)}</p><p className="text-platform-text-muted">{l.criado_por}</p></td>
        <td className="py-2 pr-4 text-xs tabular-nums">{l.revogado_em ? t(`encerrado ${datas.curta(l.revogado_em)}`, `closed ${datas.curta(l.revogado_em)}`) : datas.curta(l.expira_em)}</td>
        <td className="py-2 pr-4"><span data-situacao-rotulo className="border border-platform-border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">{situacao}</span></td>
        <td className="py-2 pr-4 tabular-nums">{l.arquivos}</td>
        <td className="py-2 pr-4 tabular-nums">{l.downloads}{l.ultimo_download && <p className="text-xs text-platform-text-muted">{t(`último ${datas.curta(l.ultimo_download)}`, `last ${datas.curta(l.ultimo_download)}`)}</p>}</td>
        <td className="py-2 pr-0 text-right">
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" data-ver-acessos onClick={alternar} aria-expanded={aberto} className={BOTAO_LEVE}>{aberto ? t("Fechar", "Close") : t("Acessos", "Accesses")}</button>
            {l.situacao === "ativo" && (confirmar ? (
              <>
                <button type="button" data-confirmar-encerrar disabled={encerrando} onClick={() => void encerrar()} className={BOTAO_LEVE}>{t("Encerrar agora", "Close now")}</button>
                <button type="button" onClick={() => setConfirmar(false)} className="text-sm underline">{t("cancelar", "cancel")}</button>
              </>
            ) : (
              <button type="button" data-encerrar onClick={() => setConfirmar(true)} className={BOTAO_LEVE}>{t("Encerrar", "Close")}</button>
            ))}
          </div>
          {erro && <p role="alert" className="mt-1 text-xs">{erro}</p>}
        </td>
      </tr>
      {aberto && (
        <tr className="border-b border-platform-border bg-platform-panel">
          <td colSpan={8} className="px-3 py-3"><AcessosDoLink id={l.id} datas={datas} /></td>
        </tr>
      )}
    </>
  );
}

function AcessosDoLink({ id, datas }: { id: string; datas: ReturnType<typeof useDatas> }) {
  const alvo = useAlvo();
  const t = useT();
  const [acessos, setAcessos] = useState<Acesso[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const resposta = await fetch(comAlvo(`/api/links/${id}/acessos`, { workspaceSlug: alvo.workspaceSlug }), { cache: "no-store" }).catch(() => null);
      const dados = resposta ? await resposta.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (resposta?.ok) setAcessos(dados.acessos ?? []);
      else setErro(t("Não foi possível carregar os acessos.", "Couldn't load the accesses."));
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, alvo.workspaceSlug]);

  if (erro) return <p role="alert" className="text-sm">{erro}</p>;
  if (!acessos) return <p className="text-sm text-platform-text-muted">{t("Carregando…", "Loading…")}</p>;
  if (acessos.length === 0) return <p data-sem-acessos className="text-sm text-platform-text-muted">{t("Ninguém abriu este link ainda.", "No one has opened this link yet.")}</p>;
  return (
    <div data-acessos={id}>
      <p className="mb-2 text-xs text-platform-text-muted">
        {t("Nome e e-mail são os que a pessoa digitou antes de baixar: não são verificados. \"Baixou\" quer dizer que ela recebeu o arquivo — não que o download terminou.",
           "Name and email are what the person typed before downloading: they aren't verified. \"Downloaded\" means they received the file — not that the download finished.")}
      </p>
      <ul className="space-y-1 text-sm">
        {acessos.map((a) => (
          <li key={a.id} data-acesso={a.evento} className="flex flex-wrap gap-x-3">
            <span className="font-mono text-xs tabular-nums text-platform-text-muted">{datas.curta(a.created_at)}</span>
            {a.evento === "abriu"
              ? <span className="text-platform-text-muted">{t("Link aberto", "Link opened")}</span>
              : <span>{t(`${a.nome} (${a.email}) baixou ${a.asset_label} — ${a.file_name}`, `${a.nome} (${a.email}) downloaded ${a.asset_label} — ${a.file_name}`)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CriarLink({ marcas, inicial, aoFechar, aoCriar }: {
  marcas: Marca[]; inicial?: { marca?: string; arquivos?: string[] }; aoFechar: () => void; aoCriar: () => void;
}) {
  const alvo = useAlvo();
  const t = useT();
  const [chave, setChave] = useState(inicial?.marca && marcas.some((m) => m.chave === inicial.marca) ? inicial.marca : (marcas[0]?.chave ?? ""));
  const [acervo, setAcervo] = useState<{ itens: ItemDaMarca[]; arquivos: ArquivoDaMarca[] } | null>(null);
  const [erroDoAcervo, setErroDoAcervo] = useState("");
  const [marcados, setMarcados] = useState<string[]>(inicial?.arquivos ?? []);
  const [nome, setNome] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [dias, setDias] = useState(String(PRAZO_PADRAO_DIAS));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [criado, setCriado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!chave) return;
    let cancelado = false;
    (async () => {
      const resposta = await fetch(comAlvo("/api/assets", { workspaceSlug: alvo.workspaceSlug, brandKey: chave }), { cache: "no-store" }).catch(() => null);
      const dados = resposta ? await resposta.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (resposta?.ok) setAcervo({ itens: dados.itens ?? [], arquivos: dados.assets ?? [] });
      else setErroDoAcervo(t("Não foi possível carregar os materiais desta marca.", "Couldn't load this brand's materials."));
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, alvo.workspaceSlug]);

  function trocarMarca(proxima: string) {
    setChave(proxima);
    setAcervo(null);
    setErroDoAcervo("");
    setMarcados([]);
  }

  // Só o que pode ir: arquivo em uso, servível, e que não seja fonte (ADR-0007 §3).
  const itens = (acervo?.itens ?? [])
    .filter((i) => i.tipo !== "fonte")
    .map((i) => ({ ...i, arquivos: (acervo?.arquivos ?? []).filter((a) => a.itemId === i.id && !a.descontinuadoEm && a.baixavel) }))
    .filter((i) => i.arquivos.length > 0);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const resposta = await fetch(comAlvo("/api/links", { workspaceSlug: alvo.workspaceSlug, brandKey: chave }), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, destinatario, dias: Number(dias), arquivos: marcados }),
    }).catch(() => null);
    const dados = resposta ? await resposta.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!resposta?.ok) {
      setErro(dados.message ?? t("Não foi possível criar o link. Tente de novo.", "Couldn't create the link. Try again."));
      return;
    }
    setCriado(dados.endereco);
    aoCriar();
  }

  async function copiar() {
    if (!criado) return;
    try {
      await navigator.clipboard.writeText(criado);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  if (criado) {
    return (
      <section data-link-criado aria-labelledby="link-criado" className="border border-platform-text p-4">
        <h2 id="link-criado" className="font-display text-sm font-black uppercase tracking-wider">{t("Link criado", "Link created")}</h2>
        <p className="mt-2 text-sm font-bold">
          {t("Este endereço aparece só agora. Copie e mande para quem vai receber os arquivos.", "This address appears only now. Copy it and send it to whoever will receive the files.")}
        </p>
        <p className="mt-1 text-xs text-platform-text-muted">
          {t("Por segurança, a Brennimark não guarda o endereço — só um resumo que não o revela. Se ele se perder, encerre este link e crie outro.",
             "For security, Brennimark doesn't store the address — only a summary that doesn't reveal it. If it gets lost, close this link and create another.")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input data-endereco-do-link readOnly value={criado} onFocus={(e) => e.currentTarget.select()} className={`${CAMPO} min-w-0 flex-1 font-mono text-xs`} />
          <button type="button" data-copiar-link onClick={() => void copiar()} className={BOTAO}>{copiado ? t("Copiado", "Copied") : t("Copiar", "Copy")}</button>
        </div>
        <button type="button" onClick={aoFechar} className="mt-4 text-sm underline">{t("Pronto", "Done")}</button>
      </section>
    );
  }

  const podeCriar = Boolean(chave) && nome.trim().length > 0 && marcados.length > 0 && marcados.length <= MAXIMO_DE_ARQUIVOS && !enviando;

  return (
    <form data-criar-link onSubmit={criar} className="space-y-5 border border-platform-border p-4">
      <h2 className="font-display text-sm font-black uppercase tracking-wider">{t("Novo link de entrega", "New delivery link")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className={ROTULO}>{t("Nome do link", "Link name")}</span>
          <input data-nome-do-link value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} placeholder={t("Gráfica Pampa — cartazes de outubro", "Print shop — October posters")} className={`${CAMPO} w-full`} /></label>
        <label className="block"><span className={ROTULO}>{t("Para quem (opcional)", "For whom (optional)")}</span>
          <input value={destinatario} onChange={(e) => setDestinatario(e.target.value)} maxLength={120} className={`${CAMPO} w-full`} /></label>
        <label className="block"><span className={ROTULO}>{t("Marca", "Brand")}</span>
          <select data-marca-do-link value={chave} onChange={(e) => trocarMarca(e.target.value)} className={`${CAMPO} w-full`}>
            {marcas.map((m) => <option key={m.chave} value={m.chave}>{m.nome}</option>)}
          </select></label>
        <label className="block"><span className={ROTULO}>{t(`Prazo em dias (até ${PRAZO_MAXIMO_DIAS})`, `Deadline in days (up to ${PRAZO_MAXIMO_DIAS})`)}</span>
          <input data-prazo-do-link type="number" inputMode="numeric" min={1} max={PRAZO_MAXIMO_DIAS} value={dias} onChange={(e) => setDias(e.target.value)} className={`${CAMPO} w-full`} /></label>
      </div>

      <fieldset>
        <legend className={ROTULO}>{t(`Arquivos (${marcados.length} escolhidos)`, `Files (${marcados.length} chosen)`)}</legend>
        {erroDoAcervo && <p role="alert" className="text-sm">{erroDoAcervo}</p>}
        {!acervo && !erroDoAcervo && <p className="text-sm text-platform-text-muted">{t("Carregando materiais…", "Loading materials…")}</p>}
        {acervo && itens.length === 0 && (
          <p className="text-sm text-platform-text-muted">{t("Esta marca ainda não tem arquivos em uso para entregar.", "This brand has no files in use to deliver yet.")}</p>
        )}
        <div className="mt-2 max-h-[22rem] space-y-4 overflow-y-auto">
          {itens.map((i) => (
            <div key={i.id} data-item-para-link={i.id}>
              <p className="text-sm font-bold">{i.nome}</p>
              <ul className="mt-1 space-y-1">
                {i.arquivos.map((a) => (
                  <li key={a.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" data-arquivo-para-link={a.id} checked={marcados.includes(a.id)}
                        onChange={(e) => setMarcados((m) => (e.target.checked ? [...m, a.id] : m.filter((x) => x !== a.id)))} />
                      <span>{a.label}</span><span className="font-mono text-xs text-platform-text-muted">{a.file_name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-platform-text-muted">
          {t("Fontes não vão por link: só quem tem acesso à marca as recebe. Se um arquivo for substituído depois, o link entrega a versão nova.",
             "Fonts don't go by link: only people with access to the brand receive them. If a file is replaced later, the link delivers the new version.")}
        </p>
      </fieldset>

      {erro && <p role="alert" className="text-sm font-bold">{erro}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" data-criar disabled={!podeCriar} className={BOTAO}>{enviando ? t("Criando…", "Creating…") : t("Criar link", "Create link")}</button>
        <button type="button" onClick={aoFechar} className="text-sm underline">{t("Cancelar", "Cancel")}</button>
      </div>
    </form>
  );
}
