# Briefing para Claude Code — Patch 1.1: uma resolução real por requisição

## 1. Objetivo

Corrigir duas inconsistências deixadas pelo Patch 1 antes de iniciar a migração da administração para `brand_id`.

Ao final deste patch:

- autenticação, membership, perfil, marca ativa e documentos devem formar um único contexto request-scoped;
- a mesma requisição não pode autenticar duas vezes nem resolver a marca duas vezes;
- layout, navegação, página e canvas devem consumir o mesmo resultado;
- ausência de sessão deve produzir zero capacidades;
- o fluxo especial de desenvolvimento não pode alterar a regra central de autorização;
- nenhuma mudança da administração do Patch 2 deve entrar neste commit.

Este patch é corretivo e deve ser isolado.

---

## 2. Baseline revisado

Commit efetivamente presente em `main`:

`77e352c — Patch 1: a marca ativa passa a ser da requisição`

O hash `1c8a6c9` citado anteriormente não corresponde ao commit atual do repositório.

O Patch 1 acertou a direção:

- removeu `hasBrand` da decisão de runtime;
- introduziu `resolveWorkspaceContext` com `cache` do React;
- passou o tema resolvido para `BrandCanvas`;
- passou nome e descritor para `WorkspaceIdentity`;
- separou metadados do produto dos metadados do manual;
- fortaleceu o smoke test do estado sem marca;
- manteve CI e `npm run verify` verdes.

O Patch 1.1 não deve desfazer esses ganhos.

---

## 3. Bloqueador 1 — a resolução ainda está duplicada

### 3.1 Comportamento atual

O código afirma resolver uma vez por requisição, mas o fluxo atual ainda é:

1. `src/app/docs/layout.tsx` chama `getBrennimarkAuthContext()` diretamente;
2. o layout consulta `profiles` diretamente;
3. o layout chama `resolveWorkspaceContext()`;
4. `resolveWorkspaceContext()` chama `getBrennimarkAuthContext()` novamente;
5. `resolveWorkspaceContext()` chama `resolveActiveBrand(auth)`;
6. depois chama `getResolvedBrandDocs(auth)`;
7. `getResolvedBrandDocs(auth)` chama `resolveActiveBrand(auth)` novamente.

Resultado:

- autenticação repetida;
- membership repetida;
- marca ativa consultada duas vezes;
- perfil fora do contexto request-scoped;
- possibilidade de layout e documentos observarem resultados diferentes;
- a afirmação do commit de que existe uma única resolução não corresponde ao comportamento real.

`supabase.auth.getUser()` abre uma chamada à Auth API. Essa duplicação não é apenas estética.

Referência oficial:

<https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&package-manager=npm&queryGroups=framework&queryGroups=package-manager>

### 3.2 Arquivos envolvidos

- `src/lib/brennimark/workspace-context.ts`
- `src/lib/brennimark/server.ts`
- `src/lib/brennimark/context.ts`
- `src/app/docs/layout.tsx`
- `src/app/docs/page.tsx`
- `src/app/docs/[...slug]/page.tsx`
- `src/app/dev/shell-v2/[[...slug]]/page.tsx`

### 3.3 Correção esperada

O contexto request-scoped deve resolver e carregar:

- autenticação;
- workspace;
- papel;
- e-mail;
- situação do perfil/onboarding;
- marca ativa ou `null`;
- documentos da marca ativa;
- capacidades;
- locale da interface;
- slug padrão.

O layout deve consumir somente `resolveWorkspaceContext()` para decidir:

- redirecionamento para login;
- redirecionamento para onboarding;
- e-mail da sessão;
- capacidades;
- documentos da navegação.

Não chamar `getBrennimarkAuthContext()` separadamente no layout.

### 3.4 Consulta de documentos

Depois que a marca estiver resolvida, a consulta de documentos deve receber explicitamente o identificador já conhecido.

Contrato esperado, adaptável à nomenclatura do projeto:

