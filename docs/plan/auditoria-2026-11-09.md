# Auditoria de segurança, correções e desempenho — 09/11/2026

Somente leitura. Código lido em `origin/main` (dbc5564, inclui os PRs 245/246) via `git show`/`git grep`, porque o checkout local (`ajustes/verify-local`, 00d2927) está **275 commits atrás**. Banco: projeto `ijnpigdmlswhkxqbjeru`, só `SELECT` e `get_advisors`. Não li o branch do PR 247; a migration dele (`20261109133014 fonts_pareamento_aprovar_sem_anon`) já está em produção e foi considerada.

Legenda: **Confirmado** = visto no banco ou no código. **Hipótese** = plausível, não provada. **Não validado** = não consegui checar daqui.

## 1. Resumo executivo

Não achei nenhuma falha crítica de isolamento entre contas. A base é mais sólida que a média: RLS ligado nas 59 tabelas de `public`, `anon` sem acesso direto a nenhuma tabela, as 3 buckets privadas, todas as 125 funções `SECURITY DEFINER` com `search_path` vazio, e as funções de equipe/conta checando papel dentro do corpo (`private.eh_da_equipe()`, `private.administra_a_conta`, membership).

Os riscos reais para a semana da Happy House são operacionais, não de vazamento: (a) **ausência total de limite de taxa** em rotas públicas que mandam e-mail ou gravam no banco; (b) **proteção contra senha vazada desligada** no Supabase Auth; (c) **cobrança de pacote avulso pode ficar "paga e não creditada"** sem alerta; (d) a regra "revoke execute de `authenticated`" do CLAUDE.md **não vale hoje** para 73 funções — a proteção real é a checagem interna, o que é aceitável, mas a regra escrita está desatualizada.

## 2. Achados críticos

Nenhum confirmado. O mais próximo de crítico é o item A1 (abaixo), por ser abuso de e-mail em escala antes de um cliente real.

| # | Sev. | Status | Achado |
|---|---|---|---|
| A1 | **Alto** | Confirmado (código) | Sem rate limit nenhum. `POST /api/cadastro` só tem honeypot, sem captcha: qualquer pessoa pode disparar e-mail de confirmação para endereços de terceiros (bombardeio e queima de reputação do Resend). |
| A2 | **Alto** | Confirmado (advisor) | `auth_leaked_password_protection` desligado. Os primeiros usuários da Happy House podem usar senhas já vazadas. |
| M1 | Médio | Confirmado (código) / impacto hipótese | Crédito de pacote avulso: se `creditar_pacote_de_perguntas` falha (ex.: conta sem franquia, erro 22023), o webhook responde 500 e o Stripe repete por dias; a pessoa já pagou. Não há alerta nem estorno automático. |
| M2 | Médio | Confirmado | `solicitar_pareamento_fonts` é chamável por `anon`; o limite (12 por 10 min) usa `p_origem_hash`, que **o cliente envia**. Dá para encher `fonts_pareamentos_de_dispositivo` variando o hash. Sem vazamento, mas é crescimento sem teto. |
| M3 | Médio | Confirmado | A regra do projeto (revoke de `authenticated`) diverge da realidade: 73 funções executáveis por `authenticated` (advisor 0029). Inclui `console_*` (protegidas por `private.eh_da_equipe()`, verificado em 8 delas) e `guardar_chave_de_ia`/`conceder_acesso` (checam dono). Risco: a próxima função esquecer a checagem. |
| B1 | Baixo | Confirmado | `planos` legível por `anon` (`using true`) com colunas internas (`teto_mensal_do_vini_micros`, `armazenamento_bytes`). Revela custo interno de IA por plano. |
| B2 | Baixo | Confirmado | Webhook confere `currency` mas não confere `amount_total == pacote.valorCentavos`; usa o valor do Stripe só para registro. |
| B3 | Baixo | Confirmado | `.env.example` desatualizado (fala de BYOK/GROQ, não lista `BRENNIMARK_CHAVE_*`, `BRENNIMARK_CHAVE_STRIPE`, `BRENNIMARK_SEGREDO_WEBHOOK_STRIPE`, `SUPABASE_SECRET_KEY`, `BRENNIMARK_TURNSTILE_SECRET`). |
| B4 | Baixo | Confirmado | Bucket `brand-imports` com limite 100 MiB, enquanto o plano diz 50 MB. Coerente com o CLAUDE.md (limite global do Supabase vence), só vale lembrar ao migrar. |

