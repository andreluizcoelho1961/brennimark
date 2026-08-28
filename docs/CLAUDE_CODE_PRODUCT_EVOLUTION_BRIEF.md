# Briefing de evolução do aplicativo de gerenciamento de marca

**Destinatário:** Claude Code  
**Tipo de documento:** briefing de produto, arquitetura e implementação  
**Versão:** 1.0  
**Data:** 27 de agosto de 2026  
**Repositório:** `BrandvilleApp`  
**Nome do produto:** ainda não definido; `Brandville` é somente codinome técnico legado

---

## 1. Mandato

Evoluir o aplicativo existente de uma matriz funcional de brand books digitais para um produto
operável, mensurável e vendável por agências, sem iniciar uma reescrita ampla antes da validação
comercial.

O trabalho deve preservar as capacidades já implementadas e criar a menor arquitetura que permita:

1. implantar uma marca com processo previsível;
2. convidar e administrar os usuários corretos;
3. medir uso, custo, tempo de implantação e qualidade da IA;
4. permitir que uma agência acompanhe uma carteira de marcas isoladas;
5. aplicar planos, limites e permissões mesmo antes de automatizar cobrança;
6. transformar alterações de conteúdo, análises e aprovações em histórico governado;
7. demonstrar que uma segunda marca pode ser ativada com menos intervenção do criador do produto.

Este briefing não autoriza a implementação integral em uma única entrega. Ele define o norte, os
pacotes de trabalho, dependências e critérios de aceite. Antes de alterar código, produzir um plano
de execução baseado no estado real do repositório e submeter as decisões arquiteturais irreversíveis
a revisão.

## 2. Regras obrigatórias antes de trabalhar

1. Ler integralmente `AGENTS.md`, `CLAUDE.md`, `docs/PROJECT_BOUNDARY.md`,
   `docs/ARCHITECTURE.md`, `docs/PRODUCT_ARCHITECTURE.md`, `docs/BRANDVILLE_MATRIX.md`,
   `docs/BRAND_KNOWLEDGE_BASE_SCHEMA.md` e este briefing.
2. Este projeto usa Next.js 16.2.10 com mudanças incompatíveis com versões anteriores. Antes de
   alterar APIs, roteamento, cache, middleware/proxy, Server Components ou convenções do App Router,
   consultar a documentação local correspondente em `node_modules/next/dist/docs/`.
3. Tratar `Brandville` como codinome interno. Não consolidá-lo em novas interfaces, textos de venda,
   domínios, tabelas ou contratos como se fosse nome comercial aprovado.
4. Não transformar uma necessidade específica de The BluesMaker, Hairline, Guitar Garage ou outra
   instância em regra do produto sem abstração e validação.
5. Não misturar bancos, buckets, chaves, fontes licenciadas, usuários, assets ou histórico entre
   clientes.
6. Não importar provedores de IA diretamente em features. Toda seleção continua passando por
   `src/lib/ai/provider.ts` e pelas políticas de roteamento existentes.
7. Preservar a regra de honestidade editorial: conteúdo não aprovado nunca pode ser apresentado
   como verdade definitiva pela interface ou pela IA.
8. Toda mudança de banco deve ter migration versionada, RLS, índices, testes de autorização e plano
   de rollback ou reversão lógica.
9. Não apagar, reescrever ou normalizar silenciosamente dados, histórico ou assets existentes.
10. Evitar dependências novas quando a plataforma atual já oferece a capacidade necessária.

## 3. Contexto de negócio

O produto não está mais na fase de ideia. Já existe uma aplicação funcional com brand book digital,
consulta por IA, análise visual, escolha de provedores e modelos de IA, administração de conteúdo,
assets e histórico.

O estágio empresarial é:

```text
Produto funcional → pilotos pagos → repetibilidade → product-market fit → escala
                         ↑ estágio atual
```

A tese comercial prioritária é o canal de agências:

```text
startup → agência parceira → várias marcas clientes → usuários e fornecedores de cada marca
```

A agência pode ocupar três papéis:

- cliente da camada Studio;
- canal de distribuição do aplicativo;
- prestadora de implantação, curadoria e governança para seus clientes.

A tese só estará validada quando uma agência pagar, publicar uma primeira marca e ativar uma segunda
marca em até 90 dias com menor dependência do time central.

### Metas de validação que o produto precisa suportar

- marco inicial: três agências escolhendo e iniciando pilotos pagos;
- coorte de validação: até dez agências;
- 20–30 marcas publicadas ou em onboarding no primeiro gate;
- medição de tempo até publicação e horas manuais por marca;
- custo de IA, cloud e suporte atribuível por marca;
- evidência de segunda marca por agência;
- separação entre receita de software, implantação e serviços;
- margem bruta instrumentada, não estimada apenas em planilha.

### Hipóteses de pricing

As faixas ainda não são preços finais, mas o produto deve conseguir representar e aplicar:

| Oferta | Hipótese inicial |
| --- | ---: |
| Guide | R$ 249–399/mês |
| Intelligence | R$ 699–999/mês |
| Governance | R$ 1.490–2.490/mês |
| Studio de entrada | R$ 599/mês |
| Licença piloto por marca | R$ 699/mês |
| Implantação | R$ 2,5 mil–R$ 15 mil |

