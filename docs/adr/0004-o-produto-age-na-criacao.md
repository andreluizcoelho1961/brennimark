# ADR-0004 — O produto age na criação, não só na consulta

- **Status:** proposto, aguardando aprovação
- **Data:** 28/08/2026
- **Origem:** `documentacao_brennimark.md`, filtrado — ver §6
- **Relaciona-se com:** ADR-0002 (modos e capacidades), ADR-0003 (produto hospedado)

---

## 1. A mudança de postura

Tudo o que existe hoje é **defensivo**: consultar a regra, validar a peça depois de pronta. O chat
responde, a análise julga, o histórico registra. Todos agem *depois* que o trabalho aconteceu.

Falta o momento em que o trabalho acontece.

> **Decisão:** o produto passa a agir também durante a criação, não apenas antes e depois dela.

## 2. Por que isso importa mais do que parece

Uma ferramenta que fiscaliza é uma ferramenta que o designer tolera. Uma que faz o trabalho render
é uma que ele não larga.

O público-alvo — designers e diretores de arte — hoje usa IA generativa diariamente. Escrever um
prompt que respeite a marca é trabalho manual, repetitivo e fácil de errar: o hex certo, a
proporção certa, o estilo fotográfico permitido, o tom de voz. Ninguém abre o PDF de 200 páginas
para conferir antes de cada prompt.

É o problema mais próximo do dia a dia que o produto pode resolver, e o mais curto até alguém
dizer *não trabalho mais sem isso*.

## 3. O que entra no escopo

### 3.1 Copiloto de criação

Compõe prompts alinhados à marca a partir do que já está documentado:

- **Imagem e vídeo:** injeta hex exatos, restrições visuais e estilos fotográficos permitidos nos
  prompts de motores generativos.
- **Texto:** injeta o tom de voz documentado nos pedidos a modelos de linguagem.

**Não exige infraestrutura nova.** Os dados já existem em blocos: `swatches` traz hex, `gallery` e
prosa trazem direção fotográfica, páginas de voz trazem o tom. A composição é montagem de texto
sobre o que `flattenBlocksToFacts` já produz.

### 3.2 A honestidade editorial se estende ao copiloto

Consequência que vale fixar como regra, porque é fácil errar:

> **Só regra aprovada entra num prompt em silêncio.** Uma regra em rascunho não pode moldar o
> resultado sem a pessoa saber.

Se o copiloto injetasse um rascunho como se fosse regra estabelecida, o designer produziria peças
a partir de algo que a marca ainda não decidiu — e descobriria tarde. Rascunho pode ser oferecido,
mas identificado, e por escolha.

É o mesmo princípio que já governa o chat e a análise, aplicado ao caso em que o custo do erro é
maior: aqui não é uma resposta errada, é trabalho refeito.

### 3.3 Auditoria visual com marcação sobre a peça

A análise hoje devolve veredito em texto. Marcar a violação **sobre a imagem** — apontando onde o
logo está distorcido, onde o contraste falha — é diferença grande de utilidade.

Registrado como alvo, com a dificuldade declarada: exige que o modelo devolva coordenadas, o que é
substancialmente mais difícil e menos confiável que julgamento textual. Entra depois do copiloto, e
provavelmente com escopo reduzido — algumas classes de violação, não todas.

### 3.4 Medição por consumo

Auditoria visual e prompt construído são operações que custam dinheiro por uso. Qualquer modelo
comercial baseado em cota depende de medir **por marca e por operação**.

Isso não decide preço — decide que o WP2 precisa instrumentar consumo desde a primeira operação,
não depois. Sem isso não há cota, não há margem por marca e não há conversa com investidor.

### 3.5 Trilha de auditoria de ações

Registro de quem enviou o quê, quais prompts foram gerados e quais violações dispararam. É
exigência de área jurídica de marca grande, e é o que dá rastreabilidade sobre vazamento de
campanha antes do lançamento.