## 3. Performance de frontend

- Problema: 94 arquivos `"use client"`; dependências pesadas `pdfjs-dist`, `pdf-lib`, `fflate`. **Hipótese**: bundle inicial grande nas páginas com PDF.
- Evidência: `package.json`; não rodei `next build` (sem escrita) nem Lighthouse. **Não validado.**
- Boa prática já presente: visualizador usa `Range` e teto de 4 MiB por resposta (CLAUDE.md); funções na região `gru1` (leituras de 4 s para 0,8 s).
- Ação: medir `next build` e conferir que `pdfjs-dist` carrega por `dynamic import` só na tela do manual.

## 4. Banco de dados e queries

- 44 FKs sem índice de cobertura (advisor 0001), a maioria em colunas de autoria (`criado_por`) e compostas `(brand_id, workspace_id)`: baixo impacto hoje (poucas linhas), mas `DELETE` em cascata de marca/conta (exclusão aos 12 meses) varre essas tabelas. Prioridade média-baixa; o par composto `brand_workspace_fkey` em `analysis_runs`, `brand_chunks`, `ai_ledger` é o que vale indexar primeiro.
- 45 índices nunca usados (advisor 0005): ruído com pouca base de uso; **não remover agora**, amostra pequena.
- `public.consumo_de_armazenamento` sem chave primária.
- `brand_members` tem 2 policies SELECT permissivas para `authenticated` (advisor 0006): custo pequeno, unificar com `OR`.
- `GET /api/links` pagina `acessos_de_link` em laço de 1000 e agrega em JS: correto, mas é N+1 por link muito usado. **Hipótese** de lentidão só com volume.
- Não rodei `EXPLAIN ANALYZE` (poderia, mas as tabelas têm pouco dado; resultado seria enganoso).

## 5. Segurança e RLS

Confirmado em produção:
- RLS ligado em todas as tabelas de `public` (59/59); `anon` sem `select/insert/update/delete` em nenhuma.
- 14 tabelas com RLS e **zero policies** (`cadastros_gratuitos`, `chaves_de_ia_da_conta`, `eventos_de_cobranca`, `precos_do_plano`, `registros_de_acesso`…): intencional, só `service_role`/DEFINER acessam. Correto para segredos.
- Policies com `using true`: apenas `planos` (SELECT anon+auth) e `versoes_do_termo_de_fonte` (SELECT auth). Nenhuma de escrita.
- Funções `SECURITY DEFINER`: 100% com `search_path=""`. Executáveis por `anon`: só `solicitar_pareamento_fonts` e `consultar_pareamento_fonts` (pareamento do Fonts, desenho intencional; `aprovar_pareamento_fonts` já não é de `anon`, corrigido em 09/11). `consultar_` exige `id` + hash de 64 hex do segredo; sem enumeração.
- Storage: 3 buckets `public=false`; policies por `tem_capacidade_no_caminho` / `tem_capacidade_na_marca`; `brand-imports` com fallback "dono da conta" só para PDF sem marca.
- Funções de equipe: `console_*` checam `private.eh_da_equipe()` (lido em `console_contas`, `console_definir_plano`, `console_pausar_plataforma`, `console_fonts_criar_licenca`). Não li as outras ~22 das 30 `console_*` uma a uma: **não validado** para todas — recomendo teste automático (ver §8).
- Funções de conta: `usos_do_vini_da_conta`, `caminhos_da_exportacao`, `guardar_chave_de_ia`, `login_provisorio_da_conta`, `kill_switch_ativo`, `situacao_de_cobranca_da_conta` checam membership/dono. `posso_usar_o_vini` não checa membership, mas só devolve boolean sobre o próprio usuário.
- Auth: leaked password protection desligado (A2).

