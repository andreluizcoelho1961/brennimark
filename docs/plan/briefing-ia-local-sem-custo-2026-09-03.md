# Briefing — demonstração web com Qwen de baixo custo

## Decisão

O Brennimark deve funcionar pela web para apresentação e teste em agências. Nesta fase, a IA será fornecida por uma API multimodal Qwen de baixo custo, com pagamento pré-pago e limite rígido de uso.

O Mac local continua como laboratório para benchmark e demonstração assistida, mas não é a infraestrutura normal de venda.

```text
Computador da agência → Brennimark/Vercel → API Qwen → resposta fundamentada
Mac local            → benchmark, teste e comparação de modelos
```

O usuário vê um único Assistente da Marca. Provedor, modelo, orçamento e roteamento são responsabilidade do Studio.

## Limite importante

“Modelo aberto” não torna a inferência hospedada gratuita: o provedor cobra computação por uso. A escolha de Qwen via API evita custo fixo de GPU própria, operação de servidor, download de pesos e indisponibilidade do Mac.

Vercel e Supabase continuam responsáveis pelo produto: interface, autenticação, dados, RLS, recuperação e auditoria. A Vercel não hospeda pesos do modelo nem chama `localhost` do Mac.

Não usar:

- modelo local exposto por túnel como solução normal de venda;
- endpoint arbitrário fornecido por formulário;
- fallback automático para OpenAI, Groq, OpenRouter ou modelo mais caro;
- cartão com recarga automática;
- seletores de modelo para usuário final.

Sem perfil de IA ativo ou sem orçamento, a interface deve mostrar somente:

> A IA desta conta ainda não está configurada ou não possui saldo de demonstração disponível. Peça a quem administra a conta para verificar as configurações.

Nunca expor chave, nome de variável, `.env.local`, endpoint, payload, arquivo ou erro cru de provedor.

## Escopo do piloto web

Usar um único modelo Qwen multimodal por vez para:

- perguntas fundamentadas no manual;
- geração de prompts com contexto da marca;
- análise de imagem com fontes recuperadas;
- respostas com documento, status editorial e faixa de páginas;
- medição de latência, qualidade e custo por marca.

A marca GE é o cenário obrigatório: 122 documentos, conteúdo ainda em rascunho e manual de origem de 743 páginas.

O modelo exato só será ativado depois de apresentar:

- versão e capacidades de texto/visão;
- preços de entrada, saída e imagem;
- região e política de retenção declarada pelo provedor;
- custo aproximado de chat, prompt e análise no benchmark GE;
- motivo para ser o perfil inicial.

## Contrato independente de fornecedor

Preservar uma fronteira interna entre produto e provedor. Rotas e componentes não conhecem formato específico de Alibaba, Qwen, OpenAI, Anthropic ou Ollama.

```ts
type AIModelCapabilities = {
  text: boolean;
  vision: boolean;
  streaming: boolean;
  structuredOutput: boolean;
  maxContextTokens?: number;
  maxImageBytes?: number;
};

type AIExecutionRequest = {
  brandId: string;
  task: "assist" | "analyse-image" | "prompt";
  question: string;
  sources: RetrievedSource[];
  image?: ValidatedImage;
  limits: AILimits;
};
```

Ajustar os nomes aos tipos existentes. O catálogo deve validar modelo e capacidades no servidor. Uma imagem não pode chegar a modelo sem `vision`; a recusa acontece antes da chamada e sem cobrança.

Não reescrever nem enfraquecer:

- recuperação lexical por `brand_id`;
- limite de fontes e contexto;
- citações com documento, status e páginas;
- bloqueio quando não há evidência;
- RLS e regras de owner/member;
- cifra de credenciais;
- mensagens seguras de erro;
- utilidades contratadas por marca.

O manual inteiro nunca é fallback de contexto.

## Perfil de demonstração Qwen

Criar um perfil explícito de demonstração no workspace, configurado apenas por owner.

Regras:

1. Conexão e chave são server-only, cifradas e nunca retornam ao navegador.
2. Endpoint e modelo vêm de catálogo controlado, nunca de string livre ou URL enviada pelo cliente.
3. O perfil tem modelo primário único; fallback é desabilitado.
4. Só workspaces/marcas de demonstração autorizados podem usá-lo.
5. A API não é chamada sem perfil, saldo e orçamento disponíveis.
6. Cada execução registra marca, pessoa, tarefa, modelo, duração, uso retornado e custo estimado.
7. Histórico preserva o modelo efetivamente usado, mesmo que o perfil mude depois.
8. O fallback global por `GROQ_API_KEY` deve ser removido ou explicitamente desabilitado.

O adaptador local pode continuar existindo apenas para `development`. Ele não é selecionável pela versão web e nunca é fallback da API Qwen.

## Orçamento: trava antes da chamada

Implementar três controles cumulativos:

| Camada | Regra |
|---|---|
| Provedor | crédito pré-pago pequeno, sem recarga automática |
| Workspace | orçamento de demonstração por período |
| Marca/pessoa | limites de chamadas, tokens, imagens e concorrência |

O servidor reserva orçamento antes da chamada. Quando o provedor retorna uso real, consolida o ledger; se a execução falha, libera a reserva. Se não for possível consultar ou registrar orçamento, falhar fechado: não chamar API paga.

Implementar também:

