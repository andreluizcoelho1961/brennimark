# Instruções do projeto — Brennimark

**Brennimark** é o produto: uma plataforma de gestão de marca vendida a agências e a marcas.
Islandês para *marca de fogo* — a marca queimada no gado, origem literal da palavra "brand".
Adotado como nome de trabalho, ainda não definitivo.

`Brandville` era codinome técnico legado. Não pode voltar a aparecer em interface, venda, domínio
ou contrato. A dívida de identificadores internos foi quitada em 25/09/2026: pastas, tipos, funções,
variáveis e documentos passaram a `brennimark`. O nome antigo sobrevive só em migrations já
aplicadas (`supabase/migrations/`, `historico-remoto.txt`, `RECONCILIACAO.md`), que não se
reescrevem porque o histórico precisa bater com o ledger de produção. `src/platform/codinome.test.ts`
barra a volta dele.

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
- [`docs/adr/0005`](./docs/adr/0005-a-curadoria-editorial-e-do-produto.md) — a curadoria editorial
  é do produto
- [`docs/adr/0006`](./docs/adr/0006-o-pdf-e-a-superficie-de-leitura.md) — o PDF é a superfície de
  leitura; as páginas remontadas saem da navegação
- [`docs/adr/0007`](./docs/adr/0007-biblioteca-de-assets-da-marca.md) — a biblioteca de assets da
  marca, a entrega governada por link com prazo, e a hospedagem de fonte

`docs/ARCHITECTURE.md`, `docs/PRODUCT_ARCHITECTURE.md` e `docs/BRENNIMARK_MATRIX.md` são
**históricos** e estão marcados como tal. Onde divergirem dos ADRs, valem os ADRs.

## Next.js 16.3.4

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
aparece onde demonstra a marca: títulos do manual e blocos de espécime.

**A plataforma HOSPEDA a fonte da marca — mudou em 13/09/2026, ver ADR-0007 §3.** A regra anterior
dizia o contrário ("não hospeda fonte licenciada de cliente algum"), e caiu por um argumento de
produto: quem trabalha na marca baixa o logo e tudo mais, e sem a fonte o texto renderiza errado no
primeiro arquivo aberto. O que a hospedagem OBRIGA, e sem o que ela não se sustenta:

- **termo assinado pelo assinante ANTES de ligar a hospedagem** — a responsabilidade pela licença é
  dele, e sem texto assinado ela continua com quem serve o arquivo;
- **aceite registrado no upload**, com autor e data;
- **servida só para download, a membro autenticado daquela marca** — nunca URL pública, nunca
  webfont, sem hotlink e sem CDN;
- **procedimento de retirada**, se uma foundry notificar.

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

Roda a mesma sequência do CI, nesta ordem: lint, tipos, testes de unidade, build de produção e a
suíte de navegador.

**Rodar o `verify` INTEIRO antes de empurrar, sempre.** Unidade e build verdes não autorizam push:
em 09/09/2026 três commits foram empurrados com o CI vermelho em seguida, e nenhuma das três
causas aparecia fora do navegador — texto de mensagem mudado, `testMatch` casando com o nome do
diretório, e uma corrida latente exposta pelo aumento de carga da suíte.

Em worktree novo, `npm ci` de verdade: `node_modules` como atalho simbólico quebra o Turbopack com
"Symlink points out of the filesystem root".

**Correção de 10/09/2026 — duas afirmações que este arquivo fazia e eram falsas:** ele dizia que o
repositório não tem remoto e que o CI nunca rodou. Existe `origin` em
`github.com/andreluizcoelho1961/brennimark`, e o CI ("Lint, tipos, testes, build e navegador",
~11 min) roda verde desde 05/09. O gate de execução remota verde **já foi cumprido**.

O CI do PR roda `refs/pull/N/merge`, então testa a integração com a `main` **atual**, não a branch
isolada: uma falha nova depois de um push pode ser choque com a `main` que andou, e não regressão
do commit.

## Transporte do documento-fonte — invariantes que não se afrouxam

`src/lib/documento-fonte/` e `src/app/api/documento-fonte/[id]/`. Estas regras custaram uma sessão
inteira de caçada; cada uma tem teste, e nenhuma é preferência de estilo.

**Nenhuma resposta passa de 4 MiB.** A resposta de uma função da Vercel é truncada acima de
4,5 MB, e corpo truncado com `content-length` cheio é um PDF corrompido sem aviso. O teto **apara**
o intervalo e devolve `206` com `Content-Range` honesto — aparar promete menos e cumpre; recusar
com 413 quebrou todo manual acima de 4 MiB. `HEAD` é isento: não tem corpo.

**O visualizador nunca pede o arquivo inteiro.** Ele faz `HEAD` para o tamanho e usa
`PDFDataRangeTransport`. Passar a URL ao PDF.js faz ele sondar **sem `Range`**, a rota começa a
repassar o arquivo todo, a função estoura a duração e o manual não abre — 60 segundos, medido em
produção. Há teste de navegador trancando essa invariante.

**A autorização do transporte é enxuta, e por medição.** Uma consulta autorizada pela RLS: se a
linha vem, o banco provou. Usar a autorização das páginas de interface custava **~350 ms por
pedido de intervalo** contra 16 ms — ela resolve workspaces, marcas, perfil, documentos e
capacidades e valida o token pela rede.

**`Server-Timing` fica na resposta.** `consulta` (autorização e documento, uma ida ao banco), `sessao`, `storage`. Quando o
sintoma é lentidão, ler a etapa vem antes de formular hipótese: três rodadas foram gastas em
teoria — uma delas errada — e a instrumentação resolveu na primeira leitura.

**Cache não mente sobre a representação.** Esta URL serve intervalos diferentes, então nada de
`immutable`: ele descreve representação completa, e "zero bytes transferidos" era o navegador
reaproveitando conteúdo parcial entre intervalos.

## Limites: do produto e da instalação

São dois números, e confundi-los deixa a conta de hospedagem decidir o escopo.

| | Valor | Natureza |
|---|---|---|
| `TETO_DO_PRODUTO_BYTES` | 100 MiB | requisito, constante no código |
| `TETO_DO_PLANO_BYTES` | 50 MB | `NEXT_PUBLIC_TETO_DE_IMPORTACAO_MB` |

O Supabase Free impõe 50 MB por arquivo como limite global de plataforma; o limite por bucket não
pode ultrapassá-lo. A recusa **diz qual dos dois** barrou: "passa do limite da instalação atual,
não do produto". Dizer só "grande demais" faria uma agência concluir que o produto não serve para
manuais grandes, sobre um limite provisório.

Migrar ao Pro são dois passos, nenhum automático: a variável na Vercel e uma migration subindo o
bucket. Teto de Storage é estado do banco, e estado do banco muda por migration versionada.

## Provas versionadas

Garantia que ninguém reexecuta é garantia que alguém remove numa refatoração sem perceber.

- `scripts/prova-de-concorrencia-ai-ledger.sh` — as travas do razão de IA
- `scripts/prova-manifesto-por-pagina.sh` — as constraints do documento-fonte

**Prova confere o NOME EXATO da constraint**, não "algum erro". Uma versão anterior tratava
qualquer `violates` como sucesso, e um caso cuja preparação falhava passava sem nunca alcançar a
constraint pretendida — falso positivo estrutural. Cada caso também precisa de dados isolados:
dado compartilhado entre casos foi o que produziu o falso positivo.