## 6. Exposição de dados (rotas `src/app/api/`, `origin/main`)

- 70+ rotas. Padrão dominante bom: sessão do usuário + RPC/RLS decide; rotas públicas validam por segredo próprio.
- `POST /api/cobranca/stripe`: assinatura verificada com `constructEventAsync` antes de qualquer banco; 400 sem assinatura válida. Nada do corpo vai ao log.
- `POST /api/receber/[codigo]/baixar` (público): autorização é o código do link, conferido por `abrir_link_de_entrega` (hash, service-only); URL assinada de 120 s, `no-store`. Sem limite de taxa (A1).
- `/api/manutencao/*` (cron): `CRON_SECRET` obrigatório, 401 sem ele.
- `/api/console/*`: rpc `console_*`; recusa vira 404 (Console "não existe" para quem não é equipe). Bom.
- `/api/configuracoes/ia/chave|testar`: só dono; chave cifrada AES-256-GCM, nunca devolvida, resposta é código, nunca mensagem do provedor; sem endereço de API livre (sem SSRF). `versao_da_chave_mestra` fixo em 1: sem plano de rotação da chave-mestra.
- `/api/conta/esqueci-senha`: resposta idêntica exista o login ou não (sem enumeração); throttle por usuário via `app_metadata`, mas sem limite por IP.
- `/api/demonstracao/entrar` tem Turnstile e teto de corpo; `/api/cadastro` não tem captcha (A1).
- Não encontrei IDOR: rotas de recurso por `[id]` (`links`, `complementos`, `conversas`, `assets`) passam por RLS ou RPC com checagem.

## 7. Chaves, secrets e variáveis de ambiente

- `NEXT_PUBLIC_*` só contém URL e anon key do Supabase (seguras). Nenhum secret com prefixo público.
- `SUPABASE_SECRET_KEY` lida só em `src/lib/supabase/service.ts` e 2 rotas de assets, todas server-side.
- `BRENNIMARK_CHAVE_*`, `BRENNIMARK_CHAVE_STRIPE`, `BRENNIMARK_SEGREDO_WEBHOOK_STRIPE` lidas só no servidor.
- `.env.local` está no `.gitignore`; nenhum `.env*` versionado exceto `.env.example`. `git log -S service_role` só acha mensagens de commit de migrations (sem chave).
- `BRENNIMARK_DEV_SKIP_AUTH`: `next.config.ts` derruba o build em produção; porém o `middleware.ts` não repete a checagem em tempo de execução. **Hipótese**: baixa; exige alguém pôr a variável na Vercel e fazer redeploy (o build quebraria antes).
- Não rodei `gitleaks` nem varredura completa do histórico: **não validado**. Valores reais das variáveis na Vercel: **não validado**.

## 8. Testes técnicos recomendados

1. Teste que lista, a partir do catálogo, toda função `SECURITY DEFINER` executável por `authenticated` sem `auth.uid()`/`eh_da_equipe`/membership no corpo, e falha o CI. Fecha M3 de forma permanente.
2. Teste negativo por chamada: conta A, via RPC, tentando `console_*`, `guardar_chave_de_ia` e `pessoas_da_conta` da conta B (existem `scripts/prova-*.sh`; conferir cobertura das funções novas de 08/11).
3. Teste do webhook: pacote com `amount_total` diferente do catálogo; conta sem franquia (M1); evento repetido.
4. Teste de abuso: 50 chamadas a `/api/cadastro` com e-mails diferentes devem ser contidas (depois da correção A1).
5. Teste de `anon` chamando `solicitar_pareamento_fonts` 100x com `origem_hash` distintos (M2).

## 9. Qualidade técnica e manutenção

