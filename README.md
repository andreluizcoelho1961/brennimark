# Aplicativo de gestão de marcas — nome provisório

Aplicativo de diretrizes de marca com navegação, busca, assets, assistência por
IA, análise de aplicações e histórico de governança. Cada cliente recebe uma
instalação individual; a base técnica é reutilizável.

**Brandville é apenas o nome de trabalho do código atual.** O nome comercial será substituído
depois de pesquisa e clearance. Este repositório é o produto SaaS; não é o projeto de marca
Guitar Garage, The BluesMaker ou qualquer outra instância carregada nele.

A separação de escopo está em [`docs/PROJECT_BOUNDARY.md`](./docs/PROJECT_BOUNDARY.md).

Sibling project: [`the-bluesmaker-site`](https://github.com/andreluizcoelho1961/the-bluesmaker-site)
(the "Call Me Analog Man" release site) — both draw from the same brand
system; keep tokens in sync if either changes.

## Run locally

```bash
npm install
npm run dev
```

A instância padrão é `the-bluesmaker`. Para validar a matriz com a marca
fictícia:

```bash
NEXT_PUBLIC_BRANDVILLE_INSTANCE=example npm run dev
```

O processo completo para criar uma instalação está em
[`docs/BRANDVILLE_MATRIX.md`](./docs/BRANDVILLE_MATRIX.md).

Para iniciar uma nova marca pelo questionário guiado:

```bash
npm run brandville:new
```

Para trabalhar a partir de um briefing preenchido, copie
[`brandville/intake.example.json`](./brandville/intake.example.json) e execute
o gerador com `--input`. Use `--check` para validar e `--dry-run` para conferir
os arquivos previstos sem alterar a matriz.

Para converter um brand book já existente em rascunho revisável:

```bash
npm run brandville:import -- --pdf /caminho/manual.pdf --brand "Empresa" --key empresa --descriptor "Descrição"
```

O resultado importado deve ser curado antes de ser entregue ao gerador. Consulte
[`docs/BRANDVILLE_MATRIX.md`](./docs/BRANDVILLE_MATRIX.md) para os comandos de
curadoria e indexação das referências visuais.

## Verificação

Um comando roda exatamente a mesma sequência que a integração contínua executa —
lint, tipos, as três suítes locais e o build de produção:

```bash
npm run verify
```

Se ele passa na sua máquina, passa no CI: o workflow em
[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) chama os mesmos scripts,
na mesma ordem, na versão de Node declarada em `.nvmrc`.

Etapas isoladas, quando útil durante o desenvolvimento:

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run test:ci     # as três suítes, sem rede e sem banco
```

Nenhuma suíte depende de Supabase, credenciais ou rede. O teste que aplica as
migrations numa stack limpa é o PR-10 do WP0 e ainda não entrou no pipeline —
ver [`docs/plan/wp0-baseline-reproduzivel.md`](./docs/plan/wp0-baseline-reproduzivel.md).

## Status

- Color, typography, motion, photography direction, voice/language: complete.
- Logo: placeholder (interim wordmark shown) — pending dedicated logo files from the client.
- Streaming badges and cover art: pulled from the release site's already-approved assets.

## Estrutura configurável

Identidade, tema, navegação, metadados e seleção de conteúdo vivem em
[`src/brandville/`](./src/brandville/). O conteúdo aprofundado do The BluesMaker
permanece em [`src/content/`](./src/content/).
