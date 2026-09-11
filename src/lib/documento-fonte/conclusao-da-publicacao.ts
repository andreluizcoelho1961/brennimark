import type { CodigoDeFalha } from "./registrar";

/**
 * O que dizer a quem publicou quando a SEGUNDA transação não conclui.
 *
 * A situação não tem equivalente no resto do produto: a marca existe, os
 * documentos existem, e o manual original está lá — mas o manifesto por página
 * não foi registrado, então a publicação está incompleta. Chamar isso de
 * "erro ao publicar" seria falso: quem lesse iria importar de novo e criaria
 * uma segunda marca. Chamar de sucesso seria pior.
 *
 * A regra vive fora do componente porque é regra, e regra se testa sem
 * navegador. O vocabulário de códigos é fechado em `registrar.ts`: a mensagem
 * do banco nunca chega aqui.
 */

export interface RelatoDaConclusao {
  pt: string;
  en: string;
  /**
   * Se o botão de nova tentativa aparece.
   *
   * Repetir é sempre SEGURO — a RPC é idempotente por `sha256`. Este campo diz
   * se é ÚTIL: oferecer um botão que vai falhar igual gasta a paciência de
   * quem clica e esconde o fato de que a pendência precisa de outra ação.
   */
  ofereceNovaTentativa: boolean;
}

const RELATOS: Record<CodigoDeFalha, RelatoDaConclusao> = {
  falha_temporaria: {
    pt: "A marca foi criada, mas o registro do documento original não terminou. Nada foi perdido — tentar de novo conclui de onde parou.",
    en: "The brand was created, but registering the source document didn't finish. Nothing was lost — retrying picks up where it stopped.",
    ofereceNovaTentativa: true,
  },
  /*
   * Consulta que não rodou — banco fora do ar, PostREST recusando, rede entre
   * a função e o banco. É o oposto de "não encontrei": não se sabe, então
   * nada foi gravado e repetir é o certo. Distinguir importa porque a
   * alternativa era gravar o manifesto sem seção nenhuma e fechar o vínculo,
   * perdendo a estrutura do manual em silêncio e para sempre.
   */
  falha_de_leitura: {
    pt: "Não foi possível ler os dados da marca para concluir o registro. Nada foi gravado — tentar de novo conclui de onde parou.",
    en: "The brand's data couldn't be read to finish registration. Nothing was saved — retrying picks up where it stopped.",
    ofereceNovaTentativa: true,
  },
  nao_autenticado: {
    pt: "A sessão expirou antes de o registro terminar. Entre de novo e conclua a partir do manual original da marca.",
    en: "The session expired before registration finished. Sign in again and finish from the brand's source manual.",
    ofereceNovaTentativa: false,
  },
  sem_permissao: {
    pt: "Só quem administra a conta pode registrar o documento original. A marca já existe; pedir a quem administra conclui o registro.",
    en: "Only an account owner can register the source document. The brand already exists; an owner can finish the registration.",
    ofereceNovaTentativa: false,
  },
  /*
   * Manifesto ausente é a publicação anterior a esta etapa: a marca foi criada
   * quando o relatório ainda não guardava geometria. Não há o que repetir, e
   * dizer o que resolve — reimportar — é mais honesto que "falhou".
   */
  manifesto_ausente: {
    pt: "Esta importação foi feita antes do registro por página, e não guardou a medida das páginas. A marca está no ar; importar o PDF de novo cria o registro completo.",
    en: "This import predates per-page registration and didn't record page measurements. The brand is live; importing the PDF again creates the complete record.",
    ofereceNovaTentativa: false,
  },
  manifesto_invalido: {
    pt: "O registro das páginas ficou inconsistente e não pode ser gravado como está. A marca está no ar, e importar o PDF de novo reconstrói o registro.",
    en: "The page record came out inconsistent and can't be saved as is. The brand is live, and importing the PDF again rebuilds the record.",
    ofereceNovaTentativa: false,
  },
  conta_nao_encontrada: {
    pt: "A conta não foi encontrada para concluir o registro. Abra a marca e conclua a partir do manual original.",
    en: "The account couldn't be found to finish registration. Open the brand and finish from its source manual.",
    ofereceNovaTentativa: false,
  },
  marca_nao_encontrada: {
    pt: "A marca não foi encontrada para concluir o registro. Abra a marca e conclua a partir do manual original.",
    en: "The brand couldn't be found to finish registration. Open the brand and finish from its source manual.",
    ofereceNovaTentativa: false,
  },
  importacao_nao_encontrada: {
    pt: "O arquivo desta importação não foi encontrado no armazenamento. Importar o PDF de novo resolve, e nada do que já existe é apagado.",
    en: "This import's file wasn't found in storage. Importing the PDF again fixes it, and nothing that already exists is erased.",
    ofereceNovaTentativa: false,
  },
  pedido_invalido: {
    pt: "O pedido de registro chegou incompleto. Abra a marca e conclua a partir do manual original.",
    en: "The registration request arrived incomplete. Open the brand and finish from its source manual.",
    ofereceNovaTentativa: false,
  },
};

