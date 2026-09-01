# Brennimark — briefing de correção pós-auditoria

**Data:** 2026-09-01  
**Origem:** auditoria estática, banco Supabase de produção, deploy e suíte local.  
**Regra de trabalho:** resolver primeiro segurança e integridade; depois escala da importação; só então consolidar a experiência multi-marca e remover a herança visual. Não misturar essas frentes no mesmo commit.

## 0. Estado verificado

- `lint`, `typecheck`, build, 181 testes unitários e 71 testes Playwright passam.
- O verde atual não valida Supabase, RLS, Storage, login real nem importação autenticada: a suíte de navegador usa `BRANDVILLE_DEV_SKIP_AUTH` e Chromium apenas.
- O banco de produção tem um usuário/workspace, mas nenhuma marca, documento, asset ou importação publicada.
- O PDF fornecido (`GE_ID000.PDF`) tem 743 páginas. Portanto é caso obrigatório de aceite, não um cenário excepcional.

## 1. Patch S0 — corrigir privilégios que contornam RLS

**Severidade: P0. Executar antes de qualquer outra mudança.**

### Defeito

No banco de produção, o papel `authenticated` possui `TRUNCATE` nas tabelas abaixo:

- `ai_settings`
- `ai_routing_policies`
- `analysis_runs`
- `brand_assets`

`TRUNCATE` não passa por RLS. Assim, uma sessão autenticada pode apagar dados de outras contas, apesar das policies de linha. O repositório já reconhece explicitamente essa propriedade em `20260827215129_drift_restrict_foundational_grants.sql`, mas a redução de grants não cobriu as tabelas criadas depois.

### Entrega

1. Criar uma migração nova, sem editar migrações históricas.
2. Revogar `TRUNCATE`, `REFERENCES` e `TRIGGER` de `authenticated` e `anon` em todas as tabelas expostas que não necessitam desses privilégios.
3. Conceder somente os privilégios CRUD indispensáveis, tabela a tabela.
4. Criar um script SQL versionado que execute como `authenticated` de verdade (`set local role authenticated`), e não como `postgres` com claims simuladas.

### Aceite

- Tentativa de `TRUNCATE` por `authenticated` falha com permissão negada.
- Operações normais previstas para cada papel continuam funcionando.
- O teste varre os grants efetivos do banco e falha se `TRUNCATE` reaparecer.
- Rodar o teste no projeto Supabase de integração e registrar o resultado no commit.

## 2. Patch S1 — atualizar dependências vulneráveis

**Severidade: P0. Independente do patch S0, pode ser entregue em commit próprio.**

### Defeito

`npm audit --omit=dev` aponta vulnerabilidades altas em dependências de produção:

- `pdfjs-dist@6.1.200`: PDF malicioso pode executar JavaScript ao ser aberto;
- `next@16.2.10`: múltiplos advisories altos, inclusive no perímetro de proxy/middleware;
- transitivas `nanoid`, `postcss` e `sharp`.

O primeiro é diretamente crítico: Brennimark abre PDFs enviados por usuários no navegador.

### Entrega

1. Atualizar `pdfjs-dist` para versão corrigida e compatível com o Next atual.
2. Atualizar Next, `eslint-config-next` e lockfile para versão corrigida compatível.
3. Preservar build, tipo e comportamento de importação.
4. Gerar e registrar `npm audit --omit=dev` limpo ou justificar, por advisory, qualquer remanescente que não tenha correção disponível.

### Aceite

- `npm audit --omit=dev` sem vulnerabilidades altas de produção.
- Importação do PDF de fixture e do GE_ID000 continua funcionando.
- Build, unidade e navegador verdes.

## 3. Patch I1 — importador de PDF para 100 MB e 1.000 páginas

**Severidade: P1. Não tratar como ajuste de constante.**

### Defeitos atuais