- Pontos fortes: testes de arquivo por regra de segurança (`leak-guard.test.ts`, `codinome.test.ts`), 30+ provas SQL versionadas, ADRs, log estruturado sem corpo de cliente.
- Dívida: checkout local 275 commits atrás (risco de auditar/rodar versão velha); regra de `revoke` do CLAUDE.md desatualizada; `.env.example` obsoleto; tabelas `ai_settings`/`ai_routing_policies` e `crypto.ts` mantidas "sem uso".

## 10. Checklist de implementação (ordem sugerida)

- [ ] Ligar "Leaked password protection" no painel do Supabase Auth (A2, 2 min, reversível).
- [ ] Limite de taxa + Turnstile em `/api/cadastro`; limite por IP em `/api/conta/esqueci-senha` e `/api/receber/*` (A1).
- [ ] Alerta (log com `level:error` vigiado, ou e-mail à equipe) quando `eventos_de_cobranca.resultado = 'falhou'` por mais de 1 h (M1).
- [ ] Validar `amount_total` contra o catálogo no webhook (B2).
- [ ] Mover o limite de `solicitar_pareamento_fonts` para o servidor (IP real) ou adicionar teto global por hora (M2).
- [ ] Atualizar o CLAUDE.md: "funções para `authenticated` são permitidas quando checam papel internamente; teste X impõe".
- [ ] Atualizar `.env.example` (B3).
- [ ] Trazer o checkout local para a `main` antes de qualquer trabalho novo.

## 11. Métricas antes/depois

- Nº de funções `SECURITY DEFINER` executáveis por `authenticated` sem checagem interna: hoje **não medido por teste** (alvo: 0, por CI).
- E-mails de confirmação/dia por IP em `/api/cadastro`: hoje ilimitado.
- Linhas em `fonts_pareamentos_de_dispositivo` e taxa de crescimento.
- Eventos `eventos_de_cobranca` com resultado `falhou` e idade.
- LCP/INP e tamanho do JS inicial da tela do manual (não medido).
- `get_advisors` security: 1 WARN auth + 75 WARN de função; performance: 44 FKs sem índice.

## 12. Arquivos completos corrigidos

Não entrego arquivo completo: a auditoria foi só de leitura e as correções dependem de decisões de produto (qual serviço de rate limit; Turnstile em `/api/cadastro`) e de nenhum arquivo ter sido fornecido por inteiro para reescrita. SQL de apoio, seguro para staging antes de produção:

```sql
-- B1: esconder colunas internas de planos para anon (decisão: manter leitura para authenticated)
-- Confirmar antes se o site público lê estas colunas.
revoke select on public.planos from anon;
-- ou expor só o necessário por view:
-- create view public.planos_publicos with (security_invoker = true) as
--   select codigo, nome, maximo_de_marcas, a_venda, ordem from public.planos where a_venda;
```

```sql
-- M2: teto global por hora, independente do hash enviado pelo cliente (esboço; testar em staging)
-- dentro de solicitar_pareamento_fonts, antes do insert:
--   if (select count(*) from public.fonts_pareamentos_de_dispositivo
--       where criado_em > now() - interval '1 hour') >= 300 then
--     raise exception 'limite temporário de pedidos de pareamento atingido' using errcode='P0003';
--   end if;
```

## 13. Conclusão

**Pronto para produção com a Happy House?** Sim para isolamento de dados: não encontrei caminho para a conta A ler a B. **Não ainda** para abrir cadastro público sem limite de taxa e com proteção de senha vazada desligada.

**As 3 ações mais importantes agora:**
1. Ligar a proteção contra senhas vazadas no Supabase Auth (A2) — dois minutos, sem código.
2. Pôr limite de taxa e captcha em `/api/cadastro`, `/api/conta/esqueci-senha` e `/api/receber/*` (A1).
3. Vigiar e alertar eventos de cobrança "falhou" e validar o valor pago do pacote (M1/B2) antes de vender o pacote de perguntas.

Limites desta auditoria: não executei `next build`, Lighthouse, `gitleaks`, nem testes de autorização negativos; não li o código do PR 247; não vi as variáveis da Vercel nem as configurações de Auth além do advisor.