Não implementar valores diretamente em lógica espalhada. Modelar planos, entitlements, franquias e
limites como configuração versionada, ainda que a cobrança dos pilotos seja manual.

## 4. Produto que já existe

O código atual já entrega uma base relevante. Não reconstruir estas capacidades sem razão técnica
documentada.

### 4.1 Aplicação e experiência

- Next.js 16 App Router, TypeScript, React 19 e Tailwind CSS v4.
- Shell responsivo de documentação com navegação desktop, mobile e command palette.
- Brand book por páginas, grupos, estados editoriais, conteúdo e referências visuais.
- Blocos estruturados de prose, lista, callout, swatches, galeria e seção.
- Temas e identidade definidos por instância.
- Instâncias reais e de teste carregadas por configuração tipada.

### 4.2 Matriz e implantação

- Gerador guiado de instância.
- Manifesto validado antes da geração.
- Importador textual de brand books em PDF.
- Curadoria editorial explícita.
- Indexação de referências visuais.
- Checklist por cliente.
- Estratégia atual de uma instalação isolada por marca.

### 4.3 Administração e governança

- Área `/docs/admin` restrita a owner.
- Alteração de título, grupo, status e corpo sem deploy.
- Conteúdo persistido no Supabase sobrepondo a matriz versionada.
- Biblioteca privada de assets com URLs assinadas.
- Histórico imutável de versões de documentos.
- Recuperação de versões sem destruir o histórico anterior.
- Blocos estruturados já persistidos e renderizados, embora ainda não exista editor visual completo
  para todos os tipos de bloco.

### 4.4 IA

- Chat de marca com streaming.
- Contexto que incorpora estado editorial.
- Citações e validação inicial de qualidade.
- Análise multimodal de JPEG, PNG, WebP e GIF.
- Resultado estruturado e veredito normalizado.
- Feedback humano, calibração e reanálise encadeada.
- Histórico de análises e evidências privadas.
- Provedores Groq, Anthropic, OpenAI, Google e OpenRouter.
- BYOK com chaves criptografadas em AES-256-GCM.
- Roteamento independente para chat e análise.
- Primary/fallback, timeout configurável e consentimento para cruzar empresas provedoras.

### 4.5 Segurança já presente

- Supabase Auth.
- RLS em tabelas operacionais versionadas no repositório.
- Buckets privados para assets e evidências.
- Restrições de tamanho e tipos de arquivo.
- Chaves de IA nunca retornadas integralmente pela API.
- Isolamento por workspace e `instance_key` nas estruturas atuais.

## 5. Lacunas confirmadas no estado atual

Estas lacunas foram identificadas no código e na documentação; devem ser verificadas novamente antes
da implementação.

### 5.1 Reprodutibilidade e documentação

- As migrations de fundação para `profiles`, `workspaces`, `workspace_members` e `ai_settings` não
  aparecem no conjunto versionado atual, embora migrations posteriores dependam delas.
- `.env.example` não documenta todas as variáveis citadas na arquitetura, como `GROQ_API_KEY` e as
  variáveis opcionais de fallback do chat.
- `README.md`, `CLAUDE.md`, `ARCHITECTURE.md` e `PRODUCT_ARCHITECTURE.md` contêm trechos de momentos
  diferentes. Exemplos: status do logo, autenticação por senha versus referência residual a magic
  link e plataforma multi-brand aspiracional versus matriz isolada implementada.
- Há apenas um commit visível no histórico atual, portanto decisões importantes precisam ficar mais
  bem registradas em ADRs e changelog.

### 5.2 Conta, usuários e organização

- Papéis atuais são apenas `owner` e `member`.
- Não há interface de convites, remoção de membros, transferência de propriedade ou papéis por
  responsabilidade.
- Não há recuperação/troca de senha pela interface.
- O código escolhe o primeiro workspace do usuário com `.limit(1)`, o que não suporta uma pessoa em
  várias organizações ou marcas.
- Não há seleção explícita de organização/workspace ativo.

### 5.3 Operação de agência

- Não existe uma camada Studio para carteira de marcas.
- A instância ativa é selecionada por `NEXT_PUBLIC_BRANDVILLE_INSTANCE` no deploy, não em runtime.
- Não há registro central de instalações, estágio de onboarding, saúde, plano, domínio, responsável,
  próxima ação ou data de publicação.
- Não há fluxo de duplicação operacional da primeira para a segunda marca.
- Não há visão comercial/operacional agregada para agência.

### 5.4 Produto e conteúdo

- O lifecycle efetivo é `ready | draft | pending`; a arquitetura-alvo descreve estados mais ricos
  como review, approved, deprecated e archived.
- O admin atual não oferece editor visual completo para os blocos já suportados no modelo.
- Não há workflow explícito de revisão, aprovação e release por brand owner.
- Não há comparação visual/diff de versões para aprovação.
- Não foi encontrada exportação completa do brand book; existe geração de relatório PDF para uma
  análise individual.
- Tema e estrutura da instância ainda dependem majoritariamente de geração/configuração técnica.

### 5.5 Medição e economia

