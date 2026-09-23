import type { AIProvider } from "./provider";

/**
 * O catálogo de modelos autorizados, e o que cada um sabe fazer.
 *
 * Duas coisas mudam em relação ao que havia:
 *
 * **O modelo passa a ser validado.** A rota de configuração validava o
 * PROVEDOR contra uma lista e aceitava qualquer string em `model`. Uma string
 * arbitrária chegava ao adaptador e daí ao provedor — no melhor caso um erro
 * caro, no pior um modelo que ninguém revisou processando o manual de um
 * cliente. O briefing é explícito: não aceitar qualquer string de modelo
 * enviada pelo cliente.
 *
 * **As capacidades são DECLARADAS, não adivinhadas.** Antes existia um conjunto
 * `VISION_MODELS`, e nada mais: nenhum limite de contexto, nenhum limite de
 * imagem. A interface tinha de supor, e supor errado sobre tamanho de imagem é
 * uma chamada rejeitada depois de a pessoa ter esperado o upload.
 *
 * O que este arquivo NÃO é: uma lista de preços nem uma opinião sobre
 * qualidade. Essa decisão sai do benchmark com a GE, não daqui.
 */
/**
 * Preço VERIFICADO por fonte oficial — nunca estimado, nunca herdado de
 * outro modelo. Ausente em `ModelCapabilities.pricing` significa "não
 * confirmei", não "grátis": um modelo sem isto não pode ser usado para
 * reservar orçamento nenhum, texto ou imagem.
 */
export interface ModelPricing {
  /** USD por milhão de tokens de ENTRADA de texto. */
  inputPerMillionTokensUsd: number;
  /** USD por milhão de tokens de entrada em CACHE, quando o provedor distingue. */
  cachedInputPerMillionTokensUsd?: number;
  /** USD por milhão de tokens de SAÍDA. */
  outputPerMillionTokensUsd: number;
  currency: "USD";
  /** URL pública de onde o preço foi conferido. */
  source: string;
  /** Quando foi conferido — AAAA-MM-DD. */
  asOf: string;
  /**
   * Maior número de tokens que UMA imagem consome, documentado pelo
   * provedor — não um preço separado. Nem todo provedor cobra imagem à
   * parte: alguns (caso confirmado da Ollama Cloud para `gemma4`, ver
   * https://ollama.com/library/gemma4) convertem a imagem para um
   * "orçamento de tokens visuais" fixo e cobram pela MESMA taxa de entrada
   * já verificada acima — não existe, e não precisa existir, um número de
   * preço à parte para isso.
   *
   * Ausente = o custo de uma imagem não é computável com o que está
   * documentado hoje. `podeAnalisarImagem` bloqueia nesse caso, mesmo que
   * `vision` seja `true` — capacidade técnica não é o mesmo que custo
   * conhecido.
   */
  maxImageTokens?: number;
}

export interface ModelCapabilities {
  text: boolean;
  vision: boolean;
  streaming: boolean;
  /** Contexto do modelo, em tokens. Ausente quando o provedor não publica. */
  maxContextTokens?: number;
  /** Maior imagem aceita, em bytes. Ausente quando não há limite documentado. */
  maxImageBytes?: number;
  supportsStructuredOutput?: boolean;
  /**
   * Preço verificado — ver `ModelPricing`. Ausente = nenhuma reserva de
   * orçamento pode ser calculada para este modelo, texto ou imagem; é o que
   * `decidirExecucao` (execucao.ts) checa antes de reservar qualquer coisa.
   */
  pricing?: ModelPricing;
}

/**
 * Muda sempre que `CATALOGO` muda de um jeito que afeta o que já foi
 * reservado ou liquidado — preço, capacidade ou remoção de um modelo. Cada
 * linha do ledger grava a versão vigente NO MOMENTO da reserva (ver
 * `price_snapshot` na migração do ledger): se o preço mudar depois, uma
 * execução antiga continua lendo o preço que valia quando ela aconteceu, em
 * vez de ser reescrita silenciosamente pela mudança.
 */
export const CATALOGO_VERSION = "2026-09-18";

export interface ModeloDoCatalogo {
  provider: AIProvider;
  model: string;
  /** Rótulo curto para a interface. O id do modelo não é nome de produto. */
  label: string;
  capabilities: ModelCapabilities;
}

