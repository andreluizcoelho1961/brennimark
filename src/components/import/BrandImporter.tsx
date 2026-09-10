"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useIsEnglish } from "@/platform/locale-client";
import { slugify } from "@/lib/import/draft";
import { LIMITES_DE_IMPORTACAO } from "@/lib/import/limites";
import { lerPdf, FalhaDeLeitura, renderizarPaginasComoImagem, type ItemDeOutline } from "@/lib/import/pdf";
import { rotuloDoProgresso, type ProgressoDaPublicacao } from "@/lib/import/progresso-da-publicacao";
import { diagnosticar } from "@/lib/import/pdf-erros";
import { detectarRepetidos, linhasUteis } from "@/lib/import/texto";
import {
  agrupar, ehVisualDominante, faixaLegivel, fimDe, inicioDe, type Agrupamento, type Secao,
} from "@/lib/import/secoes";
import { ListaDeSecoes } from "./ListaDeSecoes";
import type { BrandvilleUtilityKey } from "@/brandville/types";
import { caminhoDeAsset, caminhoDeImportacao } from "@/lib/storage/caminhos";
import { enviarArquivosDaImportacao, garantirAusencia } from "@/lib/import/orfaos";
import { portasDeEnvioSupabase } from "@/lib/import/portas-supabase";



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