- Cliente limita a 50 MB em `BrandImporter.tsx`.
- Bucket `brand-imports` em produção também limita a 50 MB.
- `publish_brand_import` limita a 300 documentos.
- O cliente lê o arquivo duas vezes: uma para SHA-256 e outra para PDF.js. Em arquivo de 100 MB, isso duplica o buffer cru antes do custo do parser.
- Cada página física vira um documento. Um PDF de 1.000 páginas gera uma navegação inviável e excede o limite atual; o GE_ID000, com 743 páginas, já não pode ser publicado.
- O MIME precisa ser exatamente `application/pdf`, o que rejeita PDFs válidos quando o navegador não informa o tipo esperado.
- A extração usa o build moderno do PDF.js, enquanto a falha observada em produção é compatível com problema de engine/worker no Safari.

### Decisões de arquitetura obrigatórias

1. Suportar **até 100 MiB e 1.000 páginas** tanto no cliente quanto no Storage e na RPC.
2. Ler o arquivo uma vez; reutilizar o mesmo `ArrayBuffer` para hash e parser, com orçamento de memória explícito.
3. Validar PDF por assinatura `%PDF-`, não apenas por MIME. Recusar conteúdo não-PDF mesmo que tenha extensão `.pdf`.
4. Usar variante/worker do PDF.js comprovadamente compatível com Safari, Chrome e Firefox. Não prometer “qualquer PDF” como se PDF criptografado, corrompido ou sem texto tivesse o mesmo tratamento:
   - PDF válido com texto: importar;
   - PDF digitalizado: sinalizar necessidade de OCR/revisão;
   - PDF protegido por senha: explicar que não pode ser lido sem senha;
   - corrompido/incompatível: erro específico e ação possível.
5. Não transformar uma página física em uma página de manual por padrão. Criar uma estratégia revisável de agrupamento por seção/título, com fallback seguro. A estrutura extraída deve ser curável antes da publicação.
6. Limitar texto, quantidade de rascunhos e preview de forma paginada/virtualizada. Nunca montar uma lista de 1.000 cards no cliente.

### Banco e contrato RPC

- Alterar limite da função para 1.000, mas validar coerência entre `p_page_count`, quantidade de documentos e relatório.
- Atualizar o bucket privado `brand-imports` para 100 MiB, mantendo MIME permitido e políticas existentes.
- O status inicial continua obrigatoriamente `draft` no servidor.
- Manter caminho exclusivo por importação e a garantia de procedência no Storage.

### Aceite

- GE_ID000 (743 páginas) é lido e chega à prévia sem crash de navegador.
- Um PDF com 1.000 páginas e até 100 MiB é aceito em navegador suportado e publicado de modo atômico.
- 100 MiB + 1.001 páginas, 100 MiB + 1 byte e arquivo sem assinatura PDF são recusados com mensagem correta.
- Safari/WebKit, Firefox e Chromium executam ao menos: arquivo válido, arquivo sem texto e erro de PDF protegido/corrompido.
- A publicação não cria mais de 1.000 documentos e não cria documento parcial em falha.

## 4. Patch M1 — seleção real de workspace e marca

**Severidade: P1. Bloqueador de produto multi-marca.**

### Defeito

`resolveActiveBrand` filtra opcionalmente por `NEXT_PUBLIC_BRANDVILLE_INSTANCE` e, sem a variável, seleciona a primeira marca por `created_at`. Não existe uma escolha de marca por pessoa, URL ou sessão. `getBrandvilleAuthContext` e `getCurrentWorkspaceId` fazem o mesmo com workspace: usam `.limit(1)` sem seleção determinística.

Isso não atende a premissa de que uma mesma conta/agência pode operar várias marcas.

### Entrega

1. Definir o modelo de contexto ativo: workspace e marca precisam ser escolhas explícitas e persistentes ou parte da rota.
2. Remover `NEXT_PUBLIC_BRANDVILLE_INSTANCE` do caminho normal de produção; manter somente migração temporária, se inevitável, com prazo de remoção.
3. Rejeitar contexto ambíguo: nunca escolher “a primeira linha” silenciosamente.
4. Criar seletor de marca na moldura, sem permitir que a marca invada os tokens da plataforma.
5. Todo acesso a documento, asset, IA, importação e relatório recebe `brand_id` resolvido no mesmo contexto de requisição.

