"use client";

import { useEffect, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import {
  descreverAcao, descreverAcesso, quandoCurto,
  type Aba, type LinhaDeAcao, type LinhaDeAcesso, type LinhaDeDownload,
} from "@/lib/registros/registros";

type Marca = { id: string; nome: string };
type Linha = LinhaDeDownload | LinhaDeAcesso | LinhaDeAcao;
type Consulta = { aba: Aba; marca: string; pessoa: string; de: string; ate: string };

const CAMPO = "border border-platform-border bg-platform-bg px-3 py-2 text-sm text-platform-text focus:border-platform-signal focus:outline-none";
const ROTULO = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-platform-text-muted";

function endereco(c: Consulta, antes?: string | null): string {
  const p = new URLSearchParams({ aba: c.aba });
  if (c.marca) p.set("marca", c.marca);
  if (c.pessoa.trim()) p.set("pessoa", c.pessoa.trim());
  if (c.de) p.set("de", c.de);
  if (c.ate) p.set("ate", c.ate);
  if (antes) p.set("antes", antes);
  return `/api/registros?${p.toString()}`;
}

/**
 * Registros — a tela da conta (28/09/2026). Mostra o que já é gravado:
 * downloads, acessos e ações. Quem vê o quê decide o BANCO — cada linha vem
 * de uma marca que a pessoa administra; esta tela só filtra e mostra.
 *
 * Os filtros só valem ao clicar "Filtrar": uma consulta por digitação seria
 * uma ida ao banco por letra, sobre uma tabela que só cresce.
 */
export function Registros({ marcas }: { marcas: Marca[] }) {
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const t = (en: string, pt: string) => (isEnglish ? en : pt);
  const [rascunho, setRascunho] = useState<Consulta>({ aba: "downloads", marca: "", pessoa: "", de: "", ate: "" });
  const [consulta, setConsulta] = useState<Consulta>(rascunho);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [mais, setMais] = useState(false);
  const [erro, setErro] = useState("");

  // A consulta aplicada muda → uma ida ao banco. O `cancelado` descarta a
  // resposta de uma consulta que já foi trocada por outra.
  useEffect(() => {
    if (consulta.aba === "perguntas") return;
    let cancelado = false;
    (async () => {
      const resposta = await fetch(comAlvo(endereco(consulta), alvo), { cache: "no-store" }).catch(() => null);
      const dados = resposta ? await resposta.json().catch(() => ({})) : {};
      if (cancelado) return;
      setCarregando(false);
      if (resposta?.ok) {
        setLinhas(dados.linhas ?? []);
        setProximo(dados.proximo ?? null);
      } else {
        setLinhas([]);
        setProximo(null);
        setErro(resposta ? (dados.message ?? t("Couldn't load the records.", "Não foi possível carregar os registros.")) : t("No connection: couldn't load the records.", "Sem conexão: não foi possível carregar os registros."));
      }
    })();
    return () => { cancelado = true; };
    // `t` muda a cada render; a busca depende da consulta e do alvo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta, alvo]);

  function aplicar(proxima: Consulta) {
    setErro("");
    setCarregando(proxima.aba !== "perguntas");
    setLinhas([]);
    setProximo(null);
    setConsulta(proxima);
  }

  function trocarAba(aba: Aba) {
    const proxima = { ...rascunho, aba };
    setRascunho(proxima);
    aplicar(proxima);
  }

  async function carregarMais() {
    if (!proximo) return;
    setMais(true);
    const resposta = await fetch(comAlvo(endereco(consulta, proximo), alvo), { cache: "no-store" }).catch(() => null);
    const dados = resposta ? await resposta.json().catch(() => ({})) : {};
    setMais(false);
    if (!resposta?.ok) {
      setErro(resposta ? (dados.message ?? t("Couldn't load more.", "Não foi possível carregar mais.")) : t("No connection.", "Sem conexão."));
      return;
    }
    setLinhas((antes) => [...antes, ...(dados.linhas ?? [])]);
    setProximo(dados.proximo ?? null);
  }

  const abas: { id: Aba; rotulo: string }[] = [
    { id: "downloads", rotulo: t("Downloads", "Downloads") },
    { id: "acessos", rotulo: t("Access", "Acessos") },
    { id: "acoes", rotulo: t("Changes", "Ações") },
    { id: "perguntas", rotulo: t("Unanswered questions", "Perguntas sem resposta") },
  ];

  return (
    <div data-registros>
      <div role="tablist" aria-label={t("Records", "Registros")} className="flex flex-wrap gap-1 border-b border-platform-border">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            data-aba={a.id}
            aria-selected={consulta.aba === a.id}
            onClick={() => trocarAba(a.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${consulta.aba === a.id ? "border-platform-text font-bold text-platform-text" : "border-transparent text-platform-text-muted hover:text-platform-text"}`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {consulta.aba === "perguntas" ? (
        <div data-perguntas-em-breve className="mt-8 max-w-[46rem] space-y-3 text-sm leading-relaxed text-platform-text-muted">
          <p className="font-bold text-platform-text">{t("Coming later.", "Vem depois.")}</p>
          <p>
            {t(
              "This report will show what people ask the assistant that the manual doesn't answer — the bridge to Complements. Conversations belong only to whoever asks, so the report will be aggregated, and only shown when enough people ask the same thing, so no one is identified by their question.",
              "Este relatório vai mostrar o que as pessoas perguntam ao Vini e o manual não responde — a ponte para os Complementos. As conversas são só de quem pergunta; por isso o relatório será agregado, e só aparece quando gente suficiente pergunta a mesma coisa, para ninguém ser identificado pela pergunta.",
            )}
          </p>
        </div>
      ) : (
        <>
          <form
            data-filtros
            onSubmit={(e) => { e.preventDefault(); aplicar(rascunho); }}
            className="mt-6 flex flex-wrap items-end gap-3"
          >
            <label className="block">
              <span className={ROTULO}>{t("Brand", "Marca")}</span>
              <select value={rascunho.marca} onChange={(e) => setRascunho((r) => ({ ...r, marca: e.target.value }))} className={CAMPO}>
                <option value="">{t("All brands", "Todas as marcas")}</option>
                {marcas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={ROTULO}>{t("Person", "Pessoa")}</span>
              <input value={rascunho.pessoa} maxLength={80} placeholder={t("name or e-mail", "nome ou e-mail")}
                onChange={(e) => setRascunho((r) => ({ ...r, pessoa: e.target.value }))} className={`${CAMPO} w-56`} />
            </label>
            <label className="block">
              <span className={ROTULO}>{t("From", "De")}</span>
              <input type="date" value={rascunho.de} onChange={(e) => setRascunho((r) => ({ ...r, de: e.target.value }))} className={CAMPO} />
            </label>
            <label className="block">
              <span className={ROTULO}>{t("To", "Até")}</span>
              <input type="date" value={rascunho.ate} onChange={(e) => setRascunho((r) => ({ ...r, ate: e.target.value }))} className={CAMPO} />
            </label>
            <button type="submit" data-filtrar className="bg-platform-signal px-4 py-2 font-display text-[11px] font-black uppercase text-platform-bg">
              {t("Filter", "Filtrar")}
            </button>
          </form>

          <p className="mt-4 text-xs text-platform-text-muted">
            {consulta.aba === "downloads" && t(
              "A download means the person received a valid link to the file at that moment — not that the transfer finished.",
              "Download iniciado: a pessoa recebeu um endereço válido para o arquivo naquele instante — não quer dizer que a transferência terminou.",
            )}
            {consulta.aba === "acessos" && t(
              "Who granted, changed or removed whose access. Visits to a brand are not recorded.",
              "Quem deu, mudou ou tirou o acesso de quem. Visitas às marcas não são gravadas.",
            )}
            {consulta.aba === "acoes" && t(
              "Changes to the manual content: published and restored versions. Materials and palette changes aren't recorded here yet.",
              "Mudanças no conteúdo do manual: versões publicadas e recuperadas. Mudanças em Materiais e na Paleta ainda não entram aqui.",
            )}
          </p>

          {erro && <p role="alert" className="mt-4 text-sm text-platform-text">{erro}</p>}

          {carregando
            ? <p className="mt-6 text-sm text-platform-text-muted">{t("Loading…", "Carregando…")}</p>
            : linhas.length === 0 && !erro
              ? <p data-registros-vazio className="mt-6 text-sm text-platform-text-muted">{t("Nothing recorded for these filters.", "Nada registrado com estes filtros.")}</p>
              : linhas.length > 0 && (
                <div className="mt-6 overflow-x-auto">
                  <table data-tabela-registros={consulta.aba} className="w-full min-w-[44rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-platform-border text-[11px] uppercase tracking-wider text-platform-text-muted">
                        <th className="py-2 pr-4 font-medium">{t("When", "Quando")}</th>
                        <th className="py-2 pr-4 font-medium">{t("Brand", "Marca")}</th>
                        {consulta.aba === "downloads" && <>
                          <th className="py-2 pr-4 font-medium">{t("Person", "Pessoa")}</th>
                          <th className="py-2 pr-4 font-medium">{t("What", "O quê")}</th>
                        </>}
                        {consulta.aba === "acessos" && <>
                          <th className="py-2 pr-4 font-medium">{t("Person", "Pessoa")}</th>
                          <th className="py-2 pr-4 font-medium">{t("Change", "Mudança")}</th>
                          <th className="py-2 pr-4 font-medium">{t("By", "Por")}</th>
                        </>}
                        {consulta.aba === "acoes" && <>
                          <th className="py-2 pr-4 font-medium">{t("Who", "Quem")}</th>
                          <th className="py-2 pr-4 font-medium">{t("What", "O quê")}</th>
                        </>}
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((l) => (
                        <tr key={l.id} data-linha-de-registro className="border-b border-platform-border align-top">
                          <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-platform-text-muted">{quandoCurto(l.quando)}</td>
                          <td className="py-2 pr-4 text-platform-text">{l.marca}</td>
                          {consulta.aba === "downloads" && "tipo" in l && <>
                            <td className="py-2 pr-4 text-platform-text">{l.pessoa}</td>
                            <td className="py-2 pr-4 text-platform-text">
                              {l.oque}
                              <span className="ml-2 font-mono text-xs text-platform-text-muted">{l.arquivo}</span>
                            </td>
                          </>}
                          {consulta.aba === "acessos" && "autor" in l && "antes" in l && <>
                            <td className="py-2 pr-4 text-platform-text">{l.pessoa}</td>
                            <td className="py-2 pr-4 text-platform-text">{descreverAcesso(l, isEnglish)}</td>
                            <td className="py-2 pr-4 text-platform-text-muted">{l.autor}</td>
                          </>}
                          {consulta.aba === "acoes" && "titulo" in l && <>
                            <td className="py-2 pr-4 text-platform-text">{l.autor}</td>
                            <td className="py-2 pr-4 text-platform-text">{descreverAcao(l.acao, isEnglish)} · {l.titulo}</td>
                          </>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

          {proximo && !carregando && (
            <button type="button" data-carregar-mais disabled={mais} onClick={carregarMais}
              className="mt-4 border border-platform-border px-4 py-2 font-display text-[11px] font-bold uppercase text-platform-text hover:border-platform-signal disabled:opacity-40">
              {mais ? t("Loading…", "Carregando…") : t("Load more", "Carregar mais")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
