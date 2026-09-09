import { NextResponse } from "next/server";
import { marcaDaRota } from "@/lib/brandville/contexto-da-rota";
import { BUCKETS, caminhoDeImportacao } from "@/lib/storage/caminhos";
import {
  TETO_DA_FATIA,
  contentRangeForaDoAlcance,
  resolverRange,
  totalDoContentRange,
} from "@/lib/documento-fonte/range";

/**
 * O transporte do documento-fonte: o PDF do manual, por intervalos.
 *
 * POR QUE ESTA ROTA EXISTE, e não uma URL assinada direta. A URL direta foi
 * medida no navegador e não entrega carregamento progressivo: o Storage do
 * Supabase não expõe `accept-ranges` nem `content-range` por CORS, o PDF.js lê
 * exatamente esses dois para decidir se pode pedir intervalos, não os vê,
 * conclui que o servidor não suporta e baixa o arquivo INTEIRO — 11,3 MiB para
 * mostrar a primeira página, contra 0,61 MiB em mesma origem. Não é preferência
 * de arquitetura: é a diferença entre ter e não ter a funcionalidade.
 *
 * O QUE ELA NÃO PROMETE. Nada aqui impede quem pode ver o documento inteiro de
 * obter os bytes. A rota melhora autorização, auditoria e a separação entre ver
 * e baixar — não cria uma garantia que não existe.
 */

/** A URL assinada só precisa durar a viagem até o Storage, do lado do servidor. */
const VALIDADE_DA_ASSINATURA = 60;

/**
 * Cabeçalhos que o cliente pede e que atravessam até a origem sem reescrita.
 *
 * Repassar é o requisito, não reimplementar: cada cabeçalho reconstruído aqui
 * é uma chance de divergir do que o PDF.js espera.
 */
const PEDIDO_REPASSADO = ["range", "if-range", "if-none-match", "if-modified-since"];

/** E os que voltam. `accept-ranges` e `content-range` são o motivo da rota existir. */
const RESPOSTA_REPASSADA = [
  "accept-ranges",
  "content-range",
  "content-length",
  "content-type",
  "etag",
  "last-modified",
];

export async function GET(request: Request, contexto: { params: Promise<{ id: string }> }) {
  return servir(request, contexto, "GET");
}

/**
 * HEAD responde o mesmo, sem corpo.
 *
 * Não é adorno: é como um cliente descobre tamanho e suporte a intervalo sem
 * puxar byte nenhum. O Next não deriva HEAD de GET para rotas de rota.
 */
export async function HEAD(request: Request, contexto: { params: Promise<{ id: string }> }) {
  return servir(request, contexto, "HEAD");
}