const MB = 1024 * 1024;

/**
 * Conservador por construção.
 *
 * `vision: false` quando não há confirmação — um modelo que recusa imagem
 * devolve erro claro; um modelo que aceita e processa mal devolve um parecer
 * errado sobre a marca de um cliente, com a mesma confiança de um certo.
 */
export const CATALOGO: readonly ModeloDoCatalogo[] = [
  // ─── Groq ────────────────────────────────────────────────────────────────
  {
    provider: "groq", model: "openai/gpt-oss-20b", label: "GPT-OSS 20B",
    capabilities: { text: true, vision: false, streaming: true, maxContextTokens: 131_072 },
  },
  {
    provider: "groq", model: "openai/gpt-oss-120b", label: "GPT-OSS 120B",
    capabilities: { text: true, vision: false, streaming: true, maxContextTokens: 131_072 },
  },
  {
    provider: "groq", model: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 131_072,
      /*
       * A IA de reserva da fase de testes — decisão do André, 23/09/2026: fila
       * Gemini → Groq. Substitui o `qwen3.6-27b`, que saiu da documentação do
       * Groq; nenhuma conta o usava em produção (conferido em 23/09).
       *
       * Preço conferido em https://console.groq.com/docs/model/qwen/qwen3.8-27b
       * em 2026-09-23, USD por milhão de tokens: entrada 0,80, saída 4,00. É o
       * modelo com visão do Groq: até 3 imagens, cada uma conta 2.048 tokens
       * de entrada — o custo da imagem é a taxa de entrada, não preço à parte.
       *
       * Imagem: a página fala em 20 MB por URL; o produto manda a imagem
       * EMBUTIDA (base64), e para isso o Groq documentava 4 MB. Fico com o
       * menor: recusar uma imagem grande com mensagem clara é melhor que o
       * provedor recusar no meio da análise.
       *
       * ⚖️ Dados: o contrato do Groq (§4.2) proíbe usar entrada e saída para
       * treinar modelos sem permissão do cliente, e a inferência não é retida
       * por padrão. Camada gratuita: ~30 pedidos/min e ~8 mil tokens/min —
       * serve de reserva ocasional, não de principal.
       */
      maxImageBytes: 4 * MB,
      pricing: {
        inputPerMillionTokensUsd: 0.8, outputPerMillionTokensUsd: 4, currency: "USD",
        source: "https://console.groq.com/docs/model/qwen/qwen3.8-27b", asOf: "2026-09-23",
        maxImageTokens: 2048,
      },
    },
  },

  // ─── Anthropic ───────────────────────────────────────────────────────────
  {
    provider: "anthropic", model: "claude-sonnet-5", label: "Claude Sonnet 5",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 200_000, maxImageBytes: 5 * MB, supportsStructuredOutput: true,
    },
  },
  {
    provider: "anthropic", model: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 200_000, maxImageBytes: 5 * MB, supportsStructuredOutput: true,
    },
  },
  {
    provider: "anthropic", model: "claude-opus-4-8", label: "Claude Opus 4.8",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 200_000, maxImageBytes: 5 * MB, supportsStructuredOutput: true,
    },
  },

  // ─── OpenAI ──────────────────────────────────────────────────────────────
  {
    provider: "openai", model: "gpt-5.1", label: "GPT-5.1",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 400_000, maxImageBytes: 20 * MB, supportsStructuredOutput: true,
    },
  },
  {
    provider: "openai", model: "gpt-5.1-mini", label: "GPT-5.1 mini",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 400_000, maxImageBytes: 20 * MB, supportsStructuredOutput: true,
    },
  },
  {
    provider: "openai", model: "gpt-4o", label: "GPT-4o",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 128_000, maxImageBytes: 20 * MB, supportsStructuredOutput: true,
    },
  },

  // ─── Google ──────────────────────────────────────────────────────────────
  {
    provider: "google", model: "gemini-2.5-pro", label: "Gemini 2.5 Pro",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 1_000_000, maxImageBytes: 20 * MB, supportsStructuredOutput: true,
    },
  },
  {
    provider: "google", model: "gemini-3.6-flash", label: "Gemini 3.6 Flash",
    capabilities: {
      text: true, vision: true, streaming: true, supportsStructuredOutput: true,
      maxImageBytes: 20 * MB,
      /*
       * Entrou em 18/09/2026, no ensaio: o Google respondeu 404 ao 2.5 Flash —
       * "no longer available to new users. Please update your code to use
       * models/gemini-3.6-flash". Conta nova do AI Studio não alcança o 2.5.
       *
       * Preço conferido em https://ai.google.dev/gemini-api/docs/pricing em
       * 2026-09-18. Camada gratuita: "Free of charge". Camada paga, USD por
       * milhão de tokens, válida ATÉ 31/12/2026: entrada 0,75, cache 0,075,
       * saída 3,75. ⚠️ A partir de 01/01/2027 dobra (1,50 / 0,15 / 7,50) — este
       * registro precisa ser revisto nessa data, com `asOf` novo.
       *
       * ⚖️ Camada gratuita: o conteúdo é usado para melhorar os produtos do
       * Google. Ensaio com manual público, sim; material de cliente, não.
       *
       * Imagem: no Gemini 3 o custo é FIXO por nível de resolução
       * (https://ai.google.dev/gemini-api/docs/media-resolution): 280, 560,
       * 1120 ou 2240 tokens; o padrão, que é o que o produto usa por não
       * escolher resolução, vale 1120. Reservo o TETO documentado, 2240 —
       * superestimar a reserva é seguro, subestimar deixaria a execução gastar
       * além do reservado.
       */
      pricing: {
        inputPerMillionTokensUsd: 0.75, cachedInputPerMillionTokensUsd: 0.075,
        outputPerMillionTokensUsd: 3.75, currency: "USD",
        source: "https://ai.google.dev/gemini-api/docs/pricing", asOf: "2026-09-18",
        maxImageTokens: 2240,
      },
    },
  },
  {
    // ⚠️ Indisponível para contas NOVAS do Google desde antes de 18/09/2026 —
    // ver o 3.6 Flash acima. Continua aqui para contas antigas que o usem.
    provider: "google", model: "gemini-2.5-flash", label: "Gemini 2.5 Flash (contas antigas)",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 1_000_000, maxImageBytes: 20 * MB, supportsStructuredOutput: true,
      /*
       * Preço da camada PAGA, conferido em https://ai.google.dev/gemini-api/docs/pricing
       * em 2026-09-18, USD por milhão de tokens.
       *
       * Na fase de testes o uso é pela camada GRATUITA (decisão do André,
       * 18/09) — o custo real é zero. O ledger reserva e registra mesmo assim,
       * com o preço pago: é o custo que ESTE uso teria, e é o número que falta
       * para formar o preço da assinatura quando a IA for da plataforma.
       *
       * ⚖️ A mesma página diz que o conteúdo da camada gratuita é usado para
       * melhorar os produtos do Google, e o da paga não. Aceitável com manuais
       * públicos no ensaio; INACEITÁVEL com manual ou peça de cliente — ver o
       * plano da interface.
       *
       * SEM `maxImageTokens` de propósito: a documentação de tokens
       * (https://ai.google.dev/gemini-api/docs/tokens) diz que imagem até 384px
       * vale 258 tokens e maior é cortada em blocos de 768×768, 258 cada — sem
       * teto. O produto não reduz a imagem antes de enviar, então o custo de uma
       * análise não é limitável hoje, e `podeAnalisarImagem` bloqueia. O chat
       * funciona; a análise de peça espera o produto limitar a imagem.
       */
      pricing: {
        inputPerMillionTokensUsd: 0.30, cachedInputPerMillionTokensUsd: 0.03,
        outputPerMillionTokensUsd: 2.50, currency: "USD",
        source: "https://ai.google.dev/gemini-api/docs/pricing", asOf: "2026-09-18",
      },
    },
  },

  // ─── OpenRouter ──────────────────────────────────────────────────────────
  //
  // `openrouter/free` escolhe um modelo disponível a cada chamada. Declaro
  // `vision: true` porque o roteador respeita as capacidades pedidas na
  // requisição, e NÃO declaro contexto nem limite de imagem: eles mudam com o
  // modelo sorteado, e um número aqui seria invenção.
  {
    provider: "openrouter", model: "openrouter/free", label: "OpenRouter — gratuito",
    capabilities: { text: true, vision: true, streaming: true },
  },
  {
    provider: "openrouter", model: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5 (OpenRouter)",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 200_000, maxImageBytes: 5 * MB,
    },
  },
  {
    provider: "openrouter", model: "openai/gpt-5.1", label: "GPT-5.1 (OpenRouter)",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 400_000, maxImageBytes: 20 * MB,
    },
  },
  {
    provider: "openrouter", model: "meta-llama/llama-4-scout", label: "Llama 4 Scout",
    capabilities: { text: true, vision: false, streaming: true, maxContextTokens: 128_000 },
  },
  /*
   * Estes três já eram usados: estavam no conjunto `VISION_MODELS` e na lista
   * sugerida da tela. Entram no catálogo porque a alternativa seria a tela
   * oferecer o que o catálogo recusa — o produto recusando o que ele mesmo
   * sugeriu. Foi o teste de coerência que os encontrou.
   *
   * Sem limite de imagem declarado: são rotas gratuitas do OpenRouter, cujo
   * modelo efetivo varia, e um número aqui seria invenção.
   */
  {
    provider: "openrouter", model: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B (gratuito)",
    capabilities: { text: true, vision: true, streaming: true },
  },
  {
    provider: "openrouter", model: "qwen/qwen3.5-flash-02-23", label: "Qwen 3.5 Flash",
    capabilities: { text: true, vision: true, streaming: true, maxContextTokens: 128_000 },
  },
  {
    provider: "openrouter", model: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra (gratuito)",
    capabilities: { text: true, vision: true, streaming: true },
  },

  // ─── Ollama Cloud — NÃO ATIVADO ─────────────────────────────────────────
  //
  // Entram no catálogo (autorizados a SEREM configurados) porque o preço é
  // publicado oficialmente — mas nenhuma chave, conexão ou linha de
  // ai_settings existe para eles. Ativar um destes para a GE é uma decisão
  // separada, depois do benchmark comparando Gemma 4, MiniMax M3 e Qwen
  // (ver docs/plan/parecer-piloto-qwen-p0.md).
  //
  // Preços conferidos em https://ollama.com/pricing em 2026-09-03, USD por
  // milhão de tokens. A página não publica preço de imagem separado para
  // NENHUM modelo — a coluna de imagem abaixo vem de cada página de modelo
  // individual, não da tabela de preços.
  {
    provider: "ollama-cloud", model: "gemma4:31b-cloud", label: "Gemma 4 31B (Ollama Cloud)",
    capabilities: {
      text: true, vision: true, streaming: true,
      pricing: {
        inputPerMillionTokensUsd: 0.14, cachedInputPerMillionTokensUsd: 0.05,
        outputPerMillionTokensUsd: 0.40, currency: "USD",
        source: "https://ollama.com/pricing", asOf: "2026-09-03",
        // https://ollama.com/library/gemma4: "variable image resolution
        // through a configurable visual token budget" de 70 a 1120 tokens.
        // Uso o TETO documentado — superestimar o custo de imagem é seguro
        // pelo mesmo motivo que superestimar qualquer reserva é seguro.
        maxImageTokens: 1120,
      },
    },
  },
  {
    provider: "ollama-cloud", model: "minimax-m3:cloud", label: "MiniMax M3 (Ollama Cloud)",
    capabilities: {
      text: true, vision: true, streaming: true, maxContextTokens: 512_000,
      pricing: {
        inputPerMillionTokensUsd: 0.60, cachedInputPerMillionTokensUsd: 0.12,
        outputPerMillionTokensUsd: 2.40, currency: "USD",
        source: "https://ollama.com/pricing", asOf: "2026-09-03",
        // SEM maxImageTokens de propósito: https://ollama.com/library/minimax-m3
        // confirma "Text, Image" e diz que a imagem some no mesmo preço de
        // entrada, mas não publica um orçamento de tokens por imagem como o
        // gemma4 publica. `vision: true` continua correto — o modelo aceita
        // imagem tecnicamente — mas `podeAnalisarImagem` bloqueia até esse
        // número existir, porque sem ele não há como saber quanto reservar.
      },
    },
  },
  // Texto, não motor do assistente — catalogados para comparação de custo,
  // não como candidatos à execução real do produto.
  {
    provider: "ollama-cloud", model: "deepseek-v4-flash:cloud", label: "DeepSeek V4 Flash (Ollama Cloud)",
    capabilities: {
      text: true, vision: false, streaming: true, maxContextTokens: 1_000_000,
      pricing: {
        inputPerMillionTokensUsd: 0.44, cachedInputPerMillionTokensUsd: 0.014,
        outputPerMillionTokensUsd: 1.32, currency: "USD",
        source: "https://ollama.com/pricing", asOf: "2026-09-03",
      },
    },
  },
  {
    provider: "ollama-cloud", model: "nemotron-3-ultra:cloud", label: "Nemotron 3 Ultra (Ollama Cloud)",
    capabilities: {
      text: true, vision: false, streaming: true,
      pricing: {
        inputPerMillionTokensUsd: 0.10, cachedInputPerMillionTokensUsd: 0.10,
        outputPerMillionTokensUsd: 3.00, currency: "USD",
        source: "https://ollama.com/pricing", asOf: "2026-09-03",
      },
    },
  },
];