- Não há taxonomia de eventos de produto.
- Não há medição persistida de tokens, custo estimado, latência e consumo por marca/feature.
- Não há dashboard de ativação, uso, retenção ou margem.
- Não há medição de horas de onboarding e suporte.
- Não há planos, entitlements, quotas ou feature flags comerciais.
- Não há billing ou integração com meios de pagamento.

### 5.6 IA e conhecimento

- O histórico de análise visual é persistido; o histórico de chat não foi identificado.
- O contexto ainda é montado principalmente a partir dos documentos resolvidos; uma base grande pode
  aumentar tokens, latência e custo.
- Respostas e análises não parecem registrar explicitamente a versão exata do conjunto de conteúdo e
  do prompt utilizado.
- Não há ledger completo de uso/custo por tentativa principal e fallback.
- O CRUD de BYOK precisa de teste end-to-end autenticado documentado.
- Falta um conjunto de avaliações contínuas por instância e por release de prompt/modelo.

### 5.7 Segurança e operação

- Não foi identificado rate limiting explícito nas rotas de IA e upload.
- Não há inventário de dados, política de retenção, exportação/eliminação da conta e fluxos LGPD
  consolidados no produto.
- Backups e testes de restauração são requisitos documentais, mas não estão comprovados pelo código.
- Fontes e arquivos executáveis/complexos aceitos no bucket de assets exigem revisão de riscos,
  validação de conteúdo e regras de download.
- Observabilidade atual é principalmente log estruturado pontual; não existe visão operacional por
  instalação.

## 6. Decisão arquitetural recomendada

### 6.1 Não fazer uma migração multi-tenant ampla antes dos pilotos

A implementação atual e o documento `BRANDVILLE_MATRIX.md` adotam isolamento forte: cada marca tem
seu domínio, Supabase, usuários, storage, chaves e histórico. A visão de longo prazo descreve uma
plataforma multi-brand. Não resolver essa divergência com uma reescrita big-bang.

### 6.2 Arquitetura em dois planos

Adotar progressivamente:

```text
PLANO DE CONTROLE — Studio
Agência, carteira, instalações, planos, onboarding, saúde e métricas agregadas
        │
        ├── Instalação isolada da Marca A
        ├── Instalação isolada da Marca B
        └── Instalação isolada da Marca C

PLANO DE DADOS — cada instalação
Brand book, usuários, assets, IA, análises, histórico e aprovações da marca
```

O Studio não deve receber chaves privadas, conteúdo integral ou assets das instalações por padrão.
Ele mantém metadados operacionais e métricas agregadas necessárias para a agência. O acesso profundo
ocorre por autenticação e autorização na própria instalação.

### 6.3 Benefícios desta abordagem

- preserva o isolamento prometido aos clientes;
- reduz risco de vazamento entre marcas;
- permite vender a camada Studio;
- mede a segunda marca por agência;
- evita reconstruir imediatamente todo o produto;
- permite decidir depois, com evidência, se algumas instalações podem compartilhar infraestrutura.

### 6.4 ADR obrigatório

Antes de implementar o Studio, criar um ADR comparando pelo menos:

1. instalações totalmente independentes + control plane;
2. um único Supabase multi-tenant com múltiplas marcas;
3. modelo híbrido por agência/cliente.

Registrar segurança, custo, complexidade operacional, billing, domínio, autenticação, portabilidade,
backup e migração. A recomendação inicial deste briefing é a opção 1.

## 7. Usuários e papéis-alvo

Não confundir papel comercial com papel de autorização técnica.

| Papel | Escopo | Capacidades essenciais |
| --- | --- | --- |
| Operador da plataforma | Global/control plane | Criar instalações, planos, suporte e auditoria operacional |
| Agency owner | Agência/Studio | Carteira, equipe, planos, implantação e visão agregada |
| Agency operator | Agência e marcas atribuídas | Curadoria, onboarding, análise e suporte |
| Brand owner | Uma marca | Aprovar releases, usuários, regras e assets |
| Brand editor | Uma marca | Editar conteúdo e preparar release |
| Reviewer/approver | Uma marca | Comentar, aprovar ou solicitar alteração |
| Member | Uma marca | Consultar guide, chat, assets e análises autorizadas |
| External/vendor | Uma marca, acesso limitado | Consultar regras/assets e enviar peças para análise |

Para os pilotos, os papéis mínimos são Agency owner, Agency operator, Brand owner e Member. Os
demais podem ser introduzidos quando o workflow exigir.

## 8. Ofertas e entitlements

Criar uma camada de configuração comercial que não dependa ainda de Stripe ou outro gateway.

### 8.1 Entitlements candidatos

| Capacidade | Guide | Intelligence | Governance |
| --- | --- | --- | --- |
| Brand book digital | Sim | Sim | Sim |
| Assets | Básico | Ampliado | Ampliado |
| Chat com IA | Opcional/limitado | Sim | Sim |
| Análise visual | Não ou franquia pequena | Sim, com franquia | Sim, franquia maior |
| BYOK | Opcional | Sim | Sim |
| Histórico de análise | Limitado | Sim | Sim |
| Workflow de aprovação | Não | Básico | Completo |
| Auditoria e releases | Básico | Sim | Sim |
| Relatórios | Não | Uso | Uso + governança |
| Suporte/operação | Padrão | Padrão | Prioritário/assistido |