### Aceite

- Uma pessoa em dois workspaces escolhe o workspace correto.
- Um workspace com quatro marcas troca de marca sem rebuild nem variável de ambiente.
- Sequência A → B → A no mesmo processo não vaza nome, tema, documentos, status, assets, IA ou relatório.
- Não há `.limit(1)` usado para decidir workspace/marca ativa.

## 5. Patch M2 — assets e relatórios por `brand_id`

**Severidade: P1. Fazer após M1.**

### Defeito

As APIs de assets ainda importam `brandvilleInstance`, gravam e consultam por `instance_key`. O relatório de análise também usa tema e nome globais e gera arquivo `brandville-*.pdf`.

Isso mistura marcas da mesma conta e mantém o nome anterior no artefato entregue ao cliente.

### Entrega

1. Migrar APIs e Storage de assets para `brand_id`; tornar `brand_assets.brand_id` obrigatório quando não houver mais dependência legada.
2. Caminho de Storage inclui workspace + brand + identificador imutável; nunca apenas `instance_key`.
3. Gerador de relatório recebe a marca resolvida da requisição, inclusive tema, nome, idioma e identidade `Brennimark`.
4. Remover toda importação de `brandville/config` das rotas de assets e relatório.

### Aceite

- Assets de duas marcas do mesmo workspace não aparecem, assinam URL nem podem ser apagados entre si.
- PDF exportado mostra a marca correta e tem nome de arquivo Brennimark, não Brandville.
- Guardas estruturais impedem `brandvilleInstance` nesses caminhos.

## 6. Patch A1 — IA com retrieval e limites de custo

**Severidade: P1. Fazer antes de liberar chat/análise para manuais grandes.**

### Defeito

O chat serializa todos os documentos no system prompt. A análise seleciona páginas com blocos visuais, mas PDFs importados começam sem blocos e caem para todos os documentos. Em um manual de 743/1.000 páginas isso estoura contexto, degrada a resposta e torna custo/latência imprevisíveis.

O AppShell também recebe todos os documentos no cliente para o Command Palette, o que aumenta muito o payload e a hidratação.

### Entrega

1. Criar retrieval por consulta, com índice de trechos, metadados (`brand_id`, documento, status, grupo) e orçamento máximo de caracteres/tokens.
2. Chat envia somente trechos recuperados e cita fontes reais.
3. Análise seleciona um conjunto pequeno de regras visuais/curadas; nunca usa o manual inteiro como fallback silencioso.
4. Busca do shell vira endpoint/índice leve e paginado; não enviar o manual completo à hidratação.
5. Validar tamanho e quantidade das mensagens de chat, tamanho de pergunta de análise e aplicar limite de taxa por usuário/workspace.
6. Conferir no servidor que a funcionalidade (`chat`, `analysis`) está habilitada para a marca, não apenas escondida na navegação.

### Aceite

- Prompt de chat e análise possui limite mensurável, independente de o manual ter 10 ou 1.000 páginas.
- Pergunta sobre conteúdo de uma marca retorna somente trechos/citações daquela marca.
- Sem trechos relevantes, a IA declara insuficiência de evidência.
- Payload de AppShell não cresce linearmente com o número de páginas do manual.
- Mensagem excessiva, pergunta excessiva e funcionalidade não contratada recebem erro controlado antes de chamar provedor.

## 7. Patch G1 — governança de IA e papéis

**Severidade: P1. Decisão de produto + correção de enforcement.**

### Conflito atual

`capabilitiesForRole` declara que `member` só pode `consultar`; políticas e rotas de `ai_settings`/`ai_routing_policies` permitem que qualquer membro leia, crie, altere e delete configurações de IA.

Há uma decisão necessária: BYOK é pessoal e editável por qualquer membro, ou é governança da marca e pertence a `owner`/`administrar`? A arquitetura e a interface precisam dizer a mesma coisa.

### Recomendação

