# Brainstorm — o PDF como o próprio manual

- **Data:** 11/09/2026
- **Status:** ⚠️ **BRAINSTORM. Nada aqui é decisão.** Nada aqui vale como ADR.
- **Participantes:** André e Claude
- **O que fazer com isto:** usar como pauta. Uma ideia só vira decisão quando for para um ADR,
  com as perguntas que a travam respondidas (ver §11).

---

## 1. A ideia de partida

Hoje o PDF do manual entra e é transformado em páginas próprias da plataforma, que aparecem ao
lado do "manual original". O resultado é o mesmo conteúdo em duas versões.

A pergunta do André: **e se o próprio PDF fosse o manual**, com a interatividade colocada sobre
as páginas que já existem?

## 2. O que a interatividade precisa ser (na visão do André)

Pouca coisa. O manual é para ser **lido**.

1. **Índice lateral** que leva à página correspondente do PDF.
2. **Downloads** de logos, ícones, paletas e demais arquivos de trabalho.
3. **Chat** para perguntas sobre a marca.
4. **Avaliação de imagem:** o usuário sobe uma peça e recebe se está correta e, se não estiver,
   onde estão os erros.
5. **Prompts com o DNA da marca** para outras IAs gerarem imagens.

Descartado na conversa: a sobreposição com coordenadas (pontos clicáveis desenhados sobre regiões
da página). Com o escopo acima ela não é necessária, e era a parte mais difícil.

## 3. Como as peças se encaixam (hipótese)

- **O PDF é o que se lê.** Ele vira a tela principal e as páginas recriadas saem da navegação.
- **A extração é o que a IA consulta.** Chat, avaliação e prompts precisam da regra em texto
  (ex.: "cor primária #0033A0"), e o PDF sozinho não entrega isso. A extração continua existindo,
  mas invisível ao leitor.

Relação com o que já existe:

| Peça | Situação em 11/09 |
|---|---|
| Índice → página | Quase pronto: visualizador por intervalos e manifesto por página em produção |
| Downloads | Não existe |
| Chat | Existe |
| Avaliação de imagem | Existe como veredito em texto. Marcar o erro sobre a imagem é o ADR-0004 §3.3 |
| Prompts | ADR-0004 §3.1, que está como *proposto, aguardando aprovação* |

Ganhos percebidos: fidelidade à diagramação original, fim da duplicação e menos peso. As 25
imagens de página do Bradesco somam 33,9 MiB, 8× o PDF (medição de 11/09). Não se sabe ainda
quanto disso explica os 58 s de publicação.

Perdas percebidas: leitura no celular (página A4 em tela pequena) e manuais cujo PDF é só imagem,
sem texto extraível.

## 4. Assets — o que o André expôs

- **Quem fornece é a agência.** Ela assina, acessa o Studio, cria os perfis das marcas, sobe os
  PDFs **e sobe os assets**. A plataforma não fabrica nem converte arquivo de marca, só distribui.
- **O asset pertence à marca**, não a uma página do manual.
- **Os downloads ficam numa página própria da marca**, uma biblioteca com todos os assets.
- **Cada item vem completo:** "Logo principal" com AI, SVG, PNG, positivo, negativo, etc. A
  disponibilização tem que ser completa.
- **Só a agência sobe.** Quem consulta só vê e baixa.
- **Tamanho de arquivo fica para depois.** Hoje Vercel e Supabase estão em plano hobby/free. Na
  operação comercial se contrata o espaço necessário.

## 5. "O manual não tem rascunho" — a tensão mais importante desta conversa

Nas palavras do André: o manual é a bíblia, o oráculo da marca. Ele **nunca** pode mostrar algo
que não é válido. O Brennimark não é uma plataforma criativa, não serve para rascunho. Serve para
disponibilizar e gerenciar o uso da marca e dos seus assets com os colaboradores da agência.

**Isto contradiz o que está construído e decidido hoje:**

- o importador publica tudo como `draft` (ADR-0005 §6);
- o assistente responde sobre rascunho, rotulado como provisório (ADR-0005 §6, decisão do Q1);
- o status `ready | draft | pending` atravessa modelo, contexto de IA e citações (CLAUDE.md).