Esta matriz é hipótese. Implementar por configuração e feature flags, não por condicionais repetidas
nas páginas.

### 8.2 Estrutura de dados mínima

- `plan_catalog`: código, versão, nome interno, status e moeda;
- `plan_entitlements`: feature, limite, janela e comportamento ao exceder;
- `workspace_subscription` ou equivalente: plano ativo, início, fim, trial/pilot, overrides;
- `usage_counters`: agregações transacionais quando necessárias;
- `entitlement_overrides`: concessões explícitas para piloto sem alterar o plano global.

Durante a validação, cobrança pode permanecer manual. O produto deve registrar contrato/plano e
aplicar limites; não precisa emitir fatura automaticamente no primeiro pacote.

## 9. Fluxos prioritários

### 9.1 Ativação de uma nova agência

1. Operador cria ou aprova organização Studio.
2. Agency owner recebe convite e conclui onboarding.
3. Agência informa equipe, perfil, carteira inicial e responsáveis.
4. Sistema cria checklist do piloto e permite cadastrar a primeira marca.
5. Plano e condições do piloto são registrados.

### 9.2 Implantação de uma nova marca

1. Registrar marca, domínio pretendido, owner, operador e fonte do conteúdo.
2. Escolher: questionário, manifesto, importação PDF ou clonagem de template.
3. Validar conteúdo, assets, fontes, direitos e decisões pendentes.
4. Configurar tema, navegação, recursos e IA.
5. Executar checklist técnico e editorial.
6. Convidar brand owner para revisão.
7. Publicar release inicial.
8. Registrar tempo, horas, erros, custo e responsáveis.

### 9.3 Uso cotidiano da marca

1. Usuário consulta página, busca ou chat.
2. Resposta exibe fonte, versão e status editorial.
3. Usuário baixa asset autorizado ou envia peça para análise.
4. Análise registra conteúdo usado, modelo, tentativas, latência, custo e feedback.
5. Decisões relevantes podem virar comentário, exceção, correção ou nova regra proposta.

### 9.4 Release de conteúdo

1. Editor altera documento/blocos.
2. Sistema cria draft sem afetar imediatamente a versão publicada quando o workflow estiver ativo.
3. Reviewer recebe solicitação.
4. Brand owner aprova, rejeita ou pede ajuste.
5. Aprovação gera release imutável com versão, autor, data e notas.
6. Chat e análise passam a usar a nova release aprovada.
7. Rollback publica nova release baseada em uma anterior; não apaga histórico.

### 9.5 Segunda marca da agência

1. Studio sugere reutilização de template, checklist e configuração não sensível.
2. Dados e assets da primeira marca nunca são clonados automaticamente.
3. Agência executa onboarding com menor intervenção do operador da plataforma.
4. Sistema compara tempo/horas da primeira e da segunda marca.
5. Evento `second_brand_activated` registra a evidência central da tese de canal.

## 10. Telemetria e unit economics

Telemetria é requisito de produto, não item opcional de analytics. Deve ser desenhada antes dos
pilotos para evitar reconstrução retrospectiva.

### 10.1 Princípios

- eventos com schema versionado;
- nenhum prompt, conteúdo confidencial ou imagem bruta em analytics geral;
- identificadores pseudonimizados quando possível;
- separação entre métricas operacionais, produto, IA e negócio;
- timestamps em UTC e apresentação no fuso da organização;
- idempotência para eventos críticos;
- retenção explícita;
- possibilidade de exportar dados do piloto.

### 10.2 Eventos mínimos

#### Conta e ativação

- `workspace_created`
- `member_invited`
- `member_accepted`
- `member_first_active`
- `brand_onboarding_started`
- `brand_onboarding_step_completed`
- `brand_published`
- `second_brand_activated`

#### Conteúdo e governança

- `document_viewed`
- `content_draft_saved`
- `review_requested`
- `release_approved`
- `release_published`
- `version_restored`
- `asset_uploaded`
- `asset_downloaded`

#### IA

- `chat_started`
- `chat_completed`
- `chat_failed`
- `citation_opened`
- `analysis_started`
- `analysis_completed`
- `analysis_failed`
- `analysis_feedback_submitted`
- `fallback_used`

### 10.3 Dimensões mínimas de IA

- workspace/installation e feature;
- provider e model;
- primary ou fallback;
- prompt/context version;
- content release/version;
- input/output tokens quando fornecidos;
- custo estimado na moeda-base;
- latência até primeiro token e total;
- status/error class;
- demo, BYOK ou chave da plataforma;
- tamanho do arquivo para análise;
- feedback de qualidade.

### 10.4 Métricas operacionais

- dias do contrato/início até primeira publicação;
- horas humanas por implantação, categoria e responsável;
- quantidade de intervenções do operador central;
- marcas ativas por agência;
- percentual de agências com segunda marca em 90 dias;
- usuários ativos por marca;
- chat e análises por marca/mês;
- custo de IA por marca, consulta e análise;
- custo de suporte diretamente atribuível;
- margem de contribuição por instalação.

### 10.5 O que fica fora do produto

