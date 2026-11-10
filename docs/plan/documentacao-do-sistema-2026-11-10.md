# Documentação e governança do sistema — 10/11/2026

Levantamento feito sobre a `main` no commit `9a2aba0` (depois do merge do #252), seguindo a skill
`documentacao-governanca-ia`. **Fatos** vêm do código, das migrations ou do `CLAUDE.md`/ADRs, e dizem
onde. **Hipóteses** e **pendências** estão marcadas. Nada aqui é regra nova: onde faltava fonte, está
escrito "não verificado".

O que este documento NÃO é: não substitui os ADRs (valem sobre qualquer coisa aqui), não repete
`docs/plan/auditoria-2026-11-09.md` (segurança e desempenho) e não é plano de produto.

---

## 1. Resumo do projeto e objetivo

**Brennimark** é uma plataforma hospedada de gestão de marca, vendida a agências e a marcas (ADR-0003).
A agência importa o manual da marca em PDF; o PDF é a superfície de leitura (ADR-0006); o produto
organiza regras, assets, tipografia, paleta e grids, e o assistente de IA (Vini) responde citando a
fonte e o status de cada regra. Stack: Next.js 16.3.4 (App Router) na Vercel (região `gru1`),
Supabase (Postgres + Auth + Storage, com RLS), Stripe (só cartão) e e-mail transacional.

Também vendidos/oferecidos: **Brennimark Fonts** (aplicativo desktop, repositório separado), e as
ferramentas gratuitas do site (Kit, Cores, Grids).

**Fato-guia de produto:** honestidade editorial. Cada regra tem status `ready | draft | pending`; a IA
só usa em silêncio regra aprovada e nunca afirma o que não está documentado (`CLAUDE.md`, ADR-0004).

## 2. Modelo de domínio

Quatro níveis, da fronteira de isolamento para dentro:

```
workspace (conta/agência, quem paga)
 ├─ assinatura → plano
 ├─ workspace_members (owner, …)
 └─ brands (marcas)
     ├─ brand_members + concessoes_de_acesso (quem acessa o quê; capacidades)
     ├─ documento-fonte (PDF) → paginas, versões, chunks de texto
     ├─ conteúdo editorial: brand_documents / versões (status ready|draft|pending)
     ├─ brand_assets / brand_asset_items (biblioteca de assets, fontes, logo)
     ├─ paleta_da_marca, tipografia_da_marca, regras_do_logo, regras_de_grid
     ├─ complementos (+ versões, trechos, rascunhos)
     ├─ conversas → mensagens (Vini), analysis_runs
     └─ links_de_entrega (+ acessos, arquivos) — entrega com prazo
```

Camadas transversais: **IA** (`ai_ledger` razão de custo, `ai_budgets`, `ai_settings` legado),
**cobrança** (`assinaturas`, `planos`, `precos_do_plano`, `pacotes_de_perguntas`,
`eventos_de_cobranca`), **conformidade** (`registros_de_acesso`, `brand_access_log`,
`aceites_de_documentos`, `versoes_do_termo_de_fonte`), **equipe Brennimark** (Console, função
`sou_da_equipe_brennimark`), **site/aquisição** (`cadastros_gratuitos`, `envios_de_email`,
demonstração), **Fonts** (`fonts_pareamentos_de_dispositivo`, licenças).

Duas fronteiras de código, fatos de `CLAUDE.md`:
- **Plataforma × marca:** tokens `--platform-*` na moldura, `--brand-*` só dentro do `BrandCanvas`;
  guarda em `src/platform/leak-guard.test.ts`.
- **Interface × autorização:** capacidades (`consultar`, `editar`, `aprovar`, `administrar`) decidem o
  que aparece; RLS e verificação de papel decidem o que é permitido.

## 3. Entidades principais e responsabilidades

| Entidade | Responsabilidade | Quem escreve | Observação verificada |
|---|---|---|---|
| `workspaces` | conta, fronteira de cobrança e de dados | fluxo de cadastro/compra, serviço | RLS por membro |
| `workspace_members` | papel na conta (`owner` administra) | admin da conta | usado nas policies |
| `brands` / `brand_members` | marca e acesso por marca | admin | acesso por marca desde 13/09; policy de leitura única desde 10/11 |
| `brand_source_documents` / `_pages` | PDF-fonte e manifesto por página | importação | travas por constraint, `prova-manifesto-por-pagina.sh` |
| `brand_assets` / `brand_asset_items` | biblioteca, fontes, kit | quem edita | fonte só para download a membro autenticado, com aceite de termo |
| `paleta_da_marca`, `tipografia_da_marca`, `regras_do_logo`, `regras_de_grid` | regras estruturadas com status | quem edita; "aprovar" é capacidade à parte | status não é promovido por ganhar imagem |
| `ai_ledger` | razão do custo de IA (reservado/liquidado) | só função de banco | provado sob concorrência |
| `planos`, `precos_do_plano`, `assinaturas` | oferta e estado de cobrança | Console / webhook Stripe | colunas legíveis pelo navegador reduzidas a públicas (conferido em produção) |
| `pacotes_de_perguntas` | perguntas avulsas compradas | só webhook (chave de serviço) | idempotente por `(provedor, sessao_externa)` |
| `links_de_entrega` | entrega com prazo, endereço aparece uma vez | quem edita | só o hash no banco |
| `limites_de_taxa` | contador do limite por IP/chave | só função de banco | sem policy; só `service_role` executa |
| `chaves_de_ia_da_conta`, `registros_da_ia_propria` | IA própria do plano sem IA | só funções de banco | chave cifrada nunca volta ao navegador |

Decisões pendentes de domínio, vindas dos ADRs e não decididas por este levantamento: nome definitivo
do produto ("nome de trabalho"), preços finais (`precificacao`), texto jurídico do termo de fonte v1
(sem advogado).

## 4. Casos de uso prioritários

Resumo; cada um cita onde vive. Formato completo (pré-condição, erros) só para os que carregam risco.

1. **Importar o manual em PDF** — agência (editar). `api/documento-fonte/registrar` + Storage. Teto 100 MiB
   do produto, 50 MB do plano atual; a recusa diz qual limite barrou.
2. **Ler o manual** — qualquer membro. `api/documento-fonte/[id]` com `HEAD` + `Range`; nunca resposta
   acima de 4 MiB; invariante testada no navegador.
3. **Perguntar ao Vini** — membro com a IA ligada. `api/ai/chat`; reserva no `ai_ledger` antes da chamada;
   franquia de perguntas do plano; cita fonte, status e caminho.
4. **Aprovar regra** (paleta, tipografia, grid, logo) — capacidade `aprovar`. Só regra aprovada entra
   em prompt em silêncio.
5. **Baixar a fonte da marca / kit** — membro autenticado daquela marca, com termo aceito no envio;
   nunca por link de entrega.
6. **Entregar por link com prazo** — `api/links`, `/receber/<código>`.
7. **Assinar/comprar pacote** — Stripe checkout → webhook → crédito. Pacote pago sem crédito agora
   alerta a equipe e aparece no Console (#248).
8. **Cadastro gratuito (Kit/Cores/Grids)** — `api/cadastro` com limite de taxa e Turnstile opcional.
9. **Definir/trocar senha** — três rotas, todas com checagem de senha vazada (#252).
10. **Operar a plataforma** — Console (`api/console/*`), só equipe.
11. **Excluir conta aos 12 meses / exportar** — `api/manutencao/contas-canceladas` (cron),
    `api/configuracoes/exportacao/*`.

Teste de referência por caso: `e2e/*.spec.ts` (navegador) e provas `scripts/prova-*.sh` (banco).

## 5. Regras de negócio confirmadas (fonte: `CLAUDE.md` e ADRs 0002–0009)

- Nenhuma conta escolhe a IA **no plano com IA** (ADR-0008); no plano sem IA a conta conecta a própria,
  chave cifrada e nunca revelada (ADR-0009). Manual de cliente real nunca passa por chave de plano
  gratuito.
- Só regra aprovada vai em prompt em silêncio; rascunho só se identificado (ADR-0004 §3.2).
- A plataforma **hospeda** a fonte da marca, com: termo aceito antes (versão numerada, a cada envio),
  aceite registrado pelo banco, download só para membro autenticado, retirada por quem administra
  (ADR-0007 §3).
- Entrega por link: endereço aparece uma vez, só o hash no banco, com prazo; fonte nunca entra.
- Nenhuma resposta do transporte do PDF passa de 4 MiB; o teto apara (`206`), não recusa.
- Toda mudança de banco: migration versionada, RLS, índice e teste de autorização negativo (conta A
  não lê a B). Função `SECURITY DEFINER` nova: `revoke` de `anon`/`authenticated` e `search_path` vazio.
- Histórico de migrations do repositório = ledger de produção (`supabase/historico-remoto.txt`).
- Nunca apagar, reescrever ou normalizar dados, histórico ou assets em silêncio.
- O codinome técnico legado não pode voltar a aparecer em interface, venda, domínio ou contrato.

Regras de preço e franquia (R$ 29/100 e R$ 119/500 perguntas, escada de planos) estão em
`pacotes.ts`, nas migrations e na memória do projeto, **não** num documento de produto único — ver §8.

## 6. Mapa de responsabilidades técnicas

| Camada | Onde vive | Responsabilidade |
|---|---|---|
| Rotas/páginas | `src/app/` (`(site)` público, `w/…` área logada, `api/`) | receber pedido, autenticar, chamar `lib` |
| Componentes | `src/components/<área>/` | renderizar e coletar; não decidir permissão |
| Regras de negócio | `src/lib/<área>/` (cobranca, ai, assets, links, documento-fonte, …) | casos de uso, validação, portas testáveis |
| Autorização real | RLS + funções `private.*`/`public.*` + `sou_da_equipe_brennimark` | decide o que é permitido |
| Plataforma × marca | `src/platform/` | tokens, capacidades, locale, guardas de vazamento |
| IA | `src/lib/ai/` (`getModel()` único), `src/lib/ia-propria/` | roteamento, razão, chaves |
| Segurança transversal | `src/lib/seguranca/` (limite de taxa), `src/lib/acesso/` (senha vazada) | defesas reutilizáveis |
| Integrações | `src/lib/cobranca/` (Stripe), `src/lib/email/`, Turnstile | adaptadores com portas |
| Banco | `supabase/migrations/` + `scripts/prova-*.sh` | schema, RLS, provas |
| Tarefas agendadas | `vercel.json` (4 crons de manutenção, `CRON_SECRET`) | limpeza e exclusões |

Padrão visível e bom: o webhook de cobrança usa **portas** (`Portas`) injetadas, o que permite
testar sem Stripe. Acoplamento a vigiar: rotas em `api/` ainda decidem autenticação linha a linha
(§8, item 6).

## 7. Mapa de dados, APIs e permissões

### 7.1 APIs (92 rotas em `src/app/api`, agrupadas por mecanismo de autorização)

Conferido por leitura do código; "sessão" = usuário autenticado pelo Supabase com RLS ligada.

| Grupo | Rotas | Autorização |
|---|---|---|
| Edição da marca | `admin/{brand,content,assets,paleta,tipografia,pessoas,…}` | sessão + capacidade; RLS no banco |
| Vini | `ai/{chat,analyze,prompt}`, `conversas`, `analysis/history` | sessão; reserva no razão; `analysis/history` por `contextoDoHistorico` |
| Leituras estruturadas | `grids|kit|cores|…/regras(/ler,/aprovar)` | sessão; `aprovar` exige capacidade |
| Materiais e fontes | `assets`, `assets/[id]/download`, `assets/kit`, `assets/termo-de-fonte` | sessão, membro da marca, termo aceito |
| Entrega | `links`, `links/[id]/*` (sessão); `receber/[codigo]/baixar` (público, **limite 60/10 min**) | misto |
| Documento-fonte | `documento-fonte/[id]` (GET/HEAD), `/baixar`, `/registrar` | sessão; RLS prova o acesso |
| Cobrança | `cobranca/checkout` (público, **limite 20/h**), `pacote`, `portal`, `senha`, `situacao`, `stripe` (webhook, assinatura Stripe) | sessão, exceto checkout e webhook |
| Configurações da conta | `configuracoes/{ia,consumo,exportacao,plano,…}` | sessão + dona (RPCs checam `administra_a_conta`) |
| Conta/senha | `conta/esqueci-senha` (**10/h**), `nova-senha`, `trocar-senha` | sessão/token; senha vazada barrada |
| Cadastro gratuito | `cadastro` (**20/h**, Turnstile opcional), `cadastro/confirmar`, `cadastro/saida`, `sair/[token]` | público; serviço no servidor |
| Console | `console/{cobranca,cobranca/sem-credito,custos,email,exportacoes,fonts,ia,operacao}` | `sou_da_equipe_brennimark` |
| Fonts | `fonts/pareamento` e `/consultar` (anon, por desenho; **teto 300/h global** após o #250), `/aprovar` (sessão) | misto |
| Demonstração/idioma | `demonstracao/*`, `idioma` | login anônimo/cookie |
| Manutenção | `manutencao/*` (4) | `CRON_SECRET` |

Não há inventário gerado por máquina das rotas: esta tabela é manual e envelhece (§9).

### 7.2 Tabelas (62 em `public`, por migration)

Lista completa e RLS por tabela vivem nas migrations; as provas confirmam o que importa:
`scripts/prova-funcoes-executaveis.sh` (quem executa cada função), `prova-teto-e-franquia-da-ia.sh`,
`prova-ia-por-plano.sh`, `prova-limites-de-taxa.sh`, `prova-indices-e-brand-members.sh`, entre as 105
provas versionadas. Estado em produção conferido em 09–10/11: anon sem privilégio em `limites_de_taxa`;
anon executa apenas `consultar_/solicitar_pareamento_fonts`; `authenticated` só as 43 funções não-Console
da lista aprovada; as 30 `console_*` recusam quem não é da equipe (42501).

### 7.3 Permissões por recurso (resumo)

| Recurso | Ler | Escrever | Onde valida |
|---|---|---|---|
| Conteúdo/regras da marca | membro da marca | `editar`; `aprovar` à parte | RLS + capacidade |
| Fonte da marca (download) | membro autenticado da marca | upload com aceite do termo | RLS/Storage + função |
| Plano/preço | colunas públicas só | Console (equipe) | grants de coluna + RPC |
| `ai_ledger`, `limites_de_taxa`, `pacotes_de_perguntas` | dona (pacotes) / ninguém | só função de serviço | revoke + RLS |
| Chave de IA da conta | ninguém (só os últimos dígitos) | admin da conta | RPC `SECURITY DEFINER` |
| Console | equipe | equipe | `sou_da_equipe_brennimark` no backend |

### 7.4 Variáveis de ambiente (nomes; valores nunca em arquivo)

| Variável | Pública? | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim (browser) | cliente Supabase |
| `SUPABASE_SECRET_KEY` | **não** | cliente de serviço, só no servidor |
| `CRON_SECRET` | não | autentica os 4 crons |
| `BRENNIMARK_CHAVE_<PROVEDOR>` (Google, Groq, Anthropic, OpenAI, OpenRouter, Ollama) | não | IA da plataforma; nunca ao banco |
| `AI_SETTINGS_ENCRYPTION_KEY` | não | ler chaves antigas cifradas; **não apagar** |
| `BRENNIMARK_CHAVE_STRIPE`, `BRENNIMARK_SEGREDO_WEBHOOK_STRIPE` | não | cobrança |
| `BRENNIMARK_CHAVE_EMAIL`, `BRENNIMARK_EMAIL_REMETENTE` | não | e-mail transacional |
| `BRENNIMARK_TURNSTILE_SECRET` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | segredo / pública | captcha do cadastro; **só vale com as duas** — pendente do André |
| `BRENNIMARK_CHAVE_LICENCAS_FONTS` | não | assina certificados do Fonts (Ed25519, PEM) |
| `NEXT_PUBLIC_TETO_DE_IMPORTACAO_MB` | sim | teto do plano (50) |
| `BRENNIMARK_BASE_URL`, `BRENNIMARK_EVAL_*`, `BRENNIMARK_ALLOW_EXTERNAL_EVAL`, `BRENNIMARK_DEV_SKIP_AUTH` | não | avaliação e desenvolvimento; `DEV_SKIP_AUTH` nunca em produção |

`VERCEL_PROJECT_PRODUCTION_URL`, `PORT`, `PORTA_DO_E2E`, `CI`, `NODE_ENV` são lidas no código mas
vêm da plataforma/teste e por isso não estão em `.env.example`.

## 8. Hardcodes, duplicidades e inconsistências

1. **CLAUDE.md e ADR-0009 estão defasados (inconsistência confirmada).** Ambos dizem que a IA própria
   "ainda NÃO está construída: nenhuma conta escolhe ou configura IA". Mas o ledger de produção tem
   `20261107184907 ia_por_plano` e `20261108140544 ia_propria_teto_e_franquia`; existem as rotas
   `api/configuracoes/ia/{chave,teto,termo,testar}`, as tabelas `chaves_de_ia_da_conta` e
   `registros_da_ia_propria` e as provas `prova-ia-por-plano.sh` e `prova-teto-e-franquia-da-ia.sh`.
   **Corrigido neste PR** (CLAUDE.md e status do ADR-0009). O que continua só na memória do projeto, e
   não verifiquei: se os planos sem IA estão à venda.
2. **Valores comerciais espalhados:** preços dos pacotes em `src/lib/cobranca/pacotes.ts` (R$ 29 e
   R$ 119) e de planos na tabela `precos_do_plano` (Console). Risco: mudar num lugar e não no outro. O
   #248 já trava o crédito do pacote se o valor pago divergir do catálogo, o que reduz o dano, não a
   duplicação. Pendente de decisão: fonte única.
3. **Limites de taxa em número solto:** 20/h cadastro, 10/h esqueci-senha, 60/10 min download, 20/h
   checkout, nas quatro rotas; 300/h e 12/10 min no SQL do pareamento. Funcionam, mas não há um lugar
   que liste todos. Esta tabela (§7.1) é, hoje, esse lugar.
4. **Tabelas sem uso:** `ai_settings` e `ai_routing_policies` ficam no banco "sem uso" por decisão
   registrada (ADR-0008); o nome "Provedores de IA" ainda aparece em testes de navegação
   (`coluna.test.ts`) e um comentário em `navigation.ts` ainda cita `ai_settings` como vivo. Rótulo de
   teste, não de produto, mas confunde quem lê.
5. **Documentos históricos convivem com os vigentes:** `docs/ARCHITECTURE.md`, `PRODUCT_ARCHITECTURE.md`,
   `BRENNIMARK_MATRIX.md` (marcados) e `docs/CHANGELOG.md`, cuja última entrada é de 21/07/2026 e fala
   em "instância replicável", modelo que o produto abandonou. O CHANGELOG não é fonte de nada hoje.
6. **Autorização repetida rota a rota:** 92 rotas, cada uma abre sessão e checa papel à mão. Não achei
   rota sem proteção, mas nada **impede** a próxima de esquecer; a defesa real é RLS, que é a certa.
   Recomendação: teste automático que lista as rotas e exige um marcador de autorização declarado
   (público, sessão, equipe, cron, webhook).
7. **Nome do produto "de trabalho"** ainda não definitivo; o codinome legado é barrado por `src/platform/codinome.test.ts`.
8. **Pendência de segurança em aberto, de ação do André:** ativar Turnstile (variáveis acima) e conferir
   regra de limite no Firewall da Vercel (plano Free: 1 regra por projeto; o plano pago amplia). O
   limite no banco (#249) já cobre as quatro rotas sem depender disso.

## 9. Riscos de perda de contexto e alucinação da IA

| Risco | Sinal concreto neste repositório | Mitigação existente | Lacuna |
|---|---|---|---|
| Doc desatualizada contradiz código | item 1 do §8 (IA própria) | ADRs com regra "corrige o CLAUDE.md no mesmo commit" | ninguém confere depois; ver §10 |
| Regra só na memória do assistente | preços, "fora de venda", decisões de 08–09/11 vivem em `~/.claude/.../memory`, não no repositório | CLAUDE.md e ADRs para o estrutural | memória é pessoal do André; outro assistente ou pessoa não a vê |
| Afirmação falsa repetida | CLAUDE.md afirmou "sem remoto" e "CI nunca rodou" até 10/09; auditoria dizia que `planos` expunha o teto, e produção mostrou que não | correção datada no próprio CLAUDE.md | exigir **evidência no mesmo texto** (arquivo/consulta) |
| Prova falsa-positiva | provas já trataram qualquer erro como sucesso | regra: conferir o **nome exato** da constraint, dado isolado por caso | revisão por quem escreve a prova seguinte |
| Teste verde local, CI vermelho | 3 commits em 09/09 | `npm run verify` inteiro antes de push | suíte de navegador oscila sob carga (`site-idioma`, `importador-leitura`) |
| Next.js 16 diferente do treino da IA | `AGENTS.md` manda ler `node_modules/next/dist/docs/` | já mandado | — |
| Custom property resolvida onde é declarada, função não atravessa Server→Client | armadilhas já registradas em CLAUDE.md | registradas | sem teste que as pegue |
| Migrations que divergem do ledger | divergiu uma vez; `db push` teria reaplicado | `historico-de-migracoes.test.ts` + `historico-remoto.txt` | processo manual de renomear ao aplicar |

Checkpoint recomendado para qualquer assistente antes de implementar: confirmar (a) o ADR vigente
da área, (b) a existência da tabela/coluna/função no **ledger**, (c) a versão do Next, (d) que a
afirmação que vai usar tem arquivo ou consulta como fonte.

## 10. Governança técnica recomendada

Já existe e deve ser mantido: ADRs numerados com status; `CLAUDE.md` e `AGENTS.md`; worktree e branch por
fatia, `git add` por caminho; `npm run verify` completo antes de push; CI por PR; 105 provas de banco
versionadas; aplicar migration em produção só com OK nominal, uma por vez, depois renomear ao carimbo
real e registrar no histórico.

Propostas, pequenas e sem processo novo pesado:

1. **Critério de pronto único** (já espalhado): fluxo principal testado; autorização negativa provada;
   `verify` verde; migration no ledger; documento afetado atualizado **no mesmo PR**.
2. **Uma linha de "fonte" por afirmação factual** em CLAUDE.md/ADRs (arquivo ou migration). Foi a falta
   disso que deixou o item 1 do §8 vivo por dois dias.
3. **Teste de inventário das rotas** (§8, item 6) e um teste que compare `.env.example` com o que o
   código lê — o par barra variável documentada que não existe e variável usada que ninguém documentou.
4. **Mover para o repositório** as decisões que só vivem na memória pessoal e afetam o produto
   (planos/preços aprovados, o que está à venda). Sugestão: `docs/decisoes/` com um arquivo por decisão,
   data e quem decidiu. Não migrei nada: são decisões do André, e eu não quero transcrever à mão e errar.
5. **Revisão de segurança por quem não escreveu** antes de merge em mudanças de banco/autenticação/IA
   (os agentes `brennimark-security-reviewer` e `brennimark-acceptance-reviewer` já existem).

## 11. Documentação mínima do projeto

O que existe → o que falta:

| Documento mínimo | Situação |
|---|---|
| Visão geral do produto | `CLAUDE.md`, `README.md`, ADR-0003. Ok |
| Modelo de domínio | **este documento, §2–3** (antes: só `BRENNIMARK_MATRIX.md` histórico) |
| Casos de uso | **este documento, §4**; detalhe por caso ainda disperso |
| Mapa de APIs | **este documento, §7.1** (manual; ver proposta 3) |
| Mapa de tabelas | migrations; sem mapa legível além do §3 |
| Mapa de permissões | §7.3 + provas; a prova-funcoes-executaveis é a fonte executável |
| Mapa de env vars | §7.4 + `.env.example` (reescrito no #251) |
| Arquitetura de pastas | §6 |
| Registro de decisões | `docs/adr/` (0001–0009). Ok |
| Checklist de produção | §12 e `docs/plan/lista-de-lancamento.md` |
| Plano de testes | `npm run verify` + e2e + provas; sem documento único |
| Padrões de código | `CLAUDE.md` (armadilhas) |

Proposta de lugar: manter este arquivo como o **mapa do sistema** e atualizá-lo quando uma rota,
tabela ou variável nova entrar; está em `docs/plan/` por ser a convenção do repositório para estado.

## 12. Checklist de produção (situação em 10/11/2026)

Produto e domínio
- [x] Objetivo, entidades e casos prioritários documentados (este arquivo, ADRs)
- [ ] Nome definitivo do produto; texto jurídico do termo de fonte revisado por advogado

Arquitetura
- [x] Responsabilidades separadas (§6); UI não decide permissão sensível
- [ ] Autorização das rotas sem teste de inventário (§8.6)
- [ ] Fonte única para preços (§8.2)

Segurança e dados
- [x] Endpoints sensíveis exigem sessão ou segredo; Console valida equipe no banco
- [x] Autorização negativa provada (conta A × B) em IA, pareamento, índices/brand_members, limites
- [x] Service role só no servidor; chaves de IA fora do banco e do navegador
- [x] Limite de taxa nas quatro rotas públicas/sensíveis (banco)
- [x] Senha vazada barrada nas três rotas de senha (HIBP, falha aberta)
- [ ] Turnstile ativo (variáveis, do André)
- [ ] Regra de limite no Firewall da Vercel (do André; Free permite 1)
- [ ] `auth_leaked_password_protection` do Supabase (não existe no Free; coberto em código só nas rotas do app, não em caminho direto do painel)

Banco e desempenho
- [x] Índices de chave composta, PK em `consumo_de_armazenamento`, policy única em `brand_members`
- [x] pdf.js carregado sob demanda; `pdf-lib` só em rota de servidor
- [x] Região das funções `gru1`, junto do Supabase

Testes e continuidade
- [x] Unidade, navegador e provas de banco; histórico de migrations igual ao ledger
- [ ] Suíte de navegador estável sob carga (2 testes oscilam)
- [x] Registro de decisões atualizado (ADR-0009 e CLAUDE.md corrigidos neste PR)

## 13. Próximos prompts recomendados

1. "Escreva um teste que liste todos os `route.ts` de `src/app/api` e exija em cada um um comentário
   `@acesso: publico|sessao|equipe|cron|webhook`; falhe se faltar. Marque as existentes conforme
   `docs/plan/documentacao-do-sistema-2026-11-10.md` §7.1. Rode `npm run verify`."
2. "Compare `.env.example` com as variáveis lidas no código (`process.env.*`) e crie um teste que
   falhe se houver uma usada e não documentada, ou o contrário. Liste as exceções da plataforma."
3. "Faça um PR que consolida preços (pacotes, planos) numa fonte única e remove a duplicação entre
   `pacotes.ts` e `precos_do_plano`. Antes, proponha o desenho e espere meu OK (é decisão de dados)."
4. "Crie `docs/decisoes/` e transcreva, **para eu revisar**, as decisões de planos e preços que hoje só
   estão na minha memória de assistente. Não publique sem minha aprovação."
5. "Estabilize `site-idioma` e `importador-leitura` na suíte de navegador sob carga, sem aumentar
   timeout às cegas: instrumente primeiro e diga a causa medida."
6. "Revise rótulos e comentários que ainda citam 'Provedores de IA' e `ai_settings` como vivos."
7. Quando André migrar a Vercel para o plano pago: "Configure no Firewall regras de limite por rota
   espelhando o §7.1 e registre em `docs/plan/`."
