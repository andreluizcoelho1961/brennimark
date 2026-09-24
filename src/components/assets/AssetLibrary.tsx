"use client";

import { useCallback, useEffect, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { gerarMiniatura } from "@/lib/assets/miniatura";
import { rotuloDaPessoa } from "@/lib/acesso/conta-removida";
import { createClient } from "@/lib/supabase/client";

/**
 * O tipo do arquivo — o que o navegador declara, ou, quando ele não sabe (EPS e
 * AI costumam vir sem tipo), o da extensão. É só uma pista: o servidor confere
 * pelos BYTES que chegaram, e recusa o que não bate.
 */
const TIPO_PELA_EXTENSAO: Record<string, string> = {
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  pdf: "application/pdf", ai: "application/pdf", eps: "application/postscript", zip: "application/zip",
  otf: "font/otf", ttf: "font/ttf", woff: "font/woff", woff2: "font/woff2",
};
async function tipoDoArquivo(arquivo: File): Promise<string> {
  const extensao = arquivo.name.split(".").pop()?.toLowerCase() ?? "";
  // AI é PDF quando salvo com compatibilidade (o padrão do Illustrator) e
  // PostScript nas versões antigas: os primeiros bytes dizem qual.
  if (extensao === "ai") {
    const comeco = await arquivo.slice(0, 4).text().catch(() => "");
    return comeco === "%!PS" ? "application/postscript" : "application/pdf";
  }
  if (arquivo.type && arquivo.type !== "application/octet-stream") return arquivo.type;
  return TIPO_PELA_EXTENSAO[extensao] ?? arquivo.type;
}
import { EIXOS, EIXOS_POR_TIPO, TIPOS_DE_ITEM, TIPOS_SEM_UPLOAD, colunasDoTipo, formatoDoArquivo, rotulo, type TipoDeItem } from "@/lib/assets/eixos";

type Eixos = { hierarquia: string | null; lockup: string | null; cor: string | null; polaridade: string | null; espaco_de_cor: string | null };
type Asset = { id: string; itemId: string; label: string; description: string; file_name: string; mime_type: string; size_bytes: number; status: string; created_at: string; baixavel: boolean; descontinuadoEm: string | null; substituidoPor: string | null; eixos: Eixos };
type Item = { id: string; tipo: TipoDeItem; nome: string; descricao: string; ordem: number };
type Download = { id: string; assetId: string | null; pessoa: string; rotulo: string; arquivo: string; quando: string };
function formatSize(bytes: number) { if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

export function AssetLibrary({ canManage = false }: { canManage?: boolean }) {
  // A marca em que esta tela opera, vinda da URL. Sem ela o servidor não
  // saberia qual, e responderia 409 numa conta com mais de uma.
  const alvo = useAlvo();
  // A biblioteca é instrumento da plataforma: rótulos, erros e estados vazios
  // são do produto. Os nomes dos arquivos é que são da marca.
  const isEnglish = useIsEnglish();
  const [itens, setItens] = useState<Item[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [downloads, setDownloads] = useState<Download[] | null>(null);
  // O item escolhido no envio decide quais eixos o formulário pede.
  const [itemDoEnvio, setItemDoEnvio] = useState("");

  const aplicar = useCallback((response: Response, data: { itens?: Item[]; assets?: Asset[]; message?: string }) => {
    setLoading(false);
    if (response.ok) { setItens(data.itens ?? []); setAssets(data.assets ?? []); }
    else setMessage(data.message ?? (isEnglish ? "Couldn't load assets." : "Não foi possível carregar os assets."));
  }, [isEnglish]);

  const load = useCallback(async () => {
    const response = await fetch(comAlvo("/api/assets", alvo), { cache: "no-store" });
    aplicar(response, await response.json().catch(() => ({})));
  }, [alvo, aplicar]);
  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      const response = await fetch(comAlvo("/api/assets", alvo), { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!cancelled) aplicar(response, data);
    }
    void loadInitial();
    return () => { cancelled = true; };
  }, [alvo, aplicar]);

  /*
   * O registro dos downloads iniciados, só para quem gerencia.
   *
   * "Iniciados", e não "quem baixou": o registro prova que a pessoa recebeu um
   * endereço válido para o arquivo, não que os bytes chegaram. Ver
   * `lib/assets/download.ts`.
   *
   * Carregado sob demanda, e não junto com o acervo: é a pergunta de quem
   * administra, feita de vez em quando, e não deve pesar na abertura da
   * biblioteca para quem só veio buscar o logo.
   */
  async function verDownloads() {
    const response = await fetch(comAlvo("/api/assets/downloads", alvo), { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setDownloads(data.downloads ?? []);
    else setMessage(data.message ?? (isEnglish ? "Couldn't load the download record." : "Não foi possível carregar o registro de downloads."));
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setUploading(true); setMessage("");
    const form = event.currentTarget;
    const campos = new FormData(form);
    const arquivo = campos.get("file");
    if (!(arquivo instanceof File) || arquivo.size < 1) { setUploading(false); return; }

    /*
     * O arquivo vai DIRETO ao Storage (24/09/2026): pela função da Vercel ele
     * era cortado em ~4,5 MB, e o produto promete 25 MB. Três passos:
     * preparar (a rota confere e escolhe o caminho), enviar (daqui ao Storage,
     * por um endereço que só serve àquele caminho) e concluir (a rota confere
     * o que chegou e registra). Ver `lib/assets/envio.ts`.
     */
    const erro = (texto: string) => { setUploading(false); setMessage(texto); };
    const tipo = await tipoDoArquivo(arquivo);
    const metadados: Record<string, unknown> = {
      item: campos.get("item"), label: campos.get("label"), description: campos.get("description") ?? "",
      substitui: campos.get("substitui") ?? "", fileName: arquivo.name, mimeType: tipo, sizeBytes: arquivo.size,
    };
    for (const eixo of Object.keys(EIXOS)) metadados[eixo] = campos.get(eixo) ?? "";

    setMessage(isEnglish ? "Preparing the upload…" : "Preparando o envio…");
    const preparo = await fetch(comAlvo("/api/admin/assets/envio", alvo), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metadados),
    });
    const preparado = await preparo.json().catch(() => ({}));
    if (!preparo.ok) return erro(preparado.message ?? (isEnglish ? "Couldn't upload." : "Não foi possível enviar."));

    setMessage(isEnglish ? `Uploading ${arquivo.name}…` : `Enviando ${arquivo.name}…`);
    const { error: erroDoEnvio } = await createClient().storage.from("brand-assets")
      .uploadToSignedUrl(preparado.caminho, preparado.token, arquivo, { contentType: tipo });
    if (erroDoEnvio) return erro(isEnglish ? "The file couldn't be uploaded. Try again." : "Não foi possível enviar o arquivo. Tente de novo.");

    // A miniatura da prévia, gerada AQUI, no navegador de quem envia (fatia 5).
    // Sem prévia possível (EPS), vai sem — a tela diz o formato.
    const conclusao = new FormData();
    conclusao.set("autorizacao", preparado.autorizacao);
    const miniatura = await gerarMiniatura(arquivo);
    if (miniatura) conclusao.set("miniatura", new File([miniatura], "miniatura.png", { type: "image/png" }));
    const response = await fetch(comAlvo("/api/admin/assets", alvo), { method: "POST", body: conclusao });
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
    if (response.ok) { form.reset(); setItemDoEnvio(""); await load(); }
  }

  async function criarItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const form = event.currentTarget;
    const dados = new FormData(form);
    const response = await fetch(comAlvo("/api/admin/assets/itens", alvo), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: dados.get("tipo"), nome: dados.get("nome"), descricao: dados.get("descricao") }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? (isEnglish ? "Item created. Now add its files." : "Item criado. Agora envie os arquivos dele.") : (data.message ?? (isEnglish ? "Couldn't create the item." : "Não foi possível criar o item.")));
    if (response.ok) { form.reset(); setItemDoEnvio(data.item?.id ?? ""); await load(); }
  }

  async function removerItem(id: string, nome: string) {
    if (!window.confirm(isEnglish ? `Remove the empty item "${nome}"?` : `Remover o item vazio “${nome}”?`)) return;
    const response = await fetch(comAlvo("/api/admin/assets/itens", alvo), { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? (isEnglish ? "Item removed." : "Item removido.") : (data.message ?? (isEnglish ? "Couldn't remove the item." : "Não foi possível remover o item.")));
    if (response.ok) await load();
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

  const porId = new Map(assets.map((asset) => [asset.id, asset]));
  const itemEscolhido = itens.find((item) => item.id === itemDoEnvio);
  const campo = "w-full border border-platform-border bg-platform-bg px-4 py-3 text-platform-text focus:border-platform-signal focus:outline-none";
  const rotuloDeCampo = "mb-2 block text-xs font-bold uppercase text-platform-text-muted";
  const botaoSecundario = "border border-platform-border px-3 py-1.5 font-display text-[10px] font-bold uppercase text-platform-text-muted";

  /*
   * Uma linha da matriz é uma variante.
   *
   * As colunas são os eixos que o TIPO usa — a paleta não mostra uma coluna de
   * polaridade vazia, porque "vazio" ali leria como "esqueceram", quando é
   * "não se aplica" (ADR-0007 §2.2, 5).
   */
  function linha(asset: Asset, tipo: TipoDeItem) {
    const fora = Boolean(asset.descontinuadoEm);
    const sucessor = asset.substituidoPor ? porId.get(asset.substituidoPor) : undefined;
    return (
      <tr key={asset.id} data-asset-descontinuado={fora ? "sim" : undefined} data-variante={asset.id}
        className={`border-b border-platform-border/60 align-top${fora ? " opacity-70" : ""}`}>
        {colunasDoTipo(tipo).map((eixo) => (
          <td key={eixo} className="py-3 pr-4 text-platform-text">{asset.eixos[eixo] ? rotulo(asset.eixos[eixo] as string, isEnglish) : "—"}</td>
        ))}
        <td className="py-3 pr-4 font-mono text-[12px] text-platform-text">{formatoDoArquivo(asset.file_name)}</td>
        <td className="py-3 pr-4">
          <p className="text-platform-text">{asset.label}</p>
          <p className="font-mono text-[11px] text-platform-text-muted">{asset.file_name} · {formatSize(asset.size_bytes)}</p>
          {asset.description && <p className="mt-1 text-[12px] leading-relaxed text-platform-text-muted">{asset.description}</p>}
          {/* A identificação que o item 10 exige: descontinuado é visível e
              DIZ por quê — quando o sucessor existe, ele é nomeado. */}
          {fora && (
            <p className="mt-2 border-l-2 border-platform-border pl-3 text-[12px] leading-relaxed text-platform-text-muted">
              {isEnglish ? "Discontinued" : "Descontinuado"}
              {sucessor
                ? (isEnglish ? ` — replaced by “${sucessor.label}”.` : ` — substituído por “${sucessor.label}”.`)
                : (isEnglish ? " — no replacement." : " — sem substituto.")}
            </p>
          )}
        </td>
        <td className="py-3">
          <div className="flex flex-wrap gap-2">
            {/* Descontinuado continua baixável: quem precisa da versão anterior
                de um logo é justamente quem tem material antigo para conferir. */}
            {asset.baixavel && <a href={comAlvo(`/api/assets/${asset.id}/download`, alvo)} download={asset.file_name} className="bg-platform-signal px-3 py-1.5 font-display text-[10px] font-black uppercase text-platform-bg">{isEnglish ? "Download" : "Baixar"}</a>}
            {canManage && !fora && (
              <button type="button" onClick={() => descontinuar(asset.id, asset.label)} className={botaoSecundario}>
                {isEnglish ? "Discontinue" : "Descontinuar"}
              </button>
            )}
            {canManage && fora && (
              <>
                <button type="button" onClick={() => reativar(asset.id)} className={botaoSecundario}>
                  {isEnglish ? "Put back in use" : "Voltar ao uso"}
                </button>
                <button type="button" onClick={() => removerEmDefinitivo(asset.id, asset.label)} className={botaoSecundario}>
                  {isEnglish ? "Delete for good" : "Apagar em definitivo"}
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  }

  function matriz(item: Item, variantes: Asset[], titulo?: string) {
    return (
      <div className="mt-4 overflow-x-auto">
        {titulo && <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-platform-text-muted">{titulo}</p>}
        <table data-matriz-do-item={item.id} className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-platform-border text-[11px] uppercase tracking-wider text-platform-text-muted">
              {colunasDoTipo(item.tipo).map((eixo) => <th key={eixo} className="py-2 pr-4 font-medium">{rotulo(eixo, isEnglish)}</th>)}
              <th className="py-2 pr-4 font-medium">{isEnglish ? "Format" : "Formato"}</th>
              <th className="py-2 pr-4 font-medium">{isEnglish ? "File" : "Arquivo"}</th>
              <th className="py-2 font-medium"><span className="sr-only">{isEnglish ? "Actions" : "Ações"}</span></th>
            </tr>
          </thead>
          <tbody>{variantes.map((asset) => linha(asset, item.tipo))}</tbody>
        </table>
      </div>
    );
  }

  /*
   * Em uso e descontinuado continuam separados, agora DENTRO de cada item.
   *
   * O que está em uso é o acervo; o descontinuado é o histórico. Quem chega
   * para baixar o logo precisa ver o logo, não uma tabela em que a versão
   * antiga e a nova disputam a mesma linha (ADR-0007 §2.4, item 10).
   */
  function secaoDoItem(item: Item) {
    const doItem = assets.filter((asset) => asset.itemId === item.id);
    const emUso = doItem.filter((asset) => !asset.descontinuadoEm);
    const descontinuados = doItem.filter((asset) => asset.descontinuadoEm);
    return (
      <section key={item.id} data-item={item.id} className="border border-platform-border bg-platform-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-[10px] font-black uppercase tracking-widest text-platform-text-muted">{rotulo(item.tipo, isEnglish)}</p>
            <h3 className="mt-2 font-display text-lg font-black uppercase text-platform-text">{item.nome}</h3>
            {item.descricao && <p className="mt-1 max-w-[42rem] text-sm leading-relaxed text-platform-text-muted">{item.descricao}</p>}
          </div>
          {canManage && doItem.length === 0 && (
            <button type="button" onClick={() => removerItem(item.id, item.nome)} className={botaoSecundario}>
              {isEnglish ? "Remove item" : "Remover item"}
            </button>
          )}
        </div>
        {TIPOS_SEM_UPLOAD[item.tipo] === "exige-termo" && (
          <p data-fonte-travada className="mt-4 border-l-2 border-platform-border pl-3 text-[12px] leading-relaxed text-platform-text-muted">
            {isEnglish
              ? "Font files are accepted only after the license term is signed by the subscriber."
              : "Arquivos de fonte só são aceitos depois de o assinante assinar o termo de licença."}
          </p>
        )}
        {emUso.length > 0
          ? matriz(item, emUso)
          : doItem.length === 0
            ? <p className="mt-4 text-sm text-platform-text-muted">{isEnglish ? "No files in this item yet." : "Nenhum arquivo neste item ainda."}</p>
            : <p className="mt-4 text-sm text-platform-text-muted">{isEnglish ? "Nothing in use — every file here has been discontinued." : "Nada em uso — todo arquivo aqui foi descontinuado."}</p>}
        {descontinuados.length > 0 && matriz(item, descontinuados, isEnglish ? "Discontinued — kept on purpose" : "Descontinuados — guardados de propósito")}
      </section>
    );
  }

  const variantesEmUsoDoItem = assets.filter((asset) => asset.itemId === itemDoEnvio && !asset.descontinuadoEm);
  const envioTravado = itemEscolhido ? Boolean(TIPOS_SEM_UPLOAD[itemEscolhido.tipo]) : false;

  return <div>
    {canManage && <div className="grid gap-4 lg:grid-cols-2">
      {/* Item antes de arquivo: o item é o que a pessoa procura ("o logo"), o
          arquivo é uma das formas dele. Criar o item é um ato separado e curto. */}
      <form onSubmit={criarItem} data-form-item className="grid content-start gap-4 border border-platform-border bg-platform-panel p-5">
        <h2 className="font-display text-xs font-black uppercase tracking-widest text-platform-text-muted">{isEnglish ? "New item" : "Novo item"}</h2>
        <label><span className={rotuloDeCampo}>{isEnglish ? "Type" : "Tipo"}</span>
          <select name="tipo" required defaultValue="" className={campo}>
            <option value="" disabled>{isEnglish ? "Choose…" : "Escolha…"}</option>
            {TIPOS_DE_ITEM.map((tipo) => <option key={tipo} value={tipo}>{rotulo(tipo, isEnglish)}</option>)}
          </select>
        </label>
        <label><span className={rotuloDeCampo}>{isEnglish ? "Item name" : "Nome do item"}</span><input name="nome" required maxLength={120} className={campo} /></label>
        <label><span className={rotuloDeCampo}>{isEnglish ? "Description" : "Descrição"}</span><input name="descricao" maxLength={500} className={campo} /></label>
        <div><button className="border border-platform-border px-5 py-3 font-display text-xs font-black uppercase text-platform-text">{isEnglish ? "Create item" : "Criar item"}</button></div>
      </form>

      <form onSubmit={upload} data-form-envio className="grid content-start gap-4 border border-platform-border bg-platform-panel p-5 md:grid-cols-2">
        <h2 className="font-display text-xs font-black uppercase tracking-widest text-platform-text-muted md:col-span-2">{isEnglish ? "Add a file" : "Enviar arquivo"}</h2>
        <label className="md:col-span-2"><span className={rotuloDeCampo}>{isEnglish ? "Item" : "Item"}</span>
          <select name="item" required value={itemDoEnvio} onChange={(event) => setItemDoEnvio(event.target.value)} className={campo}>
            <option value="" disabled>{itens.length ? (isEnglish ? "Choose the item…" : "Escolha o item…") : (isEnglish ? "Create an item first" : "Crie um item antes")}</option>
            {itens.map((item) => <option key={item.id} value={item.id}>{rotulo(item.tipo, isEnglish)} — {item.nome}</option>)}
          </select>
        </label>
        {/*
          Os eixos aparecem depois do item, e só os do tipo dele. Obrigatório é
          `required` — o navegador segura o envio antes de 25 MB subirem. Proibido
          não aparece: não há como mandar polaridade de paleta por esta tela.
        */}
        {itemEscolhido && !envioTravado && colunasDoTipo(itemEscolhido.tipo).map((eixo) => {
          const obrigatorio = EIXOS_POR_TIPO[itemEscolhido.tipo][eixo] === "obrigatorio";
          return (
            <label key={eixo}><span className={rotuloDeCampo}>{rotulo(eixo, isEnglish)}{obrigatorio ? "" : (isEnglish ? " (optional)" : " (opcional)")}</span>
              <select name={eixo} required={obrigatorio} defaultValue="" className={campo}>
                <option value="" disabled={obrigatorio}>{obrigatorio ? (isEnglish ? "Choose…" : "Escolha…") : "—"}</option>
                {EIXOS[eixo].map((valor) => <option key={valor} value={valor}>{rotulo(valor, isEnglish)}</option>)}
              </select>
            </label>
          );
        })}
        {envioTravado
          ? <p className="md:col-span-2 text-sm leading-relaxed text-platform-text-muted">{isEnglish ? "Font files are accepted only after the license term is signed." : "Arquivo de fonte só é aceito depois de assinado o termo de licença."}</p>
          : <>
              <label className="md:col-span-2"><span className={rotuloDeCampo}>{isEnglish ? "File name shown" : "Nome exibido"}</span><input name="label" required maxLength={120} className={campo} /></label>
              <label className="md:col-span-2"><span className={rotuloDeCampo}>{isEnglish ? "Description" : "Descrição"}</span><input name="description" maxLength={500} className={campo} /></label>
              {/*
                Substituir é um ato do upload, e não um botão em cada linha: chega
                um arquivo NOVO e o anterior sai de uso. Só oferece variantes do
                mesmo item — o banco recusa trocar um logo por um ícone.
              */}
              {variantesEmUsoDoItem.length > 0 && <label className="md:col-span-2"><span className={rotuloDeCampo}>{isEnglish ? "Replaces (optional)" : "Substitui (opcional)"}</span><select name="substitui" defaultValue="" className={campo}><option value="">{isEnglish ? "— nothing, this is a new file —" : "— nada, é um arquivo novo —"}</option>{variantesEmUsoDoItem.map((asset) => <option key={asset.id} value={asset.id}>{asset.label} · {asset.file_name}</option>)}</select></label>}
              <label className="md:col-span-2"><span className={rotuloDeCampo}>{isEnglish ? "File — 25 MB max" : "Arquivo — máximo 25 MB"}</span><input name="file" type="file" required className="block w-full border border-platform-border bg-platform-bg p-3 text-sm text-platform-text-muted file:mr-4 file:border-0 file:bg-platform-signal file:px-4 file:py-2 file:font-display file:text-xs file:font-black file:uppercase file:text-platform-bg" /></label>
              <div className="md:col-span-2"><button disabled={uploading || !itemEscolhido} className="bg-platform-signal px-5 py-3 font-display text-xs font-black uppercase text-platform-bg disabled:opacity-50">{uploading ? (isEnglish ? "Uploading…" : "Enviando…") : (isEnglish ? "Add file" : "Enviar arquivo")}</button></div>
            </>}
      </form>
    </div>}
    {message && <p role="status" className="mt-4 text-sm text-platform-text-muted">{message}</p>}

    {loading ? <p className="mt-8 text-sm text-platform-text-muted">{isEnglish ? "Loading library…" : "Carregando biblioteca…"}</p>
      : itens.length === 0 ? <p className="mt-8 border border-dashed border-platform-border p-6 text-sm text-platform-text-muted">{isEnglish ? "No items have been added yet." : "Nenhum item foi cadastrado ainda."}</p>
      : <div className="mt-8 grid gap-4">{itens.map(secaoDoItem)}</div>}

    {canManage && <section className="mt-12 border-t border-platform-border pt-8">
      <h2 className="font-display text-xs font-black uppercase tracking-widest text-platform-text-muted">{isEnglish ? "Downloads started" : "Downloads iniciados"}</h2>
      <p className="mt-2 max-w-[42rem] text-sm leading-relaxed text-platform-text-muted">
        {isEnglish
          ? "Every download is recorded before its link is released: who, which file, and when. It shows the download was started — not that the whole file arrived. Nobody can erase this record."
          : "Todo download é registrado antes de o link ser liberado: quem, qual arquivo e quando. Ele mostra que o download foi iniciado — não que o arquivo chegou inteiro. Ninguém apaga este registro."}
      </p>
      {downloads === null
        ? <button type="button" onClick={verDownloads} className="mt-4 border border-platform-border px-4 py-2 font-display text-[10px] font-bold uppercase text-platform-text-muted">{isEnglish ? "Show the record" : "Ver o registro"}</button>
        : downloads.length === 0
          ? <p className="mt-4 text-sm text-platform-text-muted">{isEnglish ? "No downloads yet." : "Nenhum download ainda."}</p>
          : <div className="mt-4 overflow-x-auto">
              <table data-registro-de-downloads className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-platform-border text-[11px] uppercase tracking-wider text-platform-text-muted">
                    <th className="py-2 pr-4 font-medium">{isEnglish ? "When" : "Quando"}</th>
                    <th className="py-2 pr-4 font-medium">{isEnglish ? "Who" : "Quem"}</th>
                    <th className="py-2 font-medium">{isEnglish ? "File" : "Arquivo"}</th>
                  </tr>
                </thead>
                <tbody>
                  {downloads.map((d) => (
                    <tr key={d.id} className="border-b border-platform-border/60">
                      <td className="py-2 pr-4 font-mono text-[12px] text-platform-text-muted">{new Date(d.quando).toLocaleString(isEnglish ? "en" : "pt-BR")}</td>
                      <td className="py-2 pr-4 text-platform-text">{rotuloDaPessoa(d.pessoa, isEnglish)}</td>
                      <td className="py-2 text-platform-text">
                        {d.rotulo} <span className="font-mono text-[11px] text-platform-text-muted">{d.arquivo}</span>
                        {/* O arquivo pode ter sido apagado em definitivo depois.
                            O registro continua dizendo o que era — é para isso
                            que ele guarda o nome em texto. */}
                        {d.assetId === null && <span className="ml-2 text-[11px] text-platform-text-muted">{isEnglish ? "(file since deleted)" : "(arquivo apagado depois)"}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
    </section>}
  </div>;
}