Valores de contrato, CAC completo, comissão, impostos e despesas comerciais podem começar em CRM ou
planilha controlada. O produto deve fornecer IDs e exportações que permitam reconciliar essas fontes
sem guardar dados financeiros desnecessários dentro de cada instalação.

## 11. Evolução da camada de IA

### 11.1 Preservar

- abstração de provider;
- BYOK criptografado;
- roteamento por feature;
- consentimento antes de cruzar provedores;
- fallback controlado;
- estados editoriais no contexto;
- análise estruturada;
- feedback humano e calibração.

### 11.2 Implementar para pilotos

1. Ledger de uso e custo por tentativa.
2. Registro de `prompt_version`, `context_version` e `brand_release_id` em chat/análise.
3. Persistência opcional e governada de sessões de chat, com retenção configurável.
4. Citações estruturadas e verificáveis, não apenas texto produzido pelo modelo.
5. Limites por plano e por workspace.
6. Rate limiting por usuário, workspace, IP e feature conforme risco.
7. Dashboard de saúde: erro, latência, fallback, custo e feedback.
8. Teste end-to-end autenticado de BYOK e políticas de fallback.

### 11.3 Retrieval e escala de contexto

Não adicionar vector database apenas por tendência. Primeiro medir tamanho do contexto, tokens, custo,
latência e perda de qualidade. Definir limiar objetivo para migrar de contexto integral para retrieval.

Quando necessário:

- quebrar documentos em unidades que preservem página, seção, bloco, status e release;
- indexar somente conteúdo autorizado;
- filtrar por workspace, instância, idioma, estado e release;
- retornar IDs de fonte determinísticos;
- avaliar recall e groundedness com conjunto de perguntas reais;
- impedir qualquer recuperação entre clientes.

### 11.4 Avaliação contínua

Criar datasets versionados com:

- perguntas que devem ser respondidas;
- perguntas que devem receber “não definido”;
- regras prontas, rascunhos e conflitos;
- imagens alinhadas, parcialmente alinhadas e desalinhadas;
- casos adversariais e tentativas de prompt injection em documentos/assets;
- comparação antes/depois de prompt, modelo ou retrieval.

Nenhuma troca padrão de modelo ou prompt deve chegar a produção sem avaliação mínima e registro do
resultado.

## 12. Governança do conhecimento

### 12.1 Lifecycle recomendado

Evoluir de `ready | draft | pending` para um modelo explícito, preservando compatibilidade:

```text
pending → draft → in_review → approved → published
                       ↘ rejected
published → deprecated → archived
```

Não migrar todos os registros automaticamente para `approved` sem evidência. Mapear `ready` para
estado compatível somente quando a origem já representa conteúdo aprovado.

### 12.2 Release como unidade de verdade

Uma release deve registrar:

- ID e número/label;
- workspace/instância;
- snapshot ou referências imutáveis dos documentos;
- autor, aprovador e timestamps;
- notas de release;
- regras/exceções relevantes;
- prompt/context version derivada;
- status e eventual release substituída.

Chat e análise devem declarar qual release foi usada.

### 12.3 Editor de blocos

O modelo já suporta blocos estruturados. Construir editor gradual para os tipos existentes antes de
inventar novos:

- prose;
- list;
- callout;
- swatches;
- gallery;
- section.

Requisitos:

- validação de schema no cliente e servidor;
- reordenação acessível;
- preview fiel;
- autosave somente se houver recuperação segura;
- estados de dirty/saving/saved/error;
- diff ou resumo de mudanças;
- histórico e rollback;
- AI nunca deve alterar/publicar regras sem confirmação humana.

## 13. Studio: plano de controle da agência

### 13.1 MVP do Studio

Tela de carteira com:

- marca e identificador da instalação;
- domínio/URL;
- plano e condição do piloto;
- status: prospect, onboarding, review, active, paused, offboarded;
- owner da marca e operador da agência;
- progresso do checklist;
- data de início e primeira publicação;
- última atividade agregada;
- uso do mês e alerta de limite;
- saúde da IA;
- próxima ação e responsável;
- indicação de primeira/segunda/n-ésima marca da agência.

### 13.2 Registro de instalação

O control plane precisa conhecer somente metadados operacionais e um mecanismo seguro de vínculo.
Não guardar no Studio:

- API keys das marcas;
- conteúdo integral do brand book;
- imagens de análise;
- fontes licenciadas;
- credenciais de banco;
- tokens administrativos permanentes.

Para telemetria agregada, preferir eventos assinados ou jobs com credenciais mínimas e rotacionáveis.

### 13.3 Provisionamento

Automatização deve começar como checklist assistido e evoluir apenas depois de observar o processo.
Não automatizar prematuramente criação de Vercel/Supabase sem confirmar:

- passos repetidos;
- erros frequentes;
- limites e custos das APIs;
- ownership dos projetos;
- processo de offboarding;
- recuperação em caso de provisionamento parcial.

## 14. Segurança, privacidade e LGPD

Antes de ampliar pilotos, produzir e executar um baseline:

