<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git: nada vai direto para a `main` — nem documentação

Regra dada por André em 05/09/2026, depois de um commit de documentação
feito direto na `main` com o checkout principal sujo.

**Cada fatia nasce em branch própria e worktree isolado.** Uma por fatia, não
uma por sessão:

```bash
git worktree add -b fatia-N/<assunto> ../Brennimark-fatia-N <commit-base>
```

Use o **SHA explícito** como base, nunca o nome `main` — `main` é um ponteiro
móvel, e a fatia precisa saber de onde partiu mesmo depois que ele andar.

**As cinco regras:**

1. **Commits pequenos e explícitos.** Inclusão por caminho (`git add -- <arquivo>`).
   Nunca `git add -A`, `git add .` ou `git commit -a` — eles varrem para dentro
   do commit tudo o que estiver aberto na mesa, que é exatamente o defeito que
   esta regra existe para impedir.
2. **Testes e revisão rodam na branch**, não na `main`.
3. **Integração na `main` só depois de aprovação do André.** Não é decisão do
   agente, e "os testes passaram" não é aprovação.
4. **Nunca transportar trabalho não commitado** do checkout principal para o
   worktree novo. Um worktree já nasce assim — a garantia é da ferramenta, não
   da sua memória — mas confira e diga, em vez de presumir.
5. **Publicar a branch remota** (`git push -u origin <branch>`) faz parte de
   abrir a fatia; empurrar a `main` não.

**Antes de qualquer commit, confira em que branch você está.** Se for `main`,
pare e crie a branch da fatia primeiro.

**`npm run verify` é auto-suficiente em worktree novo — mantenha assim.** As
fixtures ignoradas que a suíte de navegador exige são geradas por
`pretest:e2e`, que o npm dispara antes de `test:e2e` venha ele do `verify` ou
de `npm run test:e2e` direto.

Isso foi corrigido em 05/09/2026, depois de um worktree limpo reprovar 12
testes por ausência de arquivo — o CI tinha um passo (`fixtures:pdf`) que o
`verify` não tinha. **Se alguma preparação nova for necessária, acrescente ao
`verify` ou a um `pre*` do npm, nunca só ao workflow:** um passo que só existe
no CI reintroduz exatamente o defeito, e ele fica invisível em qualquer
checkout que já tenha os arquivos sobrando.

**A fixture de ~100 MiB não entra em preparação automática.** `fixtures:escala`
é chamado à mão, para medição. Gerá-la a cada suíte seria pagar 100 MiB por
uma coisa que a escala pequena já reprova.

**Antes de tratar arquivo solto como trabalho em risco, compare com as branches
existentes.** Em 05/09 os "onze arquivos WIP" da `main` eram byte a byte
idênticos a `wip/fase-3-rotas`, que já estava no `origin`: não havia nada a
resgatar, só uma cópia solta. Diagnosticar antes de agir vale especialmente
quando a ação proposta descarta alguma coisa.

**Limpar working tree é operação separada e explicitamente autorizada.** Se for
mesmo necessária, faça por cópia para fora primeiro — nunca `git checkout --`
direto sobre trabalho não commitado.

## Fatia 1 — visualizador fiel (plano de 09/09/2026)

Branch: `fatia-1/visualizador`. Plano de produto aprovado por André em
09/09/2026; substitui a Etapa A anterior deste arquivo.

**O que mudou, e por quê.** A ordem antiga era A.1 (perguntar ao Supabase se
`Access-Control-Expose-Headers` é configurável) → A.2 (borda) → A.3 (rota).
Ela está **encerrada**, não abandonada: a medição no navegador (§18.2.8 do
replanejamento) já respondeu a pergunta que A.1 faria, e respondeu contra a URL
assinada direta.

| | URL assinada direta | Rota de mesma origem |
|---|---|---|
| `accept-ranges` / `content-range` visíveis ao JS | **não** | sim |
| Requisições até a 1ª página | 1 | 11 |
| **Bytes até a 1ª página** | **11,3 MiB** (o arquivo inteiro) | **0,61 MiB** |

O Storage do Supabase não expõe esses dois cabeçalhos por CORS; o PDF.js os lê
para decidir se pode pedir intervalos, não os vê, conclui que não há suporte a
Range e baixa tudo. **Por isso o transporte é rota de mesma origem, e a
investigação não se reabre** — nem por ticket de suporte, nem por conta de
borda.

**Contrato da rota** — nasce com todos, não ganha depois:

| Requisito | Por quê |
|---|---|
| Recebe o **identificador do documento**, nunca um caminho de Storage | caminho vindo do cliente é proxy aberto |
| Autoriza usuário, conta e marca **antes do primeiro byte** | a autorização é do produto, não do token |
| **Exige `Range`** | a resposta da Vercel tem teto de 4,5 MB: servir o arquivo inteiro é impossível, não indesejável |
| Repassa `206`, `Content-Range`, `Accept-Ranges`, `ETag` | é o que o navegador precisa **ver** |
| Cancela a origem no abandono | senão paga banda por bytes que ninguém lê |
| Renova autorização sem perder a página atual | a expiração devolve **400**, não 401/403 |

**O identificador, hoje e depois.** O documento-fonte durável
(`brand_source_documents`) é a Etapa 2. Até ela existir, a rota usa
`brand_imports.id`. **O contrato do endpoint muda uma vez, na Etapa 2** — está
escrito aqui para não virar surpresa.

**Portões de aceite da Etapa 1:**

- comparação visual lado a lado contra um **renderizador independente**
  (`pdftoppm`, `mutool` ou Ghostscript). Comparar PDF.js com PDF.js é espelho,
  não teste;
- nenhuma página recortada ou reformatada; proporção, rotação e margens
  originais;
- Safari, Chromium e Firefox; iPhone e Android **físicos**;
- **camada de texto tem portão próprio** — seleção, busca e leitor de tela,
  inclusive sob zoom e rotação. Não é item de lista ao lado de "tela cheia";
- manual pequeno (40–50 páginas) fecha o **Marco A**. O manual de ~100 MiB é
  portão separado, que destrava com plano pago — um não segura o outro.

**A cobertura de páginas NÃO é portão desta etapa.** O PDF.js renderiza do PDF
e nunca consulta nossas seções, então "todas as páginas aparecem" passa de
graça aqui. A perda real está na camada semântica
(`src/lib/import/secoes.ts:289`) e o portão de cobertura é da **Etapa 2**.

**Congelado enquanto Etapas 1 e 2 não fecharem:** heurística visual, novas
funções de IA, melhorias cosméticas, expansão da administração, e
reorganização que não aproxime o fluxo de aceite.

## Material de marca de terceiro

**Não se apaga, move, copia, publica nem transforma em fixture por
interpretação.** Concordância técnica do André com um argumento **não é**
autorização para executá-lo. Pergunte de forma direta, descrevendo a
irreversibilidade, e espere o "sim" explícito.

Depois de apagar: registre no plano a autorização, o método, as identidades
colhidas **antes** (tamanho e `sha256` — sem elas a prova de ausência não tem
sujeito), as provas de ausência por vias independentes, e **o que a varredura
não cobriu**. Precedente completo em §18.2.0 e §18.3.3.
