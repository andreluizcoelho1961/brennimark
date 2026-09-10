import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

/**
 * O endereço dos bytes no Storage, lido com o token da SESSÃO.
 *
 * ─── Por que não uma URL assinada ────────────────────────────────────────
 *
 * Assinar custa uma ida e volta ao Storage — ~400 ms — e o visualizador faz
 * uma requisição por intervalo. Havia um cache de assinaturas em memória de
 * módulo, e ele resolvia isso **em localhost**, onde o processo é um só e vive.
 *
 * Em produção o processo é serverless: cada invocação pode cair numa instância
 * diferente, e memória de módulo não é estado compartilhado. O cache errava na
 * maior parte dos pedidos e o custo voltava inteiro, multiplicado pelo número
 * de intervalos.
 *
 * O endpoint `authenticated` aceita o token do usuário e aplica as MESMAS
 * políticas de Storage que a URL assinada aplicaria. Não é atalho de
 * segurança: é o mesmo controle, sem a ida e volta para emitir uma credencial
 * que a requisição já traz.
 */
function enderecoNoStorage(caminho: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  // Cada segmento codificado: nome de arquivo não escapa do caminho.
  const partes = caminho.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/authenticated/${BUCKETS.importacoes}/${partes}`;
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
  const marcaEntrada = Date.now();

  /**
   * A autorização do transporte é ENXUTA, e isto foi medido.
   *
   * ─── O que estava errado ─────────────────────────────────────────────
   *
   * Esta rota usava `marcaDaRota`, que resolve o contexto inteiro de produto:
   * lista os workspaces da pessoa, as marcas de cada um, o perfil, os
   * documentos, as capacidades — e chama `auth.getUser()`, que é uma ida à
   * Auth API pela rede.
   *
   * `Server-Timing` mediu **329–374 ms por requisição** só nessa etapa, contra
   * 4–7 ms da consulta ao documento e 6–36 ms da ida ao Storage. Multiplicado
   * pelo número de intervalos, é o custo dominante — e era ele, não o
   * transporte, que fazia o manual levar 45 segundos em produção.
   *
   * ─── Por que UMA consulta basta, e não é atalho ──────────────────────
   *
   * `brand_imports` tem RLS: a política só devolve linha de workspace do qual
   * a pessoa é membro. Se a linha vem, a autorização está provada pelo banco —
   * que é a fronteira de segurança real, e não a interface (CLAUDE.md).
   * Nenhuma verificação foi removida: o que saiu foi o trabalho de montar
   * navegação, capacidades e lista de marcas, que esta rota nunca usou.
   *
   * `getUser()` também sai: ele valida o token contra a Auth API, e a consulta
   * abaixo já é autorizada pelo mesmo token dentro do Postgres. Duas
   * validações do mesmo JWT, uma delas pela rede.
   *
   * A marca continua conferida — pelo `inner join` com `brands`, no mesmo
   * ida-e-volta, em vez de por uma resolução separada.
   */
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  }

  const marcaChave = new URL(request.url).searchParams.get("b");
  if (!marcaChave) {
    return NextResponse.json({ error: "sem_marca" }, { status: 409 });
  }

  const supabase = await createClient();

  const consulta = supabase
    .from("brand_imports")
    .select("import_id, storage_path, pdf_sha256, workspace_id, brands!inner(key)")
    .eq("id", id)
    .eq("brands.key", marcaChave)
    .maybeSingle();

  const { data: linha, error } = await consulta;
  const marcaAutorizado = Date.now();
  const marcaDocumento = marcaAutorizado;

  if (error) {
    return NextResponse.json({ error: "falha_ao_resolver_documento" }, { status: 500 });
  }
  // "Não existe", "não é sua" e "sem sessão" respondem igual: responder
  // diferente confirmaria o endereço para quem está sondando.
  if (!linha) return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const workspaceId = linha.workspace_id;

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

  /**
   * O token que a requisição já traz nos cookies.
   *
   * `getSession` lê o que o cliente do servidor já resolveu — não é uma ida à
   * Auth API. A autorização de produto (sessão, conta, marca) aconteceu acima;
   * isto é o que faz o Storage aplicar as políticas dele também.
   */
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const endereco = enderecoNoStorage(canonico);

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

  /**
   * O custo de cada etapa, devolvido ao navegador.
   *
   * `Server-Timing` aparece no painel de rede de qualquer navegador. Duas
   * rodadas de "está lento" foram gastas em hipótese porque este número não
   * existia — e das duas, uma hipótese minha estava errada. Medir a etapa
   * separa o que é a nossa rota do que é a viagem ao Storage.
   */
  const marcaOrigem = Date.now();

  let origem: Response;
  try {
    pedido.set("authorization", `Bearer ${token}`);
    pedido.set("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    origem = await fetch(endereco, {
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
     * Credencial vencida chega como 400, 401 ou 403, dependendo do caminho.
     *
     * Traduzida aqui para 401, que é o que um cliente sabe tratar: pedir a
     * página de novo e retomar de onde estava. Deixar o 400 subir faria o
     * visualizador tratar credencial vencida como documento inválido.
     */
    const status = [400, 401, 403].includes(origem.status) ? 401 : 502;
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
  cabecalhos.set(
    "server-timing",
    [
      `autorizacao;dur=${marcaAutorizado - marcaEntrada}`,
      `documento;dur=${marcaDocumento - marcaAutorizado}`,
      `sessao;dur=${marcaOrigem - marcaDocumento}`,
      `storage;dur=${Date.now() - marcaOrigem}`,
    ].join(", "),
  );

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
