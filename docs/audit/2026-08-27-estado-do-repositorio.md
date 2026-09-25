# Auditoria do estado atual — 27/08/2026

Verificação do briefing `docs/CLAUDE_CODE_PRODUCT_EVOLUTION_BRIEF.md` contra o código real.
Cada item traz caminho de arquivo e evidência. Nenhum código foi alterado para produzir este documento.

**Base auditada:** commit `76a915d`, branch `main`, 328 arquivos versionados.
**Estado da qualidade:** `npm run lint` limpo, `npx tsc --noEmit` limpo, 39 testes passando, `npm run build` OK.

---

## 1. Veredito por lacuna do briefing

| § | Lacuna afirmada | Veredito | Evidência |
| --- | --- | --- | --- |
| 5.1 | Migrations fundacionais ausentes | **Confirmada — crítica** | ver §2.1 |
| 5.1 | `.env.example` incompleto | **Confirmada** | ver §2.2 |
| 5.1 | Documentação de momentos diferentes | **Confirmada** | ver §2.3 |
| 5.1 | Apenas um commit no histórico | **Confirmada** | `git rev-list --count HEAD` = 1 |
| 5.2 | Papéis só `owner`/`member` | **Confirmada** | `src/lib/brennimark/server.ts:13,30` |
| 5.2 | Sem convites, remoção, transferência | **Confirmada** | zero arquivos em `src/app`/`src/components` |
| 5.2 | Sem troca/recuperação de senha | **Confirmada** | só `signInWithPassword` em `src/app/login/page.tsx:46` |
| 5.2 | `.limit(1)` escolhe o primeiro workspace | **Confirmada — 4 ocorrências** | ver §2.4 |
| 5.3 | Instância escolhida em build-time | **Confirmada** | `src/brennimark/config.ts:24` |
| 5.3 | Sem registro central de instalações | **Confirmada** | nenhuma tabela correspondente |
| 5.4 | Lifecycle limitado a 3 estados | **Confirmada — travada no banco** | ver §2.5 |
| 5.5 | Sem taxonomia de eventos / telemetria | **Confirmada** | nenhuma tabela de eventos nas migrations |
| 5.5 | Sem planos, entitlements, quotas | **Confirmada** | nenhuma estrutura correspondente |
| 5.6 | Histórico de chat não identificado | **Confirmada** | nenhuma rota de chat grava em tabela |
| 5.6 | Sem versão de conteúdo/prompt nas respostas | **Confirmada** | zero ocorrências de `prompt_version`/`release_id` |
| 5.7 | Sem rate limiting | **Confirmada** | zero ocorrências em `src/` |
| 4.3 | "Blocos já persistidos e renderizados" | **Correção necessária** | ver §3.1 |

**Conclusão:** o briefing está substancialmente correto. Nenhuma lacuna afirmada se mostrou falsa.
Três achados novos, não citados no briefing, aparecem em §3 — um deles mais grave que qualquer item da §5.7.

---

## 2. Evidências das lacunas confirmadas

### 2.1 Migrations fundacionais ausentes (crítico para WP0)

As migrations versionadas criam apenas cinco tabelas:

```
ai_routing_policies · analysis_runs · brand_assets · brand_documents · brand_document_versions
```

Mas quatro tabelas fundacionais são **usadas pelo código e referenciadas por chaves estrangeiras**,
sem nunca serem criadas por nenhuma migration versionada:

| Tabela | Consultas no código | Referenciada em |
| --- | ---: | --- |
| `workspaces` | — | FK em 3 migrations |
| `workspace_members` | 3 | policies RLS de todas as tabelas |
| `profiles` | 3 | trigger de versionamento |
| `ai_settings` | 7 | `ai_routing_policies` |

Exemplos literais:

- `supabase/migrations/20260721132847_add_ai_routing_policies.sql:5` — `references public.workspaces(id)`
- `supabase/migrations/20260721193403_add_brand_document_version_history.sql:6` — idem

**Consequência prática:** aplicar as migrations deste repositório num projeto Supabase novo **falha
na primeira migration**. Isso derruba diretamente o critério de aceite do WP0 — "um ambiente novo pode
ser criado apenas com repositório, variáveis documentadas e acessos legítimos".

**Correção ao enquadramento inicial (27/08, após acesso ao banco).** Eu havia escrito que as tabelas
foram "criadas manualmente, fora do controle de versão". Isso está errado. Elas foram criadas por três
migrations legítimas, registradas em `supabase_migrations.schema_migrations` com o SQL completo:

