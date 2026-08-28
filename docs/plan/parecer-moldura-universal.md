# Parecer — briefing da moldura universal

**Data:** 28/08/2026 · **Estado:** nenhuma linha de código alterada
**Briefing analisado:** `~/Documents/Codex/2026-08-28/a/outputs/briefing-code-moldura-universal.md` (550 linhas, 23 seções)

---

## 1. Resumo do entendimento

Implantar uma moldura responsiva que seja reconhecível como produto próprio e que permita a
qualquer marca ocupar o conteúdo sem contaminar os controles da plataforma. Preservar rotas,
dados, autenticação, IA, assets, administração e permissões. Comprovar contra quatro identidades
opostas. Entregar em fatias revisáveis, mantendo o aplicativo funcional entre elas.

O princípio — *a marca é o conteúdo, o aplicativo é o sistema* — é o mesmo a que o estudo
"A Moldura Neutra" chegou por outro caminho. **O briefing e o estudo concordam na tese.**

---

## 2. Auditoria: o que o código confirma

O briefing descreve o estado atual com precisão. Cada afirmação da §3 foi verificada.

### 2.1 Defeito vivo: a governança já vaza cor da marca

`src/components/docs/StatusBadge.tsx:25-27` pinta o selo editorial com o acento do cliente:

```ts
ready:   "border-release-analog-turquoise text-release-analog-turquoise",
draft:   "border-release-analog-blue text-release-analog-blue",
```

O componente renderiza em `DocPage.tsx:42`, dentro do `BrandCanvas`. Consequência: **"Pronto"
aparece na cor de acento da marca**. No Hairline sai verde-azulado; numa marca vermelha sairia um
selo "Pronto" vermelho, que se lê como alerta.

Isso não é risco teórico — é a §5.4 do briefing acontecendo hoje, e é o melhor argumento
individual a favor de toda a proposta.

O mesmo arquivo de 33 linhas carrega um segundo vazamento, de instância:

```ts
brandvilleInstance.key === "hairline" ? LABEL_CASE : ...
```

Um componente genérico de governança com lógica de um cliente específico — o que a regra §2.4 do
briefing de produto proíbe.

### 2.2 Escala do `release-analog-*`

**39 arquivos, ~300 ocorrências.** Concentração nas superfícies que são puramente plataforma:

| Superfície | Ocorrências |
|---|---:|
| `/docs/analise` | 26 |
| `DocsNav` | 23 |
| `/docs/configuracoes/ia` | 23 |
| `/docs/historico` | 20 |
| `/docs/chat` | 16 |

Nuance que a auditoria acrescenta ao briefing: essas telas **já renderizam em cores de plataforma**,
porque o escopo do tema foi movido e elas ficam fora do `BrandCanvas`. Estão certas por acidente,
através de um token batizado com o nome de um release do The BluesMaker. É frágil: quem ler
`release-analog-turquoise` em `analise/page.tsx` conclui, razoavelmente, que aquilo é cor da marca.

### 2.3 A letra `B`

`DocsNav.tsx:278` — literal, em `text-release-analog-turquoise`. Confirmado.

### 2.4 `DocsNav` acumula responsabilidades

414 linhas, 16 hooks, concentrando rail, painel expandido, drawer mobile, command palette, tooltip
em portal e seleção de grupo. A extração proposta na §10 é justificada.

### 2.5 Fronteira atual do canvas

Só `src/app/docs/[...slug]/page.tsx` está dentro do `BrandCanvas`. As utilitárias estão fora.
A §3 do briefing está correta, mas o vazamento de governança é mais estreito do que sugere:
concentra-se no `DocPage` e nos blocos.

---

## 3. Onde o briefing corrige o que eu construí

**A nomenclatura implícita de tokens é uma limitação real da minha implementação.**

Implementei sombreamento implícito: as mesmas variáveis (`--color-surface-primary`) redefinidas em
escopo diferente. Funciona para pintar, e mantém o diff pequeno. Mas tem um defeito que só aparece
agora: **um componente dentro do canvas não consegue pedir cor de plataforma.** Não existe token a
que ele possa se referir — as variáveis de plataforma foram sobrescritas pela marca naquele escopo.

É exatamente o que o `StatusBadge` precisa fazer e não consegue.

Os namespaces explícitos da §6 resolvem isso, e o `PlatformSurface` da §10 é o componente que a
minha arquitetura não permite existir. **Adoto a proposta do briefing.**

---

## 4. Conflito que exige decisão

### `--platform-signal: #4057E8` contra o princípio 02 do estudo

O briefing propõe um azul para localização e ação funcional. O estudo aprovado concluiu que a
ênfase da interface deve ser acromática, porque toda cor entra em relação com a marca ao lado.

Os dois têm razão em parte:

- **A favor do azul:** "onde estou" é o sinal mais importante de uma interface, e resolver isso só
  com peso e tom é difícil. Toda ferramenta séria tem uma cor de sinal.
- **A favor do acromático:** o azul da moldura pode ser lido como cor da marca, e briga com marcas
  azuis.