export function BrandImporter({
  workspaceId,
  workspaceSlug,
  limites = LIMITES_DE_IMPORTACAO,
}: {
  workspaceId: string;
  /** Para montar o endereço da marca recém-criada. O id é a chave do banco;
   *  o slug é o que vai na URL, e os dois não são intercambiáveis. */
  workspaceSlug: string;
  limites?: { maxBytes: number; maxPaginas: number };
}) {
  const isEnglish = useIsEnglish();
  const router = useRouter();
  const t = useCallback((pt: string, en: string) => (isEnglish ? en : pt), [isEnglish]);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [outline, setOutline] = useState<ItemDeOutline[]>([]);
  const [agrupamento, setAgrupamento] = useState<Agrupamento | null>(null);
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [linhasPorPagina, setLinhasPorPagina] = useState<Map<number, string[]>>(new Map());
  const [totalDePaginas, setTotalDePaginas] = useState(0);
  const [hash, setHash] = useState("");
  /**
   * Identidade DESTA tentativa de importação, estável entre as repetições.
   *
   * O caminho era só `conta/hash.pdf`, então duas marcas da mesma conta que
   * importassem o mesmo PDF compartilhariam o objeto — e apagar a primeira
   * levaria o arquivo da segunda, deixando a procedência dela apontando para
   * nada. Havia também corrida: uma tentativa criava o objeto, outra o
   * referenciava, e a primeira falhava e o removia.
   *
   * Objeto exclusivo por importação resolve os três de uma vez, sem contagem
   * de referência. Deduplicar o mesmo PDF pode vir depois, com referência
   * transacional — não de graça, por coincidência de caminho.
   */
  const [importId, setImportId] = useState("");
  const [lendo, setLendo] = useState(false);
  const [publicando, setPublicando] = useState(false);
  /**
   * O que a publicação está fazendo agora.
   *
   * Publicar um manual de identidade leva MINUTOS: cada página visual é
   * renderizada em escala 2 antes de qualquer gravação. Sem relato, o botão
   * ficava em "Publicando…" o tempo todo, e uma espera longa e muda é
   * indistinguível de um travamento — inclusive para quem conhece o código.
   * Numa demonstração, quem espera desiste antes de o produto terminar.
   */
  const [progresso, setProgresso] = useState<ProgressoDaPublicacao | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [nome, setNome] = useState("");
  const [utilidades, setUtilidades] = useState<BrandvilleUtilityKey[]>([]);
  /**
   * O idioma do MANUAL, e não o de quem está importando.
   *
   * Ele já foi derivado do locale da interface, o que desfazia a fronteira do
   * patch 3: uma pessoa com a interface em português importando um manual em
   * inglês faria o assistente responder sobre ele em português, traduzindo
   * termos que a marca definiu. Vem pré-selecionado, mas quem importa confirma.
   */
  const [idiomaDoManual, setIdiomaDoManual] = useState<"pt-BR" | "en">(
    isEnglish ? "en" : "pt-BR",
  );

  const chave = useMemo(() => slugify(nome), [nome]);
  const podePublicar =
    secoes.length > 0 && nome.trim().length > 0 && chave.length > 0;

  const analisar = useCallback(async (selecionado: File) => {
    setMensagem(""); setAgrupamento(null); setSecoes([]); setOutline([]); setLendo(true);
    try {
      /**
       * Nada de checar o MIME.
       *
       * Um navegador pode não declarar tipo nenhum para um PDF perfeitamente
       * válido, e um arquivo que se declara `application/pdf` pode ser
       * qualquer coisa. Quem decide são os cinco primeiros bytes, dentro de
       * lerPdf — e é lá que a leitura única acontece.
       */
      const documento = await lerPdf(selecionado, limites);

      // Cabeçalho e rodapé saem antes de qualquer heurística de título: eles
      // são exatamente o que "linha curta no alto" elegeria por engano.
      const repetidos = detectarRepetidos(documento.paginas);
      const resultado = agrupar({
        paginas: documento.paginas,
        outline: documento.outline,
        repetidos,
      });

      setHash(documento.sha256);
      setImportId(crypto.randomUUID());
      setOutline(documento.outline);
      setAgrupamento(resultado);
      setSecoes(resultado.secoes);
      setTotalDePaginas(documento.totalDePaginas);
      setLinhasPorPagina(new Map(documento.paginas.map((pagina) => [
        pagina.numero,
        linhasUteis(pagina, repetidos).map((linha) => linha.texto),
      ])));
      setArquivo(selecionado);
      if (!nome) setNome(selecionado.name.replace(/\.pdf$/i, ""));
    } catch (erro) {
      if (erro instanceof FalhaDeLeitura) {
        const diagnostico = diagnosticar(erro.falha);
        setMensagem(t(diagnostico.pt, diagnostico.en));
        // O detalhe técnico fica no console e nunca na tela: ele não ajuda
        // quem usa, e não pode carregar nada do conteúdo do arquivo.
        if (erro.falha === "desconhecida" && erro.detalheTecnico) {
          console.error("[importador] leitura falhou:", erro.detalheTecnico);
        }
        return;
      }
      const generico = diagnosticar("desconhecida");
      setMensagem(t(generico.pt, generico.en));
      // O NOME da exceção, não a mensagem: o nome é da classe do erro e não
      // carrega conteúdo do arquivo, enquanto a mensagem pode carregar. Sem
      // ele, uma falha aqui é indiagnosticável — foi o que aconteceu quando o
      // manual de 743 páginas parou de ser lido e o console dizia apenas
      // "falha inesperada".
      console.error(
        "[importador] falha inesperada:",
        erro instanceof Error ? erro.name : typeof erro,
      );
    } finally {
      setLendo(false);
    }
  }, [nome, t, limites]);

  async function publicar() {
    if (!arquivo || !agrupamento) return;
    setPublicando(true); setMensagem(""); setProgresso(null);

    /**
     * O id da marca nasce AQUI, no navegador — não no banco.
     *
     * Toda imagem de página precisa de um caminho `workspaceId/brandId/...`
     * antes de a marca existir (o Storage exige o arquivo antes da RPC que
     * cria a linha). Gerar o id agora, e passar o MESMO id para a RPC em vez
     * de deixar `brands.id` ganhar um `gen_random_uuid()` próprio, evita dois
     * padrões de pasta — decisão registrada na migração
     * `20260904160000_publish_brand_import_client_brand_id.sql`.
     */
    const brandId = crypto.randomUUID();
    const supabase = createClient();

    /**
     * Fase 1g: página visual-dominante vira imagem fiel da própria página.
     *
     * Uma seção não some do texto por ganhar imagem — as duas convivem no
     * mesmo documento. O que muda é só quem manda visualmente: uma abertura
     * de seção com quase nada de texto extraível ganha a imagem que o texto
     * sozinho nunca reconstruiria.
     */
    const paginasVisuais = secoes
      .filter(ehVisualDominante)
      .map((secao) => inicioDe(secao))
      .filter((pagina): pagina is number => pagina !== null);
    if (paginasVisuais.length > 0) {
      setProgresso({ etapa: "renderizando", feito: 0, total: paginasVisuais.length });
    }
    const imagensRenderizadas = await renderizarPaginasComoImagem(arquivo, paginasVisuais, {
      aoProgredir: (feito, total) => setProgresso({ etapa: "renderizando", feito, total }),
    });

    /**
     * As imagens e o PDF sobem juntos, por `enviarArquivosDaImportacao`.
     *
     * A sequência saiu daqui de propósito. O defeito que ela corrige era uma
     * SAÍDA: quando o envio do PDF falhava com algo que não fosse 409, este
     * componente retornava sem tocar nas imagens já enviadas — e como a marca
     * ainda não existia, nada no banco passava a apontar para elas. Ficavam
     * fora do alcance até da fila de exclusão. Um componente não é testável
     * sem navegador, e uma regra de retenção que só é exercida à mão não é uma
     * regra: por isso a decisão vive em `orfaos.ts`, com teste.
     */
    const portas = portasDeEnvioSupabase(supabase, workspaceId);
    const planoDeImagens = secoes.flatMap((secao) => {
      if (!ehVisualDominante(secao)) return [];
      const pagina = inicioDe(secao);
      const blob = pagina !== null ? imagensRenderizadas.get(pagina) : undefined;
      if (!blob) return [];
      return [{
        secaoId: secao.id,
        titulo: secao.titulo,
        caminho: caminhoDeAsset(workspaceId, brandId, `pagina-${pagina}.png`, crypto.randomUUID()),
        dados: blob as unknown,
      }];
    });

    const caminho = caminhoDeImportacao(workspaceId, importId, hash);

    setProgresso({ etapa: "enviando", feito: 0, total: planoDeImagens.length });
    const envio = await enviarArquivosDaImportacao(
      portas,
      {
        imagens: planoDeImagens.map(({ caminho: c, dados }) => ({ caminho: c, dados })),
        pdf: { caminho, dados: arquivo as unknown },
        bucketDeImagens: "brand-assets",
        bucketDoPdf: "brand-imports",
      },
      (feito, total) => setProgresso({ etapa: "enviando", feito, total }),
    );
    setProgresso({ etapa: "gravando", feito: 0, total: 0 });

    if (!envio.ok) {
      // `perdidos` é o único desfecho em que um objeto ficou sem destino.
      // Registrar é o mínimo: sem isso, um arquivo de terceiro sem dono é
      // indistinguível de um arquivo que nunca existiu.
      if (envio.limpeza.perdidos.length > 0) {
        console.error(JSON.stringify({
          level: "error", msg: "importacao_deixou_objeto_sem_destino",
          caminhos: envio.limpeza.perdidos.map((item) => item.caminho),
        }));
      }
      setPublicando(false); setProgresso(null);
      setMensagem(t("Não foi possível enviar o arquivo.", "Couldn't upload the file."));
      return;
    }

    const objetoNovo = envio.objetoNovo;
    const enviadas = new Set(envio.imagensEnviadas);
    const imagensPorSecao = new Map<string, { src: string; alt: string }[]>();
    for (const item of planoDeImagens) {
      if (!enviadas.has(item.caminho)) continue;
      imagensPorSecao.set(item.secaoId, [{ src: item.caminho, alt: item.titulo }]);
    }
    const caminhosDeImagemEnviados = envio.imagensEnviadas;

    const usados = new Set<string>();
    const documentos = secoes.map((secao, indice) => {
      let slug = slugify(secao.titulo) || secao.id;
      if (usados.has(slug)) slug = `${slug}-${indice + 1}`;
      usados.add(slug);
      return {
        slug,
        group: "Manual",
        title: secao.titulo,
        status: "draft" as const,
        body: secao.linhas,
        images: imagensPorSecao.get(secao.id) ?? [],
        // A procedência vai no DOCUMENTO, não só no relatório. O relatório é
        // registro da importação; o documento é o que a recuperação consulta
        // depois, e sem a faixa aqui a citação diria apenas "está no manual".
        sourcePageRanges: secao.sourcePageRanges,
        // Achado da auditoria de produto: antes disso, método/confiança do
        // título só existiam na prévia efêmera da importação — depois de
        // publicado, não havia como distinguir um título real de um
        // fallback "Página 7" sem ler a própria string. Agora viaja com o
        // documento, para a curadoria (Fase 2) filtrar por confiança real.
        metodo: secao.metodo,
        confianca: secao.confianca,
      };
    });

    const { data, error } = await supabase.rpc("publish_brand_import", {
      p_workspace_id: workspaceId,
      p_import_id: importId,
      p_brand_id: brandId,
      p_key: chave,
      p_name: nome.trim(),
      p_short_name: nome.trim().slice(0, 60),
      p_descriptor: t("manual importado, em revisão", "imported manual, under review"),
      p_language: idiomaDoManual,
      p_metadata: { title: nome.trim(), description: "", language: idiomaDoManual },
      p_navigation: {
        groups: ["Manual"],
        groupCodes: { Manual: "MA" },
        defaultDocSlug: documentos[0]?.slug ?? "",
        // Escolha explícita de quem importa. O PDF não decide o que a
        // instalação contratou.
        utilityLinks: utilidades,
      },
      p_theme: TEMA_INICIAL,
      p_ai: { knowledgeMode: "docs", chatRole: "", analysisRole: "" },
      p_legal: { footerNotice: "" },
      p_documents: documentos,
      // O caminho não é enviado: a função o reconstrói a partir da conta, da
      // importação e do hash, e confere se o objeto existe. Um caminho vindo
      // do cliente seria procedência que o cliente escolhe.
      p_pdf_sha256: hash,
      p_page_count: totalDePaginas,
      p_report: {
        // A procedência que a RPC exige: uma entrada por seção, com as faixas
        // de páginas de origem, o método de detecção e a confiança.
        documentos: secoes.map((secao) => ({
          slug: slugify(secao.titulo) || secao.id,
          sourcePageRanges: secao.sourcePageRanges,
          sourcePageStart: inicioDe(secao),
          sourcePageEnd: fimDe(secao),
          faixa: faixaLegivel(secao),
          metodo: secao.metodo,
          confianca: secao.confianca,
        })),
        ignoradas: agrupamento.ignoradas,
        // Cabeçalho e rodapé removidos: decisão de extração, não perda.
        removidosNaExtracao: agrupamento.removidos,
        secoesUnidasPeloLimite: agrupamento.unidasPeloLimite,
        arquivo: arquivo.name,
        bytes: arquivo.size,
      },
    });

    setPublicando(false);
    if (error) {
      /**
       * A limpeza também precisa ser durável.
       *
       * Remover na hora é o caminho feliz. Se ele falhar, o arquivo existiria
       * sem marca, sem procedência e sem entrada na fila — o caminho sobrevive
       * só no estado desta aba, e some quando alguém a fecha. A pendência vai
       * para a mesma fila que a exclusão de marca usa, e a administração a
       * drena depois.
       *
       * O objeto é exclusivo desta importação, então remover não pode levar o
       * arquivo de nenhuma outra marca.
       */
      if (objetoNovo) {
        const remocao = await supabase.storage.from("brand-imports").remove([caminho]);
        if (remocao.error) {
          // Se nem a fila aceitar, o PDF fica fora do Storage limpo e fora da
          // fila. Ignorar este erro foi o que deixou um defeito da função
          // (42P10 em toda chamada) passar sem rastro nenhum.
          const pendencia = await supabase.rpc("enqueue_import_cleanup", {
            p_workspace_id: workspaceId,
            p_import_id: importId,
            p_pdf_sha256: hash,
          });
          if (pendencia.error) {
            console.error(JSON.stringify({
              level: "error", msg: "importacao_deixou_objeto_sem_destino",
              caminhos: [caminho],
              sqlstate: pendencia.error.code,
            }));
          }
        }
      }
      /**
       * As imagens seguem a MESMA garantia do PDF: saem do Storage ou viram
       * pendência durável.
       *
       * O comentário anterior aqui chamava a imagem órfã de "sem custo, nada
       * referencia o caminho". Estava errado nos três sentidos que importam:
       * ausência de referência não elimina armazenamento, não elimina
       * exposição, e não elimina o fato de o arquivo ser material de um
       * terceiro. "Ninguém aponta para ele" descreve exatamente o problema,
       * não a sua ausência — foi assim que o PDF da GE sobreviveu dois dias à
       * decisão de removê-lo.
       */
      const limpezaDasImagens = await garantirAusencia(
        portas,
        caminhosDeImagemEnviados.map((c) => ({ bucket: "brand-assets", caminho: c })),
      );
      if (limpezaDasImagens.perdidos.length > 0) {
        console.error(JSON.stringify({
          level: "error", msg: "importacao_deixou_objeto_sem_destino",
          caminhos: limpezaDasImagens.perdidos.map((item) => item.caminho),
        }));
      }
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
    // A marca acabou de nascer: o destino é ela, e o endereço já existe porque
    // a chave foi escolhida nesta tela.
    router.push(`/w/${workspaceSlug}/b/${chave}/docs`);
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

        {agrupamento && (
          <section className="mt-[var(--space-shell-6)]" aria-labelledby="previa-titulo">
            <h2 id="previa-titulo" className="text-[15px] font-semibold text-platform-text">
              {t("Prévia — nada foi gravado ainda", "Preview — nothing saved yet")}
            </h2>
            <p className="mt-[var(--space-shell-2)] text-[13px] text-platform-text-muted">
              {totalDePaginas} {t("páginas no PDF", "pages in the PDF")} ·{" "}
              {secoes.length} {t("seções", "sections")}
              {agrupamento.ignoradas.length > 0 &&
                ` · ${agrupamento.ignoradas.length} ${t("sem texto", "with no text")}`}
            </p>

            {outline.length > 0 && (
              <p className="mt-[var(--space-shell-3)] border-l-2 border-platform-success pl-[var(--space-shell-3)] text-[13px] leading-relaxed text-platform-text">
                {t(
                  `Este PDF traz um índice com ${outline.length} ${outline.length === 1 ? "entrada" : "entradas"}. Ele é a estrutura declarada por quem fez o manual, e foi usada para dividir as seções.`,
                  `This PDF declares an outline with ${outline.length} ${outline.length === 1 ? "entry" : "entries"}. It's the structure its author intended, and it was used to split the sections.`,
                )}
              </p>
            )}

            {agrupamento.unidasPeloLimite > 0 && (
              <p className="mt-[var(--space-shell-3)] border-l-2 border-platform-warning pl-[var(--space-shell-3)] text-[13px] leading-relaxed text-platform-text">
                {t(
                  `Este manual traria mais seções do que o limite de 500. ${agrupamento.unidasPeloLimite} fronteiras foram dissolvidas para caber, unindo seções vizinhas. Nenhuma página foi perdida, e você pode dividir de novo abaixo.`,
                  `This manual would produce more sections than the limit of 500. ${agrupamento.unidasPeloLimite} boundaries were dissolved to fit, merging neighbouring sections. No page was lost, and you can split them again below.`,
                )}
              </p>
            )}

            {secoes.length === 0 && (
              <p className="mt-[var(--space-shell-3)] border-l-2 border-platform-danger pl-[var(--space-shell-3)] text-[13px] text-platform-text">
                {t(
                  "Nenhuma página do PDF tem texto extraível. Nada seria importado.",
                  "No page in the PDF has extractable text. Nothing would be imported.",
                )}
              </p>
            )}

            {secoes.length > 0 && (
              <ListaDeSecoes
                secoes={secoes}
                linhasPorPagina={linhasPorPagina}
                onMudar={setSecoes}
              />
            )}

            {agrupamento.removidos.length > 0 && (
              <details className="mt-[var(--space-shell-4)] text-[13px] text-platform-text-muted">
                <summary className="min-h-11 cursor-pointer py-2 text-platform-text">
                  {t(
                    `${agrupamento.removidos.length} trechos removidos como cabeçalho ou rodapé`,
                    `${agrupamento.removidos.length} passages removed as header or footer`,
                  )}
                </summary>
                <p className="mt-[var(--space-shell-2)] leading-relaxed">
                  {t(
                    "Eles se repetem na margem de quase todas as páginas, então não entram na leitura editorial. A decisão fica registrada aqui.",
                    "They repeat in the margin of nearly every page, so they don't enter the editorial reading. The decision is recorded here.",
                  )}
                </p>
                <ul className="mt-[var(--space-shell-2)] flex flex-col gap-1">
                  {agrupamento.removidos.slice(0, 20).map((removido) => (
                    <li key={removido.texto}>
                      “{removido.texto}” — {removido.ocorrencias}{" "}
                      {t("páginas", "pages")}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {agrupamento.ignoradas.length > 0 && (
              <details className="mt-[var(--space-shell-3)] text-[13px] text-platform-text-muted">
                <summary className="min-h-11 cursor-pointer py-2 text-platform-text">
                  {t(
                    `${agrupamento.ignoradas.length} páginas sem texto`,
                    `${agrupamento.ignoradas.length} pages with no text`,
                  )}
                </summary>
                <p className="mt-[var(--space-shell-2)] leading-relaxed">
                  {t(
                    "Provavelmente são imagens. Elas não viram seção, e o motivo fica registrado no relatório da importação.",
                    "They're likely images. They don't become sections, and the reason is recorded in the import report.",
                  )}
                </p>
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
                  {t("Idioma do manual", "Manual language")}
                </legend>
                <p className="mt-1 text-[12px] leading-relaxed text-platform-text-muted">
                  {t(
                    "O idioma em que o PDF está escrito. Não é o idioma da interface: o assistente cita o manual e precisa falar a língua dele.",
                    "The language the PDF is written in. Not the interface language: the assistant quotes the manual and must speak its language.",
                  )}
                </p>
                <div className="mt-[var(--space-shell-3)] flex flex-col gap-[var(--space-shell-2)]">
                  {(["pt-BR", "en"] as const).map((idioma) => (
                    <label key={idioma} className="flex min-h-11 items-center gap-[var(--space-shell-3)] text-[14px] text-platform-text">
                      <input
                        type="radio"
                        name="idioma-do-manual"
                        value={idioma}
                        checked={idiomaDoManual === idioma}
                        onChange={() => setIdiomaDoManual(idioma)}
                      />
                      <span>{idioma === "en" ? t("Inglês", "English") : t("Português", "Portuguese")}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

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

                {/*
                  O que será gravado, dito em uma frase.
                  
                  Quatro caixas desmarcadas e uma frase dizendo "nenhuma" são a
                  mesma informação, e não são: a caixa exige que a pessoa
                  perceba a ausência de marca em quatro controles pequenos; a
                  frase afirma. E o rótulo inteiro é clicável, então tocar perto
                  do texto alterna sem que o gesto pareça um clique.

                  Isto não corrige defeito nenhum — a cadeia da tela até o banco
                  está provada gravando `[]`. Existe porque a escolha some no
                  meio de um formulário longo, e o custo de errá-la é uma marca
                  nascer com IA que ninguém pediu.
                */}
                <p
                  data-resumo-de-utilidades
                  className="mt-[var(--space-shell-3)] text-[12px] text-platform-text"
                >
                  {utilidades.length === 0
                    ? t(
                        "Nenhuma funcionalidade de IA será habilitada nesta marca.",
                        "No AI feature will be enabled for this brand.",
                      )
                    : t(
                        `Serão habilitadas: ${utilidades
                          .map((c) => FUNCIONALIDADES.find((f) => f.chave === c)?.pt ?? c)
                          .join(", ")}.`,
                        `Will be enabled: ${utilidades
                          .map((c) => FUNCIONALIDADES.find((f) => f.chave === c)?.en ?? c)
                          .join(", ")}.`,
                      )}
                </p>
              </fieldset>

              <button
                type="button"
                disabled={!podePublicar || publicando}
                onClick={publicar}
                className="mt-[var(--space-shell-5)] flex min-h-11 items-center rounded-[var(--radius-control)] bg-platform-panel px-[var(--space-shell-4)] text-[14px] font-medium text-platform-text hover:bg-platform-signal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus disabled:opacity-40"
              >
                {publicando
                  ? rotuloDoProgresso(progresso, t)
                  : t("Criar a marca com estes rascunhos", "Create the brand with these drafts")}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
