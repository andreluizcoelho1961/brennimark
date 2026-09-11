import { NextResponse } from "next/server";
import {
  TETO_DA_FATIA,
  contentRangeForaDoAlcance,
  rangeParaOrigem,
  resolverRange,
  totalDoContentRange,
} from "./range";
import { caminhoDeImportacao } from "../storage/caminhos";

/**
 * O transporte do documento-fonte, com as dependências INJETADAS.
 *
 * ─── Por que a lógica não vive na rota ───────────────────────────────────
 *
 * A rota é um módulo do App Router: só exporta verbos HTTP, e nada dentro dela
 * é alcançável por teste. O resultado era que a única cobertura do transporte
 * vinha de `/dev/fixture`, que é OUTRA rota — sem sessão, sem RLS, sem
 * conferência de caminho canônico. Testar a rota de desenvolvimento e chamar
 * isso de teste do transporte foi a lacuna apontada na revisão de 10/09.
 *
 * Com as portas explícitas, a rota real passa a ser exercitável com Storage e
 * banco controlados — e os casos que importam (fatia acima do teto, caminho
 * adulterado, sessão ausente, 416, 304) deixam de depender de rede.
 *
 * O padrão é o mesmo de `src/lib/import/portas-supabase.ts`, que já existe no
 * projeto pelo mesmo motivo.
 */
export type LinhaDoDocumento = {
  import_id: string;
  storage_path: string;
  pdf_sha256: string;
  workspace_id: string;
};

export interface PortasDoDocumento {
  /** A consulta autorizada pela RLS: se a linha vem, o banco provou o acesso. */
  documento(
    id: string,
    marcaChave: string,
  ): Promise<{ linha: LinhaDoDocumento | null; error: unknown }>;
  /** O token da sessão, para o Storage aplicar as políticas dele. */
  token(): Promise<string | undefined>;
  /** O endereço dos bytes, montado a partir do caminho canônico. */
  endereco(caminho: string): string;
  apikey: string;
  /** A ida à origem. Injetada para o teste não depender de rede. */
  buscar(url: string, init: RequestInit): Promise<Response>;
}

/**
 * Condicionais que só atravessam quando NÃO há intervalo.
 *
 * `If-None-Match` numa requisição com `Range` pode render `304 Not Modified` —
 * e um 304 não tem corpo. O cliente pediu bytes específicos e recebe nada, e o
 * PDF.js fica esperando um pedaço que nunca chega.
 */
const CONDICIONAIS_SEM_INTERVALO = ["if-none-match", "if-modified-since"];

/** Os cabeçalhos que voltam. `accept-ranges` e `content-range` são o motivo da rota existir. */
const RESPOSTA_REPASSADA = [
  "accept-ranges",
  "content-range",
  "content-length",
  "content-type",
  "etag",
  "last-modified",
];

/**
 * Recusa a resposta da origem FECHANDO o corpo dela.
 *
 * ─── O vazamento que isto corrige ────────────────────────────────────────
 *
 * As recusas depois do `fetch` — 413, 502, credencial vencida — devolviam sem
 * tocar em `origem.body`. O corpo é um `ReadableStream` aberto: sem cancelar,
 * a conexão com o Storage continua, e a função segue pagando banda e duração
 * por bytes que ninguém vai ler. É exatamente o custo que o `signal` do
 * cliente existe para evitar, escapando por outra porta.
 *
 * `cancel()` pode rejeitar se o corpo já terminou ou já foi consumido; isso
 * não é erro e não deve mascarar o motivo da recusa.
 */
async function recusar(origem: Response, resposta: Response): Promise<Response> {
  try {
    await origem.body?.cancel();
  } catch {
    // Já encerrado ou já consumido: nada a fazer.
  }
  return resposta;
}

