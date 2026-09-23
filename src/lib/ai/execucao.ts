import type { SupabaseClient } from "@supabase/supabase-js";
import type { LanguageModelUsage } from "ai";
import {
  CATALOGO_VERSION, capacidadesDe, custoDeReservaMicros, modeloAutorizado, podeAnalisarImagem,
  type ModelCapabilities, type ModelPricing,
} from "./catalogo";
import {
  consolidarExecucao, killSwitchAtivo, liberarReserva, mensagemDeOrcamento, reservarExecucao,
  type MotivoDeRecusa, type SnapshotDeUso, type SnapshotDePreco, marcarExposicaoDeCobranca,
} from "./orcamento";
import { prepareStreamWithFallback, type PreparedFallbackStream } from "./stream-fallback";
import { LIMITES_DE_IA, type Trecho } from "./recuperacao";
import { contarCaracteres, MAX_CARACTERES_DO_PAPEL_DA_MARCA } from "../brandville/brand-row";

/**
 * O contrato único que toda tarefa de IA atravessa, independente de provedor.
 *
 * Nomenclatura ajustada ao briefing do piloto — `AIExecutionRequest`,
 * `AIModelCapabilities` — sobre o que já existia: `ModelCapabilities` do
 * catálogo é reaproveitada como `AIModelCapabilities`, e `Trecho` da
 * recuperação (A1) como a forma de cada fonte. Duas formas para a mesma
 * coisa seriam duas chances de divergirem.
 *
 * Este módulo NÃO chama nenhum provedor. Ele decide SE uma execução pode
 * prosseguir — catálogo, visão, orçamento — e devolve a decisão. Quem chama
 * um adaptador de verdade é uma peça futura, de quando um perfil real
 * existir; hoje nenhum existe (P1, por decisão: nenhuma chave, nenhum
 * crédito, nenhuma conexão).
 */

export type AIModelCapabilities = ModelCapabilities;

export type AITaskType = "assist" | "analyse-image" | "prompt";

export interface AIImageInput {
  mediaType: string;
  sizeBytes: number;
}

export interface AIExecutionRequest {
  workspaceId: string;
  brandId: string;
  executionId: string;
  task: AITaskType;
  /**
   * O texto REAL do `chatRole`/`analysisRole` da marca — a reserva conta o
   * comprimento verdadeiro, não uma suposição. `decidirExecucao` ainda
   * limita esse comprimento ao teto validado (`MAX_CARACTERES_DO_PAPEL_DA_MARCA`)
   * antes de somar: o banco já impede um valor maior de existir, mas a
   * reserva não confia cegamente nisso — duas camadas, não uma confiando
   * na outra.
   */
  role: string;
  question: string;
  sources: readonly Trecho[];
  image?: AIImageInput;
}

export type MotivoDeBloqueio =
  | "modelo_nao_catalogado"
  | "preco_nao_verificado"
  | "imagem_sem_preco_verificado"
  | "imagem_maior_que_o_limite_do_modelo"
  | "execucao_em_andamento"
  | "execucao_ja_finalizada"
  | MotivoDeRecusa
  | "erro_de_consulta";

export type DecisaoDeExecucao =
  | {
      pode: true; executionId: string; capabilities: AIModelCapabilities;
      maxOutputTokens: number; reservedMicros: number;
    }
  | { pode: false; motivo: MotivoDeBloqueio };

/**
 * Bytes UTF-8 por CARACTERE, pior caso — não uma média. Um ponto de código
 * Unicode ocupa de 1 a 4 bytes em UTF-8; 4 é o teto para qualquer
 * caractere válido, então multiplicar por 4 nunca subestima, mesmo que o
 * texto real seja inteiramente ASCII (1 byte/caractere) ou CJK (2–3
 * bytes/caractere).
 *
 * Achado da revisão de segurança pós-P2A: a conversão anterior (4
 * caracteres = 1 token) era uma MÉDIA para texto latino, não um teto — para
 * português com acentuação pesada, CJK, emoji ou texto adversarial
 * (bytes que não se fundem em tokens comuns), um tokenizador BPE real pode
 * produzir muito mais tokens por caractere. Sem um tokenizador do modelo
 * disponível de forma uniforme entre provedores, o teto seguro é
 * BYTES, não caracteres — tokenizadores BPE no pior caso produzem no
 * máximo 1 token por BYTE (a maioria inclui todo byte individual no
 * vocabulário base, como fallback). `BYTES_POR_CARACTERE_PIOR_CASO`
 * assume o pior dos dois lados da conta: todo caractere no maior tamanho
 * de byte possível, E cada byte desses virando um token inteiro.
 */
