-- G1.0 — a matriz de papéis para IA e análise, no banco.
--
-- O que estava errado, e não dava erro nenhum:
--
--   ai_settings          as quatro operações diziam "membro do workspace".
--                        Um `member` lia `api_key_ciphertext`, `api_key_iv` e
--                        `api_key_last4` — material de credencial de quem
--                        paga — e podia APAGAR as chaves da conta ou inserir
--                        as suas, redirecionando o gasto de IA do workspace
--                        inteiro sem ser dono dele.
--
--   ai_routing_policies  idem. Trocar o roteamento é escolher qual provedor
--                        recebe o conteúdo do manual do cliente.
--
--   analysis_runs        UPDATE e DELETE por qualquer membro, em QUALQUER
--                        análise. Uma pessoa apagava o histórico da outra, ou
--                        reescrevia o parecer dela.
--
-- A regra: `owner` governa configuração, chaves e roteamento. `member` usa o
-- que está habilitado, e é dono só do que ele mesmo produziu.

-- ─── ai_settings: só quem administra ───────────────────────────────────────
drop policy if exists "Members can view their workspace ai settings"    on public.ai_settings;
drop policy if exists "Members can insert ai settings for their workspace" on public.ai_settings;
drop policy if exists "Members can update their workspace ai settings"  on public.ai_settings;
drop policy if exists "Members can delete their workspace ai settings"  on public.ai_settings;

/**
 * Um predicado, quatro políticas.
 *
 * Escrito por extenso em cada uma em vez de numa função: uma função
 * `security definer` chamada de dentro de policy é um lugar clássico para
 * escalar privilégio sem querer, e o predicado é curto o bastante para não
 * valer o risco.
 */
create policy "Owners view ai settings" on public.ai_settings
  for select to authenticated
  using (exists (select 1 from public.workspace_members m
                 where m.workspace_id = ai_settings.workspace_id
                   and m.user_id = (select auth.uid()) and m.role = 'owner'));

create policy "Owners insert ai settings" on public.ai_settings
  for insert to authenticated
  with check (exists (select 1 from public.workspace_members m
                      where m.workspace_id = ai_settings.workspace_id
                        and m.user_id = (select auth.uid()) and m.role = 'owner'));

create policy "Owners update ai settings" on public.ai_settings
  for update to authenticated
  using (exists (select 1 from public.workspace_members m
                 where m.workspace_id = ai_settings.workspace_id
                   and m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (exists (select 1 from public.workspace_members m
                      where m.workspace_id = ai_settings.workspace_id
                        and m.user_id = (select auth.uid()) and m.role = 'owner'));

create policy "Owners delete ai settings" on public.ai_settings
  for delete to authenticated
  using (exists (select 1 from public.workspace_members m
                 where m.workspace_id = ai_settings.workspace_id
                   and m.user_id = (select auth.uid()) and m.role = 'owner'));

-- ─── ai_routing_policies: só quem administra ───────────────────────────────
drop policy if exists "Members can view their workspace ai routing"   on public.ai_routing_policies;
drop policy if exists "Members can insert their workspace ai routing" on public.ai_routing_policies;
drop policy if exists "Members can update their workspace ai routing" on public.ai_routing_policies;
drop policy if exists "Members can delete their workspace ai routing" on public.ai_routing_policies;

create policy "Owners view ai routing" on public.ai_routing_policies
  for select to authenticated
  using (exists (select 1 from public.workspace_members m
                 where m.workspace_id = ai_routing_policies.workspace_id
                   and m.user_id = (select auth.uid()) and m.role = 'owner'));

create policy "Owners insert ai routing" on public.ai_routing_policies
  for insert to authenticated
  with check (exists (select 1 from public.workspace_members m
                      where m.workspace_id = ai_routing_policies.workspace_id
                        and m.user_id = (select auth.uid()) and m.role = 'owner'));

create policy "Owners update ai routing" on public.ai_routing_policies
  for update to authenticated
  using (exists (select 1 from public.workspace_members m
                 where m.workspace_id = ai_routing_policies.workspace_id
                   and m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (exists (select 1 from public.workspace_members m
                      where m.workspace_id = ai_routing_policies.workspace_id
                        and m.user_id = (select auth.uid()) and m.role = 'owner'));

create policy "Owners delete ai routing" on public.ai_routing_policies
  for delete to authenticated
  using (exists (select 1 from public.workspace_members m
                 where m.workspace_id = ai_routing_policies.workspace_id
                   and m.user_id = (select auth.uid()) and m.role = 'owner'));

-- ─── analysis_runs: leitura compartilhada, escrita de quem fez ─────────────
--
-- SELECT continua sendo do workspace inteiro, e isso é a feature: o histórico
-- de análises é memória compartilhada da equipe, e escondê-lo faria cada
-- pessoa repetir a análise que a colega já fez.
--
-- UPDATE e DELETE passam a exigir ser dono da conta OU autor da análise.
-- Reescrever o parecer de outra pessoa, ou apagar o histórico dela, não é
-- colaboração — e a análise é assinada por quem a pediu.
drop policy if exists "Members can update workspace analyses" on public.analysis_runs;
drop policy if exists "Members can delete workspace analyses" on public.analysis_runs;

create policy "Authors and owners update analyses" on public.analysis_runs
  for update to authenticated
  using (
    created_by = (select auth.uid())
    or exists (select 1 from public.workspace_members m
               where m.workspace_id = analysis_runs.workspace_id
                 and m.user_id = (select auth.uid()) and m.role = 'owner')
  )
  -- O `with check` olha a linha DEPOIS da edição, e é ele que impede um member
  -- de reatribuir a análise a outra pessoa: se `created_by` deixar de ser ele,
  -- a condição falha. Um owner pode, e já podia — governar a conta inclui isso.
  --
  -- Sem subconsulta à própria tabela de propósito: comparar com a linha antiga
  -- de dentro da política dispara a política de SELECT no meio da checagem de
  -- UPDATE, e essa é a forma de recursão que quebra RLS de um jeito difícil de
  -- diagnosticar.
  with check (
    created_by = (select auth.uid())
    or exists (select 1 from public.workspace_members m
               where m.workspace_id = analysis_runs.workspace_id
                 and m.user_id = (select auth.uid()) and m.role = 'owner')
  );

create policy "Authors and owners delete analyses" on public.analysis_runs
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    or exists (select 1 from public.workspace_members m
               where m.workspace_id = analysis_runs.workspace_id
                 and m.user_id = (select auth.uid()) and m.role = 'owner')
  );

comment on table public.ai_settings is
  'Credenciais de IA da conta. Governadas pelo owner: um member não lê, cria, '
  'altera nem apaga. O ciphertext não é a chave — a decifragem é da aplicação — '
  'mas é material de credencial de quem paga a fatura.';
