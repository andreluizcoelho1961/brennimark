-- Exclusão aos 12 meses do cancelamento — 08/10/2026 (desenho aprovado pelo
-- André no mesmo dia: "pode seguir com o desenho, B1 e B2").
--
-- A promessa (Termos, seção 13; Privacidade, seção 7): "Depois do
-- cancelamento, a conta fica guardada, só para leitura, por 12 meses [...]
-- Avisamos 30 dias antes do fim desse prazo. Depois disso, o conteúdo é
-- excluído definitivamente. [...] Dados que a lei manda guardar (como os
-- fiscais e os registros de acesso) ficam pelo prazo legal."
--
-- Decisões do André (08/10/2026):
--   * sai a ÁREA INTEIRA: marcas, manuais, arquivos do Storage, membros e os
--     logins criados por ela (o login que também participa de outra conta fica);
--   * ficam os avisos do Stripe (`eventos_de_cobranca`), os registros de acesso
--     (Marco Civil) e o REGISTRO DA ASSINATURA (e-mail, plano, datas) — dado de
--     cobrança, guardado pelo prazo legal. Ele também mantém a regra do
--     arrependimento: quem volta depois da exclusão não é "primeira assinatura".
--
-- ─── As três travas da exclusão (irreversível) ───────────────────────────
--
--   1. a assinatura da conta está cancelada há 12 meses ou mais;
--   2. o aviso de 30 dias saiu, e saiu há 30 dias ou mais;
--   3. a conta não tem assinatura viva.
--
-- ─── Por que em duas etapas ──────────────────────────────────────────────
--
-- A fila de exclusão do Storage (`brand_deletions`) é DA ÁREA e sai com ela
-- em cascata. Apagar a área primeiro levaria a fila junto, e os arquivos
-- ficariam no Storage para sempre, sem nenhuma linha que os mencione.
--
--   INICIAR    põe na fila todo objeto sob a pasta da conta (os três buckets
--              guardam tudo em `<conta>/...`, ver `src/lib/storage/caminhos.ts`);
--              a drenagem de sempre remove e só fecha o que observou sumir.
--   CONCLUIR   só com a fila vazia E nenhum objeto na pasta: apaga os logins
--              criados pela conta, marca a assinatura e apaga a área.
--
-- Reversibilidade: as colunas são aditivas. A ligação `assinaturas →
-- workspaces` deixa de IMPEDIR a exclusão da área (era `restrict`) e passa a
-- esvaziar: é ela que permite o registro de cobrança sobreviver. A exclusão
-- em si não volta.

-- ─── 1. A assinatura sobrevive à área ─────────────────────────────────────

alter table public.assinaturas
  alter column workspace_id drop not null,
  drop constraint assinaturas_workspace_id_fkey,
  add constraint assinaturas_workspace_id_fkey
    foreign key (workspace_id) references public.workspaces(id) on delete set null,
  add column exclusao_avisada_em  timestamptz,
  add column exclusao_iniciada_em timestamptz,
  add column conta_excluida_em    timestamptz,
  -- A área só some da assinatura quando a conta foi excluída por este caminho.
  add constraint assinaturas_conta_so_some_excluida
    check (workspace_id is not null or conta_excluida_em is not null),
  -- Excluir pressupõe ter iniciado; iniciar pressupõe ter avisado; avisar
  -- pressupõe estar cancelada.
  add constraint assinaturas_exclusao_em_ordem
    check ((conta_excluida_em is null or exclusao_iniciada_em is not null)
       and (exclusao_iniciada_em is null or exclusao_avisada_em is not null)
       and (exclusao_avisada_em is null or situacao = 'cancelada'));

-- A rotina diária procura as canceladas pela data.
create index assinaturas_canceladas_por_data
  on public.assinaturas (cancelada_em) where situacao = 'cancelada' and conta_excluida_em is null;

-- ─── 2. O aviso de 30 dias ────────────────────────────────────────────────
--
-- As contas canceladas há 11 meses ou mais, ainda sem aviso. Devolve o que o
-- e-mail precisa; `excluir_em` é a data prometida (12 meses do cancelamento,
-- ou 30 dias a partir de hoje, o que vier depois — quem é avisado tarde não
-- perde os 30 dias).
create function public.cobranca_contas_a_avisar_da_exclusao(p_limite integer)
returns table (id_externo_assinatura text, titular_email text, nome_da_conta text, excluir_em timestamptz)
language sql
stable
security definer
set search_path to ''
as $$
  select a.id_externo_assinatura, a.titular_email, w.name,
         greatest(a.cancelada_em + interval '12 months', now() + interval '30 days')
    from public.assinaturas a
    join public.workspaces w on w.id = a.workspace_id
   where a.situacao = 'cancelada'
     and a.cancelada_em <= now() - interval '11 months'
     and a.exclusao_avisada_em is null
   order by a.cancelada_em
   limit least(greatest(coalesce(p_limite, 50), 1), 200);
$$;

-- Reserva o aviso antes de enviar (true para um chamador só); false devolve a
-- reserva quando o envio falhou. O mesmo padrão do e-mail de cancelamento.
create function public.cobranca_aviso_de_exclusao(p_id_externo_assinatura text, p_reservar boolean)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  n integer;
begin
  if coalesce(p_reservar, false) then
    update public.assinaturas set exclusao_avisada_em = now(), updated_at = now()
     where id_externo_assinatura = p_id_externo_assinatura
       and situacao = 'cancelada' and exclusao_avisada_em is null and workspace_id is not null;
  else
    update public.assinaturas set exclusao_avisada_em = null, updated_at = now()
     where id_externo_assinatura = p_id_externo_assinatura
       and exclusao_avisada_em is not null and exclusao_iniciada_em is null;
  end if;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- ─── 3. Iniciar a exclusão ────────────────────────────────────────────────

