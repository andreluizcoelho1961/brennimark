import { timingSafeEqual } from "node:crypto";

/**
 * A limpeza periódica do material órfão (24/09/2026).
 *
 * O envio de material tem dois passos (`envio.ts`): preparar e concluir. Quem
 * fecha a aba entre eles deixa o arquivo na pasta da marca sem registro — não
 * aparece, ninguém baixa, ocupa espaço para sempre. Uma vez por dia:
 *
 *   ENFILEIRAR   a função `enfileirar_materiais_orfaos` (só `service_role`)
 *                acha os órfãos com mais de 24 h e os põe em `brand_deletions`
 *                — a fila de sempre, não uma nova;
 *   DRENAR       conta por conta, a drenagem de sempre (`drenarFilaDeExclusao`)
 *                remove e só fecha a pendência quando observa a ausência.
 *
 * A decisão vive aqui, com portas injetadas; a rota só liga as portas reais.
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

/** Por execução. A função recusa acima de 1000. */
export const LIMITE_POR_EXECUCAO = 500;

/**
 * Quanto tempo a drenagem pode gastar numa execução. Folga larga dentro do
 * `maxDuration` da rota: o que sobrar fica para amanhã, ou para a próxima vez
 * que alguém abrir a administração — a fila é durável.
 */
export const ORCAMENTO_DA_DRENAGEM_MS = 45_000;

/** Um segredo curto demais é adivinhável; melhor recusar tudo que aceitar isso. */
const SEGREDO_MINIMO = 16;

/**
 * `Authorization: Bearer <CRON_SECRET>` confere?
 *
 * Recusa quando o segredo NÃO está configurado — senão `Bearer undefined`, ou
 * um cabeçalho vazio contra um segredo vazio, abriria a rota a qualquer um.
 * Comparação em tempo constante.
 */
export function segredoDoCronConfere(autorizacao: string | null, segredo: string | undefined): boolean {
  if (!segredo || segredo.trim().length < SEGREDO_MINIMO) return false;
  if (!autorizacao) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`, "utf8");
  const recebido = Buffer.from(autorizacao, "utf8");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export type ResultadoDaDrenagem = { removidos: number; pendentes: number; adiados: number };

export type PortasDaLimpeza = {
  enfileirar(limite: number): Promise<{ dados: number | null; erro: unknown }>;
  /** As contas com pendência no bucket de Materiais. */
  contasComPendencia(): Promise<{ dados: string[] | null; erro: unknown }>;
  drenar(conta: string): Promise<ResultadoDaDrenagem>;
  agora(): number;
};

export type ResumoDaLimpeza = {
  enfileirados: number | null;
  contas: number;
  removidos: number;
  pendentes: number;
  adiados: number;
  /** Onde parou, quando parou antes da hora. */
  falhas: string[];
  /** Acabou o orçamento com conta ainda por drenar. */
  interrompida: boolean;
};

/**
 * Enfileira, depois drena conta por conta até o orçamento acabar. `lote` é o
 * da drenagem (`LOTE` em `limpeza.ts`): lote cheio sugere que há mais atrás.
 */
export async function limparMateriaisOrfaos(
  portas: PortasDaLimpeza,
  { limite = LIMITE_POR_EXECUCAO, orcamentoMs = ORCAMENTO_DA_DRENAGEM_MS, lote = 50 } = {},
): Promise<ResumoDaLimpeza> {
  const inicio = portas.agora();
  const resumo: ResumoDaLimpeza = {
    enfileirados: null,
    contas: 0,
    removidos: 0,
    pendentes: 0,
    adiados: 0,
    falhas: [],
    interrompida: false,
  };

  // Falhar ao enfileirar NÃO impede drenar: o que já está na fila continua
  // valendo, e drenar é o que libera espaço.
  const enfileirados = await portas.enfileirar(limite);
  if (enfileirados.erro) resumo.falhas.push("enfileirar");
  else resumo.enfileirados = enfileirados.dados ?? 0;

  const contas = await portas.contasComPendencia();
  if (contas.erro) {
    resumo.falhas.push("listar contas");
    return resumo;
  }

  const unicas = [...new Set(contas.dados ?? [])];
  for (const conta of unicas) {
    if (portas.agora() - inicio >= orcamentoMs) {
      resumo.interrompida = true;
      break;
    }
    resumo.contas += 1;
    let ultimo: ResultadoDaDrenagem = { removidos: 0, pendentes: 0, adiados: 0 };
    // Lote após lote enquanto ele volta CHEIO de remoções: é o sinal de que há
    // mais. Lote parcial, ou só falhas e adiadas, encerra a conta — repetir
    // agora daria o mesmo resultado.
    try {
      do {
        ultimo = await portas.drenar(conta);
        resumo.removidos += ultimo.removidos;
      } while (ultimo.removidos >= lote && portas.agora() - inicio < orcamentoMs);
    } catch {
      // Uma conta que falha não derruba as outras.
      resumo.falhas.push(`drenar ${conta}`);
      continue;
    }
    resumo.pendentes += ultimo.pendentes;
    resumo.adiados += ultimo.adiados;
  }

  return resumo;
}