Uma leitura possível, **não confirmada**, que reconcilia as duas coisas: o rascunho existe, mas
**só dentro do Studio**, como etapa de trabalho da agência antes de publicar. O que chega a quem
consulta é só o aprovado. Seria "o manual não tem rascunho", e não "o sistema não tem rascunho".

Se for isso, muda o ADR-0005 §6: hoje ele diz que esconder o não-revisado entregaria uma conta
vazia no dia seguinte à importação. Seria preciso decidir o que o consultor vê enquanto a agência
ainda não aprovou nada.

### 5.1 Resposta do André (terceira rodada)

**Não existe rascunho no Brennimark.** O rascunho é feito pela agência, fora da plataforma. Quando
ela publica, publica um PDF final, porque sabe que aquilo vai orientar todos os designers e
diretores de arte. O Brennimark é guia e gestão de marca, não plataforma criativa.

**De onde o rascunho tinha vindo.** Ele nasceu no desenho anterior, em que a máquina **remontava**
as páginas. O status `draft` não servia para o rascunho da agência. Servia para marcar a
**interpretação da máquina**, que ainda não tinha sido conferida por ninguém. Com o PDF como manual
(§7), esse motivo desaparece da tela de leitura: o que se lê é o documento final da agência.

**O que sobra: a leitura que a máquina faz do PDF.** O PDF é final, mas o chat, os prompts e a
análise não leem o PDF. Eles leem os fatos que a máquina **extraiu** dele (ex.: "cor primária
#0033A0"). Se o extrator ler um hex errado, o chat afirma um hex errado com a autoridade do manual.
Isso não é rascunho da marca, é erro de leitura, e continua sendo possível.

Caminhos levantados, nenhum escolhido:

- **a.** Conferência no Studio antes de publicar: a agência passa os olhos no que a máquina leu
  (cores, fontes, capítulos). Não é rascunho: é o equivalente a revisar a prova da gráfica.
- **b.** Toda resposta da IA cita a página e deixa abri-la ao lado, para que o usuário confira no
  PDF. O PDF continua sendo a autoridade, e a IA só aponta para ele.
- **c.** Os dois.

Se esta direção virar decisão, o ADR-0005 ("curadoria editorial") precisa ser revisto. A
curadoria deixaria de ser a revisão de páginas remontadas e passaria a ser, no máximo, a
conferência da extração, feita antes da publicação.

Pergunta nova: **18.** Qual dos caminhos a/b/c? A conferência (a) é obrigatória para publicar ou
opcional?

### 5.2 E a página remontada editável pela agência?

O André considerou que também seria bom: a máquina remonta, a agência entra e retoca até a página
ficar à altura do design dela. É o desenho que o ADR-0005 previa.

Pontos levantados contra usá-la como tela principal:

- **Duas fontes de verdade.** Se a agência retoca a página remontada e não o PDF, os dois passam a
  divergir. O oráculo teria duas versões, e ninguém sabe qual vale.
- **Trabalho em dobro.** A agência já diagramou o manual no InDesign. Retocar cada página de novo
  dentro da plataforma repete esse trabalho, e um manual de centenas de páginas torna isso inviável.
- **Escopo.** Um editor de layout bom o bastante para uma agência aceitar é, na prática, um
  InDesign simplificado: produto grande, fora do centro do Brennimark.
- **O ganho principal já tem outra saída.** A razão forte para remontar é o celular, e o modo
  "ler como texto" (§7.4) atende isso sem prometer design.

Não é excludente no tempo: começar pelo PDF e deixar a remontada editável como possibilidade
futura, se clientes pedirem.

Pergunta nova: **19.** Se a remontada editável voltar um dia, quem manda quando ela diverge do
PDF?

## 6. Perguntas em aberto

**Leitura**

1. As páginas recriadas saem de vez ou ficam como visão secundária?
2. O que acontece com manual que é só imagem, sem texto? A IA fica sem base?
3. Leitura no celular é requisito?

**Rascunho**

4. A leitura da §5 está certa: rascunho só no Studio, nunca no manual?
5. O que o consultor vê entre a importação e a primeira aprovação?
6. O chat responde sobre algo ainda não aprovado? Hoje responde, rotulado.
7. A extração do PDF é revisada pela agência antes de alimentar a IA, ou o PDF aprovado já torna
   aprovado tudo que se extrai dele?

**Assets**

8. O vínculo asset ↔ página do manual existe (ex.: botão "baixar logo" na página que fala de logo)
   ou os downloads ficam só na biblioteca?
9. Quando a agência substitui um logo, a versão anterior some, fica em histórico ou fica
   disponível como "descontinuada"?
10. **Fontes.** O CLAUDE.md diz que a plataforma não hospeda fonte licenciada de cliente algum. Se
    a agência sobe a fonte, o que acontece: recusa, só nome + link de licença, ou a regra muda?
11. Paleta: gerar `.ase`/`.css`/`.json` a partir dos hex, ou só o que a agência subir?

**Papéis**

12. Dentro da agência, quem sobe é quem aprova, ou são pessoas diferentes? Hoje `owner` recebe
    `editar` e `aprovar` juntos (ADR-0005 §5).
13. O cliente final da agência (a marca) também consulta? Com que papel?

**Criação**

14. O ADR-0004 (prompts com o DNA da marca) está como proposto. Isto o aprova, ou continua em
    aberto?
15. A avaliação de imagem precisa marcar o erro sobre a imagem já na primeira versão, ou texto
    basta?

---

## 7. Análise: PDF como tela principal ou páginas remontadas?

Resposta às perguntas 1 e 3. **Continua sendo brainstorm**: é uma recomendação a validar, não uma
decisão.

### 7.1 Inclinação da conversa

O PDF como tela principal, com um **modo de leitura em texto** para telas pequenas. A remontada
automática sai do papel principal. A extração continua, porque serve à IA e ao modo texto.

O André chegou à mesma conclusão por experiência própria. Remontar uma página em outro formato
já é difícil para um designer no InDesign. Para a máquina, com diagramação arbitrária, é mais
difícil ainda.

### 7.2 O argumento decisivo: o manual é o oráculo

- A página remontada é uma **interpretação** da máquina. Ela pode errar um hex, agrupar mal duas
  regras ou perder uma nota. No manual de 743 páginas foram 122 seções e nomes como `Páginas 9–16`.
- O PDF é o documento que **a agência aprovou**. Exibi-lo não interpreta nada.

Se o manual nunca pode mostrar algo inválido (§5), exibir a interpretação no lugar do original é
o risco maior.

### 7.3 Por que remontar é mais difícil do que parece

1. Cada manual tem uma diagramação diferente, feita por um estúdio diferente. Não há um layout a
   reproduzir.
2. A plataforma não hospeda fonte licenciada, então a página remontada sai com fonte substituta, o
   que um diretor de arte percebe na hora.
3. Cada erro de reprodução vira trabalho de curadoria sobre a *aparência*, além do conteúdo.

### 7.4 Telas

Exemplo: manual em 16:9 (1920×1080).

| Tela | Como fica |
|---|---|
| Computador | Perfeito |
| Tablet | Bom em qualquer orientação |
| Celular deitado | Bom: 16:9 cabe inteiro |
| Celular em pé | Ruim: ~390 × 220 px, texto pequeno demais |

Saídas para o celular em pé, que se somam:

- zoom com pinça e girar a tela (o PDF.js desenha em vetor, então o zoom fica nítido);
- botão **"ler como texto"**: a mesma seção em texto corrido, gerado da extração. Não imita o
  design, é um modo de leitura, como o modo leitor do Safari.

Requisito do André: o produto é feito para o computador, mas **não pode falhar** em celular nem
tablet.

### 7.5 Custos

- A reconstrução de páginas perde o papel principal. É custo afundado e não deve decidir a direção.
- Atualizar o manual é subir um PDF novo. Para a agência não é custo, porque ela já exporta do
  InDesign.
- O link direto aponta para a página, não para a regra.
- Manual de centenas de páginas no celular: o consumo de memória no aparelho precisa ser medido.

### 7.6 Reversibilidade

Barata. É decisão de frontend, e a extração continua sendo feita. Se o PDF-principal decepcionar,
a remontada volta a ser principal sem perda de dado.

### 7.7 Como validar

Abrir o manual do Bradesco, que já está em produção, num celular e num tablet reais e ler três
regras em cada um.

- Se o celular em pé ficar insuportável mesmo com zoom, o modo texto vira prioridade.
- Se ficar aceitável, o caminho está validado.

## 8. Refinamentos da segunda rodada

### 8.1 A navegação pode vir do próprio PDF

O PDF exportado do InDesign costuma trazer **marcadores** (bookmarks), o índice embutido que o
estúdio montou. Quando existe, ele é o índice da agência, e não uma dedução da máquina. Isso é mais
fiel e mais barato que a heurística tipográfica atual, que só entraria quando o PDF não tiver
marcadores.

Pergunta nova: **16.** Quando o PDF tem marcadores, eles viram o índice sem revisão, ou passam
pela curadoria mesmo assim?

### 8.2 A análise de imagem é conferência, não crítica

Nas palavras do André: não é julgamento de curadoria artística, é julgamento de grid. Verificar se
o logo está na posição e nas versões permitidas, se as cores estão certas, se o tamanho das fontes
confere.

Isso muda a natureza técnica do problema, porque cada verificação tem uma dificuldade diferente:

| Verificação | Dificuldade provável |
|---|---|
| Cores da peça estão na paleta | Baixa: é conta sobre os pixels, determinística, sem IA |
| Logo presente e em versão permitida | Média: exige localizar o logo na imagem |
| Logo na posição / área de respiro certas | Média a alta: exige localizar **e** medir |
| Tamanho de fonte de acordo | Alta: exige reconhecer texto e estimar a escala real da peça |

Hipótese a validar: começar pelas cores, que dispensam modelo e não erram, dá uma primeira versão
confiável da análise. As outras entram por ordem de dificuldade, como o ADR-0004 §3.3 já previa
("algumas classes de violação, não todas").

Pergunta nova: **17.** Para medir posição e tamanho, a análise precisa saber o formato da peça
(post, cartaz, banner). O usuário informa ao subir, ou a análise deduz?

## 9. Quarta rodada — o manual que a agência não fez

### 9.1 O cenário que o André trouxe

Muitas vezes a agência **não criou a marca nem o manual**. Ela recebe o PDF pronto do cliente e só
precisa fazer propaganda de acordo com ele. Exigir que ela prepare um PDF interativo no InDesign
seria obrigá-la a quase refazer um manual que não é dela.

Requisito que sai daqui: **qualquer PDF tem que servir, do jeito que chega**, com o mínimo de
trabalho da agência.

### 9.2 Leitura: isso favorece o PDF como manual, não a remontada

- **PDF como manual:** qualquer PDF funciona sem retoque. Se ele veio interativo do InDesign (links
  internos e marcadores), o visualizador aproveita. Se não veio, a máquina propõe o índice. Nos dois
  casos a agência não diagrama nada.
- **Remontada editável:** o "rascunho para aperfeiçoar" é justamente trabalho de diagramação dentro
  da plataforma, que é o que se quer poupar.

O trabalho que sobra no caminho do PDF é pequeno e não é de design: conferir o índice, subir os
assets e conferir o que a máquina leu (§5.1).

### 9.3 Implantação assistida como serviço

Ideia do André: "mandem os manuais que a gente sobe e deixa tudo pronto". Por exemplo, uma
assinatura de cinco marcas incluiria a implantação das cinco.

O ADR-0005 §1 já previa isso ("uma consultoria pode executá-la para um cliente"). No caminho do
PDF, o serviço é viável porque o trabalho é pequeno e repetível. No caminho da remontada, seria
diagramar centenas de páginas por cliente.

### 9.4 A agência editando um manual que não é dela

Se o manual pertence à marca cliente, a agência alterar regras dentro da plataforma é mexer na
bíblia de outra empresa. O que parece razoável ela editar:

- índice e nomes de capítulos;
- assets;
- **subir uma versão nova do PDF** quando a marca atualizar o manual.

O conteúdo das regras muda quando **a marca** muda o PDF.

Perguntas novas:

- **20.** A agência pode acrescentar orientações próprias (ex.: "neste cliente, usar sempre a versão
  negativa em redes sociais")? Se sim, precisam aparecer separadas e identificadas como da agência,
  e não como regra da marca.
- **21.** Quando entra uma versão nova do PDF, a anterior fica acessível como histórico?
- **22.** A implantação assistida entra no preço da assinatura ou é serviço cobrado à parte?

## 10. Quinta rodada — o painel para editar a interatividade

### 10.1 O que o André expôs

- PDF interativo (InDesign): a interatividade que ele traz já funciona.
- PDF cru: a máquina **propõe** a interatividade.
- Em qualquer dos casos, **precisa haver um painel para editar e corrigir** o que veio ou o que a
  máquina propôs.
- Esse painel serve **à agência e à equipe do Brennimark** (implantação assistida, suporte).

### 10.2 O que "interatividade" é, concretamente

Pelo escopo da §2, ela se resume a dados de navegação e de vínculo, **nunca ao conteúdo do PDF**:

1. **Índice:** a árvore de capítulos e subcapítulos, com título e página de destino.
2. **Vínculos página ↔ asset:** "na página 12, oferecer o Logo principal".
3. **Página de entrada** do manual.

O painel edita esses três. O PDF em si nunca é alterado, e por isso não há risco de duas fontes de
verdade (§5.2): o que a agência corrige é o mapa, e o território continua sendo o PDF.

Parte disso já existe na prévia da importação (`ListaDeSecoes`): renomear, unir, dividir e
reordenar, com validação que impede perder página. O ADR-0005 §3 registrava que falta o mesmo poder
depois de publicar.

### 10.3 A equipe do Brennimark entrando na conta de um cliente

Isto é uma questão de **autorização**, não de interface. Hoje cada conta só enxerga os próprios
dados, garantido pelo banco (RLS), e ninguém de fora entra.

Para a equipe do Brennimark editar a conta de uma agência, seria preciso decidir:

- **23.** A equipe entra como um membro convidado pela própria agência (a agência dá e tira o
  acesso), ou existe um papel de "operador da plataforma" com acesso a todas as contas?
- **24.** Cada alteração feita pela equipe fica registrada com autor e data, visível para a
  agência? (Relaciona-se com a trilha de auditoria do ADR-0004 §3.5.)

A primeira opção da 23 é mais simples e mais segura: não cria nenhuma porta que abra todas as
contas. A segunda é mais cômoda para a operação e é a que exige mais cuidado.

### 10.4 Versão nova do PDF

- **25.** Quando a marca publica uma versão nova do manual, o índice editado à mão se perde, é
  reaproveitado onde as páginas baterem, ou precisa ser refeito?

## 11. Quais perguntas bloqueiam o quê

As 25 perguntas agrupadas pelo passo que cada uma trava. Uma pergunta **bloqueia** um passo quando
construir sem respondê-la é escolher por omissão algo difícil de desfazer.

### Passo 1 — o PDF vira a tela principal

O que é: o leitor abre o PDF original, com o índice ao lado. As páginas remontadas saem da
navegação, e a extração continua existindo por trás, para a IA. É só frontend e é reversível: os
dados continuam os mesmos.

| # | Pergunta | Situação |
|---|---|---|
| 1 | As remontadas saem de vez ou ficam como visão secundária? | **Bloqueia.** Inclinação da conversa: saem da navegação e a extração fica. Falta o André confirmar. |
| 3 | Celular é requisito? | **Respondida:** não pode falhar em nenhum formato. Falta decidir se o passo 1 sai só com zoom e o modo texto vem depois da medição (§7.7). |
| 16 | Marcadores do PDF viram índice sem revisão? | Não bloqueia. Padrão reversível: usar os marcadores quando existirem e as seções atuais quando não. |

### Passo 2 — biblioteca de assets da marca

É **modelo de dados**: tabela nova, migration, RLS e teste negativo. Precisa das respostas antes
de começar.

| # | Pergunta |
|---|---|
| 8 | Vínculo asset ↔ página, ou só a biblioteca? (A §10 inclina para o vínculo.) |
| 9 | Logo substituído: some, vira histórico ou fica como "descontinuado"? |
| 10 | Fontes: recusa, só nome + link de licença, ou a regra do CLAUDE.md muda? |
| 11 | Paleta gerada a partir dos hex, ou só o que a agência subir? |
| 12 | Quem sobe é quem aprova? *Parcial: sobe a agência, e quem consulta só vê e baixa.* |

### Passo 3 — a IA e a conferência da leitura (revisão do ADR-0005)

| # | Pergunta |
|---|---|
| 4 | *Respondida (§5.1): não há rascunho no manual.* |
| 5 | O que o consultor vê entre a importação e a publicação? |
| 6 | O chat responde sobre o que ainda não foi conferido? |
| 7 | A extração é conferida antes de alimentar a IA? |
| 18 | Caminho a, b ou c da §5.1 |
| 2 | Manual só em imagem: a IA fica sem base? |

### Passo 4 — o painel de edição da interatividade

| # | Pergunta |
|---|---|
| 25 | Versão nova do PDF: o índice editado se perde, é reaproveitado ou é refeito? |
| 21 | A versão anterior do PDF fica acessível? |
| 23 | Equipe do Brennimark: membro convidado ou operador com acesso a todas as contas? |
| 24 | Alterações da equipe registradas e visíveis para a agência? |

### Podem esperar

| # | Pergunta | Por que espera |
|---|---|---|
| 13 | Papel do cliente final da agência | Não muda os passos 1 a 4 |
| 14 | Aprovar o ADR-0004 (prompts) | Frente própria, depende do passo 3 |
| 15, 17 | Análise marcando sobre a imagem; formato da peça | Idem |
| 19 | Remontada editável no futuro | Só se ela voltar |
| 20 | Orientações próprias da agência | Acrescenta, não altera o que vem antes |
| 22 | Implantação assistida: preço | Comercial. Mas se a equipe do Brennimark for quem implanta, a 23 sobe de prioridade |

## 12. Respostas do André — 12/09/2026

Respostas às perguntas 1 a 15. Ainda **brainstorm**: vira decisão quando for para um ADR.

### Leitura

- **1.** As páginas remontadas **ficam como opção futura**. Ou seja, saem da navegação agora.
- **2.** Manual só em imagem pode existir, mas é **raro**. Não vale tratar como caso principal.
- **3.** Celular **não é requisito principal**. Zoom resolve. O modo "ler como texto" sai da frente
  de largada e fica como possibilidade.

### O que era "rascunho" virou etapa de revisão

- **4.** Sem as páginas remontadas, o rascunho passa a ser só a **revisão humana antes da
  publicação**, com edição para correção.
- **5.** Entre a importação e a publicação existem **telas de edição para revisão e correção**.
  Quem consulta não vê nada nesse período.
- **6.** O chat **não responde sobre o que não foi aprovado**. O manual existe para mostrar o que é
  aprovado.
- **7.** Tudo o que se extrai do PDF **é aprovado**, porque o PDF é aprovado. A agência revisa para
  **detectar erros de extração**, não para aprovar conteúdo.

**Consequência:** o estado editorial deixa de ser uma propriedade de cada regra e passa a ser uma
etapa do documento. Na prática, dois estados: **em revisão** (só no Studio) e **publicado** (vale
para todos). Não existe conteúdo publicado não aprovado.

**Isto contraria o que está escrito hoje** e precisa de ADR para mudar:

- ADR-0005 §6: "o assistente continua respondendo sobre rascunho, rotulado como provisório" e
  "esconder o não-revisado faria o produto entregar uma conta vazia no dia seguinte à importação";
- CLAUDE.md: o status `ready | draft | pending` atravessando modelo, contexto de IA e citações;
- o importador, que hoje publica tudo como `draft`.

Ponto a resolver junto: com a revisão obrigatória antes de publicar, o manual de 743 páginas fica
invisível até a agência terminar de revisar. Quanto trabalho isso é, e a revisão pode ser por
capítulo, liberando o que já passou?

### Assets

- **8.** O vínculo existe, mas como **atalho**: a página que apresenta o logo traz um botão que leva
  à biblioteca, e a biblioteca tem página própria.
- **9.** A versão anterior fica **descontinuada**, visível e identificada como tal.
- **10.** Fontes: "a licença é responsabilidade da agência". ⚠️ **Ver §12.1 — esta é a única
  resposta que ainda não está fechada.**
- **11.** **As duas:** gerar `.ase`/`.css`/`.json` a partir dos hex e aceitar o que a agência subir.

### Papéis

- **12.** Sobe e aprova **quem tiver permissão, e a permissão é dada pela agência**. Logo, o modelo
  precisa de permissões por membro, e não dos papéis fixos `owner`/`member` de hoje.
- **13.** "Agência" = **quem compra a assinatura** e administra o Brennimark. Pode ser um designer
  autônomo, um estúdio, uma agência de propaganda ou endomarketing, ou o próprio departamento de
  marketing da empresa dona da marca.

  Isso afeta o vocabulário do ADR-0002: o papel é **assinante administrador**, e "agência" é só um
  dos perfis possíveis.

### Criação

- **14.** O copiloto de prompts (ADR-0004) é **parte do projeto e necessário**. Falta o ato formal:
  mudar o status do ADR-0004 de *proposto* para *aceito*, que é commit próprio, não nota de
  brainstorm.
- **15.** A avaliação de imagem em **texto basta** na primeira versão. Marcar o erro sobre a imagem
  (ADR-0004 §3.3) fica para depois.

### 12.1 Fontes — a única resposta que não fecha

A resposta foi que a licença é responsabilidade da agência. O problema não é de quem é a
responsabilidade contratual, é que **a plataforma passaria a distribuir o arquivo**:

- o CLAUDE.md do projeto diz, como fronteira que não se cruza, que a plataforma **não hospeda fonte
  licenciada de cliente algum**;
- a maioria das licenças de foundry restringe redistribuição. Quem armazena e serve o arquivo para
  terceiros é a plataforma, e é ela que a foundry encontra primeiro;
- o dano não é só jurídico. Uma notificação de foundry para uma agência cliente, por causa de um
  arquivo servido pelo Brennimark, queima a confiança que o produto vende.

Opções, nenhuma escolhida:

- **a.** Manter a fronteira: o item "fonte" guarda nome, foundry e link de licença, sem arquivo.
- **b.** Hospedar o arquivo, com o contrato de assinatura declarando que a agência garante ter
  direito de distribuir aos seus colaboradores. Isso é decisão jurídica, não técnica, e muda uma
  regra escrita do projeto.
- **c.** Hospedar só fontes livres (Google Fonts e afins), detectadas na subida, e tratar as
  licenciadas como no item a.

Pergunta nova: **26.** Qual das três? Se for **b**, o CLAUDE.md precisa ser corrigido no mesmo
commit, porque hoje ele afirma o contrário.

### 12.2 Fontes — resposta do André (12/09/2026)

Escolhida a opção **b**: a plataforma **hospeda o arquivo de fonte**, e o contrato de assinatura
declara que o assinante garante ter direito de distribuir aos seus colaboradores.

O que isso **obriga**, e que não existe hoje:

1. **Cláusula no contrato de assinatura.** É ela que transfere a responsabilidade. Sem o texto
   assinado, a responsabilidade continua com quem serve o arquivo.
2. **Aceite registrado.** Quem sobe a fonte precisa declarar que tem o direito, e o registro fica
   com autor e data.
3. **Corrigir o CLAUDE.md.** Ele afirma hoje que a plataforma não hospeda fonte licenciada de
   cliente algum. **A correção só entra quando isto virar ADR**, não agora: enquanto é brainstorm,
   a regra escrita continua valendo. Fica como dívida registrada.
4. **Procedimento de retirada.** Se uma foundry notificar, é preciso saber remover o arquivo e
   avisar o assinante.

Registro da ressalva, para não se perder: a responsabilidade contratual pode ser do assinante, mas
quem **armazena e serve** é a plataforma, e é ela que a foundry encontra primeiro. A escolha foi
feita com essa ressalva na mesa.
