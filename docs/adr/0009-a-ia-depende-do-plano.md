# ADR-0009 — A IA depende do plano: da plataforma ou da própria conta

- **Status:** **aceito e construído** (atualizado em 10/11/2026). O André decidiu os dois planos e a
  forma de guardar a chave em 06/11/2026. As migrations `20261107184907 ia_por_plano` e
  `20261108140544 ia_propria_teto_e_franquia` estão no ledger de produção, e as rotas
  `/api/configuracoes/ia/*` existem. O texto abaixo foi escrito antes da construção e fica como
  registro da decisão; onde disser "nada construído" ou "espera OK antes da migration", leia como
  histórico.
- **Data:** conversa de 06/11/2026, depois da primeira entrevista de mercado (Happy House)
- **Decidido por:** André (direção); detalhes técnicos propostos por Claude
- **Altera:** ADR-0008 (a IA é da plataforma). O 0008 continua valendo para o plano com IA; deixa de
  ser a regra única.
- **Corrige o CLAUDE.md:** a seção "Camada de IA" diz que nenhuma conta escolhe ou configura IA.
  A correção entra **no mesmo commit** que este ADR, como foi feito com o 0008.

## 1. Contexto

O ADR-0008 (28/09) tirou a escolha de IA do assinante: a Brennimark contrata os modelos e o custo é
dela. Fez sentido para uma assinatura que inclui IA.

A primeira entrevista de mercado (Happy House, agência grande, 06/11/2026) mostrou o outro lado:

- A agência **já paga várias IAs** (Anthropic, OpenAI, Freepik, Magnific e outras). Uma assinatura
  que embute mais uma IA é custo que ela não quer.
- O valor que ela vê está no **ecossistema de marca** (manual, materiais, links de entrega,
  ferramentas, fonts), mais do que no Vini.
- Tem departamento de TI forte e quer **configurar os próprios motores de IA**.
- Faixa de preço dita por ela: cerca de R$ 150 por mês, **pelo pacote**, na fase beta. R$ 500 e
  R$ 1.000 por mês foram descartados como inviáveis.

É uma entrevista só. O sinal é forte e coerente com o mercado (agências usam muita IA), mas outras
conversas confirmam ou corrigem antes de o preço ir ao site.

## 2. Decisão proposta

Existem **dois modos de IA por conta**, definidos pelo plano:

| Modo | Quem fornece o motor | Quem paga a IA | Chave |
|---|---|---|---|
| **Com IA** (`plataforma`) | a Brennimark | a Brennimark, dentro do preço do plano | variável da Vercel (ADR-0008, sem mudança) |
| **Sem IA** (`propria`) | a própria agência | a agência, direto ao provedor | cadastrada pelo administrador, cifrada na conta dela |

O plano sem IA entrega a plataforma inteira (manual, materiais, links, ferramentas, Fonts). O Vini
funciona quando o administrador conecta uma IA; sem conexão, o Vini fica desligado com uma mensagem
clara e o resto do produto segue normal.

### 2.1 Como a chave da conta é guardada

- **Só escreve, nunca lê.** O administrador cola a chave uma vez. Depois a tela mostra apenas
  "conectada, termina em ••••1234". Nenhuma rota devolve a chave nem o texto cifrado.
- **Para mudar, troca.** Quem precisar "ver" a chave não pode: cria uma nova no provedor e a
  substitui aqui. É o modelo do próprio mercado (o provedor também não mostra a chave de novo).
- **Cifrada no servidor** com AES-256-GCM (`src/lib/ai/crypto.ts`, já existente), com a chave-mestra
  fora do banco, na Vercel (`AI_SETTINGS_ENCRYPTION_KEY`, que **não** se apaga). Guarda-se a versão
  da chave-mestra junto de cada registro, para poder trocá-la um dia sem perder os dados.
- **Só decifra no servidor, no instante de chamar o provedor**, dentro do `getModel()`.
- **Só o papel `administrar` daquela conta** cadastra, substitui ou apaga. A verificação é no
  servidor; a interface só esconde o botão.
- **Registro append-only** de quem cadastrou, substituiu ou apagou, e quando. Nunca grava o valor.
- Função `SECURITY DEFINER` nova: `revoke execute` de `anon` e `authenticated`, `search_path` vazio
  e nomes qualificados (regra do CLAUDE.md).
- **Teste negativo obrigatório:** a conta A não lê, não substitui e não usa a chave da B; e um
  membro sem `administrar` não cadastra nem apaga. Prova versionada em `scripts/`, conferindo o
  **nome exato** da constraint ou da política que barrou.

### 2.2 Como a chamada funciona no modo `propria`

- A rota da conta usa **só a chave dela**. Se falhar, **não cai para a IA da plataforma**: cair
  gastaria o dinheiro da Brennimark num plano que não paga IA. O cliente lê "A conexão de IA da sua
  conta não respondeu. Confira a chave no painel", e o log diz o motivo.
- O administrador escolhe provedor e modelo de uma **lista validada pela Brennimark**. Outros
  modelos entram como "por sua conta e risco", com aviso de que o Vini pode errar mais.
- **Modelo precisa de capacidade mínima:** janela de contexto para o manual inteiro (decisão de
  26/09) e visão para analisar peça. O painel recusa, ou avisa, o modelo que não tem.
- Há um botão **"Testar conexão"** que faz uma chamada mínima, sem enviar conteúdo de marca.
- O orçamento por conta (`ai_budgets`) deixa de ser trava de custo nesse modo, porque o custo não é
  nosso. O razão continua registrando o uso, para o administrador ver.

### 2.3 O que não muda, em nenhum modo

