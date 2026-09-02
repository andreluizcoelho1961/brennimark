"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";

type Asset = { id: string; label: string; description: string; category: string; file_name: string; mime_type: string; size_bytes: number; status: string; created_at: string; downloadUrl: string | null };
function formatSize(bytes: number) { if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

export function AssetLibrary({ canManage = false }: { canManage?: boolean }) {
  // A marca em que esta tela opera, vinda da URL. Sem ela o servidor não
  // saberia qual, e responderia 409 numa conta com mais de uma.
  const alvo = useAlvo();
  // A biblioteca é instrumento da plataforma: rótulos, erros e estados vazios
  // são do produto. Os nomes dos arquivos é que são da marca.
  const isEnglish = useIsEnglish();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(comAlvo("/api/assets", alvo), { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (response.ok) setAssets(data.assets ?? []); else setMessage(data.message ?? (isEnglish ? "Couldn't load assets." : "Não foi possível carregar os assets."));
  }, [isEnglish, alvo]);
  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      const response = await fetch(comAlvo("/api/assets", alvo), { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (cancelled) return;
      setLoading(false);
      if (response.ok) setAssets(data.assets ?? []); else setMessage(data.message ?? (isEnglish ? "Couldn't load assets." : "Não foi possível carregar os assets."));
    }
    void loadInitial();
    return () => { cancelled = true; };
  }, [isEnglish, alvo]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setUploading(true); setMessage("");
    const form = event.currentTarget;
    const response = await fetch(comAlvo("/api/admin/assets", alvo), { method: "POST", body: new FormData(form) });
    const data = await response.json().catch(() => ({}));
    setUploading(false); setMessage(response.ok ? (isEnglish ? "Asset added to the library." : "Asset adicionado à biblioteca.") : (data.message ?? (isEnglish ? "Couldn't upload." : "Não foi possível enviar.")));
    if (response.ok) { form.reset(); await load(); }
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(isEnglish ? `Remove "${label}" from the library?` : `Remover “${label}” da biblioteca?`)) return;
    const response = await fetch(comAlvo("/api/admin/assets", alvo), { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? (isEnglish ? "Asset removed." : "Asset removido.") : (data.message ?? (isEnglish ? "Couldn't remove." : "Não foi possível remover.")));
    if (response.ok) await load();
  }

  const categories = isEnglish
    ? ["Logos", "Images", "Documents", "Fonts", "Templates", "Other"]
    : ["Logotipos", "Imagens", "Documentos", "Fontes", "Templates", "Outros"];

  return <div>
    {canManage && <form onSubmit={upload} className="grid gap-4 border border-platform-border bg-platform-panel p-5 md:grid-cols-2">
      <label><span className="mb-2 block text-xs font-bold uppercase text-platform-text-muted">{isEnglish ? "Asset name" : "Nome do asset"}</span><input name="label" required maxLength={120} className="w-full border border-platform-border bg-platform-bg px-4 py-3 text-platform-text focus:border-platform-signal focus:outline-none" /></label>
      <label><span className="mb-2 block text-xs font-bold uppercase text-platform-text-muted">{isEnglish ? "Category" : "Categoria"}</span><select name="category" className="w-full border border-platform-border bg-platform-bg px-4 py-3 text-platform-text">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase text-platform-text-muted">{isEnglish ? "Description" : "Descrição"}</span><input name="description" maxLength={500} className="w-full border border-platform-border bg-platform-bg px-4 py-3 text-platform-text focus:border-platform-signal focus:outline-none" /></label>
      <label className="md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase text-platform-text-muted">{isEnglish ? "File — 25 MB max" : "Arquivo — máximo 25 MB"}</span><input name="file" type="file" required className="block w-full border border-platform-border bg-platform-bg p-3 text-sm text-platform-text-muted file:mr-4 file:border-0 file:bg-platform-signal file:px-4 file:py-2 file:font-display file:text-xs file:font-black file:uppercase file:text-platform-bg" /></label>
      <div className="md:col-span-2"><button disabled={uploading} className="bg-platform-signal px-5 py-3 font-display text-xs font-black uppercase text-platform-bg disabled:opacity-50">{uploading ? (isEnglish ? "Uploading…" : "Enviando…") : (isEnglish ? "Add asset" : "Adicionar asset")}</button></div>
    </form>}
    {message && <p role="status" className="mt-4 text-sm text-platform-text-muted">{message}</p>}
    {loading ? <p className="mt-8 text-sm text-platform-text-muted">{isEnglish ? "Loading library…" : "Carregando biblioteca…"}</p> : assets.length === 0 ? <p className="mt-8 border border-dashed border-platform-border p-6 text-sm text-platform-text-muted">{isEnglish ? "No assets have been added yet." : "Nenhum asset foi adicionado ainda."}</p> : <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{assets.map((asset) => <article key={asset.id} className="flex min-h-48 flex-col overflow-hidden border border-platform-border bg-platform-panel">{asset.downloadUrl?.startsWith("/") && asset.mime_type.startsWith("image/") && <div className="relative aspect-[16/9] bg-platform-panel-muted"><Image src={asset.downloadUrl} alt="" fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 40vw, 90vw" className="object-contain p-6" /></div>}<div className="flex flex-1 flex-col p-5"><p className="font-display text-[10px] font-black uppercase tracking-widest text-platform-text">{asset.category}</p><h3 className="mt-3 font-display text-lg font-black uppercase text-platform-text">{asset.label}</h3>{asset.description && <p className="mt-2 text-sm leading-relaxed text-platform-text-muted">{asset.description}</p>}<p className="mt-auto pt-6 font-mono text-[10px] text-platform-text-muted">{asset.file_name} · {formatSize(asset.size_bytes)}</p><div className="mt-4 flex gap-2">{asset.downloadUrl && <a href={asset.downloadUrl} download className="bg-platform-signal px-4 py-2 font-display text-[10px] font-black uppercase text-platform-bg">{isEnglish ? "Download" : "Baixar"}</a>}{canManage && <button type="button" onClick={() => remove(asset.id, asset.label)} className="border border-platform-border px-4 py-2 font-display text-[10px] font-bold uppercase text-platform-text-muted">{isEnglish ? "Remove" : "Remover"}</button>}</div></div></article>)}</div>}
  </div>;
}
