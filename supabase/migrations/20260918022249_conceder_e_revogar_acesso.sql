-- Conceder e revogar acesso — a metade 1 de "Pessoas e acesso".
--
-- ─── Por que isto é função de banco, e não rota ──────────────────────────
--
-- Conceder mexe em três tabelas (`concessoes_de_acesso`, `workspace_members`,
-- `brand_members`) e precisa ser tudo ou nada: metade de uma concessão é uma
-- pessoa que pertence à conta e não alcança marca nenhuma, ou pior, o inverso.
--
-- E há o caso que a concessão pendente sozinha não resolve: quem JÁ TEM LOGIN
-- não vai ter um "primeiro login" para colher nada. Com a função, o mesmo gesto
-- do administrador aplica na hora para quem já entrou, e fica pendente para quem
-- ainda não entrou — uma porta só, e a tela não precisa saber a diferença.
--
-- ─── O que estas funções NÃO fazem ───────────────────────────────────────
--
-- Não mandam e-mail. Quem manda o e-mail de autenticação é o Supabase Auth,
-- quando a pessoa entra. Convite com mensagem nossa é a metade 2, e exige
-- serviço de e-mail, domínio e remetente (§21 da direção).

-- ─── Conceder ────────────────────────────────────────────────────────────

create function public.conceder_acesso(
  p_workspace_id uuid, p_email text, p_papel text, p_marcas uuid[] default '{}')
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  ator uuid := (select auth.uid());
  email_alvo text := lower(btrim(coalesce(p_email, '')));
  pessoa uuid;
  marca uuid;
  quantas integer;
begin
  -- Quem concede é quem administra a CONTA. A verificação é aqui porque a
  -- função é definer: ela contorna a RLS, então esta é a fronteira.
  if ator is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.workspace_members wm
     where wm.workspace_id = p_workspace_id and wm.user_id = ator and wm.role = 'owner'
  ) then
    raise exception 'só quem administra a conta concede acesso' using errcode = '42501';
  end if;

  if position('@' in email_alvo) < 2 or char_length(email_alvo) > 320 then
    raise exception 'e-mail inválido' using errcode = '22023';
  end if;
  if p_papel not in ('administrador', 'consulta') then
    raise exception 'papel inválido' using errcode = '22023';
  end if;

  /*
   * A forma de cada papel, conferida antes de escrever qualquer coisa.
   *
   * Administrador é da conta inteira — passar marcas aqui seria a tela dizendo
   * uma coisa e o banco outra. Consulta é sempre de marca, e de marca DESTA
   * conta: sem esta conferência, um administrador concederia, sem querer, uma
   * marca de outro cliente que ele por acaso administre.
   */
  if p_papel = 'administrador' and coalesce(array_length(p_marcas, 1), 0) > 0 then
    raise exception 'administrador alcança todas as marcas da conta; não se concede marca a marca'
      using errcode = '22023';
  end if;
  if p_papel = 'consulta' then
    if coalesce(array_length(p_marcas, 1), 0) = 0 then
      raise exception 'escolha ao menos uma marca' using errcode = '22023';
    end if;
    select count(*) into quantas from unnest(p_marcas) as m(id)
     where exists (select 1 from public.brands b where b.id = m.id and b.workspace_id = p_workspace_id);
    if quantas <> array_length(p_marcas, 1) then
      raise exception 'marca de outra conta' using errcode = '42501';
    end if;
  end if;

  select u.id into pessoa from auth.users u where lower(u.email) = email_alvo limit 1;

  -- Quem ainda não entrou: fica pendente, e o primeiro login colhe.
  if pessoa is null then
    delete from public.concessoes_de_acesso
     where workspace_id = p_workspace_id and concessoes_de_acesso.email = email_alvo and convertida_em is null;
    if p_papel = 'administrador' then
      insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por)
      values (p_workspace_id, null, email_alvo, 'administrador', ator);
    else
      foreach marca in array p_marcas loop
        insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por)
        values (p_workspace_id, marca, email_alvo, 'consulta', ator);
      end loop;
    end if;
    return 'pendente';
  end if;

  -- Quem já tem login: vale agora. A concessão é gravada JÁ convertida, para o
  -- registro dizer quem concedeu, quando, e a quem — igual ao outro caminho.
  if p_papel = 'administrador' then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (p_workspace_id, pessoa, 'owner')
    on conflict (workspace_id, user_id) do update set role = 'owner';
    insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por,
                                             convertida_em, convertida_para)
    values (p_workspace_id, null, email_alvo, 'administrador', ator, now(), pessoa);
  else
    insert into public.workspace_members (workspace_id, user_id, role)
    values (p_workspace_id, pessoa, 'member')
    on conflict (workspace_id, user_id) do nothing;
    foreach marca in array p_marcas loop
      insert into public.brand_members (brand_id, workspace_id, user_id, capacidades, created_by)
      values (marca, p_workspace_id, pessoa, array['consultar']::text[], ator)
      on conflict (brand_id, user_id) do update set capacidades = array['consultar']::text[];
      insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por,
                                               convertida_em, convertida_para)
      values (p_workspace_id, marca, email_alvo, 'consulta', ator, now(), pessoa);
    end loop;
  end if;

  return 'aplicada';