```ts
getResolvedBrandDocs(auth, brand.id)
```

ou:

```ts
getBrandDocsForActiveBrand({ auth, brandId: brand.id })
```

O que não pode continuar:

```ts
const brand = await resolveActiveBrand(auth);
const docs = await getResolvedBrandDocs(auth); // resolve a marca novamente
```

`getResolvedBrandDocs` não deve decidir qual é a marca quando a marca já foi resolvida pelo contexto.

### 3.5 Perfil e onboarding

Adicionar ao contrato de `WorkspaceContext` informação suficiente para o layout decidir se o onboarding está completo.

Exemplos aceitáveis:

```ts
profileComplete: boolean
```

ou:

```ts
profile: { fullName: string } | null
```

Não transportar o objeto completo do Supabase se o layout precisa apenas de um estado pequeno.

O comportamento deve permanecer:

- sem sessão: `/login`;
- sessão sem nome completo: `/onboarding`;
- sessão e perfil completos: renderizar o manual;
- `BRENNIMARK_DEV_SKIP_AUTH=true`: fluxo local explícito, sem criar uma regra falsa de autorização.

### 3.6 Paralelismo permitido

Depois da autenticação e do workspace, consultas independentes podem ser paralelizadas.

Por exemplo, perfil e marca ativa podem começar juntos se não houver dependência entre eles.

Os documentos dependem do `brand.id` e só devem ser consultados depois da marca.

Não introduzir cache de processo, `Map` global, variável mutável de módulo ou singleton de marca.

---

## 4. Bloqueador 2 — visitante recebe capacidade de membro

### 4.1 Comportamento atual

Em `src/lib/brennimark/context.ts`, o contexto usa:

```ts
capabilitiesForRole(auth?.role ?? "member")
```

Quando não existe sessão, o fallback transforma o visitante em `member` e concede `consultar`.

Isso contradiz o contrato já existente em `src/platform/capabilities.ts`:

```ts
capabilitiesForRole(null) === []
```

### 4.2 Correção esperada

Usar:

```ts
capabilitiesForRole(auth?.role)
```

Sem sessão:

- `brand` deve ser `null`;
- `docs` deve ser `[]`;
- `userEmail` deve ser `undefined`;
- `capabilities` deve ser exatamente `[]`;
- `defaultDocSlug` deve ser `null`.

### 4.3 Desenvolvimento local

Se o preview com `BRENNIMARK_DEV_SKIP_AUTH=true` precisar simular um membro, isso deve ser uma decisão explícita da camada de desenvolvimento.

Não usar o fallback de `member` dentro de `montarContexto`.

A função pura deve preservar a regra real do produto: sem papel, sem capacidade.

---

## 5. Limpeza esperada

### 5.1 Função sem consumidor

`getResolvedBrandDoc()` não possui consumidor depois do Patch 1.

Remover a função se o `rg` confirmar que permanece sem uso.

Não manter um caminho alternativo que refaça autenticação, marca e documentos fora do contexto request-scoped.

### 5.2 Comentários e documentação

Atualizar comentários que afirmam “uma resolução por requisição” para que descrevam o comportamento comprovado depois da correção.

Não esconder consultas duplicadas atrás de comentários ou de `cache` sem teste correspondente.

### 5.3 Não ampliar escopo

Não fazer neste patch:

- migração da administração para `brand_id`;
- mudança do histórico;
- remoção de `instance_key`;
- locale completo do Patch 3;
- mobile da V2;
- promoção da V2;
- remoção geral de `release-analog`;
- seletor de marca do Patch 7.

---

## 6. Testes obrigatórios

### 6.1 Regra pura do contexto

Fortalecer `src/lib/brennimark/context.test.ts`.

Adicionar ou ajustar:

