/**
 * A garantia de que um objeto provisório não sobrevive à importação que falhou.
 *
 * Por que isto existe como módulo, e não como mais um `await` dentro do
 * componente
 * ----------------------------------------------------------------------------
 * Durante a importação, os arquivos sobem ANTES de a marca existir — o Storage
 * exige o arquivo antes da RPC que cria a linha. Nessa janela, um objeto no
 * bucket não tem marca, não tem `brand_imports`, não tem `brand_assets`, e
 * portanto **nada no banco aponta para ele**. Se a importação falhar e o
 * caminho só existir no estado daquela aba do navegador, ele some quando
 * alguém fecha a aba, e o arquivo fica no bucket para sempre.
 *
 * É exatamente a forma do incidente P0 de setembro: material de terceiro
 * sobrevivendo à decisão de removê-lo, sem nada que o denuncie. A diferença é
 * que ali a fila de exclusão ainda alcançava o objeto; aqui, como a marca
 * nunca chegou a existir, nem a fila sabe que ele está lá.
 *
 * O componente não pode ser o dono dessa decisão porque o componente não é
 * testável sem navegador — e uma regra de retenção que só é exercida à mão não
 * é uma regra, é uma intenção.
 *
 * O contrato
 * ----------
 * `garantirAusencia` termina de UMA de duas formas, nunca de uma terceira:
 *
 *   1. o objeto não está mais no Storage — confirmado por observação, não pela
 *      resposta da remoção; ou
 *   2. o caminho está numa fila durável, que a drenagem consulta depois.
 *
 * Ficar sem nenhuma das duas é o defeito que este módulo existe para impedir.
 * Por isso o resultado nomeia `perdidos`: o caso em que a remoção não
 * funcionou E o enfileiramento também não. Ele não pode ser silencioso.
 */

export interface ObjetoProvisorio {
  bucket: string;
  caminho: string;
}

/**
 * As portas para o mundo — Storage e fila.
 *
 * Injetadas em vez de importadas para que o teste possa exercer a falha do
 * upload do PDF sem navegador, sem rede e sem material de cliente.
 */
export interface PortasDeLimpeza {
  /** Pede a remoção. O retorno NÃO é tratado como prova. */
  remover(bucket: string, caminhos: string[]): Promise<{ erro?: string }>;
  /** Observa se o objeto realmente não está mais lá. */
  ausente(bucket: string, caminho: string): Promise<boolean>;
  /** Registra a pendência de forma durável. */
  enfileirar(itens: ObjetoProvisorio[]): Promise<{ erro?: string }>;
}

export interface ResultadoDaLimpeza {
  /** Confirmados fora do Storage, por observação. */
  removidos: ObjetoProvisorio[];
  /** Ainda no Storage, mas com pendência durável registrada. */
  enfileirados: ObjetoProvisorio[];
  /**
   * Nem removidos nem enfileirados. É o estado que não pode existir em
   * silêncio: quem chama precisa registrar isto em log, porque é a única
   * pista de que um arquivo de terceiro ficou sem dono.
   */
  perdidos: ObjetoProvisorio[];
}

/**
 * Garante que cada objeto provisório saiu do Storage ou virou pendência.
 *
 * A confirmação é por OBSERVAÇÃO, não pela resposta de `remove()`. A
 * documentação do Storage não define o que ela devolve quando o objeto já não
 * existe, e esse é justamente o caso mais comum numa segunda tentativa —
 * mesma disciplina que `drenarFilaDeExclusao` já usa, e mesma disciplina das
 * provas de ausência que a exclusão do manual real exigiu.
 */
export async function garantirAusencia(
  portas: PortasDeLimpeza,
  itens: ObjetoProvisorio[],
): Promise<ResultadoDaLimpeza> {
  const vazio: ResultadoDaLimpeza = { removidos: [], enfileirados: [], perdidos: [] };
  if (itens.length === 0) return vazio;

  // Uma chamada de remoção por bucket, não por arquivo.
  const porBucket = new Map<string, string[]>();
  for (const item of itens) {
    const lista = porBucket.get(item.bucket) ?? [];
    lista.push(item.caminho);
    porBucket.set(item.bucket, lista);
  }
  for (const [bucket, caminhos] of porBucket) {
    // Um erro aqui não interrompe: a observação abaixo é que decide, e um
    // bucket que falhou não pode impedir a limpeza dos outros.
    await portas.remover(bucket, caminhos).catch(() => ({ erro: "remoção lançou" }));
  }

  const removidos: ObjetoProvisorio[] = [];
  const sobraram: ObjetoProvisorio[] = [];
  for (const item of itens) {
    // Erro ao observar não é ausência: manter na lista de pendentes é o lado
    // seguro do engano — enfileira-se um arquivo que talvez já tenha saído, e
    // a drenagem fecha a entrada quando confirmar a ausência.
    const saiu = await portas
      .ausente(item.bucket, item.caminho)
      .catch(() => false);
    (saiu ? removidos : sobraram).push(item);
  }

  if (sobraram.length === 0) return { removidos, enfileirados: [], perdidos: [] };

  const fila = await portas
    .enfileirar(sobraram)
    .catch((erro: unknown) => ({ erro: String(erro) }));

  return fila.erro
    ? { removidos, enfileirados: [], perdidos: sobraram }
    : { removidos, enfileirados: sobraram, perdidos: [] };
}

