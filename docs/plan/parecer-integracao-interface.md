# Parecer sobre o briefing de integração e implantação da interface

**Data:** 29/08/2026 · **Sobre:** `docs/referencias/briefing-integracao-interface-2026-08-29.md`
**Baseline verificado:** `a966323 — Migração 1, PR 2: a leitura vem do banco`

Resposta ao que a seção 14 do briefing pede antes de qualquer código.

---

## 1. Confirmação do diagnóstico

Verifiquei os sete bloqueadores no código. **Todos confirmados.** Números medidos hoje:

| Alegação do briefing | Medido |
|---|---|
| `release-analog` — 340 ocorrências, 26 arquivos | **345 em 28 arquivos** |
| `font-display` — 136 ocorrências | **136** |
| `/docs` decide por `hasBrand` estático | confirmado, `src/app/docs/page.tsx:6` |
| `/docs` monta `DocsNav` | confirmado, `src/app/docs/layout.tsx:36` |
| Administração grava por `workspace_id + instance_key` | confirmado, `route.ts:44` |
| V2 sem mobile | confirmado — `AppShellV2` renderiza `DesktopSidebar` incondicionalmente |
| Idioma acoplado ao manual | **35 ocorrências** de `metadata.language` |
| `brennimarkInstance` importado direto | **127 ocorrências em 39 arquivos** |

As duas divergências numéricas são para mais, não para menos.

### Três coisas que o briefing não viu, e que são piores

**1.1 — A administração não está desalinhada; está morta.**

`activeDocsRegistry` é `[...brennimarkInstance.docs]`, e a instância resolvida é
`unconfigured`, cujo `docs` é `[]`. Consequência hoje, em produção:

- `PUT /api/admin/content` procura `base` no registro vazio → **400 sempre**. Ninguém
  consegue editar página nenhuma.
- `DELETE` valida o slug contra o registro vazio → **400 sempre**.
- `brennimarkUtilityLinks` também sai do registro vazio → a seção "Inteligência" da
  navegação V2 **não tem destino nenhum**.

O briefing trata isso como incoerência de modelo. É indisponibilidade. A correção é a
mesma, mas a urgência é outra: não há caminho de escrita funcionando.

**1.2 — "Restaurar" virou destruição pura.**

O `DELETE` significava "apagar a sobreposição e voltar à matriz em código". Sem matriz,
apagar a linha **não restaura nada** — elimina o conteúdo. O gatilho de versionamento
ainda grava a ação com o nome `restored_to_matrix`, e esse nome está preso em um
`check` no banco. Trocar o vocabulário exige migração, não só código.

**1.3 — `.env.example` derruba um clone novo.**

`NEXT_PUBLIC_BRENNIMARK_INSTANCE=the-bluesmaker`, e `generatedBrennimarkInstances` está
vazio. `resolveBrennimarkInstance` **lança exceção** para chave desconhecida. Quem clonar
o repositório e seguir o exemplo não sobe a aplicação. Correção de uma linha, mas é a
primeira coisa que um desenvolvedor novo encontra.

---

## 2. Mapa dos arquivos e esquemas afetados

### Código

| Camada | Arquivos | Natureza |
|---|---|---|
| Resolução da marca | `src/lib/brennimark/server.ts`, `src/brennimark/config.ts`, `src/app/docs/page.tsx`, `src/app/docs/layout.tsx`, `src/app/docs/[...slug]/page.tsx` | reescrita do contrato |
| Escrita e histórico | `src/app/api/admin/content/route.ts`, `.../history/route.ts`, `src/app/docs/admin/page.tsx` | reescrita da chave |
| Fronteiras visuais | `BrandCanvas.tsx`, `WorkspaceIdentity.tsx`, `AppShellV2.tsx`, `app/layout.tsx` | props em vez de import |
| Locale | 35 pontos em 30 arquivos | substituição mecânica |
| Herança visual | 28 arquivos com `release-analog`, `globals.css`, `platform/tokens.ts` | migração em massa |
| Mobile | `AppShellV2.tsx`, `DesktopSidebar.tsx`, `PlatformTopBar.tsx`, `navigation.ts` | composição nova |
| Guarda | `src/platform/leak-guard.test.ts` | inversão: varrer em vez de listar |

### Esquema

`brand_documents` tem `unique (workspace_id, instance_key, slug)` e
`brand_documents_workspace_instance_idx`. `brand_document_versions` tem `instance_key`
`not null`, índice de linha do tempo por ele, e o gatilho
`private.capture_brand_document_version` grava `instance_key` no corpo. **Quatro objetos
de banco, não um.** `brand_id` já existe em `brand_documents`, nulo.

---

## 3. Riscos de dados e migração

