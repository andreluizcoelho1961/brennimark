# Estudo: plano sem IA, preços e acessibilidade (06/11/2026)

Origem: entrevista com a Happy House (Maca, diretor de criação), primeira agência consultada. Este
documento junta o que foi dito, o que isso muda e o que falta decidir. O ADR correspondente é o
rascunho `../adr/0009-a-ia-depende-do-plano.md`. **Nada aqui foi construído.**

## 1. O que a agência disse (n = 1)

- Paga várias IAs hoje e não aceita embutir outra no preço. R$ 1.000 e R$ 500 por mês: inviáveis.
- Aceitaria cerca de **R$ 150 por mês, pelo pacote de marcas** (não por marca), numa fase beta,
  desde que a IA seja a dela.
- Quer **configurar os próprios motores de IA** no painel de administração; tem TI para isso.
- Valor visto: o **ecossistema de marca**. O Vini vale menos; a revisão de peça foi o que mais pesou.
- Pediu que o Vini, ao analisar uma peça, **avise sobre acessibilidade**: combinações de cor que
  impeçam a leitura por pessoas com daltonismo ou baixa visão.
- Exigências de TI e compras: dados no Brasil, contrato e LGPD, nota fiscal, teste piloto antes,
  relatório de auditoria. Formato aceito: **piloto pago**.

Cuidado de método: é uma agência. A direção do André é seguir assim e validar nas próximas
entrevistas (acrescentar a pergunta "e se a IA fosse por sua conta, o preço cairia para quanto?").

## 2. Os dois planos

| | Com IA | Sem IA |
|---|---|---|
| Quem fornece o motor | Brennimark | a agência |
| Custo variável para nós | alto (a IA) | quase só hospedagem |
| Preço-alvo | revisar para baixo (ver §4) | ideia do André: algo como R$ 10 por marca; beta de R$ 150 pelo pacote |
| Vini | incluso | liga quando o administrador conecta a IA |
| Fonts, Kit, Cores, Grids, links de entrega | inclusos | inclusos |

O plano sem IA é o mais barato de servir e o que cabe no orçamento de uma agência que já paga
várias IAs. Também protege a Brennimark de um risco do ADR-0008: o custo de IA crescer com o uso
sem o preço acompanhar.

## 3. Como a chave fica guardada (resumo; detalhe no rascunho do ADR)

Cifrada no servidor, oculta o tempo todo no painel (só "termina em ••••1234"), nunca devolvida. Para
mudar, cria-se uma chave nova no provedor e substitui-se. Só quem administra a conta mexe, com
registro de quem fez e quando. Decifra só na hora de chamar o provedor. Com falha de chave, o Vini
avisa e **não** cai para a IA da plataforma.

Reaproveita `src/lib/ai/crypto.ts` (AES-256-GCM) e a chave-mestra que já está na Vercel. **Não
religa** as tabelas antigas `ai_settings` e `ai_routing_policies`.

### Decisões que esperam o André (schema e provedor)

1. **Tabela nova ou reaproveitar `ai_settings`?** Recomendação: **nova**
   (`chaves_de_ia_da_conta`). As antigas têm semântica da era anterior, a guarda do `leak-guard`
   as protege, e um desenho limpo facilita a prova de isolamento.
2. **Falhou a chave da agência, cair na IA da plataforma?** Recomendação: **não**, porque gastaria
   o dinheiro da Brennimark num plano que não paga IA.
3. **Quais provedores e modelos entram na lista validada?** Hoje o catálogo conhece Groq,
   Anthropic, OpenAI, Google, OpenRouter e Ollama Cloud. Sugestão para a primeira versão: Anthropic,
   OpenAI e Google (os que a Happy citou ou que as agências costumam ter), com teste de visão e de
   contexto. Os demais como "por sua conta".
4. **Quem troca de plano no meio do ciclo?** Com IA → sem IA: o Vini desliga até haver chave.
   Sem IA → com IA: o modo volta a `plataforma`; a chave fica guardada ou é apagada? Recomendação:
   **apagada**, para não manter custódia sem necessidade.
5. **O aceite de responsabilidade sobre os dados** (ADR §2.4) entra antes de ligar a conexão?
   Recomendação: **sim**, no molde do termo de fonte.

