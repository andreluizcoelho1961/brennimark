# WP0 — Baseline reproduzível: plano incremental

**Objetivo (briefing §15):** qualquer segunda pessoa técnica consegue subir, testar e operar o produto.

**Princípio de execução:** cada PR é pequeno, reversível e mergeável sozinho. Nenhum PR depende de
uma decisão comercial da §24 do briefing. Os PRs marcados **[bloqueado]** aguardam uma decisão
humana identificada na auditoria §6.

**Ordem:** PR-01 a PR-03 primeiro — são os que fecham riscos ativos. Depois os demais.

---

## Sequência

| PR | Título | Risco que fecha | Tamanho | Estado |
| --- | --- | --- | --- | --- |
| 01 | Aplicar a migration de blocos e proteger a ordem de deploy | R3 | P | **aplicado** |
| 02 | Flag de auth server-only e proibida em produção | R1 | P | **feito** |
| 03 | Fechar a allowlist de upload | R4 | M | **feito** |
| 04 | Recuperar o histórico de migrations de produção | R2 | M | **feito** |
| 04b | Migrations de drift (grants, policies, search_path) | C, D, E | M | **aplicado** |
| 05 | Completar `.env.example` e documentar o bootstrap | R11 | P | pronto |
| 06 | Runbook de deploy, rollback, backup e restore | R11 | M | pronto |
| 07 | Verificação autenticada do BYOK | — | M | pronto |
| 08 | Extrair a lógica específica de instância do core | R10 | M | pronto |
| 09 | Reconciliar a documentação | — | M | **[parcial: D2]** |
| 10 | Teste de stack Supabase local em CI | R2, R11 | M | depende de 04 |

---

## PR-01 — Aplicar a migration de blocos e proteger a ordem de deploy

**Por quê:** `src/lib/brandville/server.ts:57` já pede a coluna `blocks` no `select`. Publicar contra
um banco sem ela derruba `/docs` para todo usuário autenticado. É o único risco ativo com deploy
pendente.

**Fazer:** aplicar `20260819000000_add_brand_document_blocks.sql` em todos os projetos Supabase
existentes **antes** de qualquer deploy deste código. Registrar a ordem obrigatória no runbook (PR-06).

**Alternativa se a aplicação imediata não for possível:** tornar o `select` tolerante — tentar com
`blocks`, e em caso de erro repetir sem. Feio, mas remove a janela de quebra.

**Aceite:** a coluna existe em todos os projetos; `/docs` responde autenticado; um snapshot novo em
`brand_document_versions` contém a chave `blocks`.

**Rollback:** **não** derrubar a coluna. Uma vez publicada, ela pode conter conteúdo editorial que
não existe em nenhum outro lugar, e `drop column` violaria a regra §2.9 do briefing. A reversão é
**voltar o código** — remover `blocks` do `select` em `src/lib/brandville/server.ts:57` e do render —
**preservando coluna e dados**. A coluna é aditiva e inerte para código que a ignora, então mantê-la
não custa nada.

---

## PR-02 — Flag de autenticação server-only e proibida em produção

**Por quê:** auditoria §3.1. O escopo da exposição é o conteúdo estático do guide — admin, histórico
e assets privados continuam protegidos, e a verificação de build mostrou que a flag **não** chega ao
bundle cliente hoje. Ainda assim, uma instalação com ela ligada serve o brand book inteiro a
qualquer visitante, e o prefixo `NEXT_PUBLIC_` é uma armadilha latente para quem editar o código depois.

**Não está bloqueado.** A direção para apresentações comerciais é **instalação demo sanitizada com
autenticação real** — conteúdo de demonstração, usuário de demonstração, login de verdade — e não
uma flag que desliga a verificação. Isso remove a dependência de decisão comercial.

**Fazer:**
1. Renomear `NEXT_PUBLIC_SKIP_AUTH` para `BRANDVILLE_DEV_SKIP_AUTH` (sem `NEXT_PUBLIC_`), ajustando
   os seis pontos de leitura. Todos são server-side, então a remoção do prefixo é segura — mas
   confirmar com um build antes e depois.
2. Em `next.config.ts`, falhar o build quando a flag estiver ligada com `NODE_ENV=production`.
   Falha barulhenta é melhor que produto aberto.
3. Documentar em `.env.example` que é exclusiva de desenvolvimento local, e que demonstrações usam
   instalação sanitizada com autenticação real.
4. Remover o bypass de instância em `src/app/api/assets/route.ts:9`, que hoje serve o catálogo de
   logos do Hairline sem autenticação. Isso se sobrepõe ao PR-08.

**Aceite:** build de produção com a flag ligada falha com mensagem clara; `grep -r NEXT_PUBLIC_SKIP_AUTH src/`
não retorna nada; `.next/static/` continua sem qualquer ocorrência da flag; o modo de desenvolvimento
local segue funcionando.

**Fora de escopo, mas registrado:** a flag não é o único caminho de exposição. Os 185 arquivos em
`public/` são servidos sem autenticação sempre, por exclusão explícita no matcher de `src/proxy.ts`
(auditoria §3.1-bis). Decidir o que pode viver em `public/` versus bucket privado é uma decisão de
produto que este PR não toma — apenas documenta.