- teto diário por usuário;
- teto diário por marca;
- uma análise visual concorrente por workspace de demonstração;
- tamanho e resolução máximos de imagem;
- limites existentes de contexto, fontes e mensagens;
- timeout e cancelamento;
- alerta para owner em faixas de consumo;
- kill switch do workspace e do perfil;
- allowlist temporária de contas/agências convidadas.

Não fixar moeda, preço ou orçamento no código. Guardar preço/câmbio/estimativa como dado auditável.

## Uma experiência de IA

Chat, análise de imagem e prompts serão modos internos do Assistente da Marca, não produtos ou menus separados:

- pergunta sem imagem → `assist`;
- imagem anexada → `analyse-image`;
- pedido de prompt → `prompt`.

Começar com o mesmo Qwen multimodal para as três tarefas. Separar modelos só se o benchmark provar ganho material de qualidade, latência ou custo.

Enquanto a proposta Studio/Guia não estiver aprovada, as telas atuais servem somente para validar a integração. Não criar novos destinos permanentes para IA.

## Segurança e privacidade

- Não registrar pergunta, resposta, imagem ou trecho de manual em logs técnicos.
- Registrar somente metadados seguros de execução.
- Contexto é sempre da marca ativa; testar A → B → A inclusive com Qwen.
- `member` usa apenas capacidade contratada; não configura modelo, orçamento ou conexão.
- Falta de saldo, timeout e erro de provedor recebem mensagem de produto, nunca detalhe técnico.
- Não aplicar fallback oculto que possa consumir crédito de outro perfil ou workspace.

## Benchmark GE

Antes de decidir modelo padrão, executar:

| Cenário | Quantidade | Critério |
|---|---:|---|
| Perguntas sobre manual | 20 | fontes, status, páginas e honestidade |
| Prompts | 10 | aderência ao contexto e utilidade |
| Análises de imagem | 20 | falsos positivos/negativos e fontes |
| Marca A → B → A | 5 | zero vazamento de contexto |

Registrar por execução: modelo, versão, latência, tokens/uso, custo, qualidade humana, falha de citação e estabilidade.

O melhor modelo do piloto é o que mantém fontes corretas e resposta estável com custo aceitável — não necessariamente o maior.

## Sequência

### P0 — plano e precificação

1. Mapear adaptadores, `ai_settings`, políticas, `getDemoConfig` e todos os caminhos de `GROQ_API_KEY`.
2. Criar catálogo de candidatos Qwen multimodais, sem ativar nenhum.
3. Estimar custo do benchmark GE com preços atuais do provedor.
4. Escrever plano de arquivos e testes antes de alterar execução.

### P1 — segurança, catálogo e orçamento

1. Validar `model` contra catálogo/capacidades.
2. Eliminar fallback global implícito.
3. Criar contrato de execução independente de fornecedor.
4. Criar perfil Qwen server-only.
5. Implementar orçamento por workspace/marca, reserva pré-chamada e ledger.
6. Criar mensagens seguras para perfil ausente, orçamento esgotado, visão indisponível, timeout e erro de provedor.

### P2 — demonstração web controlada

1. Após aprovação explícita, carregar crédito pré-pago limitado.
2. Configurar Qwen no workspace de demonstração.
3. Executar chat real com a GE pela URL pública.
4. Executar análise com imagem fornecida pelo usuário.
5. Executar prompts pelo mesmo Assistente.
6. Conferir ledger interno e painel do provedor contra o teto definido.

### P3 — escala futura

Depois de investimento e decisão comercial, adicionar outros provedores, perfis por marca, modelos avançados e eventualmente GPU própria. Manter o mesmo contrato, orçamento e isolamento.

## Testes obrigatórios

### Segurança

- modelo ou endpoint fora de catálogo é recusado antes da chamada;
- configuração Qwen não chega ao cliente;
- `GROQ_API_KEY` não volta como fallback;
- erro não exibe segredo, endpoint, arquivo ou `.env.local`;
- orçamento esgotado não chama provedor;
- falha na reserva ou no ledger impede cobrança;
- versão web nunca seleciona adaptador local.

### Comportamento

- marca A nunca recupera nem envia fonte da B;
- perfil sem visão recusa imagem sem cobrança;
- ausência de perfil retorna mensagem de produto;
- timeout não produz resposta inventada;
- cancelamento interrompe execução e libera reserva;
- member não configura conexão, modelo ou orçamento;
- teste de navegador usa API falsa hermética, sem credencial real;
- teste de integração prova que rota web usa o perfil Qwen selecionado e não fallback.

## Critério de aceite

A demonstração web estará pronta quando:

1. uma agência puder usar o Brennimark pela URL pública;
2. chat, imagem e prompt funcionarem com um mesmo perfil Qwen multimodal;
3. toda resposta preservar fontes, status e páginas;
4. o custo for limitado por crédito pré-pago e orçamento do produto;
5. não houver fallback pago não autorizado;
6. owner puder interromper o perfil por kill switch;
7. benchmark GE estiver documentado;
8. CI remoto e `npm run verify` terminarem verdes antes de publicar.

## Fora de escopo agora

- GPU própria;
- exposição pública do Mac;
- túnel como infraestrutura normal;
- múltiplos provedores ativos;
- URL de endpoint livre;
- seleção de modelo pelo usuário final;
- recarga automática;
- mudança visual ampla antes da aprovação Studio/Guia.

O usuário final continuará vendo uma única coisa: o Assistente da Marca.

