"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

type Asset = { id: string; label: string; description: string; category: string; file_name: string; mime_type: string; size_bytes: number; status: string; created_at: string; downloadUrl: string | null };
function formatSize(bytes: number) { if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

export function AssetLibrary({ canManage = false, language = "pt" }: { canManage?: boolean; language?: string }) {
  const isEnglish = language === "en";
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/assets", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (response.ok) setAssets(data.assets ?? []); else setMessage(data.message ?? (isEnglish ? "Couldn't load assets." : "Não foi possível carregar os assets."));
  }, [isEnglish]);
  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      const response = await fetch("/api/assets", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (cancelled) return;
      setLoading(false);
      if (response.ok) setAssets(data.assets ?? []); else setMessage(data.message ?? (isEnglish ? "Couldn't load assets." : "Não foi possível carregar os assets."));
    }
    void loadInitial();
    return () => { cancelled = true; };
  }, [isEnglish]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setUploading(true); setMessage("");
    const form = event.currentTarget;
    const response = await fetch("/api/admin/assets", { method: "POST", body: new FormData(form) });
    const data = await response.json().catch(() => ({}));
    setUploading(false); setMessage(response.ok ? (isEnglish ? "Asset added to the library." : "Asset adicionado à biblioteca.") : (data.message ?? (isEnglish ? "Couldn't upload." : "Não foi possível enviar.")));
    if (response.ok) { form.reset(); await load(); }
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(isEnglish ? `Remove "${label}" from the library?` : `Remover “${label}” da biblioteca?`)) return;
    const response = await fetch("/api/admin/assets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? (isEnglish ? "Asset removed." : "Asset removido.") : (data.message ?? (isEnglish ? "Couldn't remove." : "Não foi possível remover.")));
    if (response.ok) await load();
  }

  const categories = isEnglish
    ? ["Logos", "Images", "Documents", "Fonts", "Templates", "Other"]
    : ["Logotipos", "Imagens", "Documentos", "Fontes", "Templates", "Outros"];

  return <div>
    {canManage && <form onSubmit={upload} className="grid gap-4 border border-border-default bg-surface-primary p-5 md:grid-cols-2">
      <label><span className="mb-2 block text-xs font-bold uppercase text-text-secondary">{isEnglish ? "Asset name" : "Nome do asset"}</span><input name="label" required maxLength={120} className="w-full border border-border-default bg-background-primary px-4 py-3 text-release-analog-white focus:border-release-analog-turquoise focus:outline-none" /></label>
      <label><span className="mb-2 block text-xs font-bold uppercase text-text-secondary">{isEnglish ? "Category" : "Categoria"}</span><select name="category" className="w-full border border-border-default bg-background-primary px-4 py-3 text-release-analog-white">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase text-text-secondary">{isEnglish ? "Description" : "Descrição"}</span><input name="description" maxLength={500} className="w-full border border-border-default bg-background-primary px-4 py-3 text-release-analog-white focus:border-release-analog-turquoise focus:outline-none" /></label>
      <label className="md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase text-text-secondary">{isEnglish ? "File — 25 MB max" : "Arquivo — máximo 25 MB"}</span><input name="file" type="file" required className="block w-full border border-border-default bg-background-primary p-3 text-sm text-text-secondary file:mr-4 file:border-0 file:bg-release-analog-turquoise file:px-4 file:py-2 file:font-display file:text-xs file:font-black file:uppercase file:text-release-analog-black" /></label>
      <div className="md:col-span-2"><button disabled={uploading} className="bg-release-analog-turquoise px-5 py-3 font-display text-xs font-black uppercase text-release-analog-black disabled:opacity-50">{uploading ? (isEnglish ? "Uploading…" : "Enviando…") : (isEnglish ? "Add asset" : "Adicionar asset")}</button></div>
    </form>}
    {message && <p role="status" className="mt-4 text-sm text-text-secondary">{message}</p>}
    {loading ? <p className="mt-8 text-sm text-text-secondary">{isEnglish ? "Loading library…" : "Carregando biblioteca…"}</p> : assets.length === 0 ? <p className="mt-8 border border-dashed border-border-default p-6 text-sm text-text-secondary">{isEnglish ? "No assets have been added yet." : "Nenhum asset foi adicionado ainda."}</p> : <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{assets.map((asset) => <article key={asset.id} className="flex min-h-48 flex-col overflow-hidden border border-border-default bg-surface-primary">{asset.downloadUrl?.startsWith("/") && asset.mime_type.startsWith("image/") && <div className="relative aspect-[16/9] bg-surface-light"><Image src={asset.downloadUrl} alt="" fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 40vw, 90vw" className="object-contain p-6" /></div>}<div className="flex flex-1 flex-col p-5"><p className="font-display text-[10px] font-black uppercase tracking-widest text-release-analog-turquoise">{asset.category}</p><h3 className="mt-3 font-display text-lg font-black uppercase text-release-analog-white">{asset.label}</h3>{asset.description && <p className="mt-2 text-sm leading-relaxed text-text-secondary">{asset.description}</p>}<p className="mt-auto pt-6 font-mono text-[10px] text-text-secondary">{asset.file_name} · {formatSize(asset.size_bytes)}</p><div className="mt-4 flex gap-2">{asset.downloadUrl && <a href={asset.downloadUrl} download className="bg-release-analog-turquoise px-4 py-2 font-display text-[10px] font-black uppercase text-release-analog-black">{isEnglish ? "Download" : "Baixar"}</a>}{canManage && <button type="button" onClick={() => remove(asset.id, asset.label)} className="border border-border-default px-4 py-2 font-display text-[10px] font-bold uppercase text-text-secondary">{isEnglish ? "Remove" : "Remover"}</button>}</div></div></article>)}</div>}
  </div>;
}
