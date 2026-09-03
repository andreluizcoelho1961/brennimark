/**
 * Candidatos Qwen para o benchmark do piloto — DADO, não configuração.
 *
 * Este módulo NÃO é consumido por `PROVIDERS` nem por nenhuma rota que
 * permita configurar uma conexão real. Ele existe para o benchmark do P2 e
 * para este parecer poderem comparar os dois caminhos de integração lado a
 * lado, com número e fonte — sem que essa comparação, por si, abra um
 * caminho de configurar uma chave de verdade.
 *
 * NENHUM candidato aqui é "o padrão". A decisão de qual caminho — Alibaba
 * direto ou Qwen via OpenRouter — é o resultado do benchmark GE (P2), não
 * uma preferência de quem escreveu este catálogo. O adaptador OpenRouter já
 * existir no código NÃO é critério de escolha: é conveniência de integração,
 * e o briefing foi explícito que isso não deve vencer sozinho.
 *
 * Toda linha de preço carrega DATA, REGIÃO, FONTE e UNIDADE — sem os quatro,
 * um número aqui é opinião, não dado auditável.
 */

export type CaminhoDeIntegracao = "alibaba-direto" | "openrouter";

export interface PrecoCitado {
  /** US$ por 1.000.000 de tokens de TEXTO. Nunca inclui imagem — ver o
   *  comentário em `imagemNaoVerificada`. */
  entradaPorMilhaoUsd: number;
  saidaPorMilhaoUsd: number;
  /** Quando o número foi coletado. Preço de IA muda; um número sem data é um
   *  número que ninguém sabe se ainda vale. */
  coletadoEm: string;
  /** A região do endpoint importa: o mesmo modelo pode ter preço e
   *  disponibilidade diferentes por região, e o piloto usa o endpoint
   *  internacional — nunca o doméstico chinês. */
  regiao: string;
  fonte: string;
}

export interface CandidatoQwen {
  caminho: CaminhoDeIntegracao;
  /** O identificador que a API do caminho espera — não necessariamente o
   *  mesmo texto do nome comercial. */
  model: string;
  label: string;
  contextoMaximoTokens?: number;
  preco: PrecoCitado;
  /**
   * Sempre `false` nesta lista, e o comentário existe para dizer por quê.
   *
   * Nenhuma fonte consultada no P0 desagregou o custo da PARTE de imagem de
   * uma chamada com visão — nem o caminho direto (a página pública de preços
   * não desagrega por modelo de visão) nem o OpenRouter (o preço por-token
   * publicado não inclui uma tabela de conversão resolução→tokens para os
   * modelos Qwen VL). Sem essa conversão, reservar orçamento para uma
   * chamada de imagem seria um número inventado — e `podeAnalisarImagem` em
   * catalogo.ts recusa a chamada enquanto isto for `false`.
   */
  imagemNaoVerificada: true;
}

export const CANDIDATOS_QWEN: readonly CandidatoQwen[] = [
  // ─── Caminho direto: Alibaba Cloud Model Studio (ex-DashScope) ───────────
  //
  // Preços de REFERÊNCIA, não confirmados por página oficial de preços —
  // fontes terceiras. Antes de qualquer ativação real, alguém com acesso ao
  // console precisa confirmar contra a página oficial dentro da conta.
  {
    caminho: "alibaba-direto",
    model: "qwen-vl-max",
    label: "Qwen VL Max (Alibaba, referência)",
    preco: {
      entradaPorMilhaoUsd: 0.80,
      saidaPorMilhaoUsd: 3.20,
      coletadoEm: "2026-09-03",
      regiao: "internacional (Singapura) — preço de referência, não confirmado na página oficial",
      fonte: "https://langdb.ai/app/models/qwen-vl-max/",
    },
    imagemNaoVerificada: true,
  },
  {
    caminho: "alibaba-direto",
    model: "qwen-vl-plus",
    label: "Qwen VL Plus (Alibaba, referência)",
    preco: {
      entradaPorMilhaoUsd: 0.1365,
      saidaPorMilhaoUsd: 0.4095,
      coletadoEm: "2026-09-03",
      regiao: "internacional (Singapura) — preço de referência, via OpenRouter que revende a mesma rota",
      fonte: "https://www.llmreference.com/model/qwen-vl-plus/openrouter",
    },
    imagemNaoVerificada: true,
  },

  // ─── Caminho OpenRouter: mesmo modelo/classe, integração intermediada ────
  //
  // Preço confirmado por FONTE PRIMÁRIA — a página do próprio modelo no
  // OpenRouter, que é quem cobra. Há uma taxa permanente de compra de
  // crédito no OpenRouter (fora do escopo deste catálogo — é política de
  // conta, não de modelo) e uma camada a mais entre o Brennimark e o Qwen:
  // isso é custo estrutural que o benchmark GE precisa pesar contra a
  // conveniência de integração, não decidir por omissão.
  {
    caminho: "openrouter",
    model: "qwen/qwen3-vl-32b-instruct",
    label: "Qwen3 VL 32B Instruct (via OpenRouter)",
    contextoMaximoTokens: 131_072,
    preco: {
      entradaPorMilhaoUsd: 0.104,
      saidaPorMilhaoUsd: 0.416,
      coletadoEm: "2026-09-03",
      regiao: "conforme roteamento do OpenRouter — não fixo, o provedor de fundo pode variar",
      fonte: "https://openrouter.ai/qwen/qwen3-vl-32b-instruct",
    },
    imagemNaoVerificada: true,
  },
  {
    caminho: "openrouter",
    model: "qwen/qwen3-vl-8b-instruct",
    label: "Qwen3 VL 8B Instruct (via OpenRouter)",
    preco: {
      entradaPorMilhaoUsd: 0.117,
      saidaPorMilhaoUsd: 0.455,
      coletadoEm: "2026-09-03",
      regiao: "conforme roteamento do OpenRouter — não fixo, o provedor de fundo pode variar",
      fonte: "https://openrouter.ai/qwen/qwen3-vl-8b-instruct",
    },
    imagemNaoVerificada: true,
  },
  {
    caminho: "openrouter",
    model: "qwen/qwen2.5-vl-72b-instruct",
    label: "Qwen2.5 VL 72B Instruct (via OpenRouter)",
    preco: {
      entradaPorMilhaoUsd: 0.25,
      saidaPorMilhaoUsd: 0.75,
      coletadoEm: "2026-09-03",
      regiao: "conforme roteamento do OpenRouter — não fixo, o provedor de fundo pode variar",
      fonte: "https://openrouter.ai/qwen/qwen2.5-vl-72b-instruct",
    },
    imagemNaoVerificada: true,
  },
] as const;

/** Os candidatos de um caminho, para o benchmark comparar par a par. */
export function candidatosDe(caminho: CaminhoDeIntegracao): readonly CandidatoQwen[] {
  return CANDIDATOS_QWEN.filter((c) => c.caminho === caminho);
}