| # | Risco | Gravidade | Mitigação |
|---|---|---|---|
| 1 | Trocar a chave única de `instance_key` para `brand_id` invalida o `onConflict` do upsert. Um upsert com conflito errado **insere duplicata** em vez de atualizar | alta | migração aditiva: criar a nova unique antes, só depois trocar o código, e remover a antiga em migração própria |
| 2 | `updated_by` é `not null references auth.users`. Qualquer criação de conteúdo exige usuário real | média | é regra correta do produto; significa que a verificação ponta a ponta precisa de login de verdade |
| 3 | `restored_to_matrix` no `check` do enum de ação | média | migração para ampliar o `check` antes de emitir o novo valor; jamais reescrever linhas históricas |
| 4 | Instantâneos antigos em `brand_document_versions` não têm `blocks` nem `brand_id` | baixa | restauração precisa tolerar chave ausente — hoje o código não é testado nisso |
| 5 | Backfill de `brand_id` nas linhas existentes | **nulo hoje** | o banco tem zero marcas e zero documentos. É a janela mais barata que este projeto vai ter para mudar esse esquema |

O risco 5 merece destaque: **hoje não há dado para perder.** Toda a reestruturação de
chave que seria arriscada em produção é, agora, gratuita. Se ela for adiada até depois do
primeiro manual real, deixa de ser.

---

## 4. Sequência proposta

Aceito a sequência do briefing com **três alterações**, todas por dependência real.

| Ordem | Patch | Mudança em relação ao briefing |
|---|---|---|
| 0 | **Esquema primeiro**: unique por `brand_id`, `check` da ação ampliado, `.env.example` corrigido | **novo.** Fazer com o banco vazio, antes de qualquer código depender disso |
| 1 | Fonte única da marca ativa (request-scoped) | como no briefing |
| 2 | Escrita, histórico e autorização por `brand_id` | como no briefing, agora sobre o esquema do patch 0 |
| 3 | Locale da interface | **antecipado** — 35 pontos que os patches 4 e 5 tocariam de novo |
| 4 | V2 mobile e paridade | como no briefing |
| 5 | Promoção da V2 para `/docs` | como no briefing |
| 6 | Remoção da herança visual + guarda global | como no briefing |

Por que o patch 0 existe: mudar chave única de tabela com dado dentro é migração
delicada; sem dado é uma linha. Fazer isso dentro do patch 2, junto com reescrita de
código, mistura duas classes de risco no mesmo commit.

Por que o locale sobe: ele atravessa `navigation.ts`, `PlatformTopBar` e `CommandPalette`
— exatamente os arquivos do patch 4. Fazer depois é editar tudo duas vezes.

---

## 5. Conflitos reais entre o briefing e o código

### 5.1 — Quatro dos catorze testes exigidos não têm onde rodar

Os testes 10, 11, 12 e 14 do briefing — overflow horizontal em cinco viewports, ausência
da sidebar no mobile, foco preso no drawer, e as quatro fixtures visuais — precisam de
**navegador**. O projeto roda `node --test` sobre TypeScript compilado. Não há DOM, não há
Playwright, não há runner de componente.

São dois caminhos, e a escolha é sua:

- **adicionar Playwright** — cobertura real, executável no CI, e uma dependência nova de
  peso com tempo de execução próprio;
- **verificar manualmente** com evidência em imagem a cada patch, e registrar a dívida.

Recomendo Playwright, porque "sem overflow horizontal" é exatamente o tipo de regressão
que volta em silêncio na terceira semana. Mas é decisão de ferramenta com custo
permanente, e o briefing a pressupõe sem nomear.

### 5.2 — Um critério de aceite pertence a outra migração

"Trocar de marca não exige rebuild" (§13) depende de a marca ativa deixar de vir de
`NEXT_PUBLIC_BRENNIMARK_INSTANCE`. Isso é a migração 2 do plano existente — 45 arquivos,
127 ocorrências. O briefing a absorve sem dizer, e ela é maior que qualquer patch listado.

Proposta: o patch 1 entrega a **resolução por requisição** com a variável de ambiente
ainda como filtro opcional; a troca de marca sem rebuild vira o patch 7, com seletor de
marca de verdade. Assim o critério é cumprido, mas não escondido dentro de outro.

### 5.3 — A fixture azul clara e o sinal do Brennimark

O briefing pede a fixture azul institucional porque ela "expõe colisões com qualquer sinal
azul que venha a ser considerado". Hoje o sinal do Brennimark é **acromático por decisão**
(`#f4f5f7`) — a colisão não existe ainda. A fixture continua valendo, mas como proteção
para quando a identidade definitiva chegar, não como teste de um defeito atual.

---

## 6. O que eu não vou fazer

Conforme §3.4: nenhum logotipo, símbolo, tipografia proprietária, cor definitiva ou
grafismo. Os tokens provisórios em `src/platform/identity.ts` continuam sendo o único
lugar onde a identidade mora, e a arquitetura mantém a troca em um ponto só.
