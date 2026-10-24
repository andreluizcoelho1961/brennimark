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

**Correção (20/10):** o parágrafo anterior afirmava que criar o perfil do visitante abriria uma conta
pessoal. Está errado desde 17/09/2026: `handle_new_profile` deixou de criar conta (a conta nasce da
assinatura) e só colhe concessões pendentes do e-mail. Ver a fatia 2, §11.

## 10. Decisões que dependem de André

1. Ligar *Anonymous sign-ins* no projeto Supabase de produção (muda configuração de autenticação).
2. Turnstile da Cloudflare (nova dependência, gratuita) **ou** sem captcha, apoiado só no limite por
   IP + teto global. Recomendação: com Turnstile.
3. Os números: 10 perguntas, 24 h, teto diário da conta Demonstração.
4. Qual manual: o do Brennimark (recomendado) ou o da ACME.

## 11. Fatia 2 — a entrada (desenho de 20/10/2026, nada construído)

### 11.1 O fluxo, de ponta a ponta

1. `/demonstracao` (caminho **exato** em `caminhos-publicos.ts`): texto do tour, aviso de privacidade,
   o widget do Turnstile e o botão "Entrar no tour".
2. No navegador: `supabase.auth.signInAnonymously()`. O login anônimo nasce **sem vínculo nenhum** e,
   sozinho, não enxerga nada.
3. `POST /api/demonstracao/entrar` com o token do Turnstile. O servidor: lê a sessão e exige que ela
   seja anônima (`user.is_anonymous`); confere o token na Cloudflare (`siteverify`, com o IP do
   pedido); chama `demonstracao_entrar` com a chave de serviço; devolve o destino e a validade.
4. O navegador vai ao destino (`/w/<conta>/b/<marca>/docs`). O destino sai do banco, nunca do cliente.

**Por que o Turnstile guarda o VÍNCULO e não a criação do login.** O Supabase tem captcha embutido,
mas ele vale para o projeto inteiro: ligá-lo exigiria token também no login por senha e na recuperação
de senha, e quebraria a tela de entrada dos assinantes. Do jeito proposto, quem pula o captcha ganha um
login anônimo vazio (inofensivo) e nunca o acesso ao manual nem ao Vini. O limite do Supabase
(30 logins anônimos por hora por IP) continua valendo, porque quem chama é o navegador do visitante.

### 11.2 O perfil e o onboarding: resolvido sem código novo no onboarding

`/docs` manda para `/onboarding` quem não tem perfil com nome. Como `handle_new_profile` já não cria
conta, **a entrada cria o perfil do visitante** (`full_name = 'Visitante'`, e-mail sintético
`visitante-<8 hex>@visitante.invalid`, domínio reservado pela RFC 2606 que nunca entrega nada, o mesmo
recurso da conta removida). Com perfil, vínculo de conta e uma única marca, o resolvedor redireciona
direto ao manual. O onboarding não é tocado.

### 11.3 O que a fatia 2 muda no banco (uma migration nova)

- `demonstracao_entrar` passa a criar o perfil e a devolver `(expira_em, conta_slug, marca_key)`.
  Como o tipo de retorno muda, é `drop function` + `create function`, com o mesmo `revoke`/`grant`.
- `demonstracao_orfaos()` (só `service_role`): logins anônimos com mais de 2 h e sem linha em
  `demonstracao_visitantes` — o rastro de quem fez o login e não passou pelo captcha.
- A prova da fatia 1 cresce: perfil criado e idempotente, destino devolvido, órfãos listados.

### 11.4 A limpeza (cron)

`/api/manutencao/demonstracao`, no padrão das três rotinas existentes (segredo do Cron, 401 antes de
qualquer cliente; decisão em `src/lib/demonstracao/limpeza.ts` com portas injetadas e testada sem
banco). Apaga, via API de administração, os vencidos e os órfãos, no máximo 200 por rodada, e **confere
`is_anonymous` de novo** antes de cada `deleteUser`. Falha parcial é 500, para o log do Cron ficar
vermelho. O `cascade` e o gatilho de 24/09 levam vínculos, perfil e conversas; o razão de IA fica.

Limite assumido: uma limpeza **diária** deixa o visitante lendo o manual até 24 h depois de vencer
(conteúdo nosso, público por decisão). O Vini para na hora, porque o contador confere a validade
(fatia 3). Rodar de hora em hora exige o plano Pro da Vercel.

### 11.5 A superfície nova: o papel `authenticated` agora alcança desconhecidos

Ligar o login anônimo significa que **qualquer pessoa na internet, com a chave pública do projeto,
consegue um JWT de `authenticated`**. Toda policy `to authenticated` e toda função executável por esse
papel passa a ser alcançável por estranhos. Medição preliminar no banco local: as únicas policies de
leitura sem vínculo são `planos` ("Os planos são públicos") e uma de Storage amarrada a `analysis_runs`;
as funções `SECURITY DEFINER` chamáveis conferem papel, equipe ou capacidade por dentro.

Isto vira **prova**, não impressão: `scripts/prova-do-visitante-sem-vinculo.sql` enumera todas as
tabelas e funções do `public` e do Storage e, como login anônimo sem nenhum vínculo, exige zero linhas
ou recusa em todas, com `planos` como única exceção declarada. Depois, revisão do
`brennimark-security-reviewer` sobre a migration e as rotas.

### 11.6 Dados e privacidade

O `proxy` grava o IP de todo login em `registros_de_acesso` (Marco Civil, 6 meses); com o visitante
apagado, a linha fica com `user_id` nulo. A página `/demonstracao` e a Política de Privacidade passam a
dizer: perguntas guardadas até 24 h; endereço IP por 6 meses, por lei.

### 11.7 Fora do código: o que depende de você

1. **Cloudflare Turnstile:** criar o widget (gratuito) e pôr na Vercel `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   e `BRENNIMARK_TURNSTILE_SECRET`. Em desenvolvimento uso as chaves de teste públicas da Cloudflare.
2. **Supabase de produção:** ligar *Anonymous sign-ins*. No local, `enable_anonymous_sign_ins = true`
   em `supabase/config.toml` (entra na fatia). Nada disso é ligado sem sua autorização nominal.
3. **A marca do tour:** importar o manual numa conta "Demonstração" e então preencher
   `private.demonstracao_config`. Até lá o tour fica desligado e a entrada recusa.

### 11.8 Divisão em PRs

- **2a — banco:** migration (item 11.3) + prova da fatia 1 estendida + `prova-do-visitante-sem-vinculo`.
- **2b — servidor:** `lib/demonstracao` (Turnstile, entrada, limpeza), as duas rotas, `vercel.json`,
  `config.toml`, testes de unidade.
- **2c — tela:** `/demonstracao`, aviso de privacidade, estados de erro (tour desligado, captcha
  falhou, muitas tentativas).

Reversibilidade: 2a e 2b são baratas de desfazer (função e rotas novas). Ligar o login anônimo em
produção é configuração, reversível, mas **enquanto estiver ligada a superfície do 11.5 está exposta**;
por isso é o último passo, depois da prova verde.

### 11.9 Decisões que travam o desenho

1. Turnstile guarda o vínculo (11.1), e não o login. Aprova?
2. Limpeza diária (sem custo) ou de hora em hora (exige Vercel Pro)?
3. O nome que o visitante ganha: "Visitante". Serve?
