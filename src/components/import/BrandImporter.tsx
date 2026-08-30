"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useIsEnglish } from "@/platform/locale-client";
import { montarPrevia, slugify, type Previa } from "@/lib/import/draft";
import type { BrandvilleUtilityKey } from "@/brandville/types";

const TAMANHO_MAXIMO = 50 * 1024 * 1024;

const FUNCIONALIDADES: { chave: BrandvilleUtilityKey; pt: string; en: string }[] = [
  { chave: "chat", pt: "Chat da marca", en: "Brand assistant" },
  { chave: "analysis", pt: "Análise de aplicações", en: "Application review" },
  { chave: "history", pt: "Histórico e calibração", en: "History & calibration" },
  { chave: "ai-settings", pt: "Configurações de IA", en: "AI settings" },
];

/** Neutro de propósito: a paleta da marca é decisão de quem cura, não do PDF. */
const TEMA_INICIAL = {
  background: "#14161a", backgroundSecondary: "#14161a", surface: "#1b1e24",
  surfaceLight: "#242830", foreground: "#f4f5f7", muted: "#9099a8",
  accent: "#f4f5f7", accentSecondary: "#9099a8", border: "#2b3038",
  focus: "#ffffff", fontStack: "var(--font-ui)",
};

async function sha256(arquivo: File): Promise<string> {
  const buffer = await arquivo.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * O PDF é lido NO NAVEGADOR.
 *
 * Ele já está aqui: mandar os bytes para uma rota só para extrair texto
 * significaria transportar dezenas de megabytes por JSON, e a prévia demoraria
 * uma viagem de rede que não precisa acontecer. O arquivo vai direto para o
 * Storage privado, com a sessão da pessoa — a chave privilegiada do Supabase
 * não existe neste caminho.
 */
async function extrairPaginas(arquivo: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const documento = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise;
  const paginas = [];
  for (let numero = 1; numero <= documento.numPages; numero += 1) {
    const pagina = await documento.getPage(numero);
    const conteudo = await pagina.getTextContent();
    const linhas = conteudo.items
      .map((item) => ("str" in item ? item.str : ""))
      .join("\n")
      .split("\n");
    paginas.push({ numero, linhas });
  }
  return paginas;
}

export function BrandImporter({ workspaceId }: { workspaceId: string }) {
  const isEnglish = useIsEnglish();
  const router = useRouter();
  const t = useCallback((pt: string, en: string) => (isEnglish ? en : pt), [isEnglish]);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [hash, setHash] = useState("");
  const [lendo, setLendo] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [nome, setNome] = useState("");
  const [utilidades, setUtilidades] = useState<BrandvilleUtilityKey[]>([]);

  const chave = useMemo(() => slugify(nome), [nome]);
  const podePublicar =
    Boolean(previa) && previa!.erros.length === 0 && nome.trim().length > 0 && chave.length > 0;

  const analisar = useCallback(async (selecionado: File) => {
    setMensagem(""); setPrevia(null); setLendo(true);
    try {
      if (selecionado.type !== "application/pdf") {
        setMensagem(t("O arquivo precisa ser um PDF.", "The file must be a PDF."));
        return;
      }
      if (selecionado.size > TAMANHO_MAXIMO) {
        setMensagem(t("O PDF passa de 50 MB.", "The PDF is larger than 50 MB."));
        return;
      }
      const [paginas, digest] = await Promise.all([
        extrairPaginas(selecionado),
        sha256(selecionado),
      ]);
      setHash(digest);
      // Prévia: nada é gravado aqui.
      setPrevia(montarPrevia(paginas));
      setArquivo(selecionado);
      if (!nome) setNome(selecionado.name.replace(/\.pdf$/i, ""));
    } catch {
      setMensagem(t("Não foi possível ler este PDF.", "Couldn't read this PDF."));
    } finally {
      setLendo(false);
    }
  }, [nome, t]);

  async function publicar() {
    if (!arquivo || !previa) return;
    setPublicando(true); setMensagem("");
    const supabase = createClient();
    const caminho = `${workspaceId}/${hash}.pdf`;

    const envio = await supabase.storage
      .from("brand-imports")
      .upload(caminho, arquivo, { contentType: "application/pdf", upsert: true });
    if (envio.error) {
      setPublicando(false);
      setMensagem(t("Não foi possível enviar o arquivo.", "Couldn't upload the file."));
      return;
    }

    const { data, error } = await supabase.rpc("publish_brand_import", {
      p_workspace_id: workspaceId,
      p_key: chave,
      p_name: nome.trim(),
      p_short_name: nome.trim().slice(0, 60),
      p_descriptor: t("manual importado, em revisão", "imported manual, under review"),
      p_language: isEnglish ? "en" : "pt-BR",
      p_metadata: { title: nome.trim(), description: "", language: isEnglish ? "en" : "pt-BR" },
      p_navigation: {
        groups: ["Manual"],
        groupCodes: { Manual: "MA" },
        defaultDocSlug: previa.documentos[0]?.slug ?? "",
        // Escolha explícita de quem importa. O PDF não decide o que a
        // instalação contratou.
        utilityLinks: utilidades,
      },
      p_theme: TEMA_INICIAL,
      p_ai: { knowledgeMode: "docs", chatRole: "", analysisRole: "" },
      p_legal: { footerNotice: "" },
      p_documents: previa.documentos,
      p_storage_path: caminho,
      p_pdf_sha256: hash,
      p_page_count: previa.paginasNoPdf,
      p_report: {
        avisos: previa.avisos,
        ignoradas: previa.ignoradas,
        arquivo: arquivo.name,
        bytes: arquivo.size,
      },
    });

    setPublicando(false);
    if (error) {
      // Chave repetida é conflito, não erro genérico: já existe uma marca com
      // este nome, e sobrescrever apagaria curadoria.
      const conflito = error.code === "23505" || /duplicate key/i.test(error.message);
      setMensagem(
        conflito
          ? t(
              `Já existe uma marca com a chave "${chave}". Escolha outro nome — importar por cima apagaria o que já foi revisado.`,
              `A brand with the key "${chave}" already exists. Choose another name — importing over it would erase reviewed content.`,
            )
          : t("Não foi possível publicar a importação.", "Couldn't publish the import."),
      );
      return;
    }

    void data;
    router.push("/docs");
    router.refresh();
  }

  return (
    <div className="px-[var(--space-shell-5)] py-[var(--space-shell-6)]">
      <div className="mx-auto max-w-[46rem]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-platform-text-muted">
          {t("Importar", "Import")}
        </p>
        <h1 className="mt-[var(--space-shell-4)] text-[clamp(1.6rem,3.2vw,2.2rem)] font-semibold leading-[1.1] tracking-tight text-platform-text">
          {t("Trazer um manual em PDF", "Bring a brand manual in")}
        </h1>
        <p className="mt-[var(--space-shell-4)] text-[15px] leading-relaxed text-platform-text-muted">
          {t(
            "O texto é extraído e vira um rascunho. Nada é publicado como regra sem alguém confirmar — toda página entra como rascunho, e você revisa depois.",
            "The text is extracted into a draft. Nothing is published as a rule without someone confirming — every page starts as a draft for you to review.",
          )}
        </p>

        <label className="mt-[var(--space-shell-6)] flex min-h-11 w-full cursor-pointer items-center gap-[var(--space-shell-3)] rounded-[var(--radius-control)] border border-dashed border-platform-border px-[var(--space-shell-4)] py-[var(--space-shell-4)] text-[14px] text-platform-text-muted hover:border-platform-signal-soft hover:text-platform-text focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-platform-focus">
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(evento) => {
              const selecionado = evento.target.files?.[0];
              if (selecionado) void analisar(selecionado);
            }}
          />
          <span aria-hidden>＋</span>
          <span>{arquivo ? arquivo.name : t("Escolher um PDF", "Choose a PDF")}</span>
        </label>

        {lendo && (
          <p role="status" className="mt-[var(--space-shell-4)] text-[13px] text-platform-text-muted">
            {t("Lendo o arquivo…", "Reading the file…")}
          </p>
        )}

        {mensagem && (
          <p
            role="status"
            className="mt-[var(--space-shell-4)] border-l-2 border-platform-warning pl-[var(--space-shell-3)] text-[13px] leading-relaxed text-platform-text"
          >
            {mensagem}
          </p>
        )}

        {previa && (
          <section className="mt-[var(--space-shell-6)]" aria-labelledby="previa-titulo">
            <h2 id="previa-titulo" className="text-[15px] font-semibold text-platform-text">
              {t("Prévia — nada foi gravado ainda", "Preview — nothing saved yet")}
            </h2>
            <p className="mt-[var(--space-shell-2)] text-[13px] text-platform-text-muted">
              {previa.paginasNoPdf} {t("páginas no PDF", "pages in the PDF")} ·{" "}
              {previa.documentos.length} {t("virariam páginas do manual", "would become manual pages")}
              {previa.ignoradas.length > 0 &&
                ` · ${previa.ignoradas.length} ${t("sem texto", "with no text")}`}
            </p>

            {previa.erros.map((erro) => (
              <p
                key={erro}
                className="mt-[var(--space-shell-3)] border-l-2 border-platform-danger pl-[var(--space-shell-3)] text-[13px] text-platform-text"
              >
                {erro}
              </p>
            ))}

            {previa.documentos.length > 0 && (
              <ol className="mt-[var(--space-shell-4)] flex flex-col gap-[var(--space-shell-2)]">
                {previa.documentos.slice(0, 40).map((documento) => (
                  <li
                    key={documento.slug}
                    className="flex flex-wrap items-baseline gap-[var(--space-shell-2)] border-b border-platform-border pb-[var(--space-shell-2)]"
                  >
                    <span className="text-[14px] text-platform-text">{documento.title}</span>
                    <span className="font-mono text-[11px] text-platform-text-muted">
                      /{documento.slug}
                    </span>
                    <span className="ml-auto rounded-[var(--radius-control)] bg-platform-panel px-2 py-0.5 text-[10px] uppercase tracking-wide text-platform-warning">
                      {t("Rascunho", "Draft")}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {previa.avisos.length > 0 && (
              <details className="mt-[var(--space-shell-4)] text-[13px] text-platform-text-muted">
                <summary className="min-h-11 cursor-pointer py-2 text-platform-text">
                  {previa.avisos.length} {t("avisos", "warnings")}
                </summary>
                <ul className="mt-[var(--space-shell-2)] flex flex-col gap-1">
                  {previa.avisos.map((aviso) => (
                    <li key={`${aviso.pagina}-${aviso.tipo}`}>
                      {t("Página", "Page")} {aviso.pagina}: {aviso.detalhe}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="mt-[var(--space-shell-6)] border-t border-platform-border pt-[var(--space-shell-5)]">
              <label className="block">
                <span className="mb-2 block text-[13px] font-medium text-platform-text">
                  {t("Nome da marca", "Brand name")}
                </span>
                <input
                  value={nome}
                  onChange={(evento) => setNome(evento.target.value)}
                  maxLength={120}
                  className="h-11 w-full rounded-[var(--radius-control)] border border-platform-border bg-platform-panel px-[var(--space-shell-3)] text-[14px] text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
                />
                {chave && (
                  <span className="mt-1 block font-mono text-[11px] text-platform-text-muted">
                    {t("chave", "key")}: {chave}
                  </span>
                )}
              </label>

              <fieldset className="mt-[var(--space-shell-5)]">
                <legend className="text-[13px] font-medium text-platform-text">
                  {t("Funcionalidades desta marca", "Features for this brand")}
                </legend>
                <p className="mt-1 text-[12px] leading-relaxed text-platform-text-muted">
                  {t(
                    "Escolha explícita: o PDF não decide o que a instalação usa.",
                    "An explicit choice: the PDF doesn't decide what the installation uses.",
                  )}
                </p>
                <div className="mt-[var(--space-shell-3)] flex flex-col gap-[var(--space-shell-2)]">
                  {FUNCIONALIDADES.map((item) => (
                    <label key={item.chave} className="flex min-h-11 items-center gap-[var(--space-shell-3)] text-[14px] text-platform-text">
                      <input
                        type="checkbox"
                        checked={utilidades.includes(item.chave)}
                        onChange={(evento) =>
                          setUtilidades((atual) =>
                            evento.target.checked
                              ? [...atual, item.chave]
                              : atual.filter((c) => c !== item.chave),
                          )
                        }
                      />
                      <span>{t(item.pt, item.en)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <button
                type="button"
                disabled={!podePublicar || publicando}
                onClick={publicar}
                className="mt-[var(--space-shell-5)] flex min-h-11 items-center rounded-[var(--radius-control)] bg-platform-panel px-[var(--space-shell-4)] text-[14px] font-medium text-platform-text hover:bg-platform-signal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus disabled:opacity-40"
              >
                {publicando
                  ? t("Publicando…", "Publishing…")
                  : t("Criar a marca com estes rascunhos", "Create the brand with these drafts")}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