-- As contas que passaram nas três travas e ainda não começaram, e as que
-- começaram e não terminaram (a rotina continua de onde parou).
create function public.cobranca_contas_a_excluir(p_limite integer)
returns table (conta uuid, iniciada boolean)
language sql
stable
security definer
set search_path to ''
as $$
  select a.workspace_id, a.exclusao_iniciada_em is not null
    from public.assinaturas a
   where a.workspace_id is not null
     and a.conta_excluida_em is null
     and a.situacao = 'cancelada'
     and a.cancelada_em <= now() - interval '12 months'
     and a.exclusao_avisada_em <= now() - interval '30 days'
   order by a.exclusao_iniciada_em nulls last, a.cancelada_em
   limit least(greatest(coalesce(p_limite, 20), 1), 100);
$$;

-- Confere as travas DE NOVO (quem chama pode estar errado) e põe na fila todo
-- objeto sob a pasta da conta, nos três buckets. Repetir não duplica nada.
create function public.cobranca_iniciar_exclusao(p_conta uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  a public.assinaturas%rowtype;
  enfileirados integer;
begin
  select * into a from public.assinaturas where workspace_id = p_conta for update;
  if not found then
    raise exception 'conta sem assinatura' using errcode = 'P0002', hint = 'exclusao_sem_assinatura';
  end if;
  if a.situacao <> 'cancelada' or a.cancelada_em > now() - interval '12 months' then
    raise exception 'a conta não está cancelada há 12 meses' using errcode = '55000', hint = 'exclusao_antes_do_prazo';
  end if;
  if a.exclusao_avisada_em is null or a.exclusao_avisada_em > now() - interval '30 days' then
    raise exception 'o aviso de 30 dias não completou o prazo' using errcode = '55000', hint = 'exclusao_sem_aviso';
  end if;

  insert into public.brand_deletions (workspace_id, bucket_id, storage_path, requested_by)
  select p_conta, o.bucket_id, o.name, null
    from storage.objects o
   where o.bucket_id in ('brand-assets', 'brand-imports', 'analysis-evidence')
     and o.name like p_conta::text || '/%'
  on conflict (workspace_id, bucket_id, storage_path) do nothing;
  get diagnostics enfileirados = row_count;

  update public.assinaturas
     set exclusao_iniciada_em = coalesce(exclusao_iniciada_em, now()), updated_at = now()
   where id = a.id;
  return enfileirados;
end;
$$;

-- ─── 4. Concluir a exclusão ───────────────────────────────────────────────
--
-- Devolve 'pendente' enquanto houver fila ou objeto na pasta; 'excluida'
-- quando terminou. Os logins que saem: os criados por ESTA conta que não
-- participam de nenhuma outra conta nem de marca de outra conta. Sair o login
-- dispara `preparar_conta_removida` (autoria vira "conta removida").
create function public.cobranca_concluir_exclusao(p_conta uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  a public.assinaturas%rowtype;
begin
  select * into a from public.assinaturas where workspace_id = p_conta for update;
  if not found then
    raise exception 'conta sem assinatura' using errcode = 'P0002', hint = 'exclusao_sem_assinatura';
  end if;
  if a.exclusao_iniciada_em is null then
    raise exception 'a exclusão não foi iniciada' using errcode = '55000', hint = 'exclusao_nao_iniciada';
  end if;

  if exists (select 1 from public.brand_deletions d where d.workspace_id = p_conta)
     or exists (select 1 from storage.objects o
                 where o.bucket_id in ('brand-assets', 'brand-imports', 'analysis-evidence')
                   and o.name like p_conta::text || '/%') then
    return 'pendente';
  end if;

  delete from auth.users u
   where u.raw_app_meta_data->>'criado_pela_conta' = p_conta::text
     and not exists (select 1 from public.workspace_members m
                      where m.user_id = u.id and m.workspace_id <> p_conta)
     and not exists (select 1 from public.brand_members bm join public.brands b on b.id = bm.brand_id
                      where bm.user_id = u.id and b.workspace_id <> p_conta);

  update public.assinaturas set conta_excluida_em = now(), updated_at = now() where id = a.id;
  delete from public.workspaces where id = p_conta;
  return 'excluida';
end;
$$;

-- A drenagem com a chave de serviço lê, atualiza e fecha a fila. Em produção
-- a `service_role` já tem isso pelos privilégios padrão do Supabase hospedado;
-- no local, não (ver a memória "privilégios padrão"). Explícito, o código
-- deixa de depender de um padrão que muda entre os ambientes.
grant select, update, delete on public.brand_deletions to service_role;

-- Só o servidor (a rotina diária, com a chave de serviço) chama.
revoke all on function public.cobranca_contas_a_avisar_da_exclusao(integer) from public, anon, authenticated;
revoke all on function public.cobranca_aviso_de_exclusao(text, boolean) from public, anon, authenticated;
revoke all on function public.cobranca_contas_a_excluir(integer) from public, anon, authenticated;
revoke all on function public.cobranca_iniciar_exclusao(uuid) from public, anon, authenticated;
revoke all on function public.cobranca_concluir_exclusao(uuid) from public, anon, authenticated;
grant execute on function public.cobranca_contas_a_avisar_da_exclusao(integer) to service_role;
grant execute on function public.cobranca_aviso_de_exclusao(text, boolean) to service_role;
grant execute on function public.cobranca_contas_a_excluir(integer) to service_role;
grant execute on function public.cobranca_iniciar_exclusao(uuid) to service_role;
grant execute on function public.cobranca_concluir_exclusao(uuid) to service_role;
