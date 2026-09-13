"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";

type Asset = { id: string; label: string; description: string; category: string; file_name: string; mime_type: string; size_bytes: number; status: string; created_at: string; downloadUrl: string | null; descontinuadoEm: string | null; substituidoPor: string | null };
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
    setUploading(false);
    setMessage(
      !response.ok
        ? (data.message ?? (isEnglish ? "Couldn't upload." : "Não foi possível enviar."))
        // A substituição pode falhar depois de o arquivo entrar. Dizer só
        // "adicionado" deixaria os dois em uso sem ninguém saber por quê.
        : data.substituicao === "falhou"
          ? (isEnglish
              ? "The file was added, but the old one is still in use — discontinue it by hand."
              : "O arquivo entrou, mas o antigo continua em uso — descontinue-o à mão.")
          : data.substituicao === "feita"
            ? (isEnglish ? "Asset replaced. The previous one is marked as discontinued." : "Asset substituído. O anterior ficou marcado como descontinuado.")
            : (isEnglish ? "Asset added to the library." : "Asset adicionado à biblioteca."));
    if (response.ok) { form.reset(); await load(); }
  }

  /*
   * Descontinuar, e não remover.
   *
   * O botão apagava: a linha saía e o arquivo ia para a fila de exclusão, sem
   * volta e sem rastro. Agora o asset sai de uso e continua no acervo,
   * identificado e baixável — item 10 do ADR-0007 §2.4. O aviso diz isso, em
   * vez de perguntar "tem certeza?", que não informa nada.
   */
  async function descontinuar(id: string, label: string) {
    if (!window.confirm(isEnglish
      ? `Take "${label}" out of use? It stays in the library, marked as discontinued.`
      : `Tirar “${label}” de uso? Ele continua na biblioteca, marcado como descontinuado.`)) return;
    const response = await fetch(comAlvo("/api/admin/assets", alvo), { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? (isEnglish ? "Asset discontinued." : "Asset descontinuado.") : (data.message ?? (isEnglish ? "Couldn't discontinue." : "Não foi possível descontinuar.")));
    if (response.ok) await load();
  }

  async function reativar(id: string) {
    const response = await fetch(comAlvo("/api/admin/assets", alvo), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? (isEnglish ? "Asset back in use." : "Asset de volta ao uso.") : (data.message ?? (isEnglish ? "Couldn't reactivate." : "Não foi possível reativar.")));
    if (response.ok) await load();
  }

  /*
   * O apagamento definitivo continua existindo, e só aqui.
   *
   * Arquivo subido por engano, ou material de cliente que encerrou contrato,
   * precisa ter saída. Ele deixou de ser o primeiro clique: só alcança o que
   * já está fora de uso, e o aviso diz que não há volta.
   */
  async function removerEmDefinitivo(id: string, label: string) {
    if (!window.confirm(isEnglish
      ? `Delete "${label}" for good? The file is erased and this cannot be undone.`
      : `Apagar “${label}” em definitivo? O arquivo é apagado e não há como desfazer.`)) return;
    const response = await fetch(comAlvo("/api/admin/assets?definitivo=1", alvo), { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? (isEnglish ? "Asset deleted." : "Asset apagado.") : (data.message ?? (isEnglish ? "Couldn't delete." : "Não foi possível apagar.")));
    if (response.ok) await load();
  }

  const categories = isEnglish
    ? ["Logos", "Images", "Documents", "Fonts", "Templates", "Other"]
    : ["Logotipos", "Imagens", "Documentos", "Fontes", "Templates", "Outros"];

  /*
   * Duas listas, e não uma lista com etiqueta.
   *
   * O que está em uso é o acervo; o que foi descontinuado é o histórico. Quem
   * chega para baixar o logo precisa ver o logo, não uma grade em que a versão
   * antiga e a nova disputam o mesmo espaço com uma tarja de diferença.
   * Misturá-las tornaria o item 10 do ADR-0007 um risco em vez de uma garantia.
   */
  const emUso = assets.filter((asset) => !asset.descontinuadoEm);
  const descontinuados = assets.filter((asset) => asset.descontinuadoEm);
  const porId = new Map(assets.map((asset) => [asset.id, asset]));

  function cartao(asset: Asset) {
    const fora = Boolean(asset.descontinuadoEm);
    const sucessor = asset.substituidoPor ? porId.get(asset.substituidoPor) : undefined;
    return (
      <article
        key={asset.id}
        data-asset-descontinuado={fora ? "sim" : undefined}
        className={`flex min-h-48 flex-col overflow-hidden border border-platform-border bg-platform-panel${fora ? " opacity-70" : ""}`}
      >
        {asset.downloadUrl?.startsWith("/") && asset.mime_type.startsWith("image/") && (
          <div className="relative aspect-[16/9] bg-platform-panel-muted">
            <Image src={asset.downloadUrl} alt="" fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 40vw, 90vw" className="object-contain p-6" />
          </div>
        )}
        <div className="flex flex-1 flex-col p-5">
          <p className="font-display text-[10px] font-black uppercase tracking-widest text-platform-text">{asset.category}</p>
          <h3 className="mt-3 font-display text-lg font-black uppercase text-platform-text">{asset.label}</h3>
          {asset.description && <p className="mt-2 text-sm leading-relaxed text-platform-text-muted">{asset.description}</p>}

          {/* A identificação que o item 10 exige: descontinuado é visível e
              DIZ por quê — quando o sucessor existe, ele é nomeado. */}
          {fora && (
            <p className="mt-3 border-l-2 border-platform-border pl-3 text-[12px] leading-relaxed text-platform-text-muted">
              {isEnglish ? "Discontinued" : "Descontinuado"}
              {sucessor
                ? (isEnglish ? ` — replaced by “${sucessor.label}”.` : ` — substituído por “${sucessor.label}”.`)
                : (isEnglish ? " — no replacement." : " — sem substituto.")}
            </p>
          )}

          <p className="mt-auto pt-6 font-mono text-[10px] text-platform-text-muted">{asset.file_name} · {formatSize(asset.size_bytes)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {/* Descontinuado continua baixável: quem precisa da versão anterior
                de um logo é justamente quem tem material antigo para conferir. */}
            {asset.downloadUrl && <a href={asset.downloadUrl} download className="bg-platform-signal px-4 py-2 font-display text-[10px] font-black uppercase text-platform-bg">{isEnglish ? "Download" : "Baixar"}</a>}
            {canManage && !fora && (
              <button type="button" onClick={() => descontinuar(asset.id, asset.label)} className="border border-platform-border px-4 py-2 font-display text-[10px] font-bold uppercase text-platform-text-muted">
                {isEnglish ? "Discontinue" : "Descontinuar"}
              </button>
            )}
            {canManage && fora && (
              <>
                <button type="button" onClick={() => reativar(asset.id)} className="border border-platform-border px-4 py-2 font-display text-[10px] font-bold uppercase text-platform-text-muted">
                  {isEnglish ? "Put back in use" : "Voltar ao uso"}
                </button>
                <button type="button" onClick={() => removerEmDefinitivo(asset.id, asset.label)} className="border border-platform-border px-4 py-2 font-display text-[10px] font-bold uppercase text-platform-text-muted">
                  {isEnglish ? "Delete for good" : "Apagar em definitivo"}
                </button>
              </>
            )}
          </div>
        </div>
      </article>
    );
  }

  const grade = "mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3";

  return <div>
    {canManage && <form onSubmit={upload} className="grid gap-4 border border-platform-border bg-platform-panel p-5 md:grid-cols-2">
      <label><span className="mb-2 block text-xs font-bold uppercase text-platform-text-muted">{isEnglish ? "Asset name" : "Nome do asset"}</span><input name="label" required maxLength={120} className="w-full border border-platform-border bg-platform-bg px-4 py-3 text-platform-text focus:border-platform-signal focus:outline-none" /></label>
      <label><span className="mb-2 block text-xs font-bold uppercase text-platform-text-muted">{isEnglish ? "Category" : "Categoria"}</span><select name="category" className="w-full border border-platform-border bg-platform-bg px-4 py-3 text-platform-text">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase text-platform-text-muted">{isEnglish ? "Description" : "Descrição"}</span><input name="description" maxLength={500} className="w-full border border-platform-border bg-platform-bg px-4 py-3 text-platform-text focus:border-platform-signal focus:outline-none" /></label>
      {/*
        Substituir é um ato do upload, e não um botão em cada card.
        Enquadrar assim diz o que a substituição é — chega um arquivo NOVO e o
        anterior sai de uso — em vez de sugerir que o arquivo de um card é
        trocado por dentro, que é a metáfora que faz a versão antiga sumir.
      */}
      {emUso.length > 0 && <label className="md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase text-platform-text-muted">{isEnglish ? "Replaces (optional)" : "Substitui (opcional)"}</span><select name="substitui" defaultValue="" className="w-full border border-platform-border bg-platform-bg px-4 py-3 text-platform-text"><option value="">{isEnglish ? "— nothing, this is a new asset —" : "— nada, é um asset novo —"}</option>{emUso.map((asset) => <option key={asset.id} value={asset.id}>{asset.label}</option>)}</select></label>}
      <label className="md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase text-platform-text-muted">{isEnglish ? "File — 25 MB max" : "Arquivo — máximo 25 MB"}</span><input name="file" type="file" required className="block w-full border border-platform-border bg-platform-bg p-3 text-sm text-platform-text-muted file:mr-4 file:border-0 file:bg-platform-signal file:px-4 file:py-2 file:font-display file:text-xs file:font-black file:uppercase file:text-platform-bg" /></label>
      <div className="md:col-span-2"><button disabled={uploading} className="bg-platform-signal px-5 py-3 font-display text-xs font-black uppercase text-platform-bg disabled:opacity-50">{uploading ? (isEnglish ? "Uploading…" : "Enviando…") : (isEnglish ? "Add asset" : "Adicionar asset")}</button></div>
    </form>}
    {message && <p role="status" className="mt-4 text-sm text-platform-text-muted">{message}</p>}

    {loading ? <p className="mt-8 text-sm text-platform-text-muted">{isEnglish ? "Loading library…" : "Carregando biblioteca…"}</p>
      : assets.length === 0 ? <p className="mt-8 border border-dashed border-platform-border p-6 text-sm text-platform-text-muted">{isEnglish ? "No assets have been added yet." : "Nenhum asset foi adicionado ainda."}</p>
      : <>
          {emUso.length > 0
            ? <div className={grade}>{emUso.map(cartao)}</div>
            : <p className="mt-8 border border-dashed border-platform-border p-6 text-sm text-platform-text-muted">{isEnglish ? "Nothing in use — everything here has been discontinued." : "Nada em uso — tudo aqui foi descontinuado."}</p>}

          {descontinuados.length > 0 && <section className="mt-12 border-t border-platform-border pt-8">
            <h2 className="font-display text-xs font-black uppercase tracking-widest text-platform-text-muted">{isEnglish ? "Discontinued" : "Descontinuados"}</h2>
            <p className="mt-2 max-w-[42rem] text-sm leading-relaxed text-platform-text-muted">
              {isEnglish
                ? "Out of use, kept on purpose: whoever has older material needs to be able to check what it was."
                : "Fora de uso, guardados de propósito: quem tem material antigo precisa poder conferir o que era."}
            </p>
            <div className={grade}>{descontinuados.map(cartao)}</div>
          </section>}
        </>}
  </div>;
}
