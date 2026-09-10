import { NextResponse } from "next/server";
import { marcaDaRota } from "@/lib/brandville/contexto-da-rota";
import { BUCKETS, caminhoDeImportacao } from "@/lib/storage/caminhos";
import {
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
const VALIDADE_DA_ASSINATURA = 300;

/** Margem de segurança: a assinatura é descartada antes de vencer de verdade. */
const FOLGA_DA_ASSINATURA = 30_000;

/**
 * Assinaturas já emitidas, por caminho canônico.
 *
 * Abrir um manual dispara ~11 pedidos de intervalo, e assinar uma URL nova a
 * cada um custava ~400 ms de ida ao Storage POR PEDIDO — a maior parte do tempo
 * até a primeira página, e nenhuma dela útil.
 *
 * **Por que isto não é um furo de autorização:** a chave do cache é o caminho
 * canônico, que só é montado DEPOIS de a sessão, a conta e a marca terem sido
 * resolvidas e a linha ter sido lida com a RLS valendo. Quem não passa por essa
 * porta nunca chega a consultar o cache — ele não guarda permissão, guarda
 * apenas o endereço assinado de um objeto que o chamador já provou poder ler.
 */
const assinaturas = new Map<string, { url: string; expiraEm: number }>();

async function urlAssinada(
  supabase: { storage: { from(b: string): { createSignedUrl(p: string, s: number): Promise<{ data: { signedUrl: string } | null; error: unknown }> } } },
  caminho: string,
): Promise<string | null> {
  const guardada = assinaturas.get(caminho);
  if (guardada && guardada.expiraEm > Date.now() + FOLGA_DA_ASSINATURA) return guardada.url;

  const nova = await supabase.storage.from(BUCKETS.importacoes).createSignedUrl(caminho, VALIDADE_DA_ASSINATURA);
  if (nova.error || !nova.data?.signedUrl) return null;

  assinaturas.set(caminho, {
    url: nova.data.signedUrl,
    expiraEm: Date.now() + VALIDADE_DA_ASSINATURA * 1000,
  });
  return nova.data.signedUrl;
}

/**
 * Cabeçalhos que o cliente pede e que atravessam até a origem sem reescrita.
 *
 * Repassar é o requisito, não reimplementar: cada cabeçalho reconstruído aqui
 * é uma chance de divergir do que o PDF.js espera.
 */
const PEDIDO_REPASSADO = ["range", "if-range"];

/**
 * Condicionais que só atravessam quando NÃO há intervalo.
 *
 * `If-None-Match` numa requisição com `Range` pode render `304 Not Modified` —
 * e um 304 não tem corpo. O cliente pediu bytes específicos e recebe nada, e o
 * PDF.js fica esperando um pedaço que nunca chega.
 *
 * `If-Range` continua sempre: ele existe justamente para requisição com
 * intervalo, e serve para o servidor recusar colar pedaços de arquivos
 * diferentes.
 */
const CONDICIONAIS_SEM_INTERVALO = ["if-none-match", "if-modified-since"];

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

  const assinada = await urlAssinada(auth.supabase, canonico);
  if (!assinada) {
    return NextResponse.json({ error: "documento_indisponivel" }, { status: 502 });
  }

  const pedido = new Headers();
  const temIntervalo = request.headers.get("range") !== null;
  for (const nome of PEDIDO_REPASSADO) {
    const valor = request.headers.get(nome);
    if (valor) pedido.set(nome, valor);
  }
  if (!temIntervalo) {
    for (const nome of CONDICIONAIS_SEM_INTERVALO) {
      const valor = request.headers.get(nome);
      if (valor) pedido.set(nome, valor);
    }
  }

  let origem: Response;
  try {
    origem = await fetch(assinada, {
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

  /**
   * `304 Not Modified` é SUCESSO, e precisa atravessar intacto.
   *
   * Este foi um defeito real, e ele só aparecia no SEGUNDO carregamento: como a
   * rota repassa `if-none-match`, o navegador manda o validador na volta, o
   * Storage responde 304 — e a verificação abaixo, que trata "não é ok e não é
   * 206" como falha, transformava isso em 502. A primeira visita funcionava e a
   * seguinte quebrava, que é a forma mais confusa possível de um cache falhar.
   *
   * Um 304 não tem corpo por definição, e o navegador serve do cache dele. É a
   * volta mais barata que esta rota consegue dar.
   */
  if (origem.status === 304) {
    const validadores = new Headers(CABECALHOS_FIXOS);
    validadores.set("accept-ranges", "bytes");
    for (const nome of ["etag", "last-modified", "cache-control"]) {
      const valor = origem.headers.get(nome);
      if (valor) validadores.set(nome, valor);
    }
    return new Response(null, { status: 304, headers: validadores });
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

    if (esperado.tipo === "parcial") {
      const dito = contentRangeDaOrigem ?? "";
      if (dito !== `bytes ${esperado.inicio}-${esperado.fim}/${total}`) {
        return NextResponse.json({ error: "intervalo_divergente" }, { status: 502 });
      }
    }
    /**
     * O teto vale para INTERVALO PEDIDO, nunca para a requisição sem `Range`.
     *
     * Este foi o defeito mais caro desta rota, e ele só apareceu com um manual
     * de verdade. A PRIMEIRA requisição do PDF.js vai deliberadamente **sem**
     * `Range`: ela existe para ler `Accept-Ranges` e `Content-Length` e decidir
     * que pode pedir intervalos — e o cliente aborta o corpo assim que os
     * cabeçalhos chegam. A versão anterior media o `content-length` dessa
     * resposta contra o teto e devolvia 413.
     *
     * O efeito: **todo manual acima de 4 MiB era impossível de abrir**, porque
     * a requisição que torna os intervalos possíveis era recusada antes de
     * qualquer intervalo existir. A fixture sintética de 340 KB passava por
     * baixo do teto e escondia o defeito por completo.
     *
     * O teto da plataforma continua real, e continua tratado: quem pede um
     * intervalo grande demais recebe 413 (acima, por `resolverRange`), e quem
     * não pede intervalo nenhum recebe os cabeçalhos e desiste sozinho — o
     * `signal` cancela a origem no mesmo instante, então quase nenhum byte
     * chega a atravessar.
     */
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
   * `private`, e SEM `immutable`.
   *
   * A versão anterior usava `private, max-age=300, immutable`, com o argumento
   * de que o caminho do objeto é o `sha256` do arquivo e portanto os bytes não
   * mudam. O argumento é verdadeiro sobre o ARQUIVO e falso sobre a RESPOSTA:
   * esta URL serve intervalos diferentes, e `immutable` descreve uma
   * representação completa que não varia.
   *
   * A medição que parecia vitória — "quatro saltos, zero bytes transferidos" —
   * era o navegador reaproveitando conteúdo PARCIAL entre intervalos
   * diferentes. Zero byte porque nada foi conferido, não porque nada era
   * necessário. É a classe exata de corrupção que esta rota existe para
   * impedir, apresentada como ganho de desempenho.
   *
   * Cache de intervalo é do PDF.js, que sabe qual pedaço tem. O navegador
   * revalida.
   */
  "cache-control": "private, max-age=0, must-revalidate",
  "x-content-type-options": "nosniff",
} as const;