const BYTES_POR_CARACTERE_PIOR_CASO = 4;

/**
 * O texto FIXO ao redor do conhecimento recuperado dentro do prompt de
 * sistema — regras de fundamentação e formato para as duas tarefas, mais
 * as regras de cor só na análise (por isso o teto da análise é quase o
 * dobro do chat) — SEM o papel da marca (`chatRole`/`analysisRole`), que
 * agora entra separadamente com o comprimento REAL, não uma suposição.
 *
 * MEDIDO chamando `buildChatSystemPrompt`/`buildAnalysisSystemPrompt` de
 * verdade com trechos no teto de `LIMITES_DE_IA` e papel VAZIO — isola o
 * texto que não depende do papel. Ver o teste "o boilerplate medido do
 * prompt de sistema cabe dentro do assumido pela reserva", que roda a
 * MESMA medição e quebra se o texto fixo crescer além do que este número
 * assume.
 *
 * PT, o pior caso entre os dois idiomas testados, com uma folga pequena:
 *   assist: 2.219 medidos → 2.300
 *   analyse-image: 3.632 medidos → 3.700
 */
export const BOILERPLATE_DO_PROMPT_DE_SISTEMA: Record<AITaskType, number> = {
  assist: 2_300,
  "analyse-image": 3_700,
  prompt: 2_300,
};

/**
 * Margem sobre TODO o teto de entrada — cobre o que a contagem de
 * caracteres não modela diretamente: overhead de protocolo (papéis e
 * estrutura de cada mensagem no formato do provedor) e a variância do
 * tokenizador real contra a conversão grosseira de 4 caracteres por
 * token — que varia bastante entre idiomas, e não deve ser confundida com
 * medir o texto real. 20% é generoso de propósito, não medido contra um
 * provedor real — revisar quando o P2B tiver uma chamada de verdade para
 * comparar, mas continua sendo uma MARGEM sobre o texto medido, nunca um
 * substituto para medi-lo.
 */
const MARGEM_DE_PROTOCOLO = 1.2;

/**
 * Teto de tokens de ENTRADA por tarefa — o PIOR CASO permitido pelos
 * limites do produto (`LIMITES_DE_IA`), não uma mediana, MAIS o
 * comprimento REAL do papel da marca presente nesta chamada. Duas
 * garantias, não uma: o conteúdo real do papel entra na conta (não um
 * chute), E o teto validado (`MAX_CARACTERES_DO_PAPEL_DA_MARCA`) limita o
 * que a reserva aceita mesmo que, por algum defeito, um valor maior
 * chegasse até aqui — o banco já deveria ter recusado gravar isso, mas a
 * reserva não confia cegamente nessa garantia alheia.
 *
 * Uma reserva subestimada é o erro que este produto não aceita;
 * superestimar é seguro porque a consolidação ajusta para o custo real
 * depois.
 */
function tetoDeTokensDeEntrada(task: AITaskType, role: string): number {
  const papelReal = Math.min(contarCaracteres(role), MAX_CARACTERES_DO_PAPEL_DA_MARCA);
  const base = LIMITES_DE_IA.maxCaracteresDeContexto + BOILERPLATE_DO_PROMPT_DE_SISTEMA[task] + papelReal;
  const comHistorico = task === "assist"
    ? LIMITES_DE_IA.maxCaracteresDaPergunta + LIMITES_DE_IA.maxMensagens * LIMITES_DE_IA.maxCaracteresPorMensagem
    : LIMITES_DE_IA.maxCaracteresDaPergunta;
  // Multiplica (bytes no pior caso, depois tokens no pior caso), não divide
  // — a inversão do formato anterior é o ponto: a conta antiga ASSUMIA que
  // um caractere valia uma fração de token; esta assume que pode valer
  // vários.
  return Math.ceil((base + comHistorico) * BYTES_POR_CARACTERE_PIOR_CASO * MARGEM_DE_PROTOCOLO);
}

/**
 * Teto de tokens de SAÍDA por tarefa. Sem limite de caracteres de resposta
 * no produto hoje — estes números são um teto DELIBERADAMENTE generoso
 * (maior que a mediana usada no benchmark do P0), não uma medição.
 */
