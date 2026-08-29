# Instruções do projeto — Brennimark

**Brennimark** é o produto: uma plataforma de gestão de marca vendida a agências e a marcas.
Islandês para *marca de fogo* — a marca queimada no gado, origem literal da palavra "brand".
Adotado como nome de trabalho, ainda não definitivo.

`Brandville` era codinome técnico legado. Não pode voltar a aparecer em interface, venda, domínio
ou contrato. Ainda existe em identificadores internos (`src/brandville/`, `BRANDVILLE_*`), e essa
renomeação é dívida mecânica registrada, não decisão pendente.

## O que este repositório NÃO é

Não é o aplicativo de nenhuma marca específica. **The BluesMaker, Hairline e Guitar Garage não
vivem aqui** — nenhum deles é instância, dependência ou referência visual deste produto. Foram
removidos por inteiro em 28/08/2026.

Se precisar de uma marca para testar, o caminho é o mesmo do cliente: importar um manual em PDF.
Não recriar instância em código.

## Leitura obrigatória antes de alterar arquitetura

Os ADRs vigentes, em ordem:

- [`docs/adr/0002`](./docs/adr/0002-dois-modos-de-produto.md) — modos de agência e consulta,
  capacidades por marca
- [`docs/adr/0003`](./docs/adr/0003-produto-hospedado-multi-marca.md) — produto hospedado
  multi-marca; **substitui o 0001**
- [`docs/adr/0004`](./docs/adr/0004-o-produto-age-na-criacao.md) — o produto age na criação

`docs/ARCHITECTURE.md`, `docs/PRODUCT_ARCHITECTURE.md` e `docs/BRANDVILLE_MATRIX.md` são
**históricos** e estão marcados como tal. Onde divergirem dos ADRs, valem os ADRs.

## Next.js 16.2.10

Tem mudanças incompatíveis com versões anteriores. Antes de alterar APIs, roteamento, cache,
middleware/proxy, Server Components ou convenções do App Router, consultar `node_modules/next/dist/docs/`.

Duas armadilhas já encontradas, para não se repetirem:

- **Função não atravessa a fronteira de Server para Client Component.** Passar callback quebra em
  execução, não em compilação. Use valor serializável.
- **Custom property CSS é resolvida onde é DECLARADA.** Declarar `--x: var(--y)` no `:root`
  congela o valor antes de um escopo descendente definir `--y`. O escopo precisa sobrescrever `--x`
  diretamente.

## Fronteiras que não se cruzam

**Plataforma × marca.** A moldura — navegação, login, administração, configurações, governança —
usa `--platform-*`. O conteúdo da marca vive dentro do `BrandCanvas` e usa `--brand-*`.
`PlatformSurface` devolve os tokens da plataforma a um trecho dentro do canvas.

Nenhum controle, foco, estado ou status editorial pode herdar cor ou fonte da marca cliente. A
guarda em `src/platform/leak-guard.test.ts` verifica isso no código-fonte e cresce a cada
componente migrado.

**Interface × autorização.** Capacidades (`consultar`, `editar`, `aprovar`, `administrar`) decidem
o que **aparece**. RLS e verificação de papel decidem o que é **permitido**. Interface nunca é
fronteira de segurança.

**Tipografia.** A interface tem fonte própria (`--font-ui`). A fonte da marca (`--font-brand`) só
aparece onde demonstra a marca: títulos do manual e blocos de espécime. A plataforma **não hospeda
fonte licenciada de cliente algum**.

## Honestidade editorial — não negociável

O status `ready | draft | pending` atravessa o modelo, o contexto de IA e as citações.

- Ganhar imagem ou bloco **não** promove o status.
- A IA cita fonte, status e caminho, e não afirma o que não está documentado.
- **Só regra aprovada entra num prompt em silêncio.** Rascunho pode ser oferecido, mas
  identificado — ver ADR-0004 §3.2.

Um diretor de arte perdoa "não há diretriz documentada". Não perdoa ser levado a errar diante do
cliente dele.

## Camada de IA

Nunca importar `@ai-sdk/*` direto de código de feature — sempre via `getModel()` em
`src/lib/ai/provider.ts`. Resolução de configuração em `src/lib/ai/settings.ts`.

Chaves cifradas em AES-256-GCM (`src/lib/ai/crypto.ts`). Nunca retornar `api_key_ciphertext` nem
`api_key_iv` de uma rota — só `api_key_last4`.

Qualquer função `SECURITY DEFINER` nova precisa de `revoke execute` de `anon` e `authenticated`, e
`search_path` vazio com nomes qualificados.

## Banco

Toda mudança precisa de migration versionada, RLS, índices e **teste de autorização negativo** —
provar que a conta A não lê a da B, não só que A lê a sua. Condição 2 do ADR-0003.

O histórico de migrations do repositório precisa bater com o ledger de produção. Já divergiu uma
vez, em timestamps, e `db push` teria reaplicado migrations sobre objetos existentes.

Nunca apagar, reescrever ou normalizar silenciosamente dados, histórico ou assets.

## Verificação

```bash
npm run verify
```

Roda a mesma sequência do CI: lint, tipos, as três suítes e o build de produção. Se passa aqui,
passa lá.

O CI existe em `.github/workflows/ci.yml` mas **nunca rodou**: o repositório não tem remoto. Uma
execução remota verde é gate obrigatório antes do primeiro piloto.