A honestidade editorial é lógica da plataforma, não do modelo: só regra aprovada entra no prompt em
silêncio, rascunho é identificado, a resposta cita fonte, status e caminho. O que o modelo da
agência pode piorar é a **qualidade da redação**, não as regras. O painel diz isso com todas as
letras.

### 2.4 Responsabilidade sobre os dados

No modo `propria`, o conteúdo da marca vai a um provedor que a **agência** escolheu e contratou. A
responsabilidade por esse contrato passa a ser dela, e o administrador **aceita isso por escrito
antes de ligar a conexão** (aceite registrado, com autor e data), no mesmo molde do termo de
hospedagem de fonte. O painel repete o aviso da regra da fase de testes: **chave de plano gratuito
de IA não deve receber manual de cliente real**, porque o provedor pode treinar com o conteúdo.

## 3. Consequências

- Nasce um caminho de código a mais na camada de IA: `resolveFeatureRouting` passa a ler o modo da
  conta. Dois caminhos para sempre, com testes dos dois.
- Nasce uma tabela de chaves por conta (nome sugerido: `chaves_de_ia_da_conta`) e uma coluna de
  modo na conta. Decisão de schema: **espera o OK do André** (ver o estudo).
- As tabelas antigas `ai_settings` e `ai_routing_policies` continuam sem uso e **não são
  religadas**: a guarda de `leak-guard.test.ts` que barra rota gravando nelas continua valendo.
- O plano sem IA custa à Brennimark só hospedagem, armazenamento e banda. O preço dele pode ser
  muito menor, e esse é o objetivo.
- O suporte ganha uma pergunta nova ("o Vini não responde") com uma causa que não é nossa: a chave.

## 4. Reversibilidade

- **Barato:** preço, nomes dos planos, textos do painel, lista de modelos validados.
- **Médio:** o modo por conta e a tabela de chaves. Se der errado, desliga-se o modo `propria` e a
  tabela fica parada, como as antigas.
- **Trava mais:** a **promessa pública** de "traga a sua IA", porque clientes vão contratar por
  causa dela. E a custódia de chave de terceiros, que depois de existir cria obrigação de
  segurança para sempre.

## 5. O que este ADR não decide

Preço dos planos (estudo em andamento), a lista de modelos validados, a acessibilidade nas análises
do Vini (fatia própria, ver o estudo) e o que fazer com quem trocar de plano no meio do ciclo.

## 6. Adendo de 07/11/2026 — decisões do André sobre o desenho

O André respondeu ao desenho no dia seguinte à entrevista. O que fica decidido (a **direção**; o
schema continua esperando o OK explícito dele antes de qualquer migration):

1. **O modo mora no plano.** Mudar de modo é trocar de plano. Quem está no plano sem IA e quer a
   IA da Brennimark contrata o plano com IA; no plano com IA ninguém configura IA. Não existe plano
   híbrido.
2. **Nunca cai na IA da plataforma.** Confirmado o §2.2: se a chave da agência falhar, o Vini não usa
   a nossa. "A gente não vai pagar para ninguém usar IA nunca": ou a agência paga o uso da nossa
   (troca de plano), ou corrige a chave dela.
3. **Três encaixes de IA no painel do administrador:** texto (interpretar o manual), imagem
   (analisar peça) e reserva (assume quando a principal falha). É o mesmo desenho que a plataforma
   já teve.
4. **Aviso e termo sobre IA gratuita.** O painel avisa, antes de aceitar uma chave, que IAs
   gratuitas podem usar o conteúdo para treinar os próprios modelos e que, para confidencialidade,
   é preciso plano pago do provedor. O termo aceito no §2.4 passa a dizer, com todas as letras, que
   usar IA gratuita **encerra a confidencialidade** daqueles dados, por escolha da agência. O termo é
   assinado **ao contratar** o plano sem IA (além do aceite do administrador ao ligar a conexão). A
   Política de Privacidade precisa de uma exceção explícita para esse modo, porque hoje promete que
   o conteúdo vai a provedor pago, sem treinamento.
5. **Interruptor "usa o Vini" por pessoa**, válido para a **conta inteira** (não por marca) e em
   **todos os planos**, não só no sem IA. Motivo (pedido da Happy): muita gente só precisa baixar o
   logotipo — uma gráfica, um assistente — e não precisa de IA. É ortogonal às capacidades
   (`consultar`, `editar`, `aprovar`, `administrar`), não um nível novo delas. A interface só
   decide o que aparece; quem barra é o servidor, com teste negativo (membro sem o interruptor não
   chama a rota do Vini por fora da tela). O padrão para membro novo fica em aberto.
6. **Provedores:** lista fechada pela Brennimark; endereço de API digitado pelo cliente **não
   existe** (seria uma porta de requisição forjada a partir do nosso servidor). A Happy usa pelo
   menos Anthropic, OpenAI e Google; as demais saem da lista de perguntas em
   `docs/plan/perguntas-para-a-happy-ia-propria.md`.
7. **Limite de tokens do administrador** fica para fatia posterior (o razão de IA por conta já
   existe e pode servir).

**Sobre as tabelas:** vale o §3 deste ADR (tabela nova de chaves, `ai_settings` e
`ai_routing_policies` não são religadas). Uma ideia intermediária de reaproveitá-las, endurecendo as
políticas de 29/08 que deixavam qualquer membro ler a chave cifrada, foi **descartada** por esse
motivo: tabela nova nasce com a política certa.

**O piloto da Happy não usa "teto zero" do Vini.** O piloto espera o painel de conexão (fatia de
banco + roteamento + painel); preço e plano `piloto-sem-ia` entram como dado depois, e o preço
segue o estudo de viabilidade de 06/11.