function tetoDeTokensDeSaida(task: AITaskType): number {
  return task === "analyse-image" ? 2_500 : 2_000;
}

/**
 * A checagem completa, ANTES de qualquer chamada de rede custar um centavo.
 *
 * A ordem importa, e é a ordem do menor para o maior custo de verificar:
 * catálogo é leitura em memória; visão é leitura em memória; preço
 * verificado é leitura em memória; orçamento é uma escrita transacional no
 * banco. Uma imagem que o modelo recusa, ou um modelo sem preço, não
 * deveria chegar a reservar orçamento nenhum.
 *
 * `reservedMicros` não é mais parâmetro: é CALCULADO aqui, do preço
 * verificado do catálogo — um único lugar que sabe fazer essa conta, em vez
 * de cada chamador ter que adivinhar (ou inventar) um número.
 */
export async function decidirExecucao(
  /** A sessão do usuário — só para `killSwitchAtivo`, que não move dinheiro. */
  supabase: SupabaseClient,
  /**
   * O cliente de serviço (`createServiceClient()`, `src/lib/supabase/service.ts`)
   * — só as rotas conseguem construir este, nunca este módulo (ver o
   * comentário lá). Alimenta as três mutações financeiras
   * (reserva/consolidação/liberação); ver o comentário no topo de
   * `orcamento.ts` (achado P0-2).
   */
  serviceClient: SupabaseClient,
  /** O id de quem pede — resolvido pelo CHAMADOR a partir de uma sessão já
   *  validada (`supabase.auth.getUser()`), nunca do corpo da requisição. */
  userId: string,
  request: AIExecutionRequest,
  perfil: { provider: string; model: string },
): Promise<DecisaoDeExecucao> {
  if (!modeloAutorizado(perfil.provider, perfil.model)) {
    return { pode: false, motivo: "modelo_nao_catalogado" };
  }

  const capabilities = capacidadesDe(perfil.provider, perfil.model);
  if (!capabilities) {
    return { pode: false, motivo: "modelo_nao_catalogado" };
  }

  if (request.image) {
    if (!podeAnalisarImagem(capabilities)) {
      return { pode: false, motivo: "imagem_sem_preco_verificado" };
    }
    if (capabilities.maxImageBytes !== undefined && request.image.sizeBytes > capabilities.maxImageBytes) {
      return { pode: false, motivo: "imagem_maior_que_o_limite_do_modelo" };
    }
  }

  if (!capabilities.pricing) {
    // Sem imagem, o portão de visão nunca roda — este é o único lugar que
    // bloqueia um modelo de TEXTO sem preço verificado.
    return { pode: false, motivo: "preco_nao_verificado" };
  }
  const pricing = capabilities.pricing;

  const priceSnapshot: SnapshotDePreco = {
    ...pricing, catalogVersion: CATALOGO_VERSION, provider: perfil.provider, model: perfil.model,
  };
  // UM número, usado nos dois lugares: a reserva soma este teto, e é o
  // MESMO valor que decidirExecucao devolve para virar `maxOutputTokens` na
  // chamada real. Duas variáveis para "o teto de saída" seriam duas chances
  // de divergirem — e a diferença entre elas é exatamente a folga que
  // deixaria uma resposta real custar mais do que a reserva cobriu.
  const maxOutputTokens = tetoDeTokensDeSaida(request.task);
  const reservedMicros = custoDeReservaMicros(pricing, {
    entrada: tetoDeTokensDeEntrada(request.task, request.role),
    saida: maxOutputTokens,
    imagem: request.image ? pricing.maxImageTokens : undefined,
  });

  const reserva = await reservarExecucao(serviceClient, userId, {
    workspaceId: request.workspaceId,
    brandId: request.brandId,
    executionId: request.executionId,
    task: request.task,
    reservedMicros,
    currency: pricing.currency,
    priceSnapshot,
  });

  if (!reserva.ok) return { pode: false, motivo: reserva.motivo };

  /*
   * `execution_id` REUTILIZADO nunca autoriza um segundo despacho.
   *
   * A função do banco devolve `ok:true` para QUALQUER linha já existente,
   * seja qual for o status — é assim que ela sabe responder "reservado" de
   * novo para um retry legítimo, sem reservar duas vezes. Mas "a linha já
   * existe" não é o mesmo que "está seguro despachar": se o status é
   * `reserved`, outra tentativa para o MESMO id pode estar em voo agora
   * (duas abas, um duplo clique, um retry de rede que chegou ao servidor
   * duas vezes); se é `settled`/`released`, esta execução já terminou, e
   * despachar de novo seria uma segunda chamada paga sem reserva nova
   * cobrindo — o mesmo defeito de contabilidade que a correção pós-
   * despacho (P2A.1) fechou para o CAMINHO de erro, agora fechado para o
   * caminho de REPETIÇÃO.
   */
  if (reserva.jaExistia) {
    return {
      pode: false,
      motivo: reserva.status === "reserved" ? "execucao_em_andamento" : "execucao_ja_finalizada",
    };
  }

  /*
   * Recheck final, o mais perto possível do despacho.
   *
   * A reserva acima já checou o kill switch — mas ele pode ser ligado no
   * instante entre aquela checagem e este retorno. Sem este recheck, uma
   * execução em voo nesse instante ainda seria autorizada a chamar o
   * provedor, mesmo com o botão de pausa já acionado. Se este recheck
   * bloquear, a reserva já feita é liberada: sem isso, ela ficaria presa
   * como 'reserved' até expirar por timeout, ocupando teto sem executar.
   */
  const killSwitch = await killSwitchAtivo(supabase, {
    workspaceId: request.workspaceId,
    brandId: request.brandId,
  });
  if ("erro" in killSwitch) {
    await liberarReserva(serviceClient, userId, reserva.executionId);
    return { pode: false, motivo: "erro_de_consulta" };
  }
  if (killSwitch.workspace || killSwitch.marca) {
    await liberarReserva(serviceClient, userId, reserva.executionId);
    return { pode: false, motivo: killSwitch.workspace ? "kill_switch_workspace" : "kill_switch_marca" };
  }

  return { pode: true, executionId: reserva.executionId, capabilities, maxOutputTokens, reservedMicros };
}