## 4. Preços: o que falta para decidir

A tabela de 30/10 (Faísca R$ 247, Chama R$ 490, Forja R$ 890, Fornalha R$ 1.490, Vulcão sob
consulta) tinha o Vini incluso e o teto de IA em cerca de 33% do preço. A Happy mostra que, para
agência, esse patamar é alto. O que medir antes de mexer nos números:

- **Custo real por marca sem IA:** armazenamento (manual de até 100 MiB mais materiais), banda de
  download e o plano do Supabase necessário. É a conta que diz se R$ 10 por marca fecha ou dá
  prejuízo. Hoje o teto da instalação é 50 MB por arquivo (Supabase Free).
- **Custo real de IA por conta no plano com IA:** o razão de IA tem os tokens, mas a fase de testes
  usa chaves gratuitas, então o custo em dólar de hoje é zero. Vale estimar com os preços das
  opções pagas já pesquisadas (Gemini 3.6 Flash, gpt-5-mini, Claude Sonnet 5).
- **Mais entrevistas:** o roteiro de `precificacao-roteiro-e-numeros-rascunho.md` continua válido.
  Acrescentar a pergunta do plano sem IA.
- **Regra do pacote:** o beta de R$ 150 é "pelo pacote". É preciso definir quantas marcas cabem no
  pacote, e o que acontece quando passa.

**Nada de preço novo vai ao site ou ao Stripe antes de o André decidir.** Os números desta seção
são perguntas, não proposta.

## 5. Acessibilidade nas análises do Vini (prioridade alta, por fatias)

A agência pediu aviso de cores ilegíveis, daltonismo incluído. Boa parte disso **é conta, não IA**,
e isso funciona nos dois planos:

- **Contraste (WCAG):** razão de luminância entre texto e fundo. Mínimo 4,5:1 para texto comum e
  3:1 para texto grande. O manual do próprio Brennimark já cita o 4,5:1, e a ferramenta Cores já
  mede contraste.
- **Simulação de daltonismo:** protanopia, deuteranopia e tritanopia por matriz de transformação de
  cor (Machado e outros, 2009). Mostra como a peça é vista e marca pares que se confundem.
- **Informação só por cor:** peça em que o status só se distingue pelo verde e vermelho.

O que **não** é só conta: achar, numa peça, qual texto está sobre qual fundo. A medição por pixels
que já existe na análise (a cor) cobre parte; o resto pode pedir visão do modelo.

### Fatias sugeridas, em ordem

1. **A paleta da marca:** tabela de contraste de todos os pares da paleta do manual, com
   aprovado/reprovado por tamanho de texto. Tudo calculável, sem IA, e aparece no manual e no Vini
   ("esta cor sobre aquela não passa em 4,5:1").
2. **A peça analisada:** o Vini mede o contraste dos pares de cor da peça (regiões amostradas) e
   diz quais não passam. Cita a regra e o valor medido, sem afirmar o que não mediu.
3. **Daltonismo:** simulação visual da peça nos três tipos e aviso de pares confundíveis.
4. **Orientação:** sugestão de ajuste usando só cores **aprovadas** da paleta (nunca inventar cor
   fora do manual).

Cada fatia segue a honestidade do produto: o Vini cita número, regra e fonte, e diz "não medi"
quando não mediu.

## 6. Ordem de construção sugerida

1. ADR-0009 e correção do CLAUDE.md (só texto).
2. Acessibilidade, fatia 1 (não depende de IA nem de schema; entrega valor para os dois planos).
3. Banco: modo da conta e tabela de chaves, com testes negativos e prova versionada.
4. Painel do administrador: cadastrar, testar, substituir, apagar; aceite; lista de modelos.
5. Rota de IA no modo `propria` e mensagens do Vini.
6. Planos e Stripe, e o site, depois da decisão de preços.
7. Acessibilidade, fatias 2 a 4.

As etapas 3 e 6 mexem em schema e em cobrança, então esperam o OK explícito do André.

## 7. Registro

| Data | Registro |
|---|---|
| 06/11/2026 | Primeira entrevista (Happy House). André decide: dois planos (com IA e sem IA), chave oculta e cifrada na conta do administrador, troca em vez de revelar, ADR a ser alterado, acessibilidade prioritária. Preços a revisar. |