/**
 * Um código desconhecido é tratado como TEMPORÁRIO.
 *
 * Ele só aparece se o servidor ganhar um código que esta tabela não conhece —
 * versões diferentes de cliente e servidor, que num deploy contínuo acontece.
 * Repetir é idempotente, então oferecer a tentativa é o erro seguro: declarar
 * permanente o que talvez fosse uma queda de rede deixaria uma publicação
 * completável parecendo perdida.
 */
export function relatarConclusao(codigo: string): RelatoDaConclusao {
  return RELATOS[codigo as CodigoDeFalha] ?? RELATOS.falha_temporaria;
}

/**
 * Os três estados de uma publicação, vistos do manual original.
 *
 *   completo               o manifesto por página existe
 *   incompleto             a transação A gravou o relatório COM as páginas, e a
 *                          B não concluiu — a retomada consegue terminar
 *   anterior-ao-manifesto  o relatório não tem páginas: a importação foi feita
 *                          antes de o registro por página existir
 *
 * ─── Por que o terceiro estado existe ───────────────────────────────────
 *
 * `brand_imports.source_document_id` nulo tem DOIS significados, e a migração
 * da fatia 2 já dizia isso: nas importações anteriores a ela, o nulo "é VERDADE
 * e não buraco". A tela tratava todo nulo como publicação incompleta. Em
 * produção isso atingia a única marca existente, a do Marco A: o manual abria
 * com um aviso de incompleta e um botão de retomada que nunca concluiria —
 * sem `paginas` no relatório, a rota responde `manifesto_ausente`, sempre.
 *
 * O critério é o mesmo de `conferirManifesto` em `registrar.ts`: relatório sem
 * páginas é o que torna a retomada impossível. Os dois lados decidem pela
 * mesma pergunta, para a tela nunca oferecer o que o servidor vai recusar.
 */
export type EstadoDaPublicacao = "completo" | "incompleto" | "anterior-ao-manifesto";

export function classificarPublicacao(
  sourceDocumentId: string | null,
  relatorioTemPaginas: boolean,
): EstadoDaPublicacao {
  if (sourceDocumentId) return "completo";
  return relatorioTemPaginas ? "incompleto" : "anterior-ao-manifesto";
}

/**
 * Nota, e não aviso: não há nada pendente nem nada perdido. O PDF e as seções
 * estão lá; o que não existe é o registro página a página, que nasceu depois.
 * Sem promessa de ação — reimportar criaria outra marca, e sugerir isso como
 * conserto seria trocar um aviso falso por um conselho ruim.
 */
export const RELATO_ANTERIOR_AO_MANIFESTO = {
  pt: "Manual publicado antes do registro por página. O PDF original e as seções estão aqui; o que esta publicação não tem é a contagem de páginas por seção, que passou a existir depois.",
  en: "Manual published before per-page registration. The source PDF and its sections are here; what this publication lacks is the per-section page count, which came later.",
} as const;

/**
 * O que dizer quando o registro CONCLUIU mas deixou páginas sem seção.
 *
 * Não é erro e não bloqueia nada: a página está registrada, medida e ligada ao
 * original. O que falta é curadoria — e o produto não pode apresentar isso
 * como publicação limpa, porque quem importou precisa saber que há trabalho
 * editorial esperando antes de a marca ir na frente de um cliente.
 */
export function relatarPendenciaDeSecao(
  paginasSemSecao: number | null,
  total: number,
): { pt: string; en: string } | null {
  /*
   * `null` é "não medido", e não gera relato — mas também não gera a
   * afirmação de que está tudo coberto. A diferença mora em quem chama: um
   * zero declarado é um fato sobre o manifesto; um `null` é ausência de fato.
   */
  if (paginasSemSecao === null || paginasSemSecao <= 0) return null;

  return {
    pt: `${paginasSemSecao} de ${total} páginas ficaram sem seção. Elas estão registradas e visíveis no manual original — a curadoria atribui a seção depois.`,
    en: `${paginasSemSecao} of ${total} pages ended up without a section. They are recorded and visible in the source manual — curation assigns sections later.`,
  };
}
