# Tour de demonstração — desenho da fatia (17/10/2026)

**Status:** proposta, nada construído. Decidido por André em 17/10: opção A (sessão anônima do Supabase,
o visitante vira membro `consultar` de uma conta Demonstração). O teste de 14 dias com o manual do
próprio assinante é uma fatia **posterior** e mexe em cobrança; não está aqui.

## 1. O que é

Um visitante do site clica em "Conhecer por dentro", entra sem cadastro num manual de exemplo e
conversa com o Vini. Não sobe nada, não edita, não vê pessoas nem configurações. A sessão dura 24 h.

## 2. Por que sessão anônima, e não rota pública

O visitante passa a ser um **usuário real** (`auth.users`, marcado `is_anonymous`), então o portão de
IA (`portaoDeIA`), a RLS, o orçamento por conta e a trava geral valem **sem código novo de
autorização**. Rota pública seria um segundo caminho até o Vini, a ser defendido à parte (ADR-0003,
condição 1: o tenant se resolve no servidor, a partir da sessão).

## 3. Escopo: onde cada coisa vive

| Camada | O que muda |
|---|---|
| Banco | 2 tabelas novas + 2 funções; nenhuma tabela existente é alterada |
| Backend | `POST /api/demonstracao/entrar`; contador no `/api/ai/chat`; cron de limpeza em `/api/manutencao/` |
| Frontend | página `/demonstracao` (caminho exato, sem sessão), faixa "Você está no tour" com saída para `/assinar` |
| Infra | ligar *Anonymous sign-ins* no Supabase; Turnstile (decisão 2); entrada no `vercel.json` do cron |

## 4. Banco

Uma **conta própria** "Demonstração" (workspace dedicado) com a marca de exemplo dentro. Nunca a conta
de André: o acesso por marca (13/09) já é a cerca, mas a conta separada é a segunda.

- `private.demonstracao_config` — linha única: `workspace_id`, `brand_id`, `ativo`,
  `perguntas_por_visitante` (padrão 10), `validade_horas` (padrão 24). RLS ligada, **sem policy**:
  só a chave de serviço lê. O cliente nunca informa qual marca é a do tour.
- `public.demonstracao_visitantes` — `user_id` (PK, FK `auth.users` com `on delete cascade`),
  `criado_em`, `expira_em`, `perguntas_feitas`. RLS ligada, sem policy de escrita; o visitante lê
  só a própria linha (para a faixa mostrar "7 de 10 perguntas").
- `private.demonstracao_entrar(user_id)` — `SECURITY DEFINER`, `search_path` vazio, `revoke execute`
  de `anon` e `authenticated`. Cria `workspace_members` (papel `member`) e `brand_members`
  (`capacidades = {consultar}`) da marca da config, e a linha do visitante. Idempotente.
- `private.demonstracao_gastar_pergunta(user_id)` — mesma blindagem. Um único
  `update … set perguntas_feitas = perguntas_feitas + 1 where perguntas_feitas < limite and expira_em > now()
  returning`; devolve falso quando barra. Atômico: duas abas ao mesmo tempo não furam o limite.

## 5. Limites, em camadas

1. **Entrada:** Turnstile na criação da sessão + o limite por IP que o próprio Supabase já aplica.
2. **Por visitante:** 10 perguntas e 24 h (`demonstracao_gastar_pergunta`, chamada em `/api/ai/chat`
   só quando o JWT tem `is_anonymous`, antes da reserva de orçamento).
3. **Global:** `ai_budgets` diário da conta Demonstração + `kill_switch`, que já existem e o Console já
   opera. É o teto que o robô não passa mesmo que as camadas 1 e 2 falhem.
4. **Capacidade:** `consultar` só. Sem upload, sem edição; as rotas de escrita já recusam por RLS.

A recusa diz qual limite barrou ("suas 10 perguntas do tour acabaram" × "o tour está pausado"),
como a mensagem de orçamento já faz.

## 6. Limpeza

Cron diário em `/api/manutencao/demonstracao` (mesmo padrão do cron existente: fora do `proxy`,
exigindo o segredo do Cron por conta própria). Apaga os visitantes com `expira_em` vencido pela API de
administração do Supabase (`deleteUser`), e o `cascade` leva os vínculos e as conversas deles.
Entradas do razão de custo **ficam**: o razão é append-only e o custo do tour é informação do Console.

## 7. Testes negativos (condição 2 do ADR-0003) e prova versionada

- visitante A não lê a linha do visitante B;
- visitante não lê nenhuma outra conta, marca, membro, convite ou razão;
- visitante não escreve em nada (upload, edição, importação, link de entrega);
- `anon` e `authenticated` não executam as funções `private.*`;
- sessão vencida ou com 10 perguntas gastas recebe recusa, não resposta;
- `scripts/prova-da-demonstracao.sh`, conferindo o **nome exato** de cada constraint.

