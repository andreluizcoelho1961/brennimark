/**
 * Os Termos de uso e a Política de privacidade — o TEXTO, como dado.
 *
 * Rascunho de 03/10/2026, escrito a partir das decisões já tomadas pelo
 * André (cobrança, atraso, cancelamento, IA da plataforma, acesso por marca,
 * hospedagem de fonte). Precisa da revisão de um advogado antes de valer
 * como contrato: os trechos entre colchetes são dados que faltam, e os
 * marcados "[a confirmar]" são decisão que ainda não foi tomada.
 *
 * A VERSÃO vai junto em cada compra (metadados da sessão do Stripe), para
 * que se saiba qual texto cada assinante aceitou. Mudou o texto, muda a
 * versão.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export type SecaoLegal = { titulo: string; paragrafos: readonly string[] };
export type DocumentoLegal = { versao: string; vigenteDesde: string; secoes: readonly SecaoLegal[] };

export const TERMOS_DE_USO: DocumentoLegal = {
  versao: "2026-10-03",
  vigenteDesde: "3 de outubro de 2026",
  secoes: [
    { titulo: "1. Quem somos", paragrafos: [
      "O Brennimark é uma plataforma de gestão de marca operada por André Luiz Ferreira Coelho, microempreendedor individual inscrito no CNPJ 47.924.458/0001-09, com sede em Porto Alegre/RS (“Brennimark”, “nós”).",
      "Estes termos valem para quem assina o Brennimark e para todas as pessoas que usam a plataforma pela conta de um assinante.",
    ] },
    { titulo: "2. Quem é quem", paragrafos: [
      "Assinante é a empresa (agência, estúdio ou marca) que contrata o Brennimark e responde pela conta. A pessoa que faz a compra declara ter poderes para contratar em nome dela.",
      "Conta é o espaço do assinante na plataforma. Cada conta reúne uma ou mais marcas.",
      "Pessoas convidadas são quem o assinante libera para usar uma ou mais marcas. O que cada uma pode fazer — consultar, editar, aprovar ou administrar — é definido por marca, por quem administra a conta.",
    ] },
    { titulo: "3. O que o Brennimark faz", paragrafos: [
      "O Brennimark guarda o manual da marca em PDF e o mostra como foi diagramado; organiza os materiais da marca, os complementos e os links de entrega; e oferece o Vini, um assistente de inteligência artificial que responde com base no que a marca documenta, citando a fonte e o estado de cada regra (aprovada, rascunho ou pendente).",
      "O Vini orienta: ele não aprova peças nem substitui a revisão de quem responde pela marca. Respostas de inteligência artificial podem conter erros, e a decisão final é sempre da equipe do assinante.",
    ] },
    { titulo: "4. Conta, acesso e senha", paragrafos: [
      "O assinante é responsável por quem ele convida e pelo que essas pessoas fazem na plataforma.",
      "A senha é pessoal. Cada pessoa usa o seu próprio acesso; compartilhar senha não é permitido. Se suspeitar de uso indevido, avise-nos em [e-mail de contato].",
    ] },
    { titulo: "5. O conteúdo é de quem o criou", paragrafos: [
      "Manuais, materiais, complementos e demais arquivos enviados continuam sendo de quem os criou ou contratou. O Brennimark não se torna dono de nada que o assinante envia.",
      "O assinante declara ter o direito de enviar esse conteúdo — inclusive o de clientes dele — e nos autoriza a guardá-lo, exibi-lo às pessoas que ele liberar e processá-lo (inclusive pelo Vini) somente para prestar o serviço.",
    ] },
    { titulo: "6. Fonte da marca", paragrafos: [
      "A hospedagem da fonte tipográfica da marca só é ligada depois que o assinante aceita um termo próprio, descrito em Licença de fontes. A responsabilidade pela licença da fonte é do assinante. A fonte é servida só para download, a pessoas autenticadas daquela marca, e é retirada se a fundição que a licencia pedir.",
    ] },
    { titulo: "7. Uso não permitido", paragrafos: [
      "Não é permitido usar o Brennimark para enviar conteúdo que viole direitos de terceiros ou a lei; tentar acessar contas, marcas ou dados de outros assinantes; contornar limites técnicos ou de plano; ou revender o acesso sem acordo por escrito.",
    ] },
    { titulo: "8. Assinatura e pagamento", paragrafos: [
      "A assinatura é mensal, paga no cartão de crédito por meio do Stripe, e renova automaticamente a cada mês até ser cancelada. O Brennimark não recebe nem guarda o número do cartão.",
      "Os valores de cada plano aparecem na página de assinatura no momento da compra. Mudanças de valor são avisadas com pelo menos 30 dias de antecedência e valem a partir da renovação seguinte.",
      "A nota fiscal de serviço é emitida em nome do assinante, com os dados informados na compra.",
    ] },
    { titulo: "9. Pagamento em atraso", paragrafos: [
      "Se uma cobrança não for paga, a conta continua funcionando normalmente por 7 dias, com aviso a quem administra.",
      "Depois disso, a conta passa a ficar só para leitura: consultar o manual e baixar os materiais continuam possíveis; usar o Vini, editar conteúdo e criar marcas ficam suspensos até a regularização. Nada é apagado por causa do atraso. Paga a pendência, tudo volta a funcionar.",
    ] },
    { titulo: "10. Cancelamento", paragrafos: [
      "O assinante pode cancelar a qualquer momento, em Configurações → Plano. O acesso completo continua até o fim do período já pago, e não há nova cobrança depois dele.",
      "Reembolsos seguem a lei e o bom senso. Quem cancela em até 7 dias depois da primeira contratação recebe de volta o valor pago, por inteiro. Cobrança indevida, em duplicidade ou causada por falha nossa também é devolvida por inteiro. Nos demais casos, o cancelamento interrompe as próximas cobranças e o acesso segue até o fim do período já pago.",
      "Depois do cancelamento, a conta continua guardada, só para leitura, com todo o conteúdo dentro. O assinante pode pedir a exportação ou a exclusão definitiva dos dados pelo canal de contato.",
    ] },
    { titulo: "11. Limites dos planos", paragrafos: [
      "Cada plano tem limites de número de marcas, de armazenamento e de uso do Vini, mostrados na página de assinatura. Pessoas convidadas são ilimitadas. Quando um limite é alcançado, a plataforma avisa; o que já existe continua acessível.",
    ] },
    { titulo: "12. Disponibilidade", paragrafos: [
      "Trabalhamos para manter o Brennimark sempre no ar, mas não garantimos funcionamento ininterrupto. Manutenções programadas são avisadas com antecedência sempre que possível.",
    ] },
    { titulo: "13. Responsabilidade", paragrafos: [
      "[a confirmar com assessoria jurídica] O Brennimark responde pelos danos diretos que causar na prestação do serviço, limitados ao valor pago pelo assinante nos 12 meses anteriores ao fato. Não responde por decisões tomadas com base em respostas do Vini sem a revisão da equipe do assinante, nem por conteúdo enviado pelo assinante.",
    ] },
    { titulo: "14. Mudanças nestes termos", paragrafos: [
      "Quando estes termos mudarem, avisaremos quem administra cada conta com pelo menos 30 dias de antecedência. Continuar usando a plataforma depois da data de vigência significa aceitar a nova versão.",
    ] },
    { titulo: "15. Lei e foro", paragrafos: [
      "Estes termos seguem a lei brasileira. Fica eleito o foro da comarca de Porto Alegre/RS para resolver qualquer questão sobre eles.",
    ] },
  ],
};

export const POLITICA_DE_PRIVACIDADE: DocumentoLegal = {
  versao: "2026-10-03",
  vigenteDesde: "3 de outubro de 2026",
  secoes: [
    { titulo: "1. Quem trata os dados", paragrafos: [
      "Esta política explica como o Brennimark, operado por André Luiz Ferreira Coelho, microempreendedor individual inscrito no CNPJ 47.924.458/0001-09, trata dados pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018).",
      "Para os dados da conta e da assinatura (quem assina, quem paga, quem entra), o Brennimark é o controlador. Para o conteúdo das marcas e os dados das pessoas que o assinante convida, o controlador é o assinante, e o Brennimark trata esses dados em nome dele, como operador, só para prestar o serviço.",
    ] },
    { titulo: "2. Que dados tratamos", paragrafos: [
      "Cadastro: nome, e-mail e empresa de quem assina e de quem é convidado.",
      "Pagamento: o Stripe processa o cartão; recebemos dele só o necessário para manter a assinatura (situação, plano, datas e e-mail do titular). Não guardamos o número do cartão.",
      "Conteúdo: manuais, materiais, complementos e demais arquivos enviados, e as conversas com o Vini.",
      "Registros de uso: quem acessou cada marca, quem baixou cada material e as ações de edição, para que o assinante saiba o que aconteceu na conta dele.",
      "Dados técnicos: endereço IP, navegador e horários de acesso, registrados pela hospedagem por segurança.",
    ] },
    { titulo: "3. Para que usamos", paragrafos: [
      "Para prestar o serviço contratado (execução de contrato); para emitir nota fiscal e cumprir obrigações legais; para manter a plataforma segura e prevenir abuso (legítimo interesse); e para melhorar o produto com números agregados, sem identificar quem perguntou ou fez o quê.",
      "Não vendemos dados pessoais e não usamos o conteúdo das marcas para publicidade.",
    ] },
    { titulo: "4. Conversas com o Vini", paragrafos: [
      "Cada conversa é de quem a fez: nem as outras pessoas da conta nem quem a administra conseguem lê-la. A equipe do Brennimark só vê uma conversa se a pessoa a enviar ao suporte.",
      "Para responder, o Vini envia ao provedor de inteligência artificial a pergunta e os trechos do manual necessários. O conteúdo de clientes só é processado por planos de provedores que não usam esses dados para treinar modelos.",
    ] },
    { titulo: "5. Com quem compartilhamos", paragrafos: [
      "Só com os fornecedores necessários para o serviço funcionar, cada um tratando os dados conforme as nossas instruções: Vercel (hospedagem do site e da aplicação), Supabase (banco de dados e arquivos, em servidores em São Paulo), Stripe (pagamento), os provedores de inteligência artificial que a plataforma usa em cada momento (hoje, entre Anthropic, Google, OpenAI, Groq e OpenRouter) e, quando ligado, um serviço de envio de e-mail.",
      "Alguns desses fornecedores ficam fora do Brasil. A transferência internacional se apoia nas salvaguardas contratuais deles e na execução do contrato com o assinante.",
      "Também compartilhamos dados quando a lei ou uma ordem judicial exigir.",
    ] },
    { titulo: "6. Cookies", paragrafos: [
      "Usamos só cookies necessários: os da sessão de quem entra na plataforma e um cookie temporário da compra, que permite criar a senha na volta do pagamento. A preferência de tema fica guardada no próprio navegador. Não usamos cookies de publicidade nem de rastreamento.",
    ] },
    { titulo: "7. Por quanto tempo guardamos", paragrafos: [
      "Enquanto a assinatura estiver ativa, guardamos os dados para prestar o serviço.",
      "Depois do cancelamento, a conta fica guardada, só para leitura, para que o assinante possa voltar ou baixar o que é dele — até que o assinante peça a exclusão. Dados que a lei manda guardar (como os fiscais) ficam pelo prazo legal.",
    ] },
    { titulo: "8. Segurança", paragrafos: [
      "O acesso é controlado por marca: cada pessoa só vê as marcas que lhe foram liberadas, e isso é imposto pelo banco de dados, não só pela tela. A comunicação é cifrada, os arquivos não têm endereço público, e os links de entrega têm prazo e podem ser revogados.",
    ] },
    { titulo: "9. Seus direitos", paragrafos: [
      "Você pode pedir confirmação de que tratamos seus dados, acesso, correção, anonimização, portabilidade, exclusão e informação sobre com quem os compartilhamos, além de revogar consentimentos, nos termos do artigo 18 da LGPD.",
      "Peça pelo e-mail [e-mail de privacidade]. Respondemos em até 15 dias. Se o pedido for sobre conteúdo de uma marca, encaminhamos ao assinante, que é o controlador desses dados.",
    ] },
    { titulo: "10. Contato", paragrafos: [
      "Para qualquer questão sobre privacidade, escreva para [e-mail de privacidade].",
    ] },
    { titulo: "11. Mudanças nesta política", paragrafos: [
      "Quando esta política mudar, a nova versão é publicada aqui, com a data. Mudanças relevantes são avisadas a quem administra cada conta.",
    ] },
  ],
};