/** O modelo está autorizado NESTE provedor? */
export function modeloAutorizado(provider: string, model: string): boolean {
  return CATALOGO.some((m) => m.provider === provider && m.model === model);
}

/**
 * As capacidades de um par provedor+modelo, ou `null` se não catalogado.
 *
 * `null` não é "sem capacidade": é "não sei", e quem chama trata como recusa.
 * Devolver um objeto com tudo `false` faria um modelo desconhecido parecer um
 * modelo limitado, e essas duas coisas pedem respostas diferentes.
 */
export function capacidadesDe(provider: string, model: string): ModelCapabilities | null {
  return CATALOGO.find((m) => m.provider === provider && m.model === model)?.capabilities ?? null;
}

/** Os modelos de um provedor, para a interface oferecer — nunca texto livre. */
export function modelosDe(provider: AIProvider): readonly ModeloDoCatalogo[] {
  return CATALOGO.filter((m) => m.provider === provider);
}

/**
 * Um modelo só recebe imagem se sua precificação de imagem for VERIFICADA.
 *
 * A alternativa que o briefing também permite — reservar um teto conservador
 * por solicitação — exigiria um número que hoje não tenho de nenhuma fonte
 * oficial (ver docs/plan/parecer-piloto-qwen-p0.md §2). Bloquear é a escolha
 * mais honesta enquanto esse número não existir: nenhuma reserva de
 * orçamento pode ser melhor que uma reserva baseada em preço confirmado.
 *
 * `vision: true` sem `imagePricingVerified` continua útil para a INTERFACE —
 * ela sabe que o modelo TECNICAMENTE aceita imagem, para não desenhar um
 * anexo que o modelo recusaria — mas a EXECUÇÃO não chama com imagem até o
 * preço ser confirmado.
 */