/**
 * A mensagem de PRODUTO para qualquer motivo de bloqueio — nunca o código
 * cru na tela. Os motivos de orçamento (`MotivoDeRecusa`/`erro_de_consulta`)
 * já têm mensagem própria em `mensagemDeOrcamento`; os quatro daqui são os
 * que só `decidirExecucao` produz, antes de chegar ao orçamento.
 */
export function mensagemDeBloqueio(motivo: MotivoDeBloqueio, ingles: boolean): string {
  switch (motivo) {
    case "modelo_nao_catalogado":
      return ingles
        ? "The configured model is no longer authorized. Ask whoever administers the account to choose another one in Settings."
        : "O modelo configurado não está mais autorizado. Peça a quem administra a conta para escolher outro em Configurações.";
    case "preco_nao_verificado":
      return ingles
        ? "The configured model doesn't have a confirmed price for paid use yet. Ask whoever administers the account to choose a model with verified pricing."
        : "O modelo configurado ainda não tem preço confirmado para uso pago. Peça a quem administra a conta para escolher um modelo com preço verificado.";
    case "imagem_sem_preco_verificado":
      return ingles
        ? "This model doesn't have confirmed image pricing yet. Choose a model with verified image support, or send text only."
        : "Este modelo ainda não tem custo de imagem confirmado. Escolha um modelo com suporte a imagem verificado, ou envie apenas texto.";
    case "imagem_maior_que_o_limite_do_modelo":
      return ingles
        ? "The image is larger than this model's limit."
        : "A imagem é maior que o limite deste modelo.";
    case "execucao_em_andamento":
      return ingles
        ? "This request is already being processed. Wait for the current response before trying again."
        : "Esta solicitação já está sendo processada. Aguarde a resposta atual antes de tentar de novo.";
    case "execucao_ja_finalizada":
      return ingles
        ? "This request has already been completed. Reload the page and send a new message to try again."
        : "Esta solicitação já foi concluída. Recarregue a página e envie uma nova mensagem para tentar de novo.";
    default:
      return mensagemDeOrcamento(motivo, ingles);
  }
}

/** O que uma chamada real ao provedor devolve — texto e o uso, que só se sabe depois. */
export interface ResultadoDoDespacho {
  textStream: AsyncIterable<string>;
  usage: PromiseLike<LanguageModelUsage>;
}

export interface ExecucaoComOrcamento<TAttempt> {
  firstChunk: string;
  iterator: AsyncIterator<string>;
  attempt: TAttempt;
  fallbackUsed: boolean;
  cleanup: () => void;
  cancel: (reason?: unknown) => Promise<void>;
}