## PR-03 — Fechar a allowlist de upload

**Por quê:** auditoria §3.2. `application/octet-stream` na lista + fallback para o mesmo valor tornam
a validação inócua.

**Fazer:**
1. Remover `application/octet-stream` de `ALLOWED_TYPES`
   (`src/app/api/admin/assets/route.ts:7`) e rejeitar arquivo sem tipo declarado.
2. Validar magic bytes dos primeiros bytes do arquivo, comparando com o tipo declarado.
3. Forçar `Content-Disposition: attachment` nos downloads assinados, para nada ser renderizado
   inline no domínio da marca.
4. Reavaliar `image/svg+xml`: SVG é executável no navegador. Ou sanear, ou servir só como download.

**Cuidado:** verificar se algum asset já existente em produção usa `octet-stream` — se sim, o
endurecimento não pode quebrar o download do que já está lá.

**Aceite:** upload de `.html` renomeado para `.png` é rejeitado; assets existentes continuam
baixáveis; teste automatizado para os dois casos.

---

## PR-04 — Recuperar o histórico de migrations (feito)

**O diagnóstico inicial estava errado no mecanismo, certo no efeito.** As quatro tabelas fundacionais
não foram criadas manualmente: existem três migrations legítimas em
`supabase_migrations.schema_migrations`, com o SQL completo preservado. O que faltava era a **cópia
versionada no repositório**.

Isso invalidou a abordagem de "escrever uma baseline canônica". Reconstruir de memória teria perdido
`revoke execute on function public.handle_new_profile() from public, anon, authenticated`, presente na
terceira migration — um ambiente novo nasceria sem essa trava. A reconstrução foi descartada e
substituída pela recuperação literal.

**Feito:**

1. Três migrations recuperadas verbatim do ledger de produção e commitadas:
   `20260717180341_create_profiles_table`, `20260717202208_add_workspaces_and_ai_settings`,
   `20260717202237_lock_down_handle_new_profile_rpc`.
2. Quatro arquivos renomeados para as versões que produção registrou (a divergência faria
   `supabase db push` reaplicá-los sobre objetos existentes) — ver auditoria §2.1-bis.
3. Série do repositório conferida contra o ledger: **as 14 versões batem exatamente**.

**Descoberta que muda o WP1:** `handle_new_profile()` cria um workspace novo e torna a pessoa `owner`
dele a cada perfil inserido. É a origem do modelo implícito "uma pessoa, um workspace" — o `.limit(1)`
da lacuna 5.2 é consequência, não causa. Seleção explícita de organização exige alterar este trigger,
não apenas as consultas.

**Pendente:** comparar o conteúdo dos quatro arquivos renomeados com o SQL gravado em produção. As
versões batem; o texto ainda não foi conferido byte a byte. Fica para o PR-10, que passa a série
inteira numa stack limpa.

---

## PR-04b — Migrations de drift (aplicado)

Três divergências corrigidas e aplicadas em produção, cada uma como migration própria:

| Migration | O que mudou | Verificado |
| --- | --- | --- |
| `20260827215129_drift_restrict_foundational_grants` | `anon` perdeu **todos** os privilégios; `authenticated` ficou com o mínimo por tabela | `anon` sem nenhum grant; `authenticated` com 9 privilégios exatos |
| `20260827215145_drift_policies_target_authenticated` | 9 policies recriadas com `to authenticated` e `(select auth.uid())` | nenhuma policy restante alvejando `public` |
| `20260827215159_drift_handle_new_profile_empty_search_path` | `search_path` da função `SECURITY DEFINER` passou a `''` | `proconfig = search_path=""` |

O `TRUNCATE` concedido a `anon` era o item mais relevante, porque **não é filtrado por RLS** — a
proteção efetiva era o PostgREST não expor a operação. Agora não há privilégio a explorar.

Grants concedidos a `authenticated`, e por quê: `profiles` select/insert/update (o upsert do
onboarding precisa dos dois últimos); `workspaces` e `workspace_members` apenas select (a criação
acontece dentro do trigger `SECURITY DEFINER`, que roda como owner); `ai_settings` CRUD completo (BYOK).

**Advisors de segurança do Supabase após as mudanças:** um único aviso, `auth_leaked_password_protection`,
que é configuração de projeto e não de schema. Virou a decisão D5.

**Rollback:** cada migration é reversível isoladamente. A reversão dos grants é reconceder o padrão
(`grant all ... to anon, authenticated`), mas não há motivo conhecido para isso.

## PR-05 — Completar `.env.example` e documentar o bootstrap

**Fazer:** documentar as 10 variáveis ausentes (auditoria §2.2), agrupadas por finalidade
(Supabase, IA, avaliação, desenvolvimento), com comentário sobre obrigatoriedade e **sem valores
reais**. Corrigir a lista defasada de instâncias. Escrever `docs/BOOTSTRAP.md` com o caminho do zero
até a aplicação rodando: pré-requisitos, criação do projeto Supabase, aplicação das migrations,
variáveis, primeiro usuário owner, verificação.

