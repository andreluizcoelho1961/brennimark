/**
 * Os limites da importação.
 *
 * Vivem num módulo SEM `"use client"` de propósito. Quando um componente de
 * servidor importa um valor de um módulo marcado como cliente, o Next não
 * entrega o valor: entrega uma referência de cliente. Para um componente isso
 * funciona; para um objeto comum, ler uma propriedade dele devolve `undefined`.
 *
 * O efeito disso era silencioso e grave: `arquivo.size > undefined` e
 * `numPages > undefined` são ambos falsos, então os dois limites simplesmente
 * deixavam de existir. Um PDF de 1.001 páginas passava direto.
 */

/**
 * O que o PRODUTO suporta. Requisito, não configuração.
 *
 * Cem MiB é a decisão de produto, e ela não se mexe porque a hospedagem do
 * momento aperta. A doutrina que governa isto está no §20.3 do replanejamento:
 * um teto de infraestrutura é fato do ambiente, não requisito do produto — e a
 * tentação contrária ("então por enquanto o produto aceita 50") é o que deixa a
 * conta de hospedagem decidir o escopo.
 */
export const TETO_DO_PRODUTO_BYTES = 100 * 1024 * 1024;

/**
 * O que a INSTALAÇÃO de hoje aguenta, que é outra coisa.
 *
 * O Supabase Free impõe **50 MB por arquivo** como limite global de plataforma,
 * e o limite por bucket não pode ultrapassá-lo. Não é contornável por código:
 * um arquivo de 80 MB é recusado pela plataforma, depois de a pessoa esperar o
 * upload inteiro.
 *
 * Por isso o teto efetivo é configuração de ambiente, com o valor do plano
 * gratuito como padrão. Ao migrar para o Pro, isto vira um valor no painel da
 * Vercel — **e a migration do bucket precisa subir junto**, senão o cliente
 * passa a aceitar o que o Storage vai recusar.
 */
const MB = 1024 * 1024;
const PADRAO_DO_PLANO_MB = 50;

function tetoDoPlanoEmBytes(): number {
  const declarado = Number(process.env.NEXT_PUBLIC_TETO_DE_IMPORTACAO_MB);
  // Um valor inválido não pode virar teto: `NaN > x` é falso, e o limite
  // deixaria de existir em silêncio — o mesmo defeito que o comentário acima
  // registra. Valor inválido cai no padrão do plano.
  const mb = Number.isFinite(declarado) && declarado > 0 ? declarado : PADRAO_DO_PLANO_MB;
  return Math.min(mb * MB, TETO_DO_PRODUTO_BYTES);
}

export const TETO_DO_PLANO_BYTES = tetoDoPlanoEmBytes();

/** O plano de hoje entrega menos que o produto promete? */
export const PLANO_ABAIXO_DO_PRODUTO = TETO_DO_PLANO_BYTES < TETO_DO_PRODUTO_BYTES;

export const LIMITES_DE_IMPORTACAO = {
  /**
   * O teto que vale AGORA: o menor entre o que o produto suporta e o que a
   * instalação aguenta. O bucket precisa concordar com este número — um
   * cliente mais permissivo faz o upload falhar depois da espera; um bucket
   * mais permissivo aceita arquivo que o leitor vai recusar.
   */
  maxBytes: TETO_DO_PLANO_BYTES,
  /** O mesmo teto que a RPC impõe. */
  maxPaginas: 1000,
};

/** Em MB inteiros, para mensagem de produto. */
export function emMB(bytes: number): number {
  return Math.round(bytes / MB);
}

/**
 * Qual recusa cabe a um arquivo deste tamanho — ou nenhuma.
 *
 * Extraída de `lerPdf` depois de o CI pegar o que a suíte local não pegou: a
 * decisão entre as duas mensagens vivia dentro de uma função que só roda com
 * um `File` e um navegador, então a única forma de exercitá-la era carregar um
 * PDF de verdade. Um ramo que precisa de 100 MiB para ser testado é um ramo
 * que ninguém testa.
 *
 * `maxBytes` é o teto EFETIVO da instalação, que pode vir de configuração; o
 * teto do produto é constante. A distinção entre as duas recusas é de produto:
 * "não aceitamos" e "esta instalação ainda não aceita" dizem coisas diferentes
 * para quem está avaliando comprar.
 */
export function motivoDeRecusaPorTamanho(
  bytes: number,
  maxBytes: number,
): "grande-demais" | "acima-do-plano" | null {
  if (bytes <= maxBytes) return null;
  return bytes > TETO_DO_PRODUTO_BYTES ? "grande-demais" : "acima-do-plano";
}
