"use client";

import { useEffect, useMemo, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { platformIdentity } from "@/platform/identity";
import { identificacaoValida } from "@/lib/links/links";
import { tamanho } from "@/lib/console/custos";
import type { PaginaDaRegra, VistaDaEntrega } from "@/lib/links/vista";
import { FalhaDoKit, montarZip, salvarArquivo } from "@/lib/assets/zip-no-navegador";

const CAMPO = "w-full border border-platform-border bg-platform-bg px-3 py-2 text-base text-platform-text focus:border-platform-signal focus:outline-none sm:text-sm";
const ROTULO = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-platform-text-muted";
const BOTAO = "border border-platform-text bg-platform-text px-4 py-2 text-sm font-bold text-platform-bg disabled:cursor-not-allowed disabled:opacity-40";
const BOTAO_LEVE = "border border-platform-border px-3 py-1.5 text-sm text-platform-text hover:border-platform-text disabled:cursor-not-allowed disabled:opacity-40";

/** Nome e e-mail ficam só neste navegador, para não pedir de novo a cada arquivo. */
const CHAVE = "brennimark:entrega:quem";

export type EstadoIndisponivel = "inexistente" | "expirado" | "revogado" | "erro";

function useT() {
  const isEnglish = useIsEnglish();
  return (pt: string, en: string) => (isEnglish ? en : pt);
}

function Moldura({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <main data-entrega className="min-h-dvh bg-platform-bg text-platform-text">
      <header className="border-b border-platform-border px-4 py-3 sm:px-8">
        <p className="font-display text-sm font-black uppercase tracking-wider">{platformIdentity.displayName}</p>
        <p className="text-[11px] uppercase tracking-wide text-platform-text-muted">{t("Entrega de arquivos da marca", "Brand file delivery")}</p>
      </header>
      <div className="mx-auto max-w-[60rem] px-4 py-8 sm:px-8">{children}</div>
    </main>
  );
}

/** Link que não existe, venceu ou foi encerrado — sem dizer mais do que isso. */
export function LinkIndisponivel({ estado }: { estado: EstadoIndisponivel }) {
  const t = useT();
  const texto = {
    inexistente: [t("Este link não existe.", "This link doesn't exist."), t("Confira se o endereço chegou inteiro.", "Check that the address arrived in full.")],
    expirado: [t("Este link expirou.", "This link has expired."), t("Links de entrega têm prazo. Peça um novo a quem o enviou.", "Delivery links have a deadline. Ask whoever sent it for a new one.")],
    revogado: [t("Este link foi encerrado.", "This link was closed."), t("Quem o enviou encerrou o acesso. Se ainda precisa dos arquivos, fale com essa pessoa.", "Whoever sent it closed access. If you still need the files, talk to them.")],
    erro: [t("Não foi possível abrir este link agora.", "Couldn't open this link right now."), t("Tente de novo em alguns instantes.", "Try again in a moment.")],
  }[estado];
  return (
    <Moldura>
      <div data-link-indisponivel={estado} className="max-w-[40rem]">
        <h1 className="font-display text-2xl font-black uppercase">{texto[0]}</h1>
        <p className="mt-3 text-sm leading-relaxed text-platform-text-muted">{texto[1]}</p>
      </div>
    </Moldura>
  );
}

function Regra({ paginas }: { paginas: PaginaDaRegra[] }) {
  const t = useT();
  if (paginas.length === 0) return null;
  return (
    <div data-regra className="mt-4">
      <p className={ROTULO}>{t("A regra do manual para estes arquivos", "The manual's rule for these files")}</p>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        {paginas.map((p) => {
          const rascunho = p.status === "draft" || p.status === "pending";
          return (
            <figure key={p.pagina} data-pagina-da-regra={p.pagina} className="border border-platform-border">
              {p.imagem ? (
                // Página do manual como imagem, só de leitura. Sem referência: o
                // endereço desta página traz o código do link.
                <a href={p.imagem} target="_blank" rel="noreferrer noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imagem} alt={t(`Página ${p.pagina} do manual`, `Manual page ${p.pagina}`)} referrerPolicy="no-referrer" className="block w-full bg-platform-panel" />
                </a>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-platform-panel px-4 text-center text-xs text-platform-text-muted">
                  {t("A imagem desta página ainda não foi preparada.", "This page's image hasn't been prepared yet.")}
                </div>
              )}
              <figcaption className="flex flex-wrap items-baseline gap-2 border-t border-platform-border px-3 py-2 text-[13px]">
                <span>{p.titulo ?? t("Manual da marca", "Brand manual")}</span>
                <span className="font-mono text-[12px] text-platform-text-muted">p. {p.pagina}</span>
                {rascunho && (
                  <span data-regra-rascunho className="font-display text-[9px] font-bold uppercase tracking-wide text-platform-warning">
                    {p.status === "draft" ? t("Rascunho", "Draft") : t("Pendente", "Pending")}
                  </span>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

function nomeDoZip(marca: string, nome: string): string {
  const limpo = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `${limpo(marca) || "marca"}-${limpo(nome) || "entrega"}.zip`;
}

/**
 * A página de quem recebeu o link (ADR-0007 §2.5). Só download: nada de
 * navegar pelo acervo, nada do manual além das páginas que regem os arquivos.
 * Antes de baixar, nome e e-mail — autodeclarados, e registrados com cada
 * arquivo (decisão do André, 30/09).
 */
export function EntregaPublica({ codigo, vista }: { codigo: string; vista: VistaDaEntrega }) {
  const t = useT();
  const isEnglish = useIsEnglish();
  const [quem, setQuem] = useState<{ nome: string; email: string } | null>(null);
  const [rascunho, setRascunho] = useState({ nome: "", email: "" });
  const [marcados, setMarcados] = useState<string[]>([]);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [fim, setFim] = useState<EstadoIndisponivel | null>(null);

  // Ler o armazenamento local só depois de montar: no servidor ele não existe,
  // e ler durante o render faria a página do servidor e a do navegador divergirem.
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
      if (salvo && identificacaoValida(String(salvo.nome ?? ""), String(salvo.email ?? ""))) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setQuem({ nome: salvo.nome, email: salvo.email });
      }
    } catch { /* sem armazenamento: pede de novo */ }
  }, []);

  const entregaveis = useMemo(() => vista.itens.flatMap((i) => i.arquivos.filter((a) => !a.retirado).map((a) => a.id)), [vista]);
  const prazo = new Intl.DateTimeFormat(isEnglish ? "en-US" : "pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(vista.expira_em));
  const data = (iso: string) => new Intl.DateTimeFormat(isEnglish ? "en-US" : "pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

  function identificar(e: React.FormEvent) {
    e.preventDefault();
    if (!identificacaoValida(rascunho.nome, rascunho.email)) {
      setErro(t("Preencha seu nome e um e-mail válido.", "Fill in your name and a valid email."));
      return;
    }
    const q = { nome: rascunho.nome.trim(), email: rascunho.email.trim() };
    try { localStorage.setItem(CHAVE, JSON.stringify(q)); } catch { /* segue sem guardar */ }
    setErro("");
    setQuem(q);
  }

  async function baixar(ids: string[], rotulo: string) {
    if (!quem || ids.length === 0) return;
    setErro("");
    setBaixando(rotulo);
    try {
      const resposta = await fetch(`/api/receber/${encodeURIComponent(codigo)}/baixar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: quem.nome, email: quem.email, arquivos: ids }),
        cache: "no-store",
      }).catch(() => null);
      const dados = resposta ? await resposta.json().catch(() => ({})) : {};
      if (!resposta) { setErro(t("Sem conexão. Tente de novo.", "No connection. Try again.")); return; }
      if (resposta.status === 410 && dados.estado) { setFim(dados.estado); return; }
      if (!resposta.ok) { setErro(dados.message ?? t("Não foi possível baixar agora.", "Couldn't download right now.")); return; }
      const arquivos = (dados.arquivos ?? []) as { id: string; url: string; file_name: string }[];
      if (arquivos.length === 1) {
        // O endereço assinado já pede download com o nome do arquivo.
        window.location.assign(arquivos[0].url);
        return;
      }
      const zip = await montarZip(arquivos.map((a) => ({ url: a.url, caminho: a.file_name })));
      salvarArquivo(zip, nomeDoZip(vista.marca, vista.nome));
    } catch (e) {
      setErro(e instanceof FalhaDoKit
        ? t(`Não foi possível buscar ${e.caminho}. Tente de novo.`, `Couldn't fetch ${e.caminho}. Try again.`)
        : t("Não foi possível montar o ZIP. Tente de novo.", "Couldn't build the ZIP. Try again."));
    } finally {
      setBaixando(null);
    }
  }

  if (fim) return <LinkIndisponivel estado={fim} />;

  return (
    <Moldura>
      <h1 className="font-display text-2xl font-black uppercase">{vista.nome}</h1>
      <p className="mt-3 max-w-[46rem] text-sm leading-relaxed text-platform-text-muted">
        {vista.destinatario
          ? t(`Arquivos da marca ${vista.marca}, enviados para ${vista.destinatario}.`, `Files from the ${vista.marca} brand, sent to ${vista.destinatario}.`)
          : t(`Arquivos da marca ${vista.marca}.`, `Files from the ${vista.marca} brand.`)}{" "}
        <span data-prazo>{t(`Disponível até ${prazo}.`, `Available until ${prazo}.`)}</span>
      </p>

      <section aria-labelledby="quem-baixa" className="mt-8 border border-platform-border p-4">
        <h2 id="quem-baixa" className="font-display text-sm font-black uppercase tracking-wider">{t("Quem está baixando", "Who is downloading")}</h2>
        {quem ? (
          <p data-identificado className="mt-2 text-sm">
            {quem.nome} · {quem.email}{" "}
            <button type="button" onClick={() => { setRascunho(quem); setQuem(null); }} className="ml-2 text-sm underline">{t("trocar", "change")}</button>
          </p>
        ) : (
          <form data-identificacao noValidate onSubmit={identificar} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block"><span className={ROTULO}>{t("Nome", "Name")}</span>
              <input value={rascunho.nome} onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} maxLength={120} autoComplete="name" className={CAMPO} /></label>
            <label className="block"><span className={ROTULO}>{t("E-mail", "Email")}</span>
              <input type="email" value={rascunho.email} onChange={(e) => setRascunho({ ...rascunho, email: e.target.value })} maxLength={254} autoComplete="email" className={CAMPO} /></label>
            <button type="submit" className={BOTAO}>{t("Continuar", "Continue")}</button>
          </form>
        )}
        <p className="mt-3 text-xs leading-relaxed text-platform-text-muted">
          {t("A marca registra quem baixou cada arquivo e quando. Seu nome e e-mail servem só para isso.",
             "The brand records who downloaded each file and when. Your name and email are used only for that.")}
        </p>
      </section>

      {erro && <p role="alert" className="mt-6 text-sm font-bold text-platform-text">{erro}</p>}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="button" data-baixar-todos disabled={!quem || entregaveis.length === 0 || Boolean(baixando)} onClick={() => void baixar(entregaveis, "todos")} className={BOTAO}>
          {baixando === "todos" ? t("Preparando…", "Preparing…") : entregaveis.length === 1 ? t("Baixar o arquivo", "Download the file") : t(`Baixar todos (${entregaveis.length}, ZIP)`, `Download all (${entregaveis.length}, ZIP)`)}
        </button>
        {marcados.length > 0 && (
          <button type="button" data-baixar-marcados disabled={!quem || Boolean(baixando)} onClick={() => void baixar(marcados, "marcados")} className={BOTAO_LEVE}>
            {baixando === "marcados" ? t("Preparando…", "Preparing…") : marcados.length === 1 ? t("Baixar o marcado", "Download the selected one") : t(`Baixar ${marcados.length} marcados (ZIP)`, `Download ${marcados.length} selected (ZIP)`)}
          </button>
        )}
        {!quem && <span className="text-xs text-platform-text-muted">{t("Diga quem você é para baixar.", "Say who you are to download.")}</span>}
      </div>

      <div className="mt-8 space-y-10">
        {vista.itens.map((item) => (
          <section key={item.id} data-item-da-entrega={item.id} aria-label={item.nome}>
            <h2 className="font-display text-sm font-black uppercase tracking-wider">{item.nome}</h2>
            <ul className="mt-3 divide-y divide-platform-border border-y border-platform-border">
              {item.arquivos.map((a) => (
                <li key={a.id} data-arquivo-da-entrega={a.id} className="flex flex-wrap items-center gap-3 py-3">
                  <input type="checkbox" aria-label={t(`Marcar ${a.label}`, `Select ${a.label}`)} disabled={a.retirado}
                    checked={marcados.includes(a.id)} onChange={(e) => setMarcados((m) => (e.target.checked ? [...m, a.id] : m.filter((x) => x !== a.id)))} />
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-platform-border bg-platform-panel p-1">
                    {a.miniatura
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={a.miniatura} alt="" referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
                      : <span className="font-mono text-[10px] font-semibold uppercase text-platform-text">{a.file_name.split(".").pop()}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{a.label}</p>
                    <p className="truncate font-mono text-[12px] text-platform-text-muted">
                      {a.file_name}{a.size_bytes ? ` · ${tamanho(a.size_bytes)}` : ""}
                    </p>
                    {a.atualizado_em && !a.retirado && (
                      <p data-atualizado className="text-xs text-platform-text-muted">{t(`Atualizado pela marca em ${data(a.atualizado_em)}.`, `Updated by the brand on ${data(a.atualizado_em)}.`)}</p>
                    )}
                    {a.retirado && (
                      <p data-retirado className="text-xs font-bold text-platform-text">{t("Retirado de uso pela marca: não está mais disponível.", "Withdrawn by the brand: no longer available.")}</p>
                    )}
                  </div>
                  {!a.retirado && (
                    <button type="button" data-baixar-arquivo={a.id} disabled={!quem || Boolean(baixando)} onClick={() => void baixar([a.id], a.id)} className={BOTAO_LEVE}>
                      {baixando === a.id ? t("Preparando…", "Preparing…") : t("Baixar", "Download")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <Regra paginas={item.regra} />
          </section>
        ))}
      </div>
    </Moldura>
  );
}