/**
 * Quanto esperar pela promise de uso antes de desistir e liquidar
 * conservador. Existe porque um cancelamento pode deixar essa promise
 * NUNCA resolvendo (o provedor esperava terminar o stream para relatar o
 * uso, e o stream nunca termina) — sem este teto, encerrar a execução
 * ficaria pendurado para sempre, e ninguém receberia resposta nenhuma,
 * nem a de erro.
 */
const TIMEOUT_DE_USO_PADRAO_MS = 5_000;

/**
 * Espera a promise de uso, mas nunca além do teto — `null` quer dizer
 * "não confirmei a tempo", tratado pelo chamador do mesmo jeito que "o
 * provedor não informou": liquidação conservadora, nunca custo zero.
 */
async function aguardarUsoComTimeout(
  usage: PromiseLike<LanguageModelUsage>,
  timeoutMs: number,
): Promise<LanguageModelUsage | null> {
  return Promise.race([
    Promise.resolve(usage).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

/**
 * Despacha UMA execução já decidida (`decidirExecucao` retornou `pode:
 * true`) e garante — por CONSTRUÇÃO, não por disciplina de quem chama —
 * que ela termina liquidada, nunca presa como 'reserved' e nunca liberada
 * de volta para zero depois que o pedido já pode ter saído para o
 * provedor.
 *
 * A distinção que importa é ANTES ou DEPOIS do despacho, não sucesso ou
 * falha:
 *
 * - **Antes do despacho** (nenhuma tentativa chegou a chamar `dispatch`, o
 *   único caso real sendo um `parentSignal` já abortado): nada saiu para o
 *   provedor. Libera integralmente — é o único caminho que ainda existe
 *   para devolver o teto inteiro ao orçamento do dia.
 * - **Depois do despacho, com uso medido**: liquida com o custo REAL.
 * - **Depois do despacho, sem uso confiável** — erro no meio do stream,
 *   cancelamento, ou a promise de uso não resolve com números — NUNCA
 *   libera. O pedido já pode ter chegado ao provedor, que pode cobrar
 *   mesmo sem devolver um relatório final de uso; transformar isso em
 *   custo zero seria inventar uma garantia que não existe. Liquida pelo
 *   TETO reservado (o mesmo número que já era o pior caso assumido) e
 *   marca `usage_unknown` no ledger, para reconciliação manual se o
 *   provedor publicar uso tardio.
 *
 * A garantia mora no `iterator` devolvido: quem chama só drena do jeito
 * que já drenava — `next()` decide sozinho ao terminar ou lançar,
 * `return()` (cancelamento) também. Um `encerrado` interno faz o que
 * acontecer primeiro vencer; as funções do banco também são idempotentes,
 * então mesmo uma corrida aqui seria inofensiva — duas camadas, não uma
 * confiando na outra.
 *
 * Nenhum fallback automático AQUI: só `attempts[0]` é tentado, mesmo que
 * `attempts` traga mais — a reserva foi calculada para UM preço, e deixar
 * esta função trocar de perfil por conta própria liquidaria com um preço
 * que ninguém reservou. A troca de IA mora em `executarEmFila`, que reserva
 * de novo antes de cada tentativa.
 */
/**
 * O razão não conseguiu registrar que a cobrança ia acontecer.
 *
 * Erro próprio, e não um genérico, porque a resposta ao usuário é diferente:
 * nada foi enviado ao provedor, então não há custo — e tentar de novo é
 * seguro, ao contrário de quase toda outra falha deste módulo.
 */
export class FalhaDeExposicaoDeCobranca extends Error {
  constructor() {
    super("não foi possível registrar a exposição de cobrança antes do despacho");
    this.name = "FalhaDeExposicaoDeCobranca";
  }
}

export async function executarComOrcamento<TAttempt extends { config: { provider: string; model: string } }>(
  params: {
    /** Ver o comentário em `decidirExecucao` — cliente de serviço, não a sessão do usuário. */
    serviceClient: SupabaseClient;
    /** Ver o comentário em `decidirExecucao` — resolvido de sessão validada, nunca do corpo da requisição. */
    userId: string;
    executionId: string;
    pricing: ModelPricing;
    /** O mesmo valor que `decidirExecucao` reservou — o teto usado na
     *  liquidação conservadora quando o uso real não está disponível. */
    reservedMicros: number;
    attempts: readonly TAttempt[];
    firstChunkTimeoutMs: number;
    /** Teto de espera pela promise de uso ao encerrar — ver `TIMEOUT_DE_USO_PADRAO_MS`. */
    usageTimeoutMs?: number;
    parentSignal?: AbortSignal;
    validateInitialText?: (text: string, streamEnded: boolean) => "accept" | "continue" | "reject";
    dispatch: (attempt: TAttempt, signal: AbortSignal) => ResultadoDoDespacho;
    onAttemptStart?: (attempt: TAttempt, index: number) => void;
    onAttemptFailure?: (attempt: TAttempt, index: number, error: unknown) => void;
  },
): Promise<ExecucaoComOrcamento<TAttempt>> {
  const { serviceClient, userId, executionId, pricing, reservedMicros, dispatch } = params;
  const usageTimeoutMs = params.usageTimeoutMs ?? TIMEOUT_DE_USO_PADRAO_MS;
  const attemptsRestritos = params.attempts.slice(0, 1) as TAttempt[];

  let usageCapturado: PromiseLike<LanguageModelUsage> | null = null;
  // Marcado no instante em que ALGUMA tentativa chega a ser despachada —
  // é o que decide se uma falha depois disso ainda pode liberar
  // integralmente (não pode) ou precisa liquidar conservador (precisa).
  let attemptDespachado: TAttempt | null = null;

  let encerrado = false;

  /**
   * Um número de tokens de fato relatado pelo provedor.
   *
   * Separado em função nomeada porque a pergunta que ele responde não é
   * "existe?", é "é utilizável numa conta de dinheiro?".
   */
  const tokensRelatados = (n: number | undefined): n is number =>
    typeof n === "number" && Number.isFinite(n) && n >= 0;

  /** A liquidação conservadora — nunca vira custo zero. */
  const consolidarConservador = async () => {
    const usageSnapshot: SnapshotDeUso = { unknown: true };
    await consolidarExecucao(serviceClient, userId, {
      executionId, settledMicros: reservedMicros,
      provider: attemptDespachado?.config.provider ?? "desconhecido",
      model: attemptDespachado?.config.model ?? "desconhecido",
      usageSnapshot,
    });
  };

  /** Encerramento depois do despacho — tenta o uso real, cai para o conservador. */
  const encerrarPosDespacho = async () => {
    if (encerrado) return;
    encerrado = true;
    const usage = usageCapturado ? await aguardarUsoComTimeout(usageCapturado, usageTimeoutMs) : null;
    /*
     * Liquidar pelo uso real exige o uso INTEIRO, e exige que ele seja um
     * número.
     *
     * A guarda anterior exigia que os DOIS campos estivessem ausentes (`&&`)
     * para cair no conservador. Com um campo só presente, o outro virava zero
     * pelo `?? 0` logo abaixo — e consumo desconhecido passava a ser cobrado
     * como consumo nulo, sempre para o lado que perde dinheiro. A diferença
     * que o contrato precisa preservar: um zero MEDIDO é um fato do provedor;
     * um campo AUSENTE é ignorância nossa, e ignorância liquida pelo teto.
     *
     * `Number.isFinite` barra `NaN` e infinitos, que propagariam pela conta
     * até o banco; `>= 0` barra negativo, que seria a única forma de uma
     * execução real liquidar por MENOS do que consumiu — um negativo em
     * entrada abate o custo da saída.
     */
    if (!usage || !tokensRelatados(usage.inputTokens) || !tokensRelatados(usage.outputTokens)) {
      await consolidarConservador();
      return;
    }
    const settledMicros = custoDeReservaMicros(pricing, {
      entrada: usage.inputTokens, saida: usage.outputTokens,
    });
    const usageSnapshot: SnapshotDeUso = {
      inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
      cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens,
    };
    await consolidarExecucao(serviceClient, userId, {
      executionId, settledMicros,
      provider: attemptDespachado!.config.provider, model: attemptDespachado!.config.model,
      usageSnapshot,
    });
  };

  /*
   * A exposição é marcada AQUI: depois de saber que vamos despachar, antes de
   * despachar.
   *
   * Mais cedo (logo após a reserva) marcaria como exposto um pedido que chega
   * com o sinal já abortado e nunca toca a rede — o único caso real de
   * pré-despacho, e o único que pode ser liberado integralmente. Mais tarde
   * seria depois do despacho, que é justamente a janela em que o custo passa a
   * existir sem o razão saber.
   *
   * Sobra uma janela estreita: abortar entre esta marcação e o despacho. Ela
   * liquida conservador em vez de liberar — paga-se por algo que talvez não
   * tenha saído. É o erro barato; o caro é o contrário.
   */
  if (!params.parentSignal?.aborted) {
    const exposicao = await marcarExposicaoDeCobranca(serviceClient, { userId, executionId });
    if ("erro" in exposicao) {
      /*
       * O erro da RPC é ambíguo: ela pode ter falhado antes do commit ou ter
       * commitado e perdido a resposta. Encerrar a reserva resolve os dois
       * casos com a semântica conservadora do banco — libera se ainda não foi
       * exposta; liquida pelo teto se a exposição já foi gravada.
       */
      await liberarReserva(serviceClient, userId, executionId);
      throw new FalhaDeExposicaoDeCobranca();
    }
    if (!exposicao.exposta) {
      // Não despachar é deliberado. Uma execução cujo custo o razão não
      // conseguiria registrar não deve acontecer — derrubar a resposta é o
      // preço, e é menor que custo invisível.
      throw new FalhaDeExposicaoDeCobranca();
    }
  }

  let prepared: PreparedFallbackStream<TAttempt>;
  try {
    prepared = await prepareStreamWithFallback<TAttempt>({
      attempts: attemptsRestritos,
      firstChunkTimeoutMs: params.firstChunkTimeoutMs,
      parentSignal: params.parentSignal,
      validateInitialText: params.validateInitialText,
      onAttemptStart: params.onAttemptStart,
      onAttemptFailure: params.onAttemptFailure,
      start: (attempt, signal) => {
        // Marcado ANTES do despacho de fato — mesmo que `dispatch` lance
        // de forma síncrona, não há como saber se o pedido já tocou a
        // rede, e errar para o lado conservador é a escolha segura.
        attemptDespachado = attempt;
        const resultado = dispatch(attempt, signal);
        usageCapturado = resultado.usage;
        return resultado.textStream;
      },
    });
  } catch (error) {
    if (attemptDespachado) {
      await encerrarPosDespacho();
    } else {
      // Nenhuma tentativa chegou a ser despachada — o único caso real é
      // `parentSignal` já abortado antes do primeiro attempt. Nada saiu
      // para o provedor: aqui, e só aqui, liberar integralmente é seguro.
      encerrado = true;
      await liberarReserva(serviceClient, userId, executionId);
    }
    throw error;
  }

  const originalIterator = prepared.iterator;
  const iterator: AsyncIterator<string> = {
    async next() {
      try {
        const resultado = await originalIterator.next();
        if (resultado.done) await encerrarPosDespacho();
        return resultado;
      } catch (error) {
        await encerrarPosDespacho();
        throw error;
      }
    },
    async return(value) {
      await encerrarPosDespacho();
      return originalIterator.return ? originalIterator.return(value) : { done: true, value };
    },
  };

  return {
    firstChunk: prepared.firstChunk,
    iterator,
    attempt: prepared.attempt,
    fallbackUsed: prepared.fallbackUsed,
    cleanup: prepared.cleanup,
    cancel: async (reason) => {
      prepared.cancel(reason);
      await encerrarPosDespacho();
    },
  };
}

/**
 * Os bloqueios que dizem respeito a UM modelo — outro modelo da fila pode
 * passar. Orçamento, pausa e execução repetida valem para a conta inteira: a
 * fila para neles.
 */
const BLOQUEIOS_DO_MODELO: ReadonlySet<MotivoDeBloqueio> = new Set<MotivoDeBloqueio>([
  "modelo_nao_catalogado", "preco_nao_verificado", "imagem_sem_preco_verificado", "imagem_maior_que_o_limite_do_modelo",
]);

/**
 * A fila de IAs: a principal e, se ela falhar ANTES de começar a responder,
 * a reserva — decisão do André, 23/09/2026 (principal + reserva de outro
 * provedor, em fila).
 *
 * Cada tentativa é uma execução própria no razão, com reserva calculada pelo
 * preço DAQUELE modelo. É isso que `executarComOrcamento` sozinha não podia
 * fazer: a reserva dela foi feita para um preço só, e trocar de modelo lá
 * dentro liquidaria por um preço que ninguém reservou. Aqui a troca passa de
 * novo por `decidirExecucao` — catálogo, visão, orçamento, pausa — como se
 * fosse o primeiro pedido.
 *
 * A tentativa que falhou já foi liquidada por `executarComOrcamento`: pelo
 * uso real, se o provedor informou, ou pelo teto reservado, se não. Ela pode
 * ter chegado ao provedor, e custo desconhecido não vira zero. A fila custa,
 * no pior caso, o teto da principal mais o da reserva — o preço de responder
 * em vez de falhar.
 *
 * A primeira decisão chega pronta: a rota já a tomou para poder recusar com
 * a mensagem certa ANTES de abrir o fluxo. As seguintes são tomadas aqui, com
 * `execution_id` novo — o do cliente identifica o PEDIDO, e só a primeira
 * tentativa o usa.
 *
 * O que NÃO troca de IA:
 * - falha depois da primeira palavra: a pessoa já está lendo a resposta, e
 *   emendar outra IA no meio produziria um texto que nenhuma das duas escreveu;
 * - cancelamento de quem pediu;
 * - falha em registrar a cobrança — nada foi enviado, e a próxima tentativa
 *   esbarraria no mesmo razão.
 */
export async function executarEmFila<TAttempt extends { config: { provider: string; model: string } }>(
  params: {
    supabase: SupabaseClient;
    serviceClient: SupabaseClient;
    userId: string;
    /** O pedido, com o `executionId` da PRIMEIRA tentativa. */
    request: AIExecutionRequest;
    attempts: readonly TAttempt[];
    /** A decisão que a rota já tomou para `attempts[0]`. */
    primeira: { pricing: ModelPricing; reservedMicros: number; maxOutputTokens: number };
    firstChunkTimeoutMs: number;
    usageTimeoutMs?: number;
    parentSignal?: AbortSignal;
    validateInitialText?: (text: string, streamEnded: boolean) => "accept" | "continue" | "reject";
    dispatch: (attempt: TAttempt, signal: AbortSignal, maxOutputTokens: number) => ResultadoDoDespacho;
    onAttemptStart?: (attempt: TAttempt, index: number) => void;
    onAttemptFailure?: (attempt: TAttempt, index: number, error: unknown) => void;
    /** Quando a reserva é recusada — para o log dizer por que a fila parou. */
    onReservaRecusada?: (attempt: TAttempt, index: number, motivo: MotivoDeBloqueio) => void;
    /** Só para testes. */
    novoId?: () => string;
  },
): Promise<ExecucaoComOrcamento<TAttempt> & { executionId: string }> {
  const novoId = params.novoId ?? (() => crypto.randomUUID());
  const falhas: unknown[] = [];

  for (let indice = 0; indice < params.attempts.length; indice++) {
    const attempt = params.attempts[indice];
    let executionId = params.request.executionId;
    let custo = params.primeira;

    if (indice > 0) {
      executionId = novoId();
      const decisao = await decidirExecucao(
        params.supabase, params.serviceClient, params.userId,
        { ...params.request, executionId },
        { provider: attempt.config.provider, model: attempt.config.model },
      );
      if (!decisao.pode) {
        params.onReservaRecusada?.(attempt, indice, decisao.motivo);
        if (BLOQUEIOS_DO_MODELO.has(decisao.motivo)) continue;
        break;
      }
      custo = { pricing: decisao.capabilities.pricing!, reservedMicros: decisao.reservedMicros, maxOutputTokens: decisao.maxOutputTokens };
    }

    try {
      const execucao = await executarComOrcamento({
        serviceClient: params.serviceClient,
        userId: params.userId,
        executionId,
        pricing: custo.pricing,
        reservedMicros: custo.reservedMicros,
        attempts: [attempt],
        firstChunkTimeoutMs: params.firstChunkTimeoutMs,
        usageTimeoutMs: params.usageTimeoutMs,
        parentSignal: params.parentSignal,
        validateInitialText: params.validateInitialText,
        onAttemptStart: (a) => params.onAttemptStart?.(a, indice),
        onAttemptFailure: (a, _i, erro) => params.onAttemptFailure?.(a, indice, erro),
        dispatch: (a, signal) => params.dispatch(a, signal, custo.maxOutputTokens),
      });
      return { ...execucao, fallbackUsed: indice > 0, executionId };
    } catch (erro) {
      if (params.parentSignal?.aborted || erro instanceof FalhaDeExposicaoDeCobranca) throw erro;
      // Achatado: quem trata o erro lê a ÚLTIMA causa (`errors.at(-1)`).
      falhas.push(...(erro instanceof AggregateError ? erro.errors : [erro]));
    }
  }

  throw new AggregateError(falhas, "Todas as IAs da fila falharam antes de iniciar a resposta.");
}