// ─── A sequência de envio, que é onde o defeito morava ─────────────────────

export interface PortasDeEnvio extends PortasDeLimpeza {
  /** Envia uma imagem de página. Falha aqui não derruba a importação. */
  enviarImagem(caminho: string, dados: unknown): Promise<{ erro?: string }>;
  /** Envia o PDF. Um 409 é reencontro do mesmo objeto, não erro. */
  enviarPdf(caminho: string, dados: unknown): Promise<{ erro?: string; jaExiste?: boolean }>;
}

export interface PlanoDeEnvio {
  imagens: { caminho: string; dados: unknown }[];
  pdf: { caminho: string; dados: unknown };
  bucketDeImagens: string;
  bucketDoPdf: string;
}

export type ResultadoDoEnvio =
  | { ok: true; objetoNovo: boolean; imagensEnviadas: string[] }
  | { ok: false; motivo: "pdf"; erro: string; limpeza: ResultadoDaLimpeza };

/**
 * Envia as imagens e depois o PDF, e **não deixa imagem para trás quando o PDF
 * falha**.
 *
 * A ordem é imposta pelo produto: as imagens de página precisam existir antes
 * da RPC que cria a marca, e o PDF é o que a RPC valida. O defeito não estava
 * na ordem — estava na saída. Quando o envio do PDF falhava com algo que não
 * fosse 409, o fluxo retornava **sem tocar nas imagens já enviadas**, e como a
 * marca ainda não existia, nada no banco passava a apontar para elas: nem
 * `brand_assets`, nem `brand_imports`, nem a fila de exclusão. Ficavam fora do
 * alcance de qualquer limpeza, inclusive da drenagem que a administração roda.
 *
 * Agora a falha do PDF passa obrigatoriamente pela garantia: ou as imagens
 * saem do Storage, ou viram pendência durável. O chamador recebe o relatório e
 * é responsável por registrar `perdidos`, que é o único desfecho ruim
 * restante — e que agora, pelo menos, tem nome.
 */
export async function enviarArquivosDaImportacao(
  portas: PortasDeEnvio,
  plano: PlanoDeEnvio,
  /**
   * Relato opcional de progresso, chamado a cada imagem processada — enviada
   * ou não. A contagem é de TENTATIVAS concluídas, não de sucessos: uma imagem
   * que falha não derruba a importação, e uma barra que parasse nela mentiria
   * sobre o que ainda falta.
   */
  aoProgredir?: (feitas: number, total: number) => void,
): Promise<ResultadoDoEnvio> {
  const imagensEnviadas: string[] = [];
  let processadas = 0;
  for (const imagem of plano.imagens) {
    const envio = await portas
      .enviarImagem(imagem.caminho, imagem.dados)
      .catch((erro: unknown) => ({ erro: String(erro) }));
    // Uma imagem que falha ao enviar não derruba a importação: a seção publica
    // só com o texto. Mas ela também não entra na lista — não há o que limpar.
    processadas += 1;
    aoProgredir?.(processadas, plano.imagens.length);
    if (envio.erro) continue;
    imagensEnviadas.push(imagem.caminho);
  }

  const envioDoPdf = await portas
    .enviarPdf(plano.pdf.caminho, plano.pdf.dados)
    .catch((erro: unknown) => ({ erro: String(erro), jaExiste: false }));

  if (envioDoPdf.erro && !envioDoPdf.jaExiste) {
    const limpeza = await garantirAusencia(
      portas,
      imagensEnviadas.map((caminho) => ({ bucket: plano.bucketDeImagens, caminho })),
    );
    return { ok: false, motivo: "pdf", erro: envioDoPdf.erro, limpeza };
  }

  return { ok: true, objetoNovo: !envioDoPdf.jaExiste, imagensEnviadas };
}