1. inventário de dados e finalidade;
2. classificação de dados por sensibilidade;
3. registro de operadores/suboperadores;
4. retenção para chats, análises, evidências, assets e logs;
5. exportação e eliminação conforme obrigação aplicável;
6. política de acesso mínimo e revisão de membros;
7. MFA quando suportado/necessário para administradores;
8. rate limiting e proteção contra abuso;
9. validação robusta de upload e download;
10. signed URLs curtas e revogáveis;
11. backups e teste documentado de restauração;
12. resposta a incidente com logs e responsáveis;
13. revisão de RLS e testes negativos cross-workspace;
14. rotação de chaves e separação entre ambientes;
15. cabeçalhos, CSP e dependências revisados.

Arquivos de brand book e assets podem conter instruções maliciosas para modelos. Tratar conteúdo
recuperado como dado não confiável e proteger prompts contra injeção, exfiltração e alteração de
regras.

## 15. Pacotes de trabalho

### WP0 — Baseline reproduzível e auditoria

**Objetivo:** qualquer segunda pessoa técnica consegue subir, testar e operar o produto.

Entregas:

- reconciliar documentação com implementação;
- recuperar/versionar migrations fundacionais ausentes;
- completar `.env.example` sem segredos;
- documentar bootstrap local e produção;
- mapa de dependências externas e owners;
- runbook de deploy, rollback, backup e restore;
- ADR sobre matriz isolada + Studio;
- verificação autenticada de BYOK;
- relatório de segurança/RLS inicial.

Critérios de aceite:

- ambiente novo pode ser criado apenas com repositório, variáveis documentadas e acessos legítimos;
- lint, testes e build passam;
- nenhuma migration depende de objeto não documentado;
- outra pessoa executa o runbook sem intervenção informal do criador.

### WP1 — Identidade, convites e papéis

**Objetivo:** agência e cliente conseguem trabalhar com permissões claras.

Entregas:

- convite, aceite, reenvio, revogação e expiração;
- seleção explícita de workspace/organização;
- papéis mínimos Agency owner/operator, Brand owner e Member;
- matriz de permissões no servidor e RLS;
- recuperação e troca de senha;
- tela de membros e auditoria de alterações.

Critérios de aceite:

- testes positivos e negativos por papel;
- usuário não acessa marca não atribuída;
- retirada de acesso invalida operações futuras;
- não existe autorização baseada somente em UI.

### WP2 — Telemetria, IA e custo

**Objetivo:** medir ativação, uso, qualidade e margem dos pilotos.

Entregas:

- event schema versionado;
- tabela/serviço de eventos;
- ledger de uso de IA;
- prompt/context/release version;
- dashboards operacionais básicos;
- exportação CSV/JSON por período e instalação;
- rate limiting e alertas de limite.

Critérios de aceite:

- uma análise permite reconciliar provider, model, tentativas, tokens/custo, latência e feedback;
- custo mensal por marca é calculável;
- nenhum evento contém imagem, chave ou conteúdo confidencial bruto;
- duplicação/retry não infla métricas críticas.

### WP3 — Onboarding operacional e checklist

**Objetivo:** reduzir tempo e dependência na implantação.

Entregas:

- entidade de onboarding/projeto;
- etapas, responsáveis, datas, bloqueadores e evidências;
- integração com importador/gerador existentes;
- medição de horas por atividade;
- readiness check técnico/editorial;
- handoff para brand owner e publicação.

Critérios de aceite:

- primeira marca percorre o fluxo completo;
- cada etapa tem responsável e estado;
- tempo e horas são exportáveis;
- segunda implantação reutiliza processo, não dados da primeira marca.

### WP4 — Studio e carteira

**Objetivo:** dar à agência visão operacional das instalações isoladas.

Entregas:

- organização Studio;
- registro seguro de instalações;
- dashboard de carteira;
- vínculo de operador e owner;
- status, plano, checklist, saúde e próxima ação;
- métricas agregadas sem conteúdo confidencial;
- evento de segunda marca ativada.

Critérios de aceite:

- agência visualiza apenas sua carteira;
- falha de uma instalação não expõe outra;
- Studio não guarda segredos das marcas;
- segunda marca pode ser cadastrada e acompanhada separadamente.

### WP5 — Planos e entitlements

**Objetivo:** testar ofertas sem depender de billing automatizado.

Entregas:

- catálogo e versões de planos;
- entitlements e limites;
- assinatura/piloto manual;
- overrides auditáveis;
- estados de aproximação e excesso de franquia;
- UI coerente para recurso indisponível/limitado.

Critérios de aceite:

- alterar plano não exige deploy;
- acesso é verificado no servidor;
- consumo respeita janela e timezone definidos;
- override registra ator, motivo e validade.

### WP6 — Workflow de conteúdo e releases

**Objetivo:** tornar governança humana parte verificável do produto.

Entregas:

- lifecycle ampliado;
- draft separado de published;
- revisão, comentários e aprovação;
- releases imutáveis;
- diff/resumo de mudança;
- editor de blocos existentes;
- rollback por nova release.

Critérios de aceite:

- IA usa somente release permitida;
- conteúdo draft não vaza como regra aprovada;
- toda publicação identifica autor e aprovador;
- rollback não apaga histórico.

### WP7 — Qualidade e governança da IA

**Objetivo:** tornar respostas e análises confiáveis e economicamente controláveis.

