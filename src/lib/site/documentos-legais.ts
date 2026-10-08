/**
 * Os Termos de uso e a Política de privacidade — o TEXTO, como dado.
 *
 * Rascunho de 03/10/2026, escrito a partir das decisões já tomadas pelo
 * André (cobrança, atraso, cancelamento, IA da plataforma, acesso por marca,
 * hospedagem de fonte). Precisa da revisão de um advogado antes de valer
 * como contrato: os trechos entre colchetes são dados que faltam, e os
 * marcados "[a confirmar]" são decisão que ainda não foi tomada.
 *
 * 07/10/2026: o e-mail de contato e de privacidade passou a contato@brennimark.com
 * (domínio próprio, recebido pelo iCloud+); a versão subiu.
 *
 * 08/10/2026: o §13 passou a dizer que o arrependimento encerra o acesso completo
 * na hora. A versão ficou a mesma porque ninguém tinha aceitado o texto anterior
 * dela (zero aceites em produção, conferido) e a versão é uma data.
 *
 * Revisão de conformidade (CDC, LGPD, Marco Civil, Decreto 7.962/2013,
 * Resolução CD/ANPD 19/2024), feita pelo André com ajuda de IA e aplicada
 * literalmente a partir de `brennimark-termos-ajustes.md`. Ainda passa por
 * advogado. Marcações no texto: **negrito**; parágrafo que começa com "- " é
 * item de lista; [[pagina#ancora|texto]] é link.
 *
 * A VERSÃO vai junto em cada compra (metadados da sessão do Stripe), para
 * que se saiba qual texto cada assinante aceitou. Mudou o texto, muda a
 * versão.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import { EMPRESA } from "./empresa";

export type SecaoLegal = { id?: string; titulo: string; paragrafos: readonly string[] };
export type DocumentoLegal = { versao: string; vigenteDesde: string; secoes: readonly SecaoLegal[] };

const E = EMPRESA;

export const TERMOS_DE_USO: DocumentoLegal = {
  versao: "2026-10-08",
  vigenteDesde: "8 de outubro de 2026",
  secoes: [
    { titulo: "1. Quem somos", paragrafos: [
      `O Brennimark é uma plataforma de gestão de marca operada por ${E.nome}, ${E.natureza} inscrito no CNPJ ${E.cnpj}, com endereço em ${E.endereco}, ${E.cidade}, CEP ${E.cep}, e-mail ${E.email} ("Brennimark", "nós").`,
      `Estes termos valem para quem assina o Brennimark e para todas as pessoas que usam a plataforma pela conta de um assinante.`,
    ] },
    { titulo: "2. Quem é quem", paragrafos: [
      `Assinante é a empresa (agência, estúdio ou marca) que contrata o Brennimark e responde pela conta. A pessoa que faz a compra declara ter poderes para contratar em nome dela.`,
      `Conta é o espaço do assinante na plataforma. Cada conta reúne uma ou mais marcas.`,
      `Pessoas convidadas são quem o assinante libera para usar uma ou mais marcas. O que cada uma pode fazer — consultar, editar, aprovar ou administrar — é definido por marca, por quem administra a conta.`,
      `O Brennimark é feito para uso profissional. Se o assinante for consumidor nos termos do Código de Defesa do Consumidor, os direitos que essa lei garante prevalecem sobre qualquer regra destes termos que diga o contrário.`,
    ] },
    { titulo: "3. O que o Brennimark faz", paragrafos: [
      `O Brennimark guarda o manual da marca em PDF e o mostra como foi diagramado; organiza os materiais da marca, os complementos e os links de entrega; e oferece o Vini, um assistente de inteligência artificial que responde com base no que a marca documenta, citando a fonte e o estado de cada regra (aprovada, rascunho ou pendente).`,
      `O Vini orienta: ele não aprova peças nem substitui a revisão de quem responde pela marca. Respostas de inteligência artificial podem conter erros, e a decisão final é sempre da equipe do assinante.`,
    ] },
    { titulo: "4. Conta, acesso e senha", paragrafos: [
      `O assinante é responsável por quem ele convida e pelo que essas pessoas fazem na plataforma.`,
      `A senha é pessoal. Cada pessoa usa o seu próprio acesso; compartilhar senha não é permitido. Se suspeitar de uso indevido, avise-nos em ${E.email}.`,
    ] },
    { titulo: "5. O conteúdo é de quem o criou", paragrafos: [
      `Manuais, materiais, complementos e demais arquivos enviados continuam sendo de quem os criou ou contratou. O Brennimark não se torna dono de nada que o assinante envia.`,
      `O assinante declara ter o direito de enviar esse conteúdo — inclusive o de clientes dele — e nos autoriza a guardá-lo, exibi-lo às pessoas que ele liberar e processá-lo (inclusive pelo Vini) somente para prestar o serviço.`,
    ] },
    { id: "dados-tratados-em-nome-do-assinante", titulo: "6. Dados tratados em nome do assinante", paragrafos: [
      `Para o conteúdo das marcas e os dados das pessoas convidadas dentro delas, o assinante é o controlador e o Brennimark é o operador (LGPD, art. 39). Por isso, o Brennimark:`,
      `- trata esses dados só para prestar o serviço e conforme estes termos, que são as instruções do assinante;`,
      `- usa apenas os fornecedores listados na Política de privacidade e avisa o assinante, com 30 dias de antecedência, quando incluir um novo;`,
      `- avisa o assinante em até 72 horas depois de saber de um incidente de segurança que afete esses dados;`,
      `- ajuda o assinante a atender pedidos de titulares;`,
      `- ao fim do contrato, devolve ou elimina os dados, conforme o assinante escolher.`,
      `Tratamos como confidencial todo o conteúdo enviado pelo assinante. Só o acessamos para prestar o serviço, dar suporte quando pedido ou cumprir ordem legal.`,
    ] },
    { titulo: "7. A plataforma é nossa", paragrafos: [
      `O software, a marca Brennimark e a plataforma são nossos; a assinatura dá direito de uso, não de propriedade. As respostas do Vini podem ser usadas livremente pelo assinante.`,
    ] },
    { titulo: "8. Fonte da marca", paragrafos: [
      `A hospedagem da fonte tipográfica da marca só é ligada depois que o assinante aceita um termo próprio, descrito em Licença de fontes. A responsabilidade pela licença da fonte é do assinante. A fonte é servida só para download, a pessoas autenticadas daquela marca, e é retirada se a fundição que a licencia pedir.`,
    ] },
    { titulo: "9. Uso não permitido", paragrafos: [
      `Não é permitido usar o Brennimark para enviar conteúdo que viole direitos de terceiros ou a lei; tentar acessar contas, marcas ou dados de outros assinantes; contornar limites técnicos ou de plano; ou revender o acesso sem acordo por escrito.`,
    ] },
    { titulo: "10. Suspensão e notificações", paragrafos: [
      `Se houver violação destas regras, podemos suspender o acesso envolvido, avisando quem administra a conta e explicando o motivo. Em violações graves ou repetidas, podemos encerrar a assinatura; nesse caso, o assinante pode exportar seu conteúdo por 30 dias.`,
      `Quem acreditar que algum conteúdo no Brennimark viola seus direitos pode escrever para ${E.email}, identificando o conteúdo e o direito. Avaliaremos e, se for o caso, encaminharemos ao assinante ou retiraremos o conteúdo.`,
    ] },
    { titulo: "11. Assinatura e pagamento", paragrafos: [
      `A assinatura é mensal, paga no cartão de crédito por meio do Stripe, e **renova automaticamente** a cada mês, no mesmo dia da contratação, até ser cancelada. O Brennimark não recebe nem guarda o número do cartão.`,
      `Os valores de cada plano aparecem na página de assinatura no momento da compra. Mudanças de valor são avisadas com pelo menos 30 dias de antecedência e valem a partir da renovação seguinte. Quem não concordar pode cancelar antes dessa data, sem nenhum custo.`,
      `A nota fiscal de serviço é emitida em nome do assinante, com os dados informados na compra.`,
    ] },
    { titulo: "12. Pagamento em atraso", paragrafos: [
      `Se uma cobrança não for paga, a conta continua funcionando normalmente por 7 dias, com aviso a quem administra.`,
      `Depois disso, a conta passa a ficar só para leitura: consultar o manual e baixar os materiais continuam possíveis; usar o Vini, editar conteúdo e criar marcas ficam suspensos até a regularização. Nada é apagado por causa do atraso. Paga a pendência, tudo volta a funcionar.`,
    ] },
    { titulo: "13. Cancelamento e reembolso", paragrafos: [
      `O assinante pode cancelar a qualquer momento, em Configurações → Plano, ou pelo e-mail ${E.email}. Confirmamos o cancelamento na hora, por e-mail. O acesso completo continua até o fim do período já pago (salvo no arrependimento, abaixo), e não há nova cobrança.`,
      `**Arrependimento:** quem cancelar em até 7 dias da primeira contratação recebe de volta o valor pago, por inteiro, pelo mesmo canal usado na compra. Pedimos o estorno ao Stripe imediatamente, e ele aparece na fatura do cartão conforme o prazo da operadora. Como o valor volta por inteiro, o acesso completo termina no momento do cancelamento, e a conta passa a ficar só para leitura, guardada como qualquer conta cancelada.`,
      `**Cobrança indevida:** cobrança em duplicidade, após o cancelamento ou causada por falha nossa é devolvida por inteiro.`,
      `**Demais casos:** fora dessas situações, não há reembolso proporcional do mês em curso; o cancelamento interrompe as próximas cobranças.`,
      `Depois do cancelamento, a conta fica guardada, só para leitura, por 12 meses, para que o assinante possa voltar ou exportar o que é dele. Avisamos 30 dias antes do fim desse prazo. Depois disso, o conteúdo é excluído definitivamente. O assinante pode pedir a exclusão antes. Dados que a lei manda guardar (como os fiscais e os registros de acesso) ficam pelo prazo legal.`,
      `A exportação devolve os arquivos originais e um índice do conteúdo, em até 15 dias depois do pedido.`,
    ] },
    { titulo: "14. Limites dos planos", paragrafos: [
      `Cada plano tem limites de número de marcas, de armazenamento e de uso do Vini, mostrados na página de assinatura. Pessoas convidadas são ilimitadas. Quando um limite é alcançado, a plataforma avisa; o que já existe continua acessível.`,
    ] },
    { titulo: "15. Disponibilidade", paragrafos: [
      `Trabalhamos para manter o Brennimark sempre no ar, mas não garantimos funcionamento ininterrupto. Manutenções programadas são avisadas com antecedência sempre que possível.`,
    ] },
    { titulo: "16. Responsabilidade", paragrafos: [
      `O Brennimark responde pelos danos diretos que causar na prestação do serviço. Entre empresas, essa responsabilidade fica limitada ao valor pago pelo assinante nos 12 meses anteriores ao fato, e o Brennimark não responde por lucros cessantes, perda de oportunidade ou danos indiretos.`,
      `Esses limites não se aplicam a danos causados com dolo ou culpa grave, nem afastam direitos que a lei garante ao consumidor ou aos titulares de dados pessoais.`,
      `O Brennimark não responde por decisões tomadas com base em respostas do Vini sem a revisão da equipe do assinante, nem pelo conteúdo que o assinante e as pessoas convidadas enviam.`,
    ] },
    { titulo: "17. Mudanças nestes termos", paragrafos: [
      `Quando estes termos mudarem, avisaremos quem administra cada conta com pelo menos 30 dias de antecedência, explicando o que mudou. Quem não concordar pode cancelar antes da data de vigência, sem custo, e recebe de volta o valor proporcional ao período já pago e não usado. Mudanças exigidas por lei podem valer em prazo menor.`,
    ] },
    { titulo: "18. Idade e aceite", paragrafos: [
      `O Brennimark é destinado a maiores de 18 anos. O aceite destes termos é feito eletronicamente, no momento da compra ou do primeiro acesso, e registramos a versão aceita, a data e o horário.`,
    ] },
    { titulo: "19. Lei e foro", paragrafos: [
      `Estes termos seguem a lei brasileira. Fica eleito o foro da comarca de Porto Alegre/RS, ressalvado o direito do consumidor de propor ação no foro do próprio domicílio.`,
    ] },
  ],
};

export const POLITICA_DE_PRIVACIDADE: DocumentoLegal = {
  versao: "2026-10-08",
  vigenteDesde: "8 de outubro de 2026",
  secoes: [
    { titulo: "1. Quem trata os dados", paragrafos: [
      `Esta política explica como o Brennimark, operado por ${E.nome}, ${E.natureza} inscrito no CNPJ ${E.cnpj}, com endereço em ${E.endereco}, ${E.cidade}, CEP ${E.cep}, trata dados pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018).`,
      `O Brennimark é o **controlador** dos dados de cadastro, login, assinatura, pagamento e segurança de todas as pessoas que usam a plataforma, inclusive as convidadas.`,
      `O **assinante** é o controlador do conteúdo das marcas e dos registros de atividade dentro delas (quem acessou, baixou ou editou o quê). Para esses dados, o Brennimark é **operador**: trata só para prestar o serviço e segue as instruções do assinante, conforme a seção "[[termos#dados-tratados-em-nome-do-assinante|Dados tratados em nome do assinante]]" dos Termos de uso.`,
    ] },
    { titulo: "2. Que dados tratamos", paragrafos: [
      `Cadastro: nome, e-mail e empresa de quem assina e de quem é convidado.`,
      `Pagamento: o Stripe processa o cartão; recebemos dele só o necessário para manter a assinatura (situação, plano, datas e e-mail do titular). Não guardamos o número do cartão.`,
      `Conteúdo: manuais, materiais, complementos e demais arquivos enviados, e as conversas com o Vini.`,
      `Registros de uso: quem acessou cada marca, quem baixou cada material e as ações de edição, para que o assinante saiba o que aconteceu na conta dele.`,
      `Dados técnicos: endereço IP, navegador e horários de acesso, registrados por segurança. Os registros de acesso à aplicação (IP, data e hora) são guardados por 6 meses, em sigilo, como exige o Marco Civil da Internet (Lei 12.965/2014, art. 15).`,
    ] },
    { titulo: "3. Para que usamos", paragrafos: [
      `Para prestar o serviço contratado (execução de contrato); para emitir nota fiscal e cumprir obrigações legais; para manter a plataforma segura e prevenir abuso (legítimo interesse); e para melhorar o produto com números agregados e anonimizados, sem identificar quem perguntou ou fez o quê (legítimo interesse). Dados anonimizados deixam de ser dados pessoais (art. 12 da LGPD). Os registros de acesso exigidos pelo Marco Civil são guardados para cumprir obrigação legal.`,
      `Não vendemos dados pessoais e não usamos o conteúdo das marcas para publicidade.`,
    ] },
    { titulo: "4. Conversas com o Vini", paragrafos: [
      `Cada conversa é de quem a fez: nem as outras pessoas da conta nem quem a administra conseguem lê-la. A equipe do Brennimark só vê uma conversa se a pessoa a enviar ao suporte.`,
      `Para responder, o Vini envia ao provedor de inteligência artificial a pergunta e os trechos do manual necessários. Só usamos provedores e planos que, por contrato, não usam esses dados para treinar modelos e não os guardam além do necessário para responder.`,
    ] },
    { titulo: "5. Com quem compartilhamos", paragrafos: [
      `Só com os fornecedores necessários para o serviço funcionar, cada um tratando os dados conforme as nossas instruções: Vercel (hospedagem do site e da aplicação), Supabase (banco de dados e arquivos, em servidores em São Paulo), Stripe (pagamento), os provedores de inteligência artificial que a plataforma usa em cada momento (hoje, entre Anthropic, Google, OpenAI, Groq e OpenRouter) e, quando ligado, um serviço de envio de e-mail.`,
      `Alguns desses fornecedores tratam dados nos Estados Unidos e em outros países. Essas transferências se apoiam nas cláusulas-padrão contratuais aprovadas pela ANPD (Resolução CD/ANPD nº 19/2024), incorporadas aos contratos com cada fornecedor. Você pode pedir a lista atualizada de fornecedores, os países e a íntegra das cláusulas pelo canal de privacidade; respondemos em até 15 dias.`,
      `Também compartilhamos dados quando a lei ou uma ordem judicial exigir.`,
    ] },
    { titulo: "6. Cookies", paragrafos: [
      `Usamos só cookies necessários: os da sessão de quem entra na plataforma e um cookie temporário da compra, que permite criar a senha na volta do pagamento. A preferência de tema fica guardada no próprio navegador. Não usamos cookies de publicidade nem de rastreamento.`,
    ] },
    { titulo: "7. Por quanto tempo guardamos", paragrafos: [
      `Enquanto a assinatura estiver ativa, guardamos os dados para prestar o serviço.`,
      `Depois do cancelamento, a conta fica guardada, só para leitura, por 12 meses, para que o assinante possa voltar ou exportar o que é dele. Avisamos 30 dias antes do fim desse prazo. Depois disso, o conteúdo é excluído definitivamente. O assinante pode pedir a exclusão antes.`,
      `Registros de acesso ficam 6 meses, como exige o Marco Civil da Internet. Dados que a lei manda guardar por mais tempo (como os fiscais) ficam pelo prazo legal.`,
    ] },
    { titulo: "8. Segurança", paragrafos: [
      `O acesso é controlado por marca: cada pessoa só vê as marcas que lhe foram liberadas, e isso é imposto pelo banco de dados, não só pela tela. A comunicação é cifrada, os arquivos não têm endereço público, e os links de entrega têm prazo e podem ser revogados.`,
      `Se houver um incidente de segurança que possa causar risco ou dano relevante, comunicaremos a ANPD e as pessoas afetadas, nos prazos da lei.`,
    ] },
    { titulo: "9. Seus direitos", paragrafos: [
      `Você pode pedir, a qualquer momento: confirmação de que tratamos seus dados; acesso; correção; anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei; portabilidade; eliminação de dados tratados com base no seu consentimento; informação sobre com quem os compartilhamos; informação sobre a possibilidade de não consentir e o que isso implica; e revogação do consentimento. Também pode se opor a um tratamento feito com base em outra hipótese legal, se ele descumprir a lei (art. 18 da LGPD).`,
      `Peça pelo e-mail ${E.emailDePrivacidade}. Respondemos em até 15 dias. Se o pedido for sobre conteúdo de uma marca, avisamos você e encaminhamos ao assinante, que é o controlador desses dados.`,
      `Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).`,
    ] },
    { titulo: "10. Contato e encarregado", paragrafos: [
      `Como agente de tratamento de pequeno porte, o Brennimark não é obrigado a nomear um encarregado (Resolução CD/ANPD nº 2/2022). O canal para qualquer questão sobre dados pessoais é ${E.emailDePrivacidade}, atendido por ${E.nome}.`,
    ] },
    { titulo: "11. Mudanças nesta política", paragrafos: [
      `Quando esta política mudar, a nova versão é publicada aqui, com a data. Mudanças relevantes são avisadas a quem administra cada conta.`,
    ] },
  ],
};