export async function servirDocumentoFonte(
  request: Request,
  { id, metodo }: { id: string; metodo: "GET" | "HEAD" },
  portas: PortasDoDocumento,
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
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  }

  const marcaChave = new URL(request.url).searchParams.get("b");
  if (!marcaChave) {
    return NextResponse.json({ error: "sem_marca" }, { status: 409 });
  }

  const { linha, error } = await portas.documento(id, marcaChave);
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
  const token = await portas.token();
  if (!token) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const endereco = portas.endereco(canonico);

  const pedido = new Headers();
  const intervaloPedido = request.headers.get("range");
  const temIntervalo = intervaloPedido !== null;

  /**
   * O `Range` vai à origem já APARADO ao teto.
   *
   * A versão anterior repassava o pedido original e só conferia o tamanho
   * depois da resposta — então um pedido acima de 4 MiB voltava da origem
   * maior que o teto, a conferência acusava divergência, e a rota respondia
   * **502** em vez de entregar a fatia aparada. Aparar antes é o que torna o
   * teto uma promessa cumprida e não uma recusa tardia.
   */
  const intervaloParaOrigem = rangeParaOrigem(intervaloPedido);
  if (intervaloParaOrigem) pedido.set("range", intervaloParaOrigem);

  const seOriginalIntacto = request.headers.get("if-range");
  if (seOriginalIntacto) pedido.set("if-range", seOriginalIntacto);
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
    pedido.set("apikey", portas.apikey);
    origem = await portas.buscar(endereco, {
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
    // 416 não tem corpo por definição; cancelar é inofensivo e mantém a regra
    // uniforme — toda saída pós-`fetch` que não repassa o corpo, fecha o corpo.
    return recusar(origem, new Response(null, {
      status: 416,
      headers: {
        "accept-ranges": "bytes",
        "content-range": origem.headers.get("content-range") ?? contentRangeForaDoAlcance(0),
        ...CABECALHOS_FIXOS,
      },
    }));
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
    return recusar(origem, NextResponse.json({ error: "documento_indisponivel" }, { status }));
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
   * NENHUMA resposta desta rota passa do teto — inclusive a sem `Range`.
   *
   * ─── A história desta verificação, porque ela já foi removida uma vez ───
   *
   * Ela existia, foi removida, e a remoção estava certa NAQUELE momento: o
   * visualizador passava a URL ao PDF.js, que fazia uma primeira requisição
   * SEM `Range` para descobrir se havia suporte a intervalo. A verificação
   * recusava essa sondagem com 413, e nenhum manual acima de 4 MiB abria.
   *
   * O que mudou: o visualizador não sonda mais. Ele faz `HEAD` para saber o
   * tamanho e usa `PDFDataRangeTransport` — nenhuma requisição sem `Range`
   * sai dele, e há teste de navegador trancando exatamente essa invariante.
   *
   * Então a verificação volta, e agora sem quebrar nada. Ela é o que faz a
   * garantia ser ABSOLUTA em vez de depender de o cliente se comportar: a
   * resposta de uma função da Vercel é truncada acima de 4,5 MB, e corpo
   * truncado com `content-length` cheio é um PDF corrompido sem aviso.
   *
   * Arquivo ABAIXO do teto continua sendo servido inteiro numa requisição só —
   * é o caminho mais rápido para um manual pequeno, e não há motivo para
   * proibi-lo.
   *
   * NÃO REMOVA esta verificação sem antes garantir que nenhum cliente pede o
   * arquivo inteiro. Foi o que aconteceu da última vez.
   */
  /*
   * E o teto NÃO vale para `HEAD`.
   *
   * `HEAD` não tem corpo: o `content-length` dele descreve o que um `GET`
   * traria, não bytes que atravessam. Aplicar o teto aqui recusaria justamente
   * a requisição que o visualizador usa para descobrir o tamanho antes de
   * pedir intervalos — quebrando o desenho inteiro. O teste pegou.
   */
  const corpoAnunciado = Number(cabecalhos.get("content-length") ?? Number.NaN);

  /*
   * Resposta INTEIRA (200) só atravessa com tamanho COMPROVADO dentro do teto.
   *
   * A versão anterior só recusava quando o `content-length` existia E passava
   * do teto. Sem o cabeçalho, a verificação era pulada e o corpo seguia sem
   * prova nenhuma de caber — que é o mesmo risco, com menos aviso: a função da
   * Vercel trunca acima de 4,5 MB, e corpo cortado com o cliente esperando o
   * resto é um PDF corrompido em silêncio.
   *
   * Uma resposta 206 não passa por aqui: o `Content-Range` dela já foi
   * conferido contra o intervalo aparado, e o intervalo aparado cabe por
   * construção.
   *
   * `HEAD` é isento: não tem corpo, e o `content-length` dele descreve o que
   * um GET traria.
   */
  if (metodo === "GET" && origem.status === 200) {
    const semTamanho = !Number.isFinite(corpoAnunciado);
    if (semTamanho || corpoAnunciado > TETO_DA_FATIA) {
      return recusar(
        origem,
        NextResponse.json(
          {
            error: "peca_por_intervalo",
            detalhe: semTamanho
              ? "A origem não declarou o tamanho, e sem ele não há como provar " +
                "que a resposta cabe. Use HEAD para o tamanho e Range para os pedaços."
              : "Este documento passa do que uma resposta desta rota sustenta. " +
                "Use HEAD para o tamanho e Range para os pedaços.",
            teto: TETO_DA_FATIA,
            ...(semTamanho ? {} : { tamanho: corpoAnunciado }),
          },
          { status: 413 },
        ),
      );
    }
  }
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
    // Conferido contra o que foi PEDIDO À ORIGEM, não contra o pedido do
    // cliente: é o intervalo aparado que a origem tinha como atender.
    const esperado = resolverRange(intervaloParaOrigem, total);

    if (esperado.tipo === "parcial") {
      const dito = contentRangeDaOrigem ?? "";
      if (dito !== `bytes ${esperado.inicio}-${esperado.fim}/${total}`) {
        return recusar(origem, NextResponse.json({ error: "intervalo_divergente" }, { status: 502 }));
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