O padrão já existe no repositório: `brand_document_versions` é append-only, escrito por trigger
`SECURITY DEFINER`, sem `update` nem `delete`. A trilha de ações segue o mesmo desenho.

### 3.6 Modo consulta não é só leitura

Precisão útil ao ADR-0002: quem consulta também **usa** — gera prompt e envia peça para auditoria.
O que ele não faz é alterar a regra.

Isso muda o desenho da capacidade `consultar`: ela inclui as ferramentas de consumo, não apenas a
leitura do manual.

### 3.7 Dispositivo por modo

- **Edição** é trabalho de mesa: desktop e tablet.
- **Consulta** é trabalho de campo: mobile em primeiro lugar, porque a pergunta e o envio de peça
  acontecem longe do computador.

Orienta a ordem do trabalho responsivo da V2: o mobile serve o modo consulta, e é por isso que ele
importa mesmo antes de a edição existir no celular.

## 4. A moldura de museu

O documento de origem chegou, por caminho independente, à mesma conclusão do estudo da interface:
paleta acromática, sem cor de destaque, estados por opacidade e filete, para não brigar com as
marcas expostas dentro do painel.

Adotado como o nome da diretriz: **moldura de museu**. Já está implementado.

## 5. O que fica de fora, e por quê

| Ideia | Motivo |
| --- | --- |
| "Garantia matemática de que nenhuma linha violará quem você é" | **Rejeitado.** Não é entregável e contradiz o princípio que nos diferencia. Um diretor de arte perdoa "não há diretriz documentada"; não perdoa afirmação errada diante do cliente dele. A promessa honesta — *toda resposta vem com a fonte e o estado dela* — é mais forte, inclusive comercialmente. |
| "Single-Tenant Context via RAG" | **Reformulado.** Descreve mecanismo que não é o nosso: não há vetores, e o ADR-0003 escolheu banco compartilhado. A promessa sustentável é: o dado da marca A nunca alcança a marca B, e nada é enviado para treino. A segunda parte depende da política do provedor, não da nossa arquitetura — prometer só o que controlamos. |
| Retenção zero absoluta da mídia auditada | **Reformulado.** Conflita com o que existe: `analysis_runs` guarda a evidência, e feedback, calibração e reanálise dependem dela. Vira **retenção configurável**, com "descartar após o relatório" disponível para quem exigir — sabendo que perde calibração. |
| Whitelabel parcial da agência | **Adiado.** Comercialmente esperto, mas colide com a identidade própria do produto e está fora de escopo da V2. Se voltar, a forma defensável é logo da agência como contexto ao lado do produto, nunca no lugar dele. |
| "Modo Estúdio" para o modo de edição | **Rejeitado.** Terceira colisão do termo. `Studio` permanece com o sentido do ADR-0001: a carteira da agência. |
| Geometria específica do monograma | **Fora do meu alcance.** É decisão de design sua. Registro só a exigência técnica: precisa sobreviver a 32 px, contraforma vazada de verdade — o mesmo teste que reprovou o monograma da Guitar Garage. |

## 6. Consequências

**Positivas:** o produto deixa de ser só defensivo; o copiloto usa dados que já existem; a
honestidade editorial ganha um caso novo onde ela vale ainda mais; e a medição por consumo entra na
arquitetura antes de virar dívida.

**Negativas, assumidas:** mais superfície para manter; a auditoria com marcação é ambiciosa e pode
não se sustentar tecnicamente; e a trilha de ações adiciona escrita a cada operação, com custo de
armazenamento a acompanhar.

**Não muda:** ADR-0002 e 0003 continuam válidos. Este ADR amplia o que o produto faz, não como ele
é hospedado nem quem pode o quê.

## 7. Ordem sugerida

O copiloto depois da migração 1 — ele precisa de blocos vindos do banco para servir mais de uma
marca. Medição junto com o copiloto, porque medir depois é sempre mais caro. Trilha de ações e
auditoria com marcação depois disso.

## 8. Fora desta decisão

Preço, cotas, empacotamento e whitelabel. Continuam sendo decisões humanas do briefing §24.