async function servir(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  metodo: "GET" | "HEAD",
): Promise<Response> {
  const resolvido = await marcaDaRota(request);
  // A autorização acontece ANTES do primeiro byte: sessão, conta e marca
  // resolvidas sem que nada tenha sido pedido ao Storage.
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, workspaceId, brandId } = resolvido;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  }

  /**
   * O identificador é do DOCUMENTO, nunca um caminho de Storage.
   *
   * Caminho vindo do cliente transformaria a rota em proxy aberto: bastaria
   * trocar a string para ler o arquivo de outra conta com a sessão de quem tem
   * direito a esta. O caminho é resolvido aqui dentro, a partir da linha.
   *
   * Os dois filtros, sempre. `brand_id` sozinho bastaria pela FK composta, mas
   * deixar o workspace de fora tornaria a consulta dependente de uma garantia
   * que vive em outro arquivo.
   */
  const { data: linha, error } = await auth.supabase
    .from("brand_imports")
    .select("import_id, storage_path, pdf_sha256")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "falha_ao_resolver_documento" }, { status: 500 });
  }
  // "Não existe" e "não é sua" respondem igual: responder diferente confirmaria
  // o endereço para quem está sondando.
  if (!linha) return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  /**
   * O caminho gravado é o caminho canônico desta conta para este arquivo?
   *
   * A RLS protege a LINHA; ela não protege o objeto do Storage. Um
   * `storage_path` gravado errado — ou adulterado um dia — assinaria o arquivo
   * de outra conta com a sessão de quem tem direito a esta. É a mesma
   * disciplina de `pertenceAMarca`, para o padrão de pasta da importação, que
   * é `workspaceId/importId/<hash>.pdf` e não `workspaceId/brandId/...`.
   */
  const canonico = caminhoDeImportacao(workspaceId, linha.import_id, linha.pdf_sha256);
  if (linha.storage_path !== canonico) {
    return NextResponse.json({ error: "caminho_nao_canonico" }, { status: 409 });
  }

  const assinada = await auth.supabase.storage
    .from(BUCKETS.importacoes)
    .createSignedUrl(canonico, VALIDADE_DA_ASSINATURA);

  if (assinada.error || !assinada.data?.signedUrl) {
    return NextResponse.json({ error: "documento_indisponivel" }, { status: 502 });
  }

  const pedido = new Headers();
  for (const nome of PEDIDO_REPASSADO) {
    const valor = request.headers.get(nome);
    if (valor) pedido.set(nome, valor);
  }

  let origem: Response;
  try {
    origem = await fetch(assinada.data.signedUrl, {
      method: metodo,
      headers: pedido,
      /**
       * O sinal do cliente atravessa até a origem.
       *
       * Sem isto, fechar a aba deixaria a rota terminando de baixar o que
       * ninguém vai ler — pagando banda e duração de função por bytes
       * descartados. Com ele, o abandono do navegador cancela a leitura.
       */
      signal: request.signal,
      cache: "no-store",
    });
  } catch (causa) {
    // Abandono do cliente não é falha do servidor, e não deve virar erro.
    if (request.signal.aborted) return new Response(null, { status: 499 });
    throw causa;
  }

  if (origem.status === 416) {
    return new Response(null, {
      status: 416,
      headers: {
        "accept-ranges": "bytes",
        "content-range": origem.headers.get("content-range") ?? contentRangeForaDoAlcance(0),
        ...CABECALHOS_FIXOS,
      },
    });
  }

  if (!origem.ok && origem.status !== 206) {
    /**
     * A expiração da URL assinada devolve **400**, não 401 nem 403.
     *
     * Traduzida aqui para 401, que é o que um cliente sabe tratar: pedir a
     * página de novo e retomar de onde estava. Deixar o 400 subir faria o
     * visualizador tratar credencial vencida como documento inválido.
     */
    const status = origem.status === 400 ? 401 : 502;
    return NextResponse.json({ error: "documento_indisponivel" }, { status });
  }

  const cabecalhos = new Headers(CABECALHOS_FIXOS);
  for (const nome of RESPOSTA_REPASSADA) {
    const valor = origem.headers.get(nome);
    if (valor) cabecalhos.set(nome, valor);
  }
  // Sempre anunciado, inclusive no 200: é o que faz o PDF.js decidir pedir
  // intervalos em vez de baixar tudo.
  cabecalhos.set("accept-ranges", "bytes");
  cabecalhos.set("content-type", "application/pdf");

  /**
   * A conferência que impede o pior defeito desta rota.
   *
   * Repassar sem conferir entregaria bytes com status de sucesso quando a
   * origem e nós discordássemos sobre o intervalo — e um PDF montado com um
   * pedaço errado no meio não acusa erro, ele só fica corrompido. O módulo puro
   * calcula o que a resposta DEVERIA ser, com o tamanho total que a própria
   * origem declarou, e a divergência vira recusa em vez de corrupção.
   */
  const contentRangeDaOrigem = origem.headers.get("content-range");
  const total = totalDoContentRange(contentRangeDaOrigem)
    ?? Number(origem.headers.get("content-length") ?? Number.NaN);

  if (Number.isFinite(total)) {
    const esperado = resolverRange(request.headers.get("range"), total);

    if (esperado.tipo === "grande-demais") {
      return NextResponse.json(
        { error: "intervalo_grande_demais", teto: TETO_DA_FATIA, pedidos: esperado.pedidos },
        { status: 413 },
      );
    }
    if (esperado.tipo === "parcial") {
      const dito = contentRangeDaOrigem ?? "";
      if (dito !== `bytes ${esperado.inicio}-${esperado.fim}/${total}`) {
        return NextResponse.json({ error: "intervalo_divergente" }, { status: 502 });
      }
    }
    /**
     * O teto de 4,5 MB por resposta da plataforma.
     *
     * Um corpo acima dele é truncado sem aviso: o cliente receberia menos bytes
     * do que o `content-length` promete e montaria um documento com buraco.
     * Recusar é a única resposta honesta — e é por isso que o visualizador pede
     * intervalos, e não o arquivo inteiro.
     */
    const corpo = Number(cabecalhos.get("content-length") ?? Number.NaN);
    if (Number.isFinite(corpo) && corpo > TETO_DA_FATIA) {
      return NextResponse.json(
        { error: "resposta_grande_demais", teto: TETO_DA_FATIA, pedidos: corpo },
        { status: 413 },
      );
    }
  }

  return new Response(metodo === "HEAD" ? null : origem.body, {
    status: origem.status,
    headers: cabecalhos,
  });
}

const CABECALHOS_FIXOS = {
  /**
   * Ver não é baixar.
   *
   * `inline` mantém a distinção que o produto promete: quem tem permissão de
   * consultar vê o manual no visualizador, sem que o navegador ofereça salvar.
   * A ressalva honesta continua valendo — isto não impede ninguém de obter os
   * bytes; separa a intenção, não fecha uma porta.
   */
  "content-disposition": "inline",
  /**
   * Documento de cliente não fica em cache compartilhado. `private` permite o
   * cache do navegador, que é o que faz voltar a uma página já lida custar
   * zero byte; `no-store` mataria a navegação para trás.
   */
  "cache-control": "private, max-age=0, must-revalidate",
  "x-content-type-options": "nosniff",
} as const;