## 8. Fatias (um PR cada, migration aplicada antes do merge)

1. Migration + testes de autorização + prova. **Para aqui para sua revisão do schema.**
2. Rota de entrada + Turnstile + cron de limpeza.
3. Contador no chat + mensagens de limite.
4. Página `/demonstracao`, faixa do tour, navegação reduzida ao Book.
5. Texto do site e da política de privacidade (as perguntas do visitante ficam guardadas até a limpeza).

## 9. Verificado no código (17/10)

1. **O papel `member` não enxerga outros membros.** As policies de `workspace_members` e de
   `brand_members` mostram só a linha da própria pessoa; a lista de acesso é de quem administra a conta.
   A prova confere (D3, D4, D9).
2. **Apagar o login do visitante não trava.** A migration de 24/09 (conta_removida) já passou a chave do
   razão de IA para `on delete set null` e remove as participações antes do login. A prova apaga um
   visitante que gastou IA e confere que o razão fica com `user_id` nulo e o valor intacto (G5–G7).
3. **A marca do tour não existe em código e não deve existir.** Recriar marca por SQL é proibido; a
   conta "Demonstração" e o manual entram pela tela de importação, e só depois a linha de
   `private.demonstracao_config` é preenchida com `ativo = true`. Até lá o tour está desligado.

Achado novo: cada visitante geraria 2 eventos para sempre no registro de acesso (append-only). A
migration põe uma guarda no gatilho: login anônimo não gera evento. A prova confere que acesso de
pessoa real continua registrado (C9, C10).

**Para a fatia 2 (não resolvido aqui):** o login anônimo não tem perfil, e criar o perfil dispara a
abertura de uma conta pessoal (`handle_new_profile`). A fatia 2 precisa decidir como o visitante passa
pelo onboarding sem ganhar conta própria.

## 10. Decisões que dependem de André

1. Ligar *Anonymous sign-ins* no projeto Supabase de produção (muda configuração de autenticação).
2. Turnstile da Cloudflare (nova dependência, gratuita) **ou** sem captcha, apoiado só no limite por
   IP + teto global. Recomendação: com Turnstile.
3. Os números: 10 perguntas, 24 h, teto diário da conta Demonstração.
4. Qual manual: o do Brennimark (recomendado) ou o da ACME.

## 12. Revisão de 25/10/2026 — visitante criado pelo servidor, com cadastro

André pediu cadastro (nome e e-mail, lista de interessados) e decidiu que o visitante é **criado por nós**,
não login anônimo do Supabase. O que isso muda, em relação aos §4 a §11:

- **Quem é visitante:** `app_metadata.tour = true` (só a API de administração escreve) **ou** login anônimo.
  `user_metadata` nunca vale (o próprio usuário o edita). Critério único: `private.visitante_do_tour`.
- **Não liga *Anonymous sign-ins*.** O servidor cria o usuário depois do captcha e do teto do dia; a superfície
  do §11.5 (qualquer estranho com JWT `authenticated`) não existe. A prova do visitante sem vínculo
  (`prova-do-visitante-sem-vinculo`, branch `fatia-demo/tour-entrada`) só importa se o login anônimo for ligado.
- **Cadastro:** nome e e-mail vão a `cadastros_gratuitos` (origem `tour`), caixa de marketing separada e
  desmarcada, duplo aceite como nas ferramentas. O usuário do Supabase leva e-mail sintético `.invalid`.
- **Limites:** 2 perguntas por visitante; teto por dia de 200 entradas e 100 perguntas
  (`demonstracao_uso_diario`); o teto devolve o gasto do visitante. Zero IA paga: a rota de IA do tour é gratuita (fatia 3).
- **Banco:** `20261025120000_tour_visitante_do_servidor.sql` (+ `prova-do-visitante-do-servidor.sh`).
- **Servidor (fatia 2):** `POST /api/demonstracao/entrar` (Turnstile → cadastro → usuário → `demonstracao_receber`
  → sessão) e `GET /api/manutencao/demonstracao` (limpeza diária de vencidos e órfãos, `is_anonymous`/`tour`
  conferido de novo antes de cada `deleteUser`).
- **Fora do código, dependem do André:** Turnstile (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
  `BRENNIMARK_TURNSTILE_SECRET`; sem segredo, em produção, a entrada recusa), regra de limite por IP no
  firewall da Vercel para `/api/demonstracao/entrar`, e a marca do tour importada antes de ligar
  `private.demonstracao_config.ativo`.
