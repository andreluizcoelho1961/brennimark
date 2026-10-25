/**
 * A limpeza diária do tour: apaga os visitantes vencidos e os usuários do tour
 * criados e nunca registrados (órfãos). A decisão vive aqui, com portas
 * injetadas; a rota só liga as portas reais. Cada passo é seguro de repetir.
 *
 * Duas conferências, nenhuma delas dispensável: o banco só lista usuário do tour
 * (`demonstracao_vencidos`, `demonstracao_orfaos`), E aqui conferimos DE NOVO
 * antes de cada `deleteUser` — conta real nunca é apagada por esta rotina, nem
 * se uma linha de sessão for gravada à mão. O razão de IA fica (append-only).
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export const LIMITE_POR_RODADA = 200;

export type PortasDaLimpeza = {
  vencidos(): Promise<string[]>;
  orfaos(): Promise<string[]>;
  /** true só se o usuário é do tour (marca de servidor ou login anônimo). */
  ehDoTour(userId: string): Promise<boolean>;
  apagar(userId: string): Promise<void>;
};

export type ResumoDaLimpeza = { apagados: number; recusados: number; restantes: number; falhas: string[] };

export async function rodarLimpezaDoTour(p: PortasDaLimpeza): Promise<ResumoDaLimpeza> {
  const ids = Array.from(new Set([...(await p.vencidos()), ...(await p.orfaos())]));
  const rodada = ids.slice(0, LIMITE_POR_RODADA);
  const resumo: ResumoDaLimpeza = { apagados: 0, recusados: 0, restantes: ids.length - rodada.length, falhas: [] };
  for (const id of rodada) {
    try {
      if (!(await p.ehDoTour(id))) { resumo.recusados += 1; continue; }
      await p.apagar(id);
      resumo.apagados += 1;
    } catch (e) {
      resumo.falhas.push(`${id.slice(0, 8)}: ${e instanceof Error ? e.message : "erro"}`);
    }
  }
  return resumo;
}
