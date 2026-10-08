/**
 * A rotina diária das contas canceladas (08/10/2026) — a promessa dos Termos
 * (seção 13): 12 meses só para leitura, aviso 30 dias antes, depois exclusão.
 *
 *   AVISAR     contas canceladas há 11 meses, sem aviso: reserva no banco,
 *              manda o e-mail; se o envio falha, devolve a reserva (amanhã
 *              tenta de novo, e o prazo de 30 dias só conta do aviso que saiu);
 *   EXCLUIR    contas que passaram nas três travas (ver a migration
 *              `exclusao_aos_12_meses`): iniciar (enfileira os arquivos),
 *              drenar (a drenagem de sempre, escopo da conta) e concluir — o
 *              banco só apaga a área quando a fila e a pasta estão vazias.
 *
 * Cada passo é seguro de repetir: o que não termina hoje continua amanhã.
 * A decisão vive aqui, com portas injetadas; a rota só liga as portas reais.
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type ContaAAvisar = { idAssinatura: string; email: string; nomeDaConta: string | null; excluirEm: string };
export type ContaAExcluir = { conta: string; iniciada: boolean };

export type PortasDaRotina = {
  contasAAvisar(): Promise<ContaAAvisar[]>;
  /** true reserva o aviso (só o primeiro ganha); false devolve a reserva. */
  reservarAviso(idAssinatura: string, reservar: boolean): Promise<boolean>;
  avisar(conta: ContaAAvisar): Promise<void>;
  contasAExcluir(): Promise<ContaAExcluir[]>;
  iniciarExclusao(conta: string): Promise<number>;
  drenar(conta: string): Promise<{ removidos: number; pendentes: number }>;
  concluirExclusao(conta: string): Promise<"pendente" | "excluida">;
  agora(): number;
};

export type ResumoDaRotina = {
  avisadas: number;
  iniciadas: number;
  arquivosRemovidos: number;
  excluidas: number;
  pendentes: number;
  falhas: string[];
};

/** Folga dentro do `maxDuration` da rota: o que sobrar fica para amanhã. */
export const ORCAMENTO_MS = 45_000;

function motivo(erro: unknown): string {
  return erro instanceof Error ? erro.message.slice(0, 200) : "erro desconhecido";
}

export async function rodarContasCanceladas(portas: PortasDaRotina, orcamentoMs = ORCAMENTO_MS): Promise<ResumoDaRotina> {
  const inicio = portas.agora();
  const resumo: ResumoDaRotina = { avisadas: 0, iniciadas: 0, arquivosRemovidos: 0, excluidas: 0, pendentes: 0, falhas: [] };
  const semTempo = () => portas.agora() - inicio > orcamentoMs;

  // 1. Avisar. Uma falha numa conta não impede as outras.
  try {
    for (const conta of await portas.contasAAvisar()) {
      if (semTempo()) break;
      try {
        if (!(await portas.reservarAviso(conta.idAssinatura, true))) continue;
        try {
          await portas.avisar(conta);
          resumo.avisadas += 1;
        } catch (erro) {
          await portas.reservarAviso(conta.idAssinatura, false);
          throw erro;
        }
      } catch (erro) {
        resumo.falhas.push(`aviso ${conta.idAssinatura}: ${motivo(erro)}`);
      }
    }
  } catch (erro) {
    resumo.falhas.push(`listar avisos: ${motivo(erro)}`);
  }

  // 2. Excluir: iniciar, drenar, concluir — conta por conta.
  try {
    for (const { conta, iniciada } of await portas.contasAExcluir()) {
      if (semTempo()) break;
      try {
        if (!iniciada) {
          await portas.iniciarExclusao(conta);
          resumo.iniciadas += 1;
        }
        const fila = await portas.drenar(conta);
        resumo.arquivosRemovidos += fila.removidos;
        const desfecho = await portas.concluirExclusao(conta);
        if (desfecho === "excluida") resumo.excluidas += 1;
        else resumo.pendentes += 1;
      } catch (erro) {
        resumo.falhas.push(`exclusão ${conta}: ${motivo(erro)}`);
      }
    }
  } catch (erro) {
    resumo.falhas.push(`listar exclusões: ${motivo(erro)}`);
  }

  return resumo;
}
