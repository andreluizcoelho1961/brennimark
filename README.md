# Brennimark

Plataforma de gestão de marca. Transforma o manual de marca — que costuma ser um PDF que ninguém
lê e onde ninguém acha nada — num sistema que responde perguntas, valida peças e mostra de onde
veio cada resposta.

O nome é islandês para *marca de fogo*: a marca queimada no gado para declarar propriedade, origem
literal da palavra "brand". É nome de trabalho, ainda não definitivo.

## Estado

Produto em construção, **sem nenhuma marca carregada**. A primeira entra quando o envio de manual
em PDF existir.

Marcas de clientes não vivem neste repositório e não são recriadas em código.

## Rodar

```bash
npm install
npm run dev
```

Abre vazio, no estado que qualquer instalação nova terá até o primeiro manual ser importado.

A moldura em construção fica em `/dev/shell-v2` — disponível apenas fora de produção.

## Verificação

Um comando roda exatamente a mesma sequência da integração contínua — lint, tipos, as três suítes
locais e o build de produção:

```bash
npm run verify
```

Se passa na sua máquina, passa no CI: o workflow em [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)
chama os mesmos scripts, na mesma ordem, na versão de Node de `.nvmrc`.

Nenhuma suíte depende de Supabase, credenciais ou rede.

## Arquitetura

As decisões vigentes estão nos ADRs:

| ADR | Assunto |
| --- | --- |
| [0002](./docs/adr/0002-dois-modos-de-produto.md) | Modos de agência e consulta; capacidades por marca |
| [0003](./docs/adr/0003-produto-hospedado-multi-marca.md) | Produto hospedado multi-marca; silo como plano superior |
| [0004](./docs/adr/0004-o-produto-age-na-criacao.md) | O produto age na criação, não só na consulta |

O [0001](./docs/adr/0001-studio-como-control-plane.md) foi substituído pelo 0003, e
`docs/ARCHITECTURE.md`, `docs/PRODUCT_ARCHITECTURE.md` e `docs/BRENNIMARK_MATRIX.md` são
históricos. Onde divergirem dos ADRs, valem os ADRs.

### Duas fronteiras que sustentam o produto

**Plataforma × marca.** A moldura usa `--platform-*`; o conteúdo da marca vive dentro do
`BrandCanvas` e usa `--brand-*`. Nenhum controle, foco ou status editorial herda cor ou fonte do
cliente — é o que permite emoldurar qualquer marca sem que a interface brigue com ela.

**Honestidade editorial.** Cada página carrega seu estado — pronto, rascunho ou em construção — e
esse estado atravessa o modelo, o contexto de IA e as citações. A IA responde com fonte e status, e
não afirma o que não está documentado.

## Trabalho em andamento

O plano em [`docs/plan/`](./docs/plan/). A migração em curso move o conteúdo da marca de código
para dado — pré-requisito de tudo o mais, incluindo o autoatendimento.