end;
$$;

revoke execute on function public.conceder_acesso(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.conceder_acesso(uuid, text, text, uuid[]) to authenticated;

-- ─── Revogar ─────────────────────────────────────────────────────────────
--
-- `p_marca` nula revoga a pessoa INTEIRA da conta; com marca, tira só aquela.
-- Remover é gesto de primeira classe: a gráfica que terminou o job precisa sair
-- hoje, não quando alguém lembrar.

create function public.revogar_acesso(p_workspace_id uuid, p_email text, p_marca uuid default null)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  ator uuid := (select auth.uid());
  email_alvo text := lower(btrim(coalesce(p_email, '')));
  pessoa uuid;
  administradores integer;
begin
  if ator is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.workspace_members wm
     where wm.workspace_id = p_workspace_id and wm.user_id = ator and wm.role = 'owner'
  ) then
    raise exception 'só quem administra a conta revoga acesso' using errcode = '42501';
  end if;

  select u.id into pessoa from auth.users u where lower(u.email) = email_alvo limit 1;

  -- A pendência morre de qualquer jeito: ela é a promessa que ainda não virou
  -- acesso, e revogar é desfazer a promessa.
  delete from public.concessoes_de_acesso
   where workspace_id = p_workspace_id and concessoes_de_acesso.email = email_alvo
     and convertida_em is null
     and (p_marca is null or brand_id = p_marca);

  if pessoa is null then
    return 'pendencia-revogada';
  end if;

  if p_marca is not null then
    delete from public.brand_members bm
     where bm.workspace_id = p_workspace_id and bm.user_id = pessoa and bm.brand_id = p_marca;
    return 'marca-revogada';
  end if;

  /*
   * A conta não pode ficar sem administrador.
   *
   * Sem esta trava, o último administrador se remove por engano e a conta fica
   * inalcançável para sempre — ninguém de dentro pode conceder, e não existe
   * cadastro público para criar outro. O erro é explícito, não silencioso.
   */
  if exists (select 1 from public.workspace_members wm
              where wm.workspace_id = p_workspace_id and wm.user_id = pessoa and wm.role = 'owner') then
    select count(*) into administradores from public.workspace_members wm
     where wm.workspace_id = p_workspace_id and wm.role = 'owner';
    if administradores <= 1 then
      raise exception 'a conta ficaria sem administrador'
        using errcode = 'check_violation', constraint = 'conta_sem_administrador';
    end if;
  end if;

  delete from public.brand_members bm
   where bm.workspace_id = p_workspace_id and bm.user_id = pessoa;
  delete from public.workspace_members wm
   where wm.workspace_id = p_workspace_id and wm.user_id = pessoa;

  return 'revogada';
end;
$$;

revoke execute on function public.revogar_acesso(uuid, text, uuid) from public, anon;
grant execute on function public.revogar_acesso(uuid, text, uuid) to authenticated;

-- ─── Quem tem acesso, para a tela ────────────────────────────────────────
--
-- A tela precisa de e-mail, e `auth.users` não é legível por quem tem sessão —
-- corretamente. Esta função devolve SÓ as pessoas da conta pedida, e só para
-- quem administra a conta.

create function public.pessoas_da_conta(p_workspace_id uuid)
returns table (email text, papel text, marcas jsonb, pendente boolean, desde timestamptz)
language plpgsql
security definer
set search_path to ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.workspace_members wm
     where wm.workspace_id = p_workspace_id and wm.user_id = (select auth.uid()) and wm.role = 'owner'
  ) then
    raise exception 'só quem administra a conta vê a lista de acesso' using errcode = '42501';
  end if;

  return query
  -- Quem já entrou.
  select lower(u.email)::text,
         case when wm.role = 'owner' then 'administrador' else 'consulta' end,
         coalesce((
           select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.name) order by b.name)
             from public.brand_members bm
             join public.brands b on b.id = bm.brand_id
            where bm.user_id = wm.user_id and bm.workspace_id = p_workspace_id), '[]'::jsonb),
         false,
         wm.created_at
    from public.workspace_members wm
    join auth.users u on u.id = wm.user_id
   where wm.workspace_id = p_workspace_id
  union all
  -- E quem foi convidado e ainda não entrou.
  select c.email,
         c.papel,
         coalesce((
           select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.name) order by b.name)
             from public.concessoes_de_acesso c2
             join public.brands b on b.id = c2.brand_id
            where c2.workspace_id = p_workspace_id and c2.email = c.email and c2.convertida_em is null),
           '[]'::jsonb),
         true,
         min(c.concedida_em)
    from public.concessoes_de_acesso c
   where c.workspace_id = p_workspace_id and c.convertida_em is null
   group by c.email, c.papel;
end;
$$;

revoke execute on function public.pessoas_da_conta(uuid) from public, anon;
grant execute on function public.pessoas_da_conta(uuid) to authenticated;
