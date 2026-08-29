"use client";

import { useEffect, useState } from "react";
import type { DocPageEntry, DocStatus } from "@/content/docs";
import { brandvilleInstance } from "@/brandville/config";
import { historyActionLabel } from "@/lib/brandville/history-action";

const isEnglish = brandvilleInstance.metadata.language === "en";

type Version = {
  id: string;
  action: string;
  actionLabel: string;
  actorLabel: string;
  createdAt: string;
  title: string;
  status: DocStatus;
  preview: string;
  changedFields: string[];
  isCurrent: boolean;
};

const STATUS_LABEL: Record<DocStatus, string> = isEnglish
  ? { ready: "Approved", draft: "Draft", pending: "In progress" }
  : { ready: "Pronto", draft: "Rascunho", pending: "Em construção" };
const DATE_FORMAT = new Intl.DateTimeFormat(isEnglish ? "en-US" : "pt-BR", { dateStyle: "short", timeStyle: "short" });

export function VersionHistory({ slug, onRecovered }: { slug: string; onRecovered: (document: DocPageEntry) => void }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [pageDeleted, setPageDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch(`/api/admin/content/history?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (cancelled) return;
      setLoading(false);
      if (response.ok) {
        setVersions(data.versions ?? []);
        setPageDeleted(Boolean(data.pageDeleted));
      } else {
        setMessage(data.message ?? (isEnglish ? "Couldn't load history." : "Não foi possível carregar o histórico."));
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [slug]);

  async function recover(version: Version) {
    const confirmMessage = isEnglish
      ? `Restore the version from ${DATE_FORMAT.format(new Date(version.createdAt))}? The current version will stay preserved in history.`
      : `Recuperar a versão de ${DATE_FORMAT.format(new Date(version.createdAt))}? A versão atual continuará preservada no histórico.`;
    if (!window.confirm(confirmMessage)) return;
    setRecoveringId(version.id); setMessage("");
    const response = await fetch("/api/admin/content/history", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId: version.id }),
    });
    const data = await response.json().catch(() => ({}));
    setRecoveringId(null);
    if (!response.ok) {
      setMessage(data.message ?? (isEnglish ? "Couldn't restore this version." : "Não foi possível recuperar esta versão."));
      return;
    }
    setMessage(isEnglish ? "Version recovered and published. The guide and the AI now use this content." : "Versão recuperada e publicada. O guia e a IA já usam este conteúdo.");
    onRecovered(data.document as DocPageEntry);
  }

  return (
    <section className="mt-10 border-t border-border-default pt-8" aria-labelledby="version-history-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-release-analog-turquoise">{isEnglish ? "Editorial audit" : "Auditoria editorial"}</p>
          <h2 id="version-history-title" className="mt-2 font-display text-2xl font-black uppercase text-release-analog-white">{isEnglish ? "Version history" : "Histórico de versões"}</h2>
        </div>
        {pageDeleted && <span className="border border-border-default px-3 py-1 font-display text-[10px] font-bold uppercase text-text-secondary">{isEnglish ? "Page deleted" : "Página excluída"}</span>}
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">{isEnglish ? "Every publish, restore and deletion is logged automatically. History can't be edited or deleted from the interface — a deleted page can still be recovered from here." : "Cada publicação, recuperação e exclusão é registrada automaticamente. O histórico não pode ser editado ou apagado pela interface — uma página excluída ainda pode ser recuperada daqui."}</p>

      {loading && <p role="status" className="mt-6 text-sm text-text-secondary">{isEnglish ? "Loading history…" : "Carregando histórico…"}</p>}
      {message && <p role="status" className="mt-5 border-l-2 border-release-analog-turquoise pl-4 text-sm text-text-secondary">{message}</p>}
      {!loading && versions.length === 0 && !message && <p className="mt-6 border border-dashed border-border-default p-5 text-sm text-text-secondary">{isEnglish ? "No versions of this page yet. The first save will start the timeline." : "Ainda não há versões desta página. O primeiro salvamento iniciará a linha do tempo."}</p>}

      {versions.length > 0 && <ol className="mt-6 space-y-3">
        {versions.map((version) => <li key={version.id} className="border border-border-default bg-surface-primary p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-1 font-display text-[9px] font-black uppercase ${historyActionLabel(version.action).muted ? "border border-border-default text-text-secondary" : "bg-release-analog-turquoise text-release-analog-black"}`}>
                  {version.actionLabel}
                </span>
                {version.isCurrent && <span className="border border-release-analog-white px-2 py-1 font-display text-[9px] font-black uppercase text-release-analog-white">{isEnglish ? "Current version" : "Versão atual"}</span>}
                <span className="font-display text-[9px] font-bold uppercase text-text-secondary">{STATUS_LABEL[version.status]}</span>
              </div>
              <h3 className="mt-3 font-display text-base font-black uppercase text-release-analog-white">{version.title}</h3>
              <p className="mt-1 font-mono text-[10px] text-text-secondary"><time dateTime={version.createdAt}>{DATE_FORMAT.format(new Date(version.createdAt))}</time> · {version.actorLabel}</p>
            </div>
            <button type="button" disabled={version.isCurrent || recoveringId !== null} onClick={() => recover(version)} className="border border-border-default px-4 py-2 font-display text-[10px] font-bold uppercase text-release-analog-white hover:border-release-analog-white disabled:opacity-40">
              {recoveringId === version.id ? (isEnglish ? "Restoring…" : "Recuperando…") : version.isCurrent ? (isEnglish ? "In use" : "Em uso") : (isEnglish ? "Restore version" : "Recuperar versão")}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">{version.changedFields.map((field) => <span key={field} className="border border-border-default px-2 py-1 text-[10px] uppercase tracking-wide text-text-secondary">{field}</span>)}</div>
          <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-text-secondary">{version.preview}</p>
        </li>)}
      </ol>}
    </section>
  );
}