**Aceite:** uma pessoa sem acesso a este histórico sobe o ambiente seguindo apenas o documento.

---

## PR-06 — Runbook de deploy, rollback, backup e restore

**Fazer:** `docs/RUNBOOK.md` cobrindo: ordem obrigatória migration-antes-de-deploy (lição do PR-01);
como reverter um deploy na Vercel; política de backup do Supabase e **teste de restauração
efetivamente executado**, com data e resultado registrados; o que fazer quando uma instalação cai;
inventário de dependências externas (Supabase, Vercel, provedores de IA) com owner e plano de cada.

**Aceite (briefing):** outra pessoa executa o runbook sem intervenção informal do criador. Isso
significa executá-lo de verdade uma vez, não apenas escrevê-lo.

---

## PR-07 — Verificação autenticada do BYOK

**Por quê:** `CLAUDE.md` registra que o CRUD de `/docs/configuracoes/ia` nunca foi testado ponta a
ponta com sessão real. É gap conhecido e assumido, e o WP0 pede fechá-lo.

**Fazer:** roteiro manual documentado (criar, listar, editar, desativar, excluir; conferir que a
resposta traz só `api_key_last4`; conferir roteamento primary/fallback) e, onde couber, teste
automatizado com sessão real contra um projeto de teste.

**Aceite:** roteiro executado e registrado; nenhuma resposta de API expõe `api_key_ciphertext` ou
`api_key_iv`; `CLAUDE.md` atualizado removendo a ressalva.

---

## PR-08 — Extrair a lógica específica de instância do core

**Por quê:** auditoria §3.3 — `key === "hairline"` em `src/app/api/assets/route.ts:9` e em
`src/app/docs/[...slug]/page.tsx` viola a regra §2.4 do briefing.

**Fazer:** mover o comportamento para configuração declarada na própria instância, no mesmo espírito
do sistema de blocos e do alias `@brand-font`. Nenhuma comparação por `key` deve sobrar em código de
produto.

**Cuidado:** os componentes bespoke do Hairline não podem regredir visualmente. Fazer com o Hairline
rodando lado a lado, antes e depois.

**Aceite:** `grep -rn 'key === "' src/` não retorna nada em código de produto; o Hairline renderiza
igual.

---

## PR-09 — Reconciliar a documentação **[parcial: D2]**

**Fazer:** alinhar `README.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md` e `docs/PRODUCT_ARCHITECTURE.md`
ao estado real: matriz multi-instância e `NEXT_PUBLIC_BRANDVILLE_INSTANCE` documentados no
`CLAUDE.md`; remover a referência residual a magic link (a autenticação é por senha,
`src/app/login/page.tsx:46`); marcar como aspiracional o que ainda não existe; adotar um `CHANGELOG.md`.

**Bloqueio parcial (D2):** se `Brandville` for aposentado como identificador técnico, a renomeação
de variáveis, scripts npm e do nome do pacote entra neste PR. Se permanecer como codinome interno,
basta declarar isso explicitamente na documentação. Recomendação: **manter** — renomear agora é
custo sem retorno, desde que nenhum texto de venda use o nome.

---

## PR-10 — Teste de stack Supabase local em CI (depende de PR-04)

**Fazer:** job que sobe uma **stack Supabase local completa** (`supabase start`) — não um PostgreSQL
genérico — aplica todas as migrations em ordem e falha se alguma referenciar objeto inexistente.

**Por que a stack completa é necessária:** as migrations declaram FKs para `auth.users`
(`20260721173226_add_analysis_history.sql:4` e `:23`), e o produto depende do schema `storage` para
os buckets privados de assets e evidências. Um Postgres puro falha já na primeira chave estrangeira,
por ausência de `auth` — um falso negativo que esconderia o problema real que este teste existe para
detectar.

**Aceite:** o job passa numa stack limpa; ao remover propositalmente a baseline do PR-04, o job falha
apontando o objeto ausente.

## Definition of Done do WP0 (briefing §22 aplicado)

- [ ] Ambiente novo criado do zero apenas com repositório, `.env.example` e acessos legítimos
- [ ] Diff de esquema entre ambientes documentado, com decisão explícita para cada divergência
- [ ] `npm run lint`, `npx tsc --noEmit`, as três suítes de teste e `npm run build` passam
- [ ] Nenhuma migration depende de objeto não documentado
- [ ] Uma segunda pessoa executou o runbook sem ajuda informal
- [ ] Teste de restauração de backup executado e registrado com data
- [ ] R1, R2, R3, R4, R10 e R11 da matriz de riscos fechados
- [ ] ADR-0001 aprovado
- [ ] Nenhuma decisão comercial da §24 foi presumida

---

## Não faz parte do WP0

Convites e papéis (WP1), telemetria e custo (WP2), onboarding (WP3), Studio (WP4), planos (WP5),
editor de blocos e releases (WP6), avaliação contínua de IA (WP7), exportação (WP8). O briefing §17
também descarta explicitamente reescrita multi-tenant, DAM, SSO e billing complexo neste momento.
