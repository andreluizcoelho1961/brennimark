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

## Fatia 1 — a ordem é vinculante

Branch: `fatia-1/transporte`. Plano: `docs/plan/replanejamento-studio-guia-2026-09-04.md`, §18.3.

**Etapa A (transporte) vem inteira antes da Etapa B (visualizador).** Construir
a interface antes de saber como os bytes chegam é apostar a interface numa
hipótese não verificada.

A ordem dentro da Etapa A não é preferência — é a ordem de alavanca:

| | |
|---|---|
| **A.1** | Supabase expõe `Access-Control-Expose-Headers` no plano hospedado? É a pergunta mais barata e a de maior alavanca: **se a resposta for sim, A.2 e A.3 deixam de existir** |
| **A.2** | Camada de borda — e ela nasce com os requisitos **B1–B6** (§18.3.0), que são eliminatórios, não desejáveis |
| **A.3** | Rota na Vercel — **só se A.1 e A.2 não resolverem** |
| **A.4** | Medir no ambiente **publicado**, com arquivo próximo de 100 MiB |
| **A.5** | Decidir o transporte, com os números de A.4 na mesa |

**Nesta abertura não se constrói:** visualizador, rota intermediária, nem
schema. O primeiro trabalho técnico é **apenas A.1**.

**Material de teste:** PDF **sintético** de ~100 MiB para escala e transporte;
material próprio ou explicitamente autorizado para comparação visual. O manual
da GE foi excluído do Storage e das cópias locais (§18.2.0, §18.3.3) — refazer
aquela comparação exige novo envio com autorização específica.

## Material de marca de terceiro

**Não se apaga, move, copia, publica nem transforma em fixture por
interpretação.** Concordância técnica do André com um argumento **não é**
autorização para executá-lo. Pergunte de forma direta, descrevendo a
irreversibilidade, e espere o "sim" explícito.

Depois de apagar: registre no plano a autorização, o método, as identidades
colhidas **antes** (tamanho e `sha256` — sem elas a prova de ausência não tem
sujeito), as provas de ausência por vias independentes, e **o que a varredura
não cobriu**. Precedente completo em §18.2.0 e §18.3.3.