**O próprio briefing contém o teste que expõe o problema:** a fixture `light-civic` é
"branco/azul" (§17). Uma moldura de sinal azul emoldurando uma marca azul é precisamente a colisão.

**Recomendação:** aceitar a cor de sinal, mas **confinada**. Ela aparece em anel de foco, item ativo
de navegação e botão de ação primária — sempre na moldura, nunca dentro nem encostada no canvas. Os
instrumentos contextuais da §5.3, que vivem sobre o conteúdo, usam neutro mais forma. E a fixture
azul entra como teste obrigatório de aceite, não opcional.

Se você preferir o acromático puro, a alternativa é: item ativo por barra de posição mais peso, e
anel de foco branco puro. É mais difícil de acertar e mais fácil de errar.

**Esta decisão é sua.**

---

## 5. Onde briefing e estudo se reforçam

- **Tipografia de sistema como provisória** (§7): coincide com o que já está no código. E o estudo
  acrescenta um argumento que o briefing não usa — cobertura de alfabetos. Cliente que escreve em
  cirílico ou árabe não pode quebrar a interface. `system-ui` delega ao sistema operacional, então
  é provavelmente a resposta *certa* para o provisório, não apenas a conveniente.
- **Estado nunca só por cor** (§13, §16): é o princípio 04 do estudo, derivado de vermelho ser
  marca de banco e verde ser marca de plano de saúde.
- **`BrandCanvas` como boundary único** (§19.8): já implementado; falta documentar.

---

## 6. Riscos

| # | Risco | Gravidade | Mitigação |
|---|---|---|---|
| 1 | Migrar 39 arquivos de `release-analog-*` toca quase todo componente visual | **Alta** | Ordem da §6.3: plataforma pura primeiro (`analise`, `chat`, `historico`, `configuracoes`), depois genéricos do guide, nunca componentes exclusivos de instância |
| 2 | Refatorar `DocsNav` pode quebrar palette, drawer ou seleção de grupo sem teste que pegue | **Alta** | Não há teste de UI hoje. Extrair em passos, com verificação manual documentada por passo |
| 3 | Aliases temporários virarem permanentes | Média | Remover na Fase 5 só quando `grep` provar não uso |
| 4 | Bottom nav mobile muda navegação que hoje é drawer | Média | Comportamento novo, não substituição: manter rotas idênticas |
| 5 | Worktree tem 29 arquivos modificados não commitados | **Alta** | Commitar o estado atual antes de começar, senão fica impossível revisar o que é da moldura |
| 6 | Laboratório vazar para produção | Baixa | `notFound()` quando `NODE_ENV === "production"`, mais teste |

---

## 7. Plano por fases

Adoto a sequência da §20, com uma fase zero acrescentada.

| Fase | Escopo | Verificação |
|---|---|---|
| **0** | Commitar o worktree atual. Registrar rotas representativas antes da mudança | Baseline limpo, `lint`/testes/`build` verdes |
| **1** | Tokens `--platform-*` e `--brand-*` com aliases. Migrar `StatusBadge` primeiro — é o defeito vivo. Depois as quatro telas utilitárias | Selo de status idêntico nas 4 fixtures; `analise`/`chat`/`historico`/`configuracoes` sem `release-analog-*` |
| **2** | Extrair `DocsNav`: `AppShell`, `PlatformTopBar`, `DesktopSidebar`, `CommandPalette`. Remover a letra `B` | ⌘K, drawer, grupos e rotas idênticos |
| **3** | Bottom nav, guide sheet, more sheet | 320px, safe area, foco, teclado |
| **4** | Quatro fixtures e `/dev/shell-lab` | Matriz 4 fixtures × 4 larguras × claro/escuro |
| **5** | Regressão, remoção de aliases, documentação | Aceite §19 item a item |

Cada fase é um commit próprio, com o aplicativo funcional entre elas.

---

## 8. Sequenciamento: o que isto desloca

Há trabalho aprovado na fila que esta entrega adia:

- **WP0** está incompleto. Fechados: ordem de deploy, flag de autenticação, upload, baseline de
  migrations e drift. Abertos: runbook com teste de restauração executado, verificação autenticada
  de BYOK, reconciliação de documentação e teste de stack limpa em CI.
- **Instância Guitar Garage** — decisões já tomadas (registro oficina, 8 páginas por categoria),
  conteúdo mapeado, à espera de execução.

A moldura antes da Guitar Garage é defensável: a instância nasceria na arquitetura certa em vez de
precisar de ajuste. Mas WP0 tem itens de reprodutibilidade que não desaparecem.

**Não é decisão minha.** Registro para que seja explícita.

---

## 9. O que não vou inventar

Conforme §22: nome comercial, símbolo definitivo, tipografia paga, cor final do produto, mudança de
papéis ou rotas, dependência nova de UI, persistência de preferência de tema, esquema de banco.

A cor de sinal da §4 deste parecer entra nessa lista até você decidir.
