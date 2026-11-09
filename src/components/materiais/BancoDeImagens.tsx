"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { ehDoBanco } from "@/lib/assets/eixos";
import { gerarMiniatura } from "@/lib/assets/miniatura";
import { FalhaDoKit, montarZip, salvarArquivo } from "@/lib/assets/zip-no-navegador";
import { createClient } from "@/lib/supabase/client";
import { useMateriais, type ItemDoCatalogo, type Variante } from "./Materiais";

/**
 * Banco de imagens da marca (23/10/2026).
 *
 * Um ÁLBUM é um item de Materiais do tipo `foto` (ou `ilustracao`); cada foto é
 * uma variante dele. Nada de tabela nova: o banco herda RLS, descontinuação,
 * registro de download e o kit em ZIP do acervo que já existe.
 *
 * Tela de miniaturas, ampliação ao clique, seleção de uma ou várias fotos e
 * download. Quem administra a marca cria álbum e envia várias fotos de uma vez.
 */

type T = (pt: string, en: string) => string;

const LIMITE_DE_FOTO_BYTES = 25 * 1024 * 1024;

function base(alvo: { workspaceSlug?: string; brandKey?: string }) {
  return alvo.workspaceSlug && alvo.brandKey ? `/w/${alvo.workspaceSlug}/b/${alvo.brandKey}/docs/biblioteca` : "/docs/biblioteca";
}