Entregas:

- citações estruturadas;
- histórico governado de chat;
- datasets de avaliação;
- regressão de prompts/modelos;
- thresholds para retrieval;
- dashboard de erro/fallback/feedback;
- política de retenção.

Critérios de aceite:

- afirmação sobre regra aponta para fonte e release;
- pergunta não coberta recebe resposta honesta;
- mudança de prompt/modelo possui resultado comparativo;
- nenhuma consulta recupera conteúdo de outra marca.

### WP8 — Exportação, offboarding e portabilidade

**Objetivo:** reduzir risco do cliente e sustentar promessa de portabilidade.

Entregas:

- exportação do brand book publicado;
- pacote de dados estruturados e assets autorizados;
- exportação de histórico conforme permissão;
- processo de offboarding, retenção e eliminação;
- comprovante/log de conclusão.

Critérios de aceite:

- exportação é reproduzível e identifica release;
- assets restritos/licenciados respeitam permissões;
- eliminação não remove registros que precisam ser legalmente preservados sem regra explícita;
- instalação pode ser transferida sem dependência oculta do ambiente original.

## 16. Ordem de execução recomendada

```text
WP0 Baseline
 ├── WP1 Identidade e papéis
 ├── WP2 Telemetria e custo
 └── WP3 Onboarding
          └── WP4 Studio
                 └── WP5 Planos/entitlements

WP1 + WP3 ──→ WP6 Releases
WP2 + WP6 ──→ WP7 Qualidade de IA
WP6 + segurança ──→ WP8 Exportação/offboarding
```

Para os primeiros três pilotos, priorizar WP0, o mínimo de WP1, WP2 e WP3. O Studio pode começar
como control plane pequeno quando houver mais de uma instalação real. Billing automatizado, SSO e
integrações enterprise ficam depois de evidência de canal.

## 17. O que não construir agora

- reescrita completa para um único banco multi-tenant;
- DAM enterprise amplo;
- editor concorrente semelhante a Figma;
- automação de mídia social;
- marketplace de templates;
- white label completo;
- SSO/SAML antes de demanda contratada;
- billing complexo antes de planos e contratos validados;
- integrações numerosas sem cliente pagante;
- geração autônoma de regras de marca;
- vector database sem limiar medido;
- personalizações que não possam virar configuração reutilizável.

## 18. Requisitos de UX

1. Manter a identidade da plataforma distinta do tema da marca cliente.
2. A experiência de consulta deve continuar simples para membros e fornecedores.
3. Administração, Studio e operação podem usar uma interface mais neutra e funcional.
4. Toda tela deve indicar marca, organização e ambiente ativos.
5. Ações destrutivas ou de publicação exigem contexto e confirmação.
6. Estados vazios devem ensinar a próxima ação.
7. Limites de plano devem ser explicados sem bloquear trabalho silenciosamente.
8. Erros de IA devem manter linguagem clara já usada pelo produto.
9. Acessibilidade por teclado, foco, labels e contraste é obrigatória.
10. Mobile deve ser validado para consulta e tarefas operacionais essenciais.

## 19. Modelo de dados: princípios

O desenho final deve ser proposto após auditoria. Aplicar estes princípios:

- IDs estáveis e UUIDs para entidades persistidas;
- `created_at`, `updated_at`, ator e origem em registros críticos;
- status com constraints ou enums migráveis;
- soft delete apenas quando houver necessidade de recuperação/auditoria;
- eventos e releases imutáveis;
- tabelas transacionais separadas de agregações;
- dinheiro em unidades inteiras mínimas e moeda explícita;
- custos de IA com versão da tabela de preços usada;
- timezone da organização explícito;
- RLS como camada obrigatória, não opcional;
- nenhuma confiança em `instance_key` enviado pelo cliente sem autorização server-side;
- migrations compatíveis com dados existentes e testes de backfill.

## 20. APIs e contratos

- Validar payloads no servidor com schemas explícitos.
- Padronizar erros com código estável, mensagem segura e request ID.
- Aplicar limites de tamanho, paginação e rate limit.
- Não retornar secrets, stack traces ou detalhes de outro tenant.
- Versionar contratos consumidos pelo Studio ou por instalações externas.
- Para eventos entre control plane e instalações, usar assinatura, timestamp, nonce/idempotency key e
  rotação de segredo ou chave assimétrica.
- Manter logs estruturados sem conteúdo sensível.
- Usar jobs/retries apenas com idempotência e dead-letter/estado de falha observável.

## 21. Estratégia de testes

### 21.1 Manter a suíte atual

- `npm run lint`
- `npm run test:brandville-scaffold`
- `npm run test:brandville-import`
- `npm run test:brand-context`
- `npm run evaluate:brand-chat`
- `npm run build`

### 21.2 Adicionar

- testes unitários de entitlements e cálculo de uso;
- testes de schema de eventos;
- testes de migrations e backfills;
- testes RLS positivos e negativos por papel;
- testes de convite e revogação;
- testes de isolamento entre workspaces/instalações;
- testes de idempotência de eventos e webhooks;
- testes de lifecycle e release;
- testes de custo/ledger com primary e fallback;
- testes E2E dos fluxos de piloto;
- testes de acessibilidade dos fluxos críticos;
- avaliações de IA com snapshots de evidência e critérios semânticos controlados.

