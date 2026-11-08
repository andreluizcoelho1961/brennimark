import { capacidadesDe, modeloAutorizado, podeAnalisarImagem } from "./catalogo";
import { ESPERA_PADRAO_MS } from "./rotas-da-plataforma";
import type { AIProvider, AIProviderConfig, AIRoutingFeature } from "./provider";

/**
 * As rotas de IA de uma conta no plano "traga a sua" — ADR-0009, adendo de
 * 07/11/2026.
 *
 * A agência cadastra até três chaves (texto, imagem, reserva). Esta é a parte
 * PURA: recebe as linhas que o banco devolveu e uma função que decifra, e
 * devolve as tentativas. Nada aqui lê o ambiente do servidor: as chaves da
 * Brennimark, que moram na Vercel, não são importadas de propósito, e um teste
 * trava essa fronteira. Se a chave da agência falha, o Vini NÃO cai na IA
 * da Brennimark — nunca. A Brennimark não paga IA de quem escolheu trazer a sua.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type Encaixe = "texto" | "imagem" | "reserva";

/** O que `chave_de_ia_para_uso` devolve, mais o encaixe de onde veio. */
export type LinhaDaChave = {
  encaixe: Encaixe;
  provedor: string;
  modelo: string;
  chave_cifrada: string;
  chave_iv: string;
};

export type MotivoDescartado =
  | "provedor-fora-da-lista"
  | "fora-do-catalogo"
  /** A análise de peça manda imagem; o modelo daquele encaixe não a aceita. */
  | "sem-visao"
  /** Não decifrou: chave-mestra trocada, ou linha corrompida. */
  | "chave-ilegivel";

export type RotasDaAgencia = {
  attempts: { config: AIProviderConfig; isDemo: false }[];
  timeoutMs: number;
  /** A reserva é da agência e escolha dela: pode ser de outro provedor. */
  allowCrossProvider: true;
  descartadas: { encaixe: Encaixe; provedor: string; modelo: string; motivo: MotivoDescartado }[];
};

/**
 * A lista fechada de provedores do plano "traga a sua". Sem endereço
 * personalizado: aceitar o endereço da API que a agência digita abriria a porta
 * para o servidor chamar qualquer lugar da rede (SSRF) — ADR-0009 §6.
 */
export const PROVEDORES_DA_AGENCIA: readonly AIProvider[] = ["anthropic", "openai", "google", "groq", "openrouter"];

/** Qual encaixe atende cada tarefa, na ordem de tentativa. A reserva é de ambos. */
export const ENCAIXES_DA_TAREFA: Record<AIRoutingFeature, readonly Encaixe[]> = {
  chat: ["texto", "reserva"],
  analysis: ["imagem", "reserva"],
};

export function montarRotasDaAgencia(
  linhas: readonly LinhaDaChave[],
  tarefa: AIRoutingFeature,
  decifrar: (chaveCifrada: string, iv: string) => string,
): RotasDaAgencia {
  const attempts: RotasDaAgencia["attempts"] = [];
  const descartadas: RotasDaAgencia["descartadas"] = [];

  for (const encaixe of ENCAIXES_DA_TAREFA[tarefa]) {
    const linha = linhas.find((l) => l.encaixe === encaixe);
    if (!linha) continue;
    const { provedor, modelo } = linha;
    const descarta = (motivo: MotivoDescartado) => descartadas.push({ encaixe, provedor, modelo, motivo });

    if (!PROVEDORES_DA_AGENCIA.includes(provedor as AIProvider)) { descarta("provedor-fora-da-lista"); continue; }
    // O catálogo é conferido NA HORA, como na rota da plataforma: um modelo
    // descatalogado depois de cadastrado não volta a ser usado por inércia.
    if (!modeloAutorizado(provedor, modelo)) { descarta("fora-do-catalogo"); continue; }
    if (tarefa === "analysis") {
      const capacidades = capacidadesDe(provedor, modelo);
      if (!capacidades || !podeAnalisarImagem(capacidades)) { descarta("sem-visao"); continue; }
    }

    let apiKey: string;
    try {
      apiKey = decifrar(linha.chave_cifrada, linha.chave_iv);
    } catch {
      // Nunca o erro original: a mensagem de decifragem não tem a chave, mas o
      // hábito de não repassar nada que toque nela vale mais que a exceção.
      descarta("chave-ilegivel");
      continue;
    }
    if (!apiKey) { descarta("chave-ilegivel"); continue; }

    attempts.push({ config: { provider: provedor as AIProvider, model: modelo, apiKey }, isDemo: false });
  }

  return { attempts, timeoutMs: ESPERA_PADRAO_MS[tarefa], allowCrossProvider: true, descartadas };
}