| Versão | Nome |
| --- | --- |
| `20260717180341` | `create_profiles_table` |
| `20260717202208` | `add_workspaces_and_ai_settings` |
| `20260717202237` | `lock_down_handle_new_profile_rpc` |

O problema real é mais estreito e mais fácil de resolver: **elas nunca foram commitadas no
repositório**. O SQL existia; a cópia versionada é que faltava. Foram recuperadas literalmente do
ledger de produção e commitadas — ver §2.1-bis.

A terceira delas contém uma proteção que minha reconstrução inicial teria perdido:
`revoke execute on function public.handle_new_profile() from public, anon, authenticated`. Se eu
tivesse escrito a baseline de memória, como propus antes, teria recriado o ambiente **sem essa
trava** — exatamente o tipo de divergência silenciosa que a correção contra `create table if not
exists` existia para evitar.

### 2.1-bis Divergência de timestamps entre repositório e produção

Quatro migrations que existiam no repositório estavam gravadas em produção com versões diferentes:

| Repositório (antes) | Produção | Migration |
| --- | --- | --- |
| `20260721173226` | `20260721173333` | `add_analysis_history` |
| `20260721174444` | `20260721174508` | `index_analysis_history_foreign_keys` |
| `20260721183442` | `20260721184318` | `add_brennimark_content_admin` |
| `20260721193403` | `20260721193521` | `add_brand_document_version_history` |

Com os timestamps desalinhados, `supabase db push` trataria cada uma como migration inédita e tentaria
reaplicá-la sobre objetos já existentes. Os arquivos foram renomeados para as versões de produção.

### 2.2 `.env.example` documenta 4 de 14 variáveis