### 21.3 Cenários E2E mínimos

1. Agency owner entra, cria primeiro onboarding e convida operador.
2. Operador importa/estrutura conteúdo, envia para review e publica.
3. Brand owner aprova release.
4. Member consulta chat e abre fonte.
5. Member envia peça, recebe análise e fornece feedback.
6. Uso e custo aparecem no painel correto.
7. Agência cadastra segunda marca sem acesso cruzado.
8. Usuário removido perde acesso.
9. Limite de plano é aplicado no servidor.
10. Exportação e offboarding respeitam permissões.

## 22. Definition of Done para qualquer pacote

Uma entrega só está pronta quando:

- requisito e não objetivo estão documentados;
- arquitetura e trade-offs relevantes estão registrados;
- tipos, validações e migração estão versionados;
- RLS e autorização server-side foram verificadas;
- caminhos de erro e rollback existem;
- telemetria necessária foi incluída;
- testes automatizados relevantes passam;
- lint e build passam;
- documentação operacional foi atualizada;
- nenhuma marca/asset específico vazou para o core;
- revisão responsiva e de acessibilidade foi realizada;
- dados e secrets não aparecem em logs/client bundle;
- critérios de aceite do pacote foram demonstrados.

## 23. Entregas esperadas do Claude Code antes de implementar

Produzir primeiro:

1. **Auditoria do estado atual**, confirmando ou corrigindo cada lacuna deste briefing com caminhos de
   arquivo e evidência.
2. **Mapa de domínio**, com entidades, ownership, trust boundaries e fluxos de dados.
3. **ADR da estratégia Studio + instalações isoladas**.
4. **Plano incremental**, dividido em PRs pequenos e reversíveis.
5. **Matriz de riscos**, incluindo segurança, dados, migração, custos de IA e lock-in.
6. **Plano de banco**, com migrations fundacionais, novas tabelas, RLS e backfills.
7. **Plano de telemetria**, com schemas, retenção, privacidade e consultas dos KPIs.
8. **Plano de testes**, incluindo isolamento e fluxos E2E.
9. **Lista de decisões humanas necessárias**, sem inventar respostas comerciais ainda não validadas.

Depois da aprovação, implementar um pacote por vez, começando por WP0.

## 24. Decisões que não podem ser presumidas

Solicitar decisão humana antes de definir:

- nome comercial;
- preços finais e impostos;
- limites exatos de cada plano;
- gateway de pagamento;
- ferramenta de CRM/product analytics;
- compartilhamento ou não de infraestrutura entre clientes;
- retention periods definitivos;
- localização/residência de dados exigida;
- permissões finais de cada papel;
- conteúdo que pode alimentar histórico de chat;
- política de BYOK versus chave da plataforma por plano;
- white label;
- SLAs e suporte;
- integrações prioritárias;
- uso de dados para treinamento ou melhoria de modelos — padrão deve ser não utilizar sem base e
  autorização explícitas.

## 25. Critério de sucesso da evolução

A evolução será bem-sucedida quando a plataforma puder demonstrar, com dados exportáveis:

1. três agências iniciaram pilotos pagos;
2. as primeiras marcas foram publicadas com tempo e horas medidos;
3. custo e margem por marca podem ser reconciliados;
4. agência, cliente e fornecedor possuem acessos adequados;
5. chat e análise indicam fonte e release;
6. a segunda marca foi ativada por uma agência com menor dependência do criador;
7. nenhuma instalação acessa dados de outra;
8. uma segunda pessoa técnica consegue operar e recuperar o sistema;
9. o produto consegue aplicar ofertas diferentes sem fork de código;
10. a decisão de escalar, manter ou pivotar o canal pode ser tomada com evidência.

## 26. Fontes internas deste briefing

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/PROJECT_BOUNDARY.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT_ARCHITECTURE.md`
- `docs/BRANDVILLE_MATRIX.md`
- `docs/BRAND_KNOWLEDGE_BASE_SCHEMA.md`
- `docs/investor/platform-preinvestment-study.md`
- `docs/investor/startup-commercial-validation-guide.md`
- `src/brandville/`
- `src/app/`
- `src/lib/ai/`
- `src/lib/analysis/`
- `src/lib/brandville/`
- `src/content/doc-blocks.ts`
- `supabase/migrations/`
- `package.json`

---

## Prompt operacional resumido para iniciar a execução

> Leia `AGENTS.md`, `CLAUDE.md`, os documentos de arquitetura e
> `docs/CLAUDE_CODE_PRODUCT_EVOLUTION_BRIEF.md`. Não implemente tudo imediatamente. Audite o
> repositório e produza: (1) divergências entre briefing e código, (2) ADR para Studio como control
> plane sobre instalações isoladas, (3) plano incremental começando pelo WP0, (4) migrations/RLS
> necessárias, (5) telemetria e testes. Preserve o produto existente, o isolamento entre marcas, a
> abstração multi-provider de IA e a honestidade editorial. Não trate Brandville como nome comercial
> definitivo e não transforme conteúdo de uma instância em regra do core.
