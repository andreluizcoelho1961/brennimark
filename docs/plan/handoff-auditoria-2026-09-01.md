# Handoff — correção pós-auditoria, 01/09/2026

Onde a execução do `briefing-correcao-auditoria-2026-09-01.md` parou, e o que a
próxima sessão precisa saber para continuar sem reconstruir contexto.

---

## Baseline atual

Estabelecido com `npm ci` limpo, `.tmp`, `.next` e `node_modules` removidos.

```
205 testes de unidade
 81 testes de navegador
  0 vulnerabilidades de produção (npm audit --omit=dev)
```

**Números anteriores a 01/09 não valem.** A suíte listava os arquivos de teste
um a um e `lib/import` nunca entrou na lista: `draft.test.ts` existia desde o
commit do importador e nunca executava. A separação exata:

| | |
|---|---|
| 181 | o que a suíte declarava **e** executava |
| + 9 | `draft.test.ts`, oculto |
| +13 | novos: `texto` (7), `pdf-erros` (4), guardas (2) |

Hoje a suíte **descobre** em vez de listar (`tsconfig.tests.json` + glob
recursivo), apaga o diretório temporário antes de compilar, e há guarda que
falha nos dois sentidos: fonte sem compilado, e compilado sem fonte.

---

## Estado de produção

| | |
|---|---|
| URL | `https://brennimark.vercel.app` |
| Supabase | `ijnpigdmlswhkxqbjeru` |
| Conta | `andyrodrigues1@gmail.com` — confirmada, perfil e workspace criados, papel **owner** |
| Banco | 1 usuário, 1 workspace, **0 marcas, 0 documentos, 0 importações, 0 arquivos** |

**Pendência que não é código:** no painel do Supabase → Authentication → URL
Configuration, o *Site URL* precisa ser `https://brennimark.vercel.app` e os
*Redirect URLs* precisam incluir `https://brennimark.vercel.app/**` e
`http://localhost:3000/**`. Enquanto isso não for feito, o link de confirmação
de e-mail e a recuperação de senha apontam para `localhost`.

---

## O que foi entregue

| Commit | O quê |
|---|---|
| `bceee1e` | login deixa de misturar português e inglês |
| `e11cb70` | documento de estado |
| `d2c70c5` | deploy de produção |
| `119e9aa` | **laço de redirecionamento do primeiro usuário** |
| `a541964` | **S0** — `TRUNCATE`/`REFERENCES`/`TRIGGER` revogados, com `ALTER DEFAULT PRIVILEGES` |
| `a84cadb` | **S1** — `pdfjs-dist` 6.3.289, `next` 16.3.4, 0 vulnerabilidades |
| `d40f530` | **I1.0** — contrato: páginas 1–1000, seções ≤500 e ≤ páginas, procedência obrigatória |
| `096a257` | **I1.1a** — suíte descobre os testes |
| `a05a5ed` | **I1.1b** — contagem exata, árvore limpa, correspondência |
| `c17c7de` | **I1.1** — leitura única, assinatura, falhas nomeadas, outline |

Correções ao briefing, apuradas no banco: `ai_settings` **já estava limpa** —
são três tabelas com `TRUNCATE`, não quatro.

---

## O que falta

### I1.2 — agrupamento, procedência e prévia virtualizada

A ordem de confiança, definida pelo André:

1. **Outline do PDF** — estrutura declarada pelo autor. Já é lido, com destino
   resolvido e hierarquia (`src/lib/import/pdf.ts`).
2. **Título detectado visualmente** — não só "linha curta": posição, tamanho,
   fonte e ausência de repetição. A geometria já está preservada
   (`src/lib/import/texto.ts`), e cabeçalho/rodapé já são descartados antes.
3. **Faixa de páginas** — blocos de 8, `Páginas 40–47`, último menor.

Rótulos sugeridos só com evidência textual, nunca inventados. O vocabulário
típico de manual — Fundamentos, Marca, Cor, Tipografia, Elementos gráficos,
Fotografia, Tom de voz, Aplicações, Governança — serve para *sugerir*, não para
criar categoria.

Cada seção precisa guardar:

- `sourcePageStart` e `sourcePageEnd`
- título e método: `outline`, `heading` ou `page-range`
- confiança da heurística
- **texto integral das páginas, sem truncamento silencioso** — os limites atuais
  de parágrafos e caracteres em `draft.ts` precisam sair ou virar segmentação
  explícita

A prévia precisa ser **virtualizada** e deixar editar antes de publicar:
renomear, dividir, unir e mover páginas.

### I1.3 — matriz de navegadores e aceite

WebKit e Firefox entram no CI. Casos obrigatórios: **GE_ID000 (743 páginas)**,
PDF de 1.000 páginas, 100 MiB, assinatura inválida, sem texto, protegido,
corrompido. **Só então** o bucket sobe para 100 MiB — enquanto o fluxo não
estiver pronto, um arquivo grande ficaria órfão ou falharia depois do upload.

### Depois, na ordem do briefing

`M1` seleção de workspace/marca · `M2` assets e relatórios por `brand_id` ·
`A1` retrieval e limites de IA · `G1` papéis para IA · `Q1` navegação e
resiliência · `V1` remoção do legado visual.

---

## Erros meus registrados nesta sessão

Valem como aviso porque são de processo, não de código:

1. **Empurrei dois commits sem esperar o `verify` terminar**, e descrevi ambos
   como verdes. `e6cdfcc` estava vermelho no lint, o seguinte no navegador. Só
   `c17c7de` ficou verde. Conferir antes do push é regra.
2. **Relatei "20" e depois "22"** testes ocultos; o número é **9**.
3. Duas sondas de regressão, em sessão anterior, foram inócuas e não valiam como
   prova — código de servidor que nunca roda no cliente, e classe CSS trocada
   sem remover a que vencia.

---

## Armadilhas conhecidas do ambiente

- **O Next recusa duas instâncias no mesmo diretório.** Com `npm run dev` no ar,
  `npm run verify` falha ao subir o servidor do Playwright. Parar um antes do
  outro. Não afeta o CI.
- **Testes desta suíte importam por caminho relativo**, nunca por `@/` — o alias
  exige a configuração do Next e faria a compilação inteira parar. Há guarda.
- As fixtures de PDF são geradas por `scripts/gerar-fixtures-pdf.py`.