export function podeAnalisarImagem(capabilities: ModelCapabilities): boolean {
  return capabilities.vision === true && capabilities.pricing?.maxImageTokens !== undefined;
}

/**
 * Micro-unidades da moeda do preço, a partir de tokens.
 *
 * A conta cabe numa linha por causa de uma coincidência de unidades: preço é
 * USD por MILHÃO de tokens, e micro-unidade é 1 milionésimo de USD — os dois
 * "milhão"/"milionésimo" se cancelam, e microUSD = tokens × preçoPorMilhão,
 * sem escala nenhuma no meio. Arredonda para cima: subestimar uma reserva é
 * o erro que este produto não aceita (ver orcamento.ts).
 */
export function custoMicros(precoPorMilhaoUsd: number, tokens: number): number {
  return Math.ceil(precoPorMilhaoUsd * tokens);
}

/**
 * O teto de reserva para UMA execução de texto: entrada + saída, no preço
 * de entrada (sem cache — a reserva não sabe se vai cachear) e no preço de
 * saída, cada um pelo respectivo teto de tokens.
 */
export function custoDeReservaMicros(
  pricing: ModelPricing,
  tokens: { entrada: number; saida: number; imagem?: number },
): number {
  const entradaTotal = tokens.entrada + (tokens.imagem ?? 0);
  return custoMicros(pricing.inputPerMillionTokensUsd, entradaTotal)
    + custoMicros(pricing.outputPerMillionTokensUsd, tokens.saida);
}