Documentadas: `NEXT_PUBLIC_BRENNIMARK_INSTANCE`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AI_SETTINGS_ENCRYPTION_KEY`.

Lidas pelo código mas **não documentadas**: `GROQ_API_KEY`, `AI_CHAT_FALLBACK_PROVIDER`,
`AI_CHAT_FALLBACK_MODEL`, `AI_CHAT_FALLBACK_API_KEY`, `NEXT_PUBLIC_SKIP_AUTH`, `BRENNIMARK_BASE_URL`,
`BRENNIMARK_EVAL_CASES`, `BRENNIMARK_EVAL_LIMIT`, `BRENNIMARK_EVAL_REPORT`,
`BRENNIMARK_ALLOW_EXTERNAL_EVAL`.

O comentário do arquivo também está defasado: lista `the-bluesmaker | example` como instâncias
disponíveis, mas o registro tem quatro (`hairline` e `empresa-modelo` faltam).

### 2.3 Documentação divergente

`README.md` e `CLAUDE.md` estão modificados no working tree desde o último commit — ou seja, já há
divergência em curso. O `CLAUDE.md` descreve o repositório na perspectiva "app do The BluesMaker" e
não menciona a matriz multi-instância nem `NEXT_PUBLIC_BRENNIMARK_INSTANCE`; essa informação vive só
em `docs/BRENNIMARK_MATRIX.md`. O briefing pede tratar `Brennimark` como codinome, mas o nome está
consolidado em variáveis de ambiente, scripts npm, nomes de arquivo e no próprio nome do pacote
(`brennimark-scaffold` em `package.json`).

### 2.4 Seleção de workspace por `.limit(1)`

Quatro pontos independentes assumem que a pessoa pertence a exatamente um workspace:

- `src/lib/brennimark/server.ts:27`
- `src/lib/ai/settings.ts:38` e `:119`
- `src/lib/analysis/server.ts:29`

Sem ordenação explícita, o "primeiro" é indeterminado. Uma pessoa em duas organizações — exatamente
o cenário de uma agência com carteira — pode receber workspaces diferentes em requisições diferentes.

### 2.5 Lifecycle travado no banco, não só no código

`src/content/docs.ts:5` define `"ready" | "draft" | "pending"`, e o banco reforça:

- `supabase/migrations/20260721183442_add_brennimark_content_admin.sql:8` e `:29` — `check (status in ('ready','draft','pending'))`

Ampliar para `review | approved | deprecated | archived` (WP6) exige migration de constraint **e**
backfill, não só mudança de tipo em TypeScript.

---

## 3. Achados novos, ausentes do briefing

### 3.1 `NEXT_PUBLIC_SKIP_AUTH` abre o conteúdo estático do guide

`src/lib/supabase/middleware.ts:10` retorna cedo quando a variável é `"true"`, antes de qualquer
verificação de sessão, e `src/app/docs/layout.tsx:14` renderiza o guide a partir do registro estático
sem exigir login.

**Escopo real da exposição, verificado rota a rota:**

| Superfície | Sob `SKIP_AUTH` | Onde é imposta |
| --- | --- | --- |
| Conteúdo estático do guide (`activeDocsRegistry`) | **Exposto** | `src/app/docs/layout.tsx:14` |
| Overrides de conteúdo do Supabase | Não expostos — cai na matriz versionada | `getResolvedBrandDocs` recebe contexto nulo |
| `/docs/admin` e `/api/admin/*` | **Protegidos** — 403 | `ownerContext()` recebe `null` |
| Histórico de análises | **Protegido** — 403 | `if (!context)` em `api/analysis/history` |
| Assets privados com URL assinada | **Protegidos** — 403 | `if (!context)` em `api/admin/assets` |
| Catálogo de logos do Hairline em `/api/assets` | **Exposto** | bypass explícito, `src/app/api/assets/route.ts:9` |

Ou seja: `SKIP_AUTH` **não** é um bypass total. Admin, histórico e assets privados mantêm verificação
própria porque `getBrennimarkAuthContext()` devolve `null` e todas essas rotas tratam `null` como
não autorizado (`src/lib/brennimark/server.ts:17`).

**Verificação do bundle cliente — resultado negativo.** Build com a variável ligada e busca em
`.next/static/`: **zero ocorrências**; 12 no bundle de servidor. O prefixo `NEXT_PUBLIC_` só provoca
inlining onde o valor é referenciado em código de cliente, e os seis pontos de leitura são todos
server-side. **A flag não vaza para o navegador hoje.**

O risco que permanece, e que justifica a mudança do PR-02:

1. Uma instalação com a flag ligada serve o brand book inteiro — a propriedade intelectual central do
   produto — a qualquer visitante.
2. O prefixo `NEXT_PUBLIC_` é uma armadilha latente: basta uma futura referência em Client Component
   para o valor passar a ser embutido no bundle, sem que nada avise.
3. Não existe trava impedindo a coexistência com `NODE_ENV=production`.

### 3.1-bis `public/` é servido sem autenticação, sempre

Independente de `SKIP_AUTH`, o matcher em `src/proxy.ts` **exclui explicitamente** do middleware
todas as extensões de imagem e três diretórios inteiros:

```
"/((?!_next/static|_next/image|favicon.ico|artwork|images|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
```

Consequência: os **185 arquivos** em `public/` são acessíveis por URL direta por qualquer pessoa, em
qualquer instalação, com ou sem login. Inventário:

| Caminho | Arquivos | Natureza |
| --- | ---: | --- |
| `public/brand/hairline/` | 54 | logos e páginas extraídas do brand book do cliente |
| `public/icons/set/` | 100 | iconografia |
| `public/images/`, `public/artwork/`, `public/logo/` | 19 | fotografia, capa e wordmarks do BluesMaker |
| `public/brand/` (demais) | 12 | mockups, peças, grafismos |

Isso é comportamento normal de `public/` no Next.js, não um defeito de implementação — mas contradiz
a expectativa de que o material visual de uma marca esteja protegido por login. Referências visuais
citadas nos blocos `gallery` vivem todas aí. Qualquer decisão sobre confidencialidade de assets
precisa partir deste fato, não da suposição de que a autenticação cobre o material da marca.

### 3.2 A allowlist de MIME types é efetivamente aberta

`src/app/api/admin/assets/route.ts:7` inclui `application/octet-stream` na lista de tipos
permitidos, e `:19` usa `file.type || "application/octet-stream"` como fallback. Qualquer arquivo
cujo navegador não declare o tipo — ou que declare vazio — passa. A validação é por tipo declarado
pelo cliente, sem inspeção de conteúdo (magic bytes). O briefing menciona o risco em §5.7 de forma
genérica; na prática a allowlist não filtra.

### 3.3 Lógica específica de instância dentro do core

`src/app/api/assets/route.ts:9` condiciona um caminho de autenticação a
`brennimarkInstance.key === "hairline"`. Isso é exatamente o que a regra §2.4 do briefing proíbe:
necessidade de uma instância virando regra do produto. O mesmo padrão existe em
`src/app/docs/[...slug]/page.tsx` para os componentes bespoke do Hairline.

### 3.4 Correção ao §4.3 do briefing: os blocos ainda não estão persistidos

O briefing afirma que blocos estruturados já estão "persistidos e renderizados". Precisão:

- **Renderizados:** sim, `src/components/docs/blocks/` está completo e em uso.
- **Persistidos:** não. A migration `20260819000000_add_brand_document_blocks.sql` existe no
  repositório mas **não foi aplicada a nenhum projeto Supabase**.

E há um risco de ordem de deploy: `src/lib/brennimark/server.ts:57` já inclui `blocks` no `select`.
Publicar esse código contra um banco sem a coluna faz o PostgREST devolver erro e
`getResolvedBrandDocs` lançar exceção — derrubando `/docs` para usuários autenticados. **A migration
precisa ser aplicada antes do próximo deploy**, ou o `select` precisa virar tolerante.

### 3.5 O que está melhor do que o briefing sugere

Em favor do código: `brand_document_versions` tem uma única policy (só `select`) por decisão de
projeto, não por descuido — a inserção acontece via trigger `SECURITY DEFINER` com `search_path`
vazio e `revoke all` de `anon`/`authenticated`
(`supabase/migrations/20260721193403_add_brand_document_version_history.sql:117`). É um histórico
append-only bem construído, e serve de modelo para as tabelas de evento do WP2.

---

## 4. Mapa de domínio

### 4.1 Entidades e ownership

```text
auth.users ──1:1── profiles
     │
     └──N:M── workspace_members ──N:1── workspaces        [FUNDACIONAIS: sem migration]
                    (role: owner | member)
                            │
   ┌────────────────────────┼─────────────────────────────┐
   │                        │                             │
brand_documents      analysis_runs                  ai_settings
(+ blocks jsonb)     (self-FK: parent_run_id)       (chave AES-256-GCM)
   │                        │                             │
brand_document_versions  bucket privado             ai_routing_policies
(append-only, trigger)   de evidências              (primary/fallback)

brand_assets ── bucket privado com URLs assinadas
```

Toda tabela operacional carrega `workspace_id` **e** `instance_key`, mas os dois têm papéis
diferentes e **não formam, juntos, uma barreira completa de isolamento**:

- **`workspace_id` é o que a RLS impõe.** Todas as policies verificadas derivam de
  `workspace_members`. É esta a fronteira efetivamente aplicada pelo banco.
- **`instance_key` é discriminador de conteúdo, não controle de acesso.** Nenhuma policy o utiliza.
  Ele separa o brand book de instâncias diferentes dentro do mesmo workspace; não impede leitura
  cruzada por si só.
- **O isolamento forte entre marcas vem do fato de cada instalação ter seu próprio projeto Supabase**
  — bancos, buckets, usuários e chaves distintos. É uma propriedade de infraestrutura, não de
  esquema. É essa separação, e não o par de colunas, que sustenta a garantia oferecida aos clientes.

### 4.2 Trust boundaries

| Fronteira | Onde é imposta | Estado |
| --- | --- | --- |
| Navegador → app | `src/lib/supabase/middleware.ts` | Conteúdo estático do guide contornável por env var (§3.1) |
| App → banco | RLS por `workspace_members` | Sólido nas 5 tabelas versionadas; `instance_key` não participa |
| Papel owner vs member | `ownerContext()` nas rotas admin | Servidor, correto |
| Instalação A → instalação B | **Projeto Supabase separado** (não RLS) | Sólido, mas por infraestrutura |
| Chave BYOK → cliente | Só `api_key_last4` sai da API | Sólido |
| Escrita de auditoria | Trigger `SECURITY DEFINER` | Sólido |
| Arquivos em `public/` | **Nenhuma** — excluídos do matcher | Público por desenho (§3.1-bis) |
| Upload → storage | Allowlist de MIME | **Efetivamente aberta** (§3.2) |
| Consumo de IA → custo | — | **Inexistente** |

### 4.3 Fluxo de dados da IA

```text
pergunta → getResolvedBrandDocs (matriz + override do Supabase)
         → buildBrandContext (inclui status editorial e agora os blocos)
         → resolveConfig(role) → getModel() → provider
         → streaming com fallback por timeout de primeiro chunk
         → citações validadas contra as fontes documentadas
```

Nenhuma etapa registra tokens, custo, latência ou a versão do conteúdo usado. É o buraco central
do WP2 e a razão de a margem por marca ser hoje inestimável a partir do produto.

---

## 5. Matriz de riscos

| # | Risco | Prob. | Impacto | Mitigação | Pacote |
| --- | --- | --- | --- | --- | --- |
| R1 | `SKIP_AUTH` em produção expõe o conteúdo estático do guide; **e os 185 arquivos de `public/` já são públicos sempre**, por exclusão no matcher de `src/proxy.ts` | Média | Alto | Flag server-only + proibição em produção; inventário e decisão explícita sobre o que pode viver em `public/` versus bucket privado | WP0 |
| R2 | Ambiente novo não sobe: migrations fundacionais ausentes | **Alta** | Alto | Recuperar e versionar as 4 tabelas de forma idempotente | WP0 |
| R3 | Deploy do `select blocks` contra banco sem a coluna derruba `/docs` | **Alta** | Alto | Aplicar a migration antes do deploy, e ordem documentada no runbook | WP0 |
| R4 | Upload de arquivo arbitrário via `octet-stream` | Média | Alto | Validar magic bytes; remover o curinga; forçar `Content-Disposition: attachment` | WP0 |
| R5 | Pessoa em duas organizações recebe workspace indeterminado | Média | Alto | Seleção explícita de workspace; remover `.limit(1)` sem ordenação | WP1 |
| R6 | Custo de IA sem teto por instalação | Média | Alto | Ledger de uso + quota por plano | WP2 |
| R7 | Sem rate limit, uma marca consome a chave da plataforma | Média | Médio | Rate limit por workspace nas rotas de IA e upload | WP2 |
| R8 | Studio acumula dados das instalações e destrói o isolamento vendido | Média | **Crítico** | ADR-0001 restringe o control plane a metadados e agregados | WP4 |
| R9 | Lock-in de provedor de IA | Baixa | Médio | `provider.ts` já abstrai; manter a regra | — |
| R10 | Lógica de instância vazando para o core | **Alta** | Médio | Extrair para configuração; proibir novos `key === "..."` | WP0 |
| R11 | Uma pessoa só sabe operar o sistema | **Alta** | Alto | Runbook executado por terceiro | WP0 |
| R12 | Ampliar o lifecycle exige migration + backfill | Alta | Médio | Planejar constraint migrável desde já | WP6 |
| R13 | Instalação ociosa no plano gratuito pausa sozinha; a primeira visita bate num banco frio que devolve schema vazio | Média | Médio | Plano pago em produção; tratar o estado de boot no app | WP0 (runbook) + WP2 (custo) |

### Nota sobre R13 — cold start por instalação

Observado em 27/08/2026: o projeto `the-bluesmaker-brennimark` estava `INACTIVE` apesar do keepalive
diário em vigor, e a restauração levou **cerca de 7 minutos** até o banco responder com dados. Durante
a janela de `COMING_UP` o Postgres **aceita conexão mas devolve o schema vazio** — o app não recebe um
erro claro, recebe "não há nada aqui".

**Contexto:** a pausa é comportamento do plano gratuito, e as instalações reais serão pagas. Isso
reduz o risco, mas não o elimina, por três motivos: os ambientes de demonstração e de piloto tendem a
ficar no plano gratuito justamente por serem baratos; a diferença de custo entra na margem por marca
que o WP2 precisa instrumentar; e o comportamento de schema vazio durante o boot vale ser tratado de
qualquer forma, porque também aparece em restauração de backup.

Isso deixa de ser detalhe de infraestrutura no momento em que o ADR-0001 é adotado: cada marca vira um
projeto que pausa por conta própria quando fica ocioso. Uma agência que apresenta o brand book a um
cliente depois de duas semanas sem acesso encontra minutos de espera — ou, pior, uma tela que parece
vazia em vez de carregando.

Três frentes, nenhuma resolvida ainda:

1. **Detecção** — o app precisa distinguir "banco acordando" de "banco sem conteúdo" e comunicar isso.
   Hoje `getResolvedBrandDocs` cairia silenciosamente na matriz versionada, que é o comportamento certo
   para o guide, mas mascara o problema em admin, histórico e análises.
2. **Prevenção** — o keepalive atual não impediu a pausa. O método precisa ser revisto antes de virar
   dependência operacional de N instalações.
3. **Economia** — evitar a pausa em plano pago muda o custo por marca, e portanto a margem que o WP2
   deve instrumentar. É insumo direto para os gatilhos de revisão do ADR-0001.

---

## 6. Decisões humanas necessárias

Além da lista da §24 do briefing, a auditoria acrescenta quatro decisões que bloqueiam trabalho técnico:

| # | Decisão | Por que bloqueia | Bloqueia |
| --- | --- | --- | --- |
| D1 | As tabelas fundacionais existentes em produção podem ser descritas exatamente? | Sem o DDL real, a migration de recuperação vira adivinhação e pode divergir do que está rodando | WP0 |
| D2 | `Brennimark` permanece como identificador técnico interno? | Renomear variáveis, scripts e o pacote é caro; manter é aceitável se ninguém confundir com nome comercial | WP0 |
| D3 | O ambiente de demonstração continua usando `SKIP_AUTH`? | Se sim, precisa de mecanismo seguro e explícito em vez da flag atual | WP0 |
| D4 | Papéis definitivos: quantos e com quais permissões? | A matriz de permissões e as policies RLS derivam disso | WP1 |
| D5 | Ligar a proteção contra senhas vazadas (HaveIBeenPwned) no Supabase Auth? | Único apontamento dos advisors de segurança; é configuração de projeto, não schema | WP1 |

As decisões comerciais da §24 do briefing — preço, gateway, limites de plano, white label, SLAs,
residência de dados, uso de dados para treino — permanecem em aberto e **não foram presumidas** em
nenhum lugar deste documento.

---

## 7. Planos de banco, telemetria e testes

O escopo destes três planos depende de D1 e D4 acima. O que já é decidível:

**Banco (WP0):** **não** reconciliar com `create table if not exists`. Duas razões: isso mascararia
divergências entre ambientes em vez de revelá-las, e o PostgreSQL **não suporta**
`create policy if not exists` — a construção que eu havia proposto simplesmente não existe.

A sequência correta tem quatro etapas, nesta ordem:

1. **Coletar snapshots de esquema de todos os ambientes** (D1) — colunas, constraints, índices,
   policies, triggers e grants das quatro tabelas fundacionais.
2. **Comparar os snapshots entre si.** Ambientes provisionados manualmente em momentos diferentes
   quase sempre divergem. O diff é o insumo, não um detalhe.
3. **Definir a baseline canônica** a partir da comparação, e reparar o histórico de migrations para
   que a baseline seja a primeira migration da série.
4. **Escrever migrations de drift explícitas** para cada ambiente que divirja da baseline, com o
   `alter` nomeado e reversível. Nada silencioso.

Nenhum backfill de dados é previsto: as tabelas já têm conteúdo e as etapas acima só tocam esquema.

**Rollback da coluna `blocks`:** não usar `drop column`. Uma vez publicada, a coluna pode conter
conteúdo editorial que não existe em nenhum outro lugar. A reversão correta é **voltar o código** —
remover `blocks` do `select` e do render — **preservando coluna e dados**. Isso respeita a regra §2.9
do briefing (não apagar dados existentes silenciosamente).

**Telemetria (WP2):** a taxonomia de eventos da §10.2 do briefing pode ser modelada agora, mas
persistir custo exige decidir a tabela de preços versionada (§19). Recomendação: uma tabela
append-only `product_events` no mesmo padrão de `brand_document_versions` — inserção por trigger ou
função `SECURITY DEFINER`, leitura por RLS de workspace, sem `update`/`delete`.

**Testes (WP0 + WP1):** a suíte atual tem 9 arquivos e cobre bem a camada de IA e o gerador. Não há
**nenhum** teste de autorização, RLS ou E2E — confirmado por varredura. O WP0 adiciona apenas o que
comprova o próprio WP0: um teste que roda as migrations num banco limpo e um teste autenticado do
CRUD de BYOK. A matriz de testes por papel pertence ao WP1, depois de D4.

O teste de banco limpo precisa de uma **stack Supabase local completa** (`supabase start`), não de um
PostgreSQL genérico: as migrations referenciam `auth.users` em chaves estrangeiras e o produto depende
do schema `storage` para os buckets privados. Um Postgres puro falha na primeira FK e daria um falso
negativo que atrasaria o diagnóstico.
