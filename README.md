# Brandville — matriz replicável

Aplicativo de diretrizes de marca com navegação, busca, assets, assistência por
IA, análise de aplicações e histórico de governança. Cada cliente recebe uma
instalação individual; a base técnica é reutilizável.

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

## Status

- Color, typography, motion, photography direction, voice/language: complete.
- Logo: placeholder (interim wordmark shown) — pending dedicated logo files from the client.
- Streaming badges and cover art: pulled from the release site's already-approved assets.

## Estrutura configurável

Identidade, tema, navegação, metadados e seleção de conteúdo vivem em
[`src/brandville/`](./src/brandville/). O conteúdo aprofundado do The BluesMaker
permanece em [`src/content/`](./src/content/).