Enquanto não existir papel granular, tratar configurações e roteamento como `owner`/`administrar`.

### Entrega e aceite

- Definir a política no ADR-0002.
- Implementar a mesma regra em RLS, API e interface.
- Testar owner permitido; member recusado tanto pela rota quanto pela Data API autenticada.
- Não usar apenas ocultação de link como controle de acesso.

## 8. Patch Q1 — qualidade de fluxo, navegação e resiliência

**Severidade: P2. Pode seguir os patches acima.**

1. A V2 só oferece “Visão geral” na seção Guia. Após importar centenas de páginas, a pessoa depende de URL, administração ou Command Palette. Criar navegação de documentos por grupos, com paginação/virtualização, estado ativo, anterior/próximo e busca.
2. Validar `next` de login, callback e onboarding: aceitar apenas caminhos internos iniciados por `/`, rejeitando `//`, esquemas e destinos externos.
3. Criar `error.tsx` e `not-found.tsx` de produto nas superfícies críticas para que erro de banco/rota não vire tela genérica do Next.
4. Tornar locale realmente por pessoa antes de prometer interface personalizada; hoje é só padrão do produto.
5. Ativar proteção contra senha vazada no Supabase Auth.

## 9. Patch V1 — remover herança visual Brandville/Hairline

**Severidade: P2, mas requisito estratégico de marca.**

Ainda existem 301 ocorrências de `release-analog-*` em 26 arquivos. Login, onboarding e tokens globais continuam nomeando “Call Me Analog Man”. Scripts e documentos ainda propõem um projeto exclusivo por cliente e `NEXT_PUBLIC_BRANDVILLE_INSTANCE`.

### Entrega

1. Remover aliases `release-analog-*` e tokens semânticos que apontam para eles.
2. Usar exclusivamente namespaces `platform-*` na interface e `brand-*` dentro do canvas.
3. Migrar login, onboarding, administração, chat, biblioteca, análise e estados de erro.
4. Arquivar/remover scripts de geração por cliente que contradizem o modelo hospedado multi-marca; atualizar documentação operacional.

### Aceite

- `rg 'release-analog|Call Me Analog Man|brandvilleInstance' src` não retorna uso de runtime fora de compatibilidade explicitamente temporária e testada.
- As quatro fixtures de marcas opostas preservam a moldura idêntica.
- Nenhum PDF, e-mail, título, download ou mensagem ao usuário exibe “Brandville”.

## 10. Testes e CI — condição para encerrar os patches

Cada patch deve ter commit isolado e incluir:

1. Teste que falha antes da correção, demonstrado uma vez e restaurado.
2. `npm run verify` verde.
3. Quando tocar banco: teste SQL com papel `authenticated`, migração aplicada em ambiente de integração e teste negativo de isolamento.
4. Quando tocar PDF: Chromium + WebKit + Firefox, com PDF real grande e casos de falha.
5. Quando tocar multi-marca: fixture de pelo menos quatro marcas opostas, em sequência no mesmo processo.

O CI precisa ganhar uma etapa Supabase local ou projeto de integração descartável para migrations, RLS, grants, Storage e RPC. O pipeline atual é útil para regressões de UI, mas não é prova de segurança nem de persistência.

## Ordem de execução recomendada

1. S0 — grants/RLS.
2. S1 — dependências vulneráveis.
3. I1 — PDF 100 MB / 1.000 páginas.
4. M1 — seleção explícita de workspace e marca.
5. M2 — assets e relatórios por marca.
6. A1 — retrieval, limites e entitlement de IA.
7. G1 — decisão e enforcement de papéis para IA.
8. Q1 — navegação/resiliência.
9. V1 — remoção total do legado visual e operacional.

## Fora de escopo deste briefing

- Redesenho estético da moldura já aprovada; preservar a V2 enquanto corrige o núcleo.
- Alterar dados reais manualmente ou criar conta em nome de alguém.
- Reescrever migrações históricas.
- Tratar a simples aprovação do CI como prova de autorização: a prova precisa exercer o banco sob o papel correto.