function Miniatura({ v, alt, className = "" }: { v: Variante | undefined; alt: string; className?: string }) {
  if (!v?.miniatura) {
    return <div className={`flex items-center justify-center bg-platform-panel text-[11px] text-platform-text-muted ${className}`}>{v ? v.file_name.split(".").pop()?.toUpperCase() : "—"}</div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={v.miniatura} alt={alt} loading="lazy" className={`bg-platform-panel object-cover ${className}`} />;
}

export function BancoDeImagens({ podeGerenciar, albumInicial, raiz }: { podeGerenciar: boolean; albumInicial?: string; raiz?: string }) {
  const en = useIsEnglish();
  const t: T = useCallback((pt: string, ing: string) => (en ? ing : pt), [en]);
  const alvo = useAlvo();
  const { carregando, erro, itens, variantes, recarregar } = useMateriais();
  const [albumId, setAlbumId] = useState(albumInicial ?? "");

  const albuns = useMemo(() => itens.filter((i) => ehDoBanco(i.tipo)), [itens]);
  const fotosDe = useCallback(
    (id: string) => variantes.filter((v) => v.itemId === id && !v.descontinuadoEm),
    [variantes],
  );
  const album = albuns.find((a) => a.id === albumId);
  const totalDeFotos = albuns.reduce((n, a) => n + fotosDe(a.id).length, 0);

  return (
    <section className="px-[var(--space-shell-5)] py-[var(--space-shell-5)] text-platform-text" data-banco-de-imagens>
      <nav aria-label={t("Caminho", "Breadcrumb")} className="text-[12px] text-platform-text-muted">
        <Link href={raiz ?? base(alvo)} className="hover:underline">{t("Materiais", "Materials")}</Link> /{" "}
        {album ? (
          <>
            <button type="button" onClick={() => setAlbumId("")} className="hover:underline">{t("Banco de imagens", "Image bank")}</button> / {album.nome}
          </>
        ) : t("Banco de imagens", "Image bank")}
      </nav>
      <header className="mt-2 flex items-baseline justify-between gap-4 border-b border-platform-border pb-[var(--space-shell-3)]">
        <h1 className="font-display text-[13px] font-bold uppercase tracking-[0.12em]">{album ? album.nome : t("Banco de imagens", "Image bank")}</h1>
        <span className="font-mono text-[12px] tabular-nums text-platform-text-muted" data-banco-contagem>
          {album
            ? `${fotosDe(album.id).length} ${t(fotosDe(album.id).length === 1 ? "foto" : "fotos", fotosDe(album.id).length === 1 ? "photo" : "photos")}`
            : `${albuns.length} ${t(albuns.length === 1 ? "álbum" : "álbuns", albuns.length === 1 ? "album" : "albums")} · ${totalDeFotos} ${t("fotos", "photos")}`}
        </span>
      </header>

      {carregando && <p className="py-[var(--space-shell-5)] text-[13px] text-platform-text-muted">{t("Carregando…", "Loading…")}</p>}
      {erro && <p role="alert" className="py-[var(--space-shell-5)] text-[13px]">{erro}</p>}

      {!carregando && !erro && !album && (
        <ListaDeAlbuns t={t} albuns={albuns} fotosDe={fotosDe} abrir={setAlbumId} podeGerenciar={podeGerenciar} aoCriar={async (id) => { await recarregar(); setAlbumId(id); }} />
      )}
      {!carregando && !erro && albumId && !album && (
        <p className="py-[var(--space-shell-4)] text-[13px]">{t("Este álbum não existe nesta marca.", "This album doesn't exist in this brand.")}</p>
      )}
      {album && <Album t={t} album={album} fotos={fotosDe(album.id)} podeGerenciar={podeGerenciar} aoEnviar={recarregar} />}
    </section>
  );
}

function ListaDeAlbuns({ t, albuns, fotosDe, abrir, podeGerenciar, aoCriar }: {
  t: T; albuns: ItemDoCatalogo[]; fotosDe: (id: string) => Variante[]; abrir: (id: string) => void;
  podeGerenciar: boolean; aoCriar: (id: string) => Promise<void>;
}) {
  const alvo = useAlvo();
  const [nome, setNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [aviso, setAviso] = useState("");

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setCriando(true);
    setAviso("");
    const r = await fetch(comAlvo("/api/admin/assets/itens", alvo), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "foto", nome: nome.trim(), descricao: "" }),
    }).catch(() => null);
    const dados = r ? await r.json().catch(() => ({})) : {};
    setCriando(false);
    if (r?.ok && dados.item?.id) { setNome(""); await aoCriar(dados.item.id); }
    else setAviso(dados.message ?? t("Não foi possível criar o álbum.", "Couldn't create the album."));
  }

  return (
    <div className="mt-[var(--space-shell-5)]">
      {albuns.length === 0 && (
        <p className="text-[13px] text-platform-text-muted">
          {podeGerenciar
            ? t("Esta marca ainda não tem álbuns. Crie o primeiro abaixo e envie as fotos.", "This brand has no albums yet. Create the first one below and upload the photos.")
            : t("Esta marca ainda não tem imagens publicadas.", "This brand has no published images yet.")}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-[var(--space-shell-4)] md:grid-cols-3 xl:grid-cols-4">
        {albuns.map((a) => {
          const fotos = fotosDe(a.id);
          const capa = fotos.find((f) => f.miniatura) ?? fotos[0];
          return (
            <li key={a.id}>
              <button type="button" data-album-do-banco={a.id} onClick={() => abrir(a.id)}
                className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-platform-focus">
                <Miniatura v={capa} alt="" className="aspect-[4/3] w-full rounded-[var(--radius-control)] border border-platform-border group-hover:border-platform-signal-soft" />
                <span className="mt-2 block truncate text-[14px] font-semibold">{a.nome}</span>
                <span className="block font-mono text-[12px] tabular-nums text-platform-text-muted">
                  {fotos.length} {t(fotos.length === 1 ? "foto" : "fotos", fotos.length === 1 ? "photo" : "photos")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {podeGerenciar && (
        <form onSubmit={criar} className="mt-[var(--space-shell-5)] flex flex-wrap items-center gap-2 border-t border-platform-border pt-[var(--space-shell-4)]" data-criar-album>
          <label className="flex items-center gap-2 text-[12px] text-platform-text-muted">
            {t("Novo álbum", "New album")}
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} placeholder={t("Nome do álbum", "Album name")}
              className="h-8 w-56 rounded-[var(--radius-control)] border border-platform-border bg-platform-bg px-2 text-[13px] text-platform-text" />
          </label>
          <button type="submit" disabled={criando || !nome.trim()}
            className="h-8 rounded-[var(--radius-control)] border border-platform-border px-3 text-[13px] hover:border-platform-signal-soft disabled:opacity-40">
            {criando ? t("Criando…", "Creating…") : t("Criar álbum", "Create album")}
          </button>
          {aviso && <span role="alert" className="text-[12px]">{aviso}</span>}
        </form>
      )}
    </div>
  );
}

function Album({ t, album, fotos, podeGerenciar, aoEnviar }: {
  t: T; album: ItemDoCatalogo; fotos: Variante[]; podeGerenciar: boolean; aoEnviar: () => Promise<void>;
}) {
  const alvo = useAlvo();
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [aberta, setAberta] = useState<number | null>(null);
  const [baixando, setBaixando] = useState("");
  const [aviso, setAviso] = useState("");

  const alternar = (id: string) => setMarcadas((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  async function baixar(ids: string[]) {
    setAviso("");
    if (ids.length === 1) { window.location.href = comAlvo(`/api/assets/${ids[0]}/download`, alvo); return; }
    setBaixando(t("Preparando…", "Preparing…"));
    try {
      const r = await fetch(comAlvo("/api/assets/kit", alvo), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: album.id, ids }),
      });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dados.message ?? t("Não foi possível preparar o download.", "Couldn't prepare the download."));
      const zip = await montarZip(dados.arquivos, (prontos, total) => setBaixando(t(`Baixando ${prontos} de ${total}…`, `Downloading ${prontos} of ${total}…`)));
      salvarArquivo(zip, dados.nome);
    } catch (e) {
      setAviso(e instanceof FalhaDoKit
        ? t(`Uma foto não veio (${e.caminho}); nada foi salvo pela metade. Tente de novo.`, `A photo didn't arrive (${e.caminho}); nothing was saved half-done. Try again.`)
        : e instanceof Error ? e.message : t("Não foi possível baixar.", "Couldn't download."));
    } finally {
      setBaixando("");
    }
  }

  const todas = fotos.map((f) => f.id);
  return (
    <div className="mt-[var(--space-shell-4)]">
      <div className="mb-[var(--space-shell-4)] flex flex-wrap items-center gap-2" data-acoes-do-album>
        <button type="button" onClick={() => setMarcadas(marcadas.length === fotos.length ? [] : todas)} disabled={fotos.length === 0}
          className="h-8 rounded-[var(--radius-control)] border border-platform-border px-3 text-[13px] hover:border-platform-signal-soft disabled:opacity-40">
          {marcadas.length === fotos.length && fotos.length > 0 ? t("Limpar seleção", "Clear selection") : t("Selecionar todas", "Select all")}
        </button>
        <button type="button" data-baixar-fotos disabled={marcadas.length === 0 || Boolean(baixando)} onClick={() => void baixar(marcadas)}
          className="h-8 rounded-[var(--radius-control)] bg-platform-text px-3 text-[13px] font-semibold text-platform-bg hover:opacity-90 disabled:opacity-40">
          {baixando || (marcadas.length === 0
            ? t("Baixar", "Download")
            : marcadas.length === 1 ? t("Baixar 1 foto", "Download 1 photo") : t(`Baixar ${marcadas.length} fotos (ZIP)`, `Download ${marcadas.length} photos (ZIP)`))}
        </button>
        {podeGerenciar && <EnviarFotos t={t} album={album} aoEnviar={aoEnviar} />}
      </div>
      {aviso && <p role="alert" className="mb-2 text-[12px]">{aviso}</p>}

      {fotos.length === 0 && (
        <p className="text-[13px] text-platform-text-muted">
          {podeGerenciar ? t("Álbum vazio. Use “Enviar fotos” para adicionar.", "Empty album. Use “Upload photos” to add some.") : t("Este álbum ainda não tem fotos.", "This album has no photos yet.")}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-[var(--space-shell-3)] md:grid-cols-4 xl:grid-cols-6" data-fotos-do-album>
        {fotos.map((f, i) => (
          <li key={f.id} className="relative">
            <button type="button" data-foto-do-album={f.id} onClick={() => setAberta(i)} aria-label={t(`Ampliar ${f.label}`, `Enlarge ${f.label}`)}
              className="block w-full focus-visible:outline-2 focus-visible:outline-platform-focus">
              <Miniatura v={f} alt={f.label} className={`aspect-square w-full rounded-[var(--radius-control)] border ${marcadas.includes(f.id) ? "border-platform-text ring-2 ring-platform-text" : "border-platform-border"}`} />
            </button>
            <input type="checkbox" aria-label={t(`Selecionar ${f.label}`, `Select ${f.label}`)} checked={marcadas.includes(f.id)} onChange={() => alternar(f.id)}
              className="absolute left-2 top-2 h-4 w-4" />
          </li>
        ))}
      </ul>
      {aberta !== null && fotos[aberta] && (
        <Ampliada t={t} fotos={fotos} indice={aberta} mudar={setAberta} baixar={(id) => void baixar([id])} />
      )}
    </div>
  );
}

function Ampliada({ t, fotos, indice, mudar, baixar }: {
  t: T; fotos: Variante[]; indice: number; mudar: (i: number | null) => void; baixar: (id: string) => void;
}) {
  const foto = fotos[indice];
  const fechar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    fechar.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") mudar(null);
      else if (e.key === "ArrowRight") mudar((indice + 1) % fotos.length);
      else if (e.key === "ArrowLeft") mudar((indice - 1 + fotos.length) % fotos.length);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [indice, fotos.length, mudar]);
  return (
    <div role="dialog" aria-modal="true" aria-label={foto.label} data-foto-ampliada
      className="fixed inset-0 z-50 flex flex-col bg-black/80 p-[var(--space-shell-4)]" onClick={() => mudar(null)}>
      <div className="flex items-center justify-between gap-2 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="min-w-0 truncate text-[13px]">{foto.label} · {indice + 1}/{fotos.length}</span>
        <span className="flex gap-2">
          <button type="button" onClick={() => baixar(foto.id)} className="h-8 rounded-[var(--radius-control)] bg-white px-3 text-[13px] font-semibold text-black">{t("Baixar", "Download")}</button>
          <button ref={fechar} type="button" onClick={() => mudar(null)} className="h-8 rounded-[var(--radius-control)] border border-white/60 px-3 text-[13px]">{t("Fechar", "Close")}</button>
        </span>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label={t("Anterior", "Previous")} onClick={() => mudar((indice - 1 + fotos.length) % fotos.length)} className="h-10 w-10 shrink-0 rounded-full border border-white/60 text-white">‹</button>
        {foto.miniatura
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={foto.miniatura} alt={foto.label} className="max-h-full min-w-0 max-w-full object-contain" />
          : <span className="text-white">{foto.file_name}</span>}
        <button type="button" aria-label={t("Próxima", "Next")} onClick={() => mudar((indice + 1) % fotos.length)} className="h-10 w-10 shrink-0 rounded-full border border-white/60 text-white">›</button>
      </div>
    </div>
  );
}

/** Várias fotos de uma vez: o mesmo caminho do envio do acervo (preparar, enviar, concluir). */
function EnviarFotos({ t, album, aoEnviar }: { t: T; album: ItemDoCatalogo; aoEnviar: () => Promise<void> }) {
  const alvo = useAlvo();
  const campo = useRef<HTMLInputElement>(null);
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(arquivos: File[]) {
    setOcupado(true);
    let ok = 0;
    const falhas: string[] = [];
    for (const [i, arquivo] of arquivos.entries()) {
      setMensagem(t(`Enviando ${i + 1} de ${arquivos.length}…`, `Uploading ${i + 1} of ${arquivos.length}…`));
      try {
        if (!arquivo.type.startsWith("image/")) throw new Error(t("não é imagem", "not an image"));
        if (arquivo.size > LIMITE_DE_FOTO_BYTES) throw new Error(t("passa de 25 MB", "over 25 MB"));
        const rotuloDaFoto = arquivo.name.replace(/\.[^.]+$/, "").slice(0, 120) || arquivo.name;
        const preparo = await fetch(comAlvo("/api/admin/assets/envio", alvo), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item: album.id, label: rotuloDaFoto, description: "", substitui: "", fileName: arquivo.name,
            mimeType: arquivo.type, sizeBytes: arquivo.size,
            hierarquia: "", lockup: "", cor: "", polaridade: "", espaco_de_cor: "",
          }),
        });
        const preparado = await preparo.json().catch(() => ({}));
        if (!preparo.ok) throw new Error(preparado.message ?? t("recusada", "refused"));
        const { error } = await createClient().storage.from("brand-assets")
          .uploadToSignedUrl(preparado.caminho, preparado.token, arquivo, { contentType: arquivo.type });
        if (error) throw new Error(t("o envio falhou", "upload failed"));
        const conclusao = new FormData();
        conclusao.set("autorizacao", preparado.autorizacao);
        const miniatura = await gerarMiniatura(arquivo);
        if (miniatura) conclusao.set("miniatura", new File([miniatura], "miniatura.png", { type: "image/png" }));
        const r = await fetch(comAlvo("/api/admin/assets", alvo), { method: "POST", body: conclusao });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? t("recusada", "refused"));
        ok++;
      } catch (e) {
        falhas.push(`${arquivo.name}: ${e instanceof Error ? e.message : t("falhou", "failed")}`);
      }
    }
    setOcupado(false);
    setMensagem(
      falhas.length === 0
        ? t(`${ok} ${ok === 1 ? "foto enviada" : "fotos enviadas"}.`, `${ok} ${ok === 1 ? "photo" : "photos"} uploaded.`)
        : t(`${ok} enviadas; não entraram: ${falhas.join("; ")}`, `${ok} uploaded; failed: ${falhas.join("; ")}`),
    );
    if (campo.current) campo.current.value = "";
    await aoEnviar();
  }

  return (
    <>
      <input ref={campo} type="file" accept="image/*" multiple hidden data-enviar-fotos
        onChange={(e) => { const lista = [...(e.target.files ?? [])]; if (lista.length) void enviar(lista); }} />
      <button type="button" disabled={ocupado} onClick={() => campo.current?.click()}
        className="h-8 rounded-[var(--radius-control)] border border-platform-border px-3 text-[13px] hover:border-platform-signal-soft disabled:opacity-40">
        {t("Enviar fotos", "Upload photos")}
      </button>
      {mensagem && <span className="text-[12px] text-platform-text-muted" aria-live="polite" role="status">{mensagem}</span>}
    </>
  );
}
