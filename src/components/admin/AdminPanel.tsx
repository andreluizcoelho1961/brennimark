"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DocPageEntry, DocStatus } from "@/content/docs";
import { AssetLibrary } from "@/components/assets/AssetLibrary";
import { VersionHistory } from "@/components/admin/VersionHistory";
import { brandvilleInstance } from "@/brandville/config";

const isEnglish = brandvilleInstance.metadata.language === "en";

const STATUS_LABEL: Record<DocStatus, string> = isEnglish
  ? { ready: "Approved", draft: "Draft", pending: "In progress" }
  : { ready: "Pronto", draft: "Rascunho", pending: "Em construção" };

type DeletedPage = { slug: string; title: string; deletedAt: string };

export function AdminPanel({
  initialDocs,
  deletedPages = [],
  groups,
}: {
  initialDocs: DocPageEntry[];
  /** Páginas sem linha viva que ainda têm histórico. Elas continuam
   *  selecionáveis porque é de lá que a recuperação parte. */
  deletedPages?: DeletedPage[];
  groups: readonly string[];
}) {
  const [docs, setDocs] = useState(initialDocs);
  const [persistedDocs, setPersistedDocs] = useState(initialDocs);
  const [excluidas, setExcluidas] = useState(deletedPages);
  const [slug, setSlug] = useState(initialDocs[0]?.slug ?? deletedPages[0]?.slug ?? "");
  const selected = docs.find((doc) => doc.slug === slug);
  const persisted = persistedDocs.find((doc) => doc.slug === slug);
  const excluidaSelecionada = excluidas.find((pagina) => pagina.slug === slug);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(selected) !== JSON.stringify(persisted),
    [selected, persisted],
  );

  function selectPage(nextSlug: string) {
    if (hasUnsavedChanges && !window.confirm(isEnglish ? "Discard unsaved changes?" : "Descartar as mudanças que ainda não foram salvas?")) return;
    if (persisted) setDocs((current) => current.map((doc) => doc.slug === slug ? persisted : doc));
    setSlug(nextSlug);
    setMessage("");
  }

  function update(patch: Partial<DocPageEntry>) {
    setDocs((current) => current.map((doc) => doc.slug === slug ? { ...doc, ...patch } : doc));
    setMessage("");
  }

  async function save() {
    if (!selected) return;
    setSaving(true); setMessage("");
    const response = await fetch("/api/admin/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selected) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (response.ok) {
      setPersistedDocs((current) => current.map((doc) => doc.slug === slug ? selected : doc));
      setHistoryRevision((value) => value + 1);
    }
    setMessage(response.ok
      ? (isEnglish ? "Page saved. The guide and the AI now use this version." : "Página salva. O guia e a IA já usam esta versão.")
      : (result.message ?? (isEnglish ? "Couldn't save." : "Não foi possível salvar.")));
  }

  /**
   * Excluir a página. Antes isto se chamava "restaurar matriz" e devolvia a
   * página ao registro em código; sem matriz, apagar apaga. O conteúdo fica no
   * histórico, e é de lá que ele volta.
   */
  async function excluir() {
    if (!selected) return;
    const confirmacao = isEnglish
      ? `Delete "${selected.title}"? It leaves the guide immediately. The content stays in the version history and can be recovered from there.`
      : `Excluir "${selected.title}"? Ela sai do guia imediatamente. O conteúdo continua no histórico de versões e pode ser recuperado de lá.`;
    if (!window.confirm(confirmacao)) return;
    setSaving(true); setMessage("");
    const response = await fetch("/api/admin/content", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      // A página sai do guia e entra na lista de excluídas — continua
      // selecionável, que é o que torna a recuperação alcançável.
      setExcluidas((atual) => [
        { slug, title: selected.title, deletedAt: new Date().toISOString() },
        ...atual.filter((pagina) => pagina.slug !== slug),
      ]);
      setDocs(docs.filter((doc) => doc.slug !== slug));
      setPersistedDocs((current) => current.filter((doc) => doc.slug !== slug));
    }
    setSaving(false);
    setMessage(response.ok
      ? (isEnglish ? "Page deleted. It's still in the history." : "Página excluída. Ela continua no histórico.")
      : (result.message ?? (isEnglish ? "Couldn't delete." : "Não foi possível excluir.")));
  }

  function handleRecovered(document: DocPageEntry) {
    // A página pode ter sido excluída: neste caso a recuperação a traz de
    // volta à lista em vez de substituir uma entrada existente.
    const repor = (atual: DocPageEntry[]) =>
      atual.some((doc) => doc.slug === document.slug)
        ? atual.map((doc) => (doc.slug === document.slug ? { ...document } : doc))
        : [...atual, { ...document }];
    setDocs(repor);
    setPersistedDocs(repor);
    setExcluidas((atual) => atual.filter((pagina) => pagina.slug !== document.slug));
    setSlug(document.slug);
    setMessage(isEnglish ? "Version recovered and published. The guide and the AI now use this content." : "Versão recuperada e publicada. O guia e a IA já usam este conteúdo.");
    setHistoryRevision((value) => value + 1);
  }

  // Página excluída: sem editor, porque não há linha para editar. O histórico
  // continua aberto, e é dele que ela volta inteira.
  if (!selected && excluidaSelecionada) {
    return (
      <div className="px-page-inline py-12 md:py-16">
        <p className="font-display text-xs font-black uppercase tracking-[0.24em] text-text-secondary">{isEnglish ? "Deleted page" : "Página excluída"}</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-none text-release-analog-white md:text-5xl">{excluidaSelecionada.title}</h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-secondary">{isEnglish ? "This page is no longer in the guide. Its full content — text, images and blocks — is preserved in the history below, and restoring any version brings the page back." : "Esta página não está mais no guia. O conteúdo completo — texto, imagens e blocos — continua preservado no histórico abaixo, e recuperar qualquer versão traz a página de volta."}</p>
        {(docs.length > 0 || excluidas.length > 1) && (
          <div className="mt-8">
            <label htmlFor="admin-excluida" className="mb-2 block font-display text-[10px] font-bold uppercase tracking-widest text-text-secondary">{isEnglish ? "Page" : "Página"}</label>
            <select id="admin-excluida" value={slug} onChange={(event) => setSlug(event.target.value)} className="w-full max-w-md border border-border-default bg-background-primary px-3 py-3 text-sm text-release-analog-white">
              {docs.map((doc) => <option key={doc.slug} value={doc.slug}>{doc.title}</option>)}
              {excluidas.map((pagina) => <option key={pagina.slug} value={pagina.slug}>{pagina.title} — {isEnglish ? "deleted" : "excluída"}</option>)}
            </select>
          </div>
        )}
        <VersionHistory key={`${slug}-${historyRevision}`} slug={slug} onRecovered={handleRecovered} />
      </div>
    );
  }

  // A administração edita o que existe; criar página é o importador de PDF.
  // Antes esta tela quebrava com lista vazia, porque presumia que o registro em
  // código sempre teria conteúdo.
  if (!selected) {
    return (
      <div className="px-page-inline py-12 md:py-16">
        <p className="font-display text-xs font-black uppercase tracking-[0.24em] text-release-analog-turquoise">{isEnglish ? "Administration" : "Administração"}</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-none text-release-analog-white md:text-6xl">{isEnglish ? "No pages yet" : "Nenhuma página ainda"}</h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-secondary">{isEnglish ? "This brand has no published pages. Pages arrive when a brand manual is imported." : "Esta marca ainda não tem páginas publicadas. As páginas chegam quando um manual é importado."}</p>
        <div className="mt-12 border-t border-border-default pt-12">
          <p className="font-display text-xs font-black uppercase tracking-[0.24em] text-release-analog-turquoise">{isEnglish ? "Library" : "Biblioteca"}</p>
          <h2 className="mt-3 font-display text-3xl font-black uppercase text-release-analog-white">{isEnglish ? "Official assets" : "Assets oficiais"}</h2>
          <div className="mt-8"><AssetLibrary canManage language={brandvilleInstance.metadata.language} /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-page-inline py-12 md:py-16">
      <p className="font-display text-xs font-black uppercase tracking-[0.24em] text-release-analog-turquoise">{isEnglish ? "Administration" : "Administração"}</p>
      <h1 className="mt-3 font-display text-4xl font-black uppercase leading-none text-release-analog-white md:text-6xl">{isEnglish ? "Content and assets" : "Conteúdo e assets"}</h1>
      <p className="mt-5 max-w-3xl text-base leading-relaxed text-text-secondary">{isEnglish ? "Update the guide without touching code. Every save is recorded in the version history, and also feeds the assistant." : "Atualize o guia sem alterar o código. Cada salvamento entra no histórico de versões e passa a orientar também o assistente."}</p>

      <section className="mt-12 grid gap-8 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border border-border-default bg-surface-primary p-3">
          <label htmlFor="admin-page" className="block px-2 pb-2 font-display text-[10px] font-bold uppercase tracking-widest text-text-secondary">{isEnglish ? "Page" : "Página"}</label>
          <select id="admin-page" value={slug} onChange={(event) => selectPage(event.target.value)} className="w-full border border-border-default bg-background-primary px-3 py-3 text-sm text-release-analog-white xl:hidden">
            {docs.map((doc) => <option key={doc.slug} value={doc.slug}>{doc.title}</option>)}
          </select>
          <div className="hidden max-h-[34rem] overflow-y-auto xl:block">
            {groups.map((group) => <div key={group} className="mb-4">
              <p className="px-2 py-2 font-display text-[10px] font-black uppercase tracking-wider text-release-analog-turquoise">{group}</p>
              {docs.filter((doc) => doc.group === group).map((doc) => <button key={doc.slug} type="button" onClick={() => selectPage(doc.slug)} className={`block w-full px-2 py-2 text-left text-sm ${doc.slug === slug ? "bg-release-analog-turquoise text-release-analog-black" : "text-text-secondary hover:text-release-analog-white"}`}>{doc.title}</button>)}
            </div>)}
            {excluidas.length > 0 && <div className="mb-4 border-t border-border-default pt-3">
              <p className="px-2 py-2 font-display text-[10px] font-black uppercase tracking-wider text-text-secondary">{isEnglish ? "Deleted" : "Excluídas"}</p>
              {excluidas.map((pagina) => <button key={pagina.slug} type="button" onClick={() => selectPage(pagina.slug)} className="block w-full px-2 py-2 text-left text-sm text-text-secondary line-through hover:text-release-analog-white">{pagina.title}</button>)}
            </div>}
          </div>
        </aside>

        <div className="border border-border-default p-5 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className="font-mono text-[10px] text-text-secondary">/docs/{selected.slug}</p><p className="mt-1 text-xs text-text-secondary">{hasUnsavedChanges ? (isEnglish ? "Unsaved changes" : "Mudanças ainda não salvas") : (isEnglish ? "Published" : "Publicada")}</p></div>
            <Link href={`/docs/${selected.slug}`} className="border border-border-default px-4 py-2 font-display text-xs font-bold uppercase text-release-analog-white hover:border-release-analog-white">{isEnglish ? "View page" : "Ver página"}</Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-secondary">{isEnglish ? "Title" : "Título"}</span><input value={selected.title} maxLength={120} onChange={(event) => update({ title: event.target.value })} className="w-full border border-border-default bg-background-primary px-4 py-3 text-release-analog-white focus:border-release-analog-turquoise focus:outline-none" /></label>
            <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-secondary">{isEnglish ? "Section" : "Seção"}</span><select value={selected.group} onChange={(event) => update({ group: event.target.value })} className="w-full border border-border-default bg-background-primary px-4 py-3 text-release-analog-white focus:border-release-analog-turquoise focus:outline-none">{groups.map((group) => <option key={group}>{group}</option>)}</select></label>
            <label className="block md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-secondary">{isEnglish ? "Editorial status" : "Status editorial"}</span><select value={selected.status} onChange={(event) => update({ status: event.target.value as DocStatus })} className="w-full border border-border-default bg-background-primary px-4 py-3 text-release-analog-white focus:border-release-analog-turquoise focus:outline-none">{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-secondary">{isEnglish ? "Text" : "Texto"} <span className="normal-case font-normal">{isEnglish ? "— separate paragraphs with a blank line" : "— separe os parágrafos com uma linha em branco"}</span></span><textarea value={(selected.body ?? []).join("\n\n")} onChange={(event) => update({ body: event.target.value.split(/\n\s*\n/) })} rows={14} className="w-full resize-y border border-border-default bg-background-primary px-4 py-3 text-sm leading-relaxed text-release-analog-white focus:border-release-analog-turquoise focus:outline-none" /></label>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" disabled={saving || !hasUnsavedChanges} onClick={save} className="bg-release-analog-turquoise px-5 py-3 font-display text-xs font-black uppercase text-release-analog-black disabled:opacity-50">{saving ? (isEnglish ? "Saving…" : "Salvando…") : (isEnglish ? "Save page" : "Salvar página")}</button>
            <button type="button" disabled={saving} onClick={excluir} className="border border-border-default px-5 py-3 font-display text-xs font-bold uppercase text-text-secondary disabled:opacity-40">{isEnglish ? "Delete page" : "Excluir página"}</button>
            {message && <p role="status" className="text-sm text-text-secondary">{message}</p>}
          </div>
          <VersionHistory key={`${slug}-${historyRevision}`} slug={slug} onRecovered={handleRecovered} />
        </div>
      </section>

      <section className="mt-16 border-t border-border-default pt-12">
        <p className="font-display text-xs font-black uppercase tracking-[0.24em] text-release-analog-turquoise">{isEnglish ? "Library" : "Biblioteca"}</p>
        <h2 className="mt-3 font-display text-3xl font-black uppercase text-release-analog-white">{isEnglish ? "Official assets" : "Assets oficiais"}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">{isEnglish ? "Upload logos, images, PDFs, fonts, and ZIP packages. Files stay private and download links expire automatically." : "Envie logos, imagens, PDFs, fontes e pacotes ZIP. Os arquivos ficam privados e os links de download expiram automaticamente."}</p>
        <div className="mt-8"><AssetLibrary canManage language={brandvilleInstance.metadata.language} /></div>
      </section>
    </div>
  );
}