1. sem sessão, `capabilities` é exatamente `[]`;
2. sem sessão, não existe marca, documento ou slug padrão;
3. member recebe apenas `consultar`;
4. owner recebe as capacidades esperadas;
5. perfil incompleto produz o estado que leva ao onboarding;
6. perfil completo libera renderização;
7. o locale da interface continua separado do idioma do manual.

O teste atual que verifica apenas ausência de `administrar` não é suficiente.

### 6.2 Resolução sem duplicação

Adicionar proteção que torne observável quantas vezes cada dependência foi chamada.

Uma opção é separar uma função carregadora testável com dependências injetadas:

```ts
carregarWorkspaceContext({
  getAuth,
  getProfile,
  getActiveBrand,
  getDocsByBrandId,
})
```

Com fakes/contadores, provar:

- `getAuth`: uma chamada;
- `getProfile`: uma chamada;
- `getActiveBrand`: uma chamada;
- `getDocsByBrandId`: uma chamada quando existe marca;
- `getDocsByBrandId`: zero chamadas quando não existe marca;
- o `brandId` enviado aos documentos é o mesmo da marca retornada;
- todos os consumidores recebem o mesmo objeto de contexto na mesma requisição.

Não é obrigatório usar exatamente dependência injetada, mas o teste deve proteger o comportamento, não apenas procurar uma string no código.

### 6.3 Guardas estruturais

Manter e ampliar a leak guard para impedir:

- retorno de `hasBrand` no caminho da marca;
- import de `brennimarkInstance` como fonte da marca ativa;
- chamada direta de `getBrennimarkAuthContext()` em `src/app/docs/layout.tsx`;
- resolução da marca dentro da função que recebe `brandId` para buscar documentos;
- restauração de `getResolvedBrandDoc()` como caminho paralelo.

Guardas de texto complementam testes de comportamento; não devem substituí-los.

### 6.4 Verificação completa

Executar:

```bash
npm run verify
```

Exigências:

- lint verde;
- typecheck verde;
- unidades verdes;
- build verde;
- Playwright verde;
- CI verde.

---

## 7. Critérios de aceite

O Patch 1.1 só está concluído quando:

- [ ] `DocsLayout` não chama `getBrennimarkAuthContext()` diretamente.
- [ ] O perfil faz parte da resolução request-scoped.
- [ ] A autenticação é resolvida uma vez no fluxo da requisição.
- [ ] A membership é resolvida uma vez.
- [ ] A marca ativa é resolvida uma vez.
- [ ] Os documentos são consultados usando o `brand.id` já resolvido.
- [ ] A consulta de documentos não chama `resolveActiveBrand()`.
- [ ] Layout, página, navegação e canvas consomem o mesmo contexto.
- [ ] Sem sessão, `capabilities` é exatamente `[]`.
- [ ] O modo local não altera a regra central de capacidades.
- [ ] `getResolvedBrandDoc()` foi removida, se continuar sem consumidores.
- [ ] Nenhum singleton ou cache de processo foi introduzido.
- [ ] Testes protegem a contagem das dependências ou comportamento equivalente.
- [ ] Nenhuma mudança do Patch 2 entrou no commit.
- [ ] `npm run verify` e CI estão verdes.

---

## 8. Entrega esperada do Claude Code

Antes de alterar o código, responder com:

1. confirmação das duas duplicações:
   - autenticação no layout + contexto;
   - marca no contexto + consulta de documentos;
2. desenho do novo contrato de `WorkspaceContext`;
3. estratégia para testar que cada dependência roda uma vez;
4. tratamento explícito de `BRENNIMARK_DEV_SKIP_AUTH`;
5. arquivos que serão modificados.

Ao concluir, reportar:

- commit isolado;
- fluxo anterior e novo;
- contagem de chamadas protegida pelos testes;
- função morta removida;
- testes adicionados ou fortalecidos;
- resultado de `npm run verify`;
- resultado do CI;
- qualquer dívida deixada para o Patch 2.

Não iniciar o Patch 2 no mesmo commit. Depois do Patch 1.1 verde, o Patch 2 fica liberado.
