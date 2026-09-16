/**
 * A sequência de um download da biblioteca — e a ordem que a torna honesta.
 *
 * Módulo puro: a rota precisa de sessão, marca e Storage, e a suíte de unidade
 * não tem nenhum dos três. As falhas que importam aqui — assinatura que não sai,
 * banco que cai no meio — só são testáveis com as dependências injetadas.
 *
 * ─── A ordem: buscar → assinar → registrar → emitir ────────────────────────
 *
 * A primeira versão registrava ANTES de assinar. Revisão externa de 14/09: se a
 * assinatura falhasse, ficava no registro um download que nunca aconteceu — e
 * ninguém apaga linha do registro. Ele passava a afirmar o falso.
 *
 * Inverter tudo também seria errado: emitir o endereço antes de registrar
 * deixaria o arquivo sair sem rastro.
 *
 * O que resolve as duas é separar ASSINAR de EMITIR. Assinar só produz um
 * endereço na memória do servidor; nada sai dali. Então: assina; se falhar, não
 * há o que registrar. Registra; se falhar, o endereço é descartado sem nunca
 * chegar ao navegador e expira sozinho em 60 segundos. Só com os dois de pé o
 * endereço é emitido.
 *
 * ─── O que o registro prova, e o que não prova ─────────────────────────────
 *
 * Que o download foi AUTORIZADO e INICIADO: esta pessoa recebeu um endereço
 * válido para este arquivo, neste instante. Não prova que os bytes chegaram —
 * rede, navegador ou antivírus podem interromper depois. Provar recebimento
 * completo exigiria transmitir o arquivo pelo próprio servidor e registrar só
 * no fim, com outro custo. A distinção vale na tela e diante de uma foundry.
 */

export type AssetParaDownload = { id: string; storagePath: string; fileName: string };

export type Busca = { ok: true; asset: AssetParaDownload | null } | { ok: false };

export type Resultado =
  | { tipo: "emitir"; endereco: string }
  | { tipo: "nao-encontrado" }
  /**
   * `busca`: o banco falhou ao procurar o asset. NÃO é "não encontrado" —
   * dizer 404 a quem tem direito ao arquivo, por uma queda do banco, faria a
   * pessoa concluir que ele não existe. (Revisão externa de 14/09.)
   */
  | { tipo: "falha"; etapa: "busca" | "assinatura" | "registro" };

export async function liberarDownload(deps: {
  buscar: () => Promise<Busca>;
  pertenceAMarca: (storagePath: string) => boolean;
  assinar: (asset: AssetParaDownload) => Promise<string | null>;
  registrar: (asset: AssetParaDownload) => Promise<boolean>;
}): Promise<Resultado> {
  const busca = await deps.buscar();
  if (!busca.ok) return { tipo: "falha", etapa: "busca" };

  const { asset } = busca;
  // Caminho fora da pasta da marca é defeito de dado, e a resposta é a mesma do
  // asset inexistente: distinguir confirmaria o arquivo a quem sonda.
  if (!asset || !deps.pertenceAMarca(asset.storagePath)) return { tipo: "nao-encontrado" };

  const endereco = await deps.assinar(asset);
  if (!endereco) return { tipo: "falha", etapa: "assinatura" };

  const registrado = await deps.registrar(asset);
  if (!registrado) return { tipo: "falha", etapa: "registro" };

  return { tipo: "emitir", endereco };
}
