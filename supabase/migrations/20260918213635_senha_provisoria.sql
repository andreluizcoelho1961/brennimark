-- Pessoas com senha provisória — fatia 2 do plano da interface, 18/09/2026.
--
-- O administrador cadastra nome, e-mail, nível e marcas; o SERVIDOR cria o
-- login com uma senha gerada ali, mostrada uma vez. A pessoa troca a senha no
-- primeiro acesso. Esta migration é a metade do banco disso:
--
--   1. a concessão ganha NOME e SITUAÇÃO (pendente, ativa, revogada) — e
--      revogar passa a MARCAR, não apagar;
--   2. senha provisória não dá acesso a nada: a concessão só vira acesso
--      depois da troca, e quem decide isso é o banco;
--   3. um login criado por uma conta só recebe acesso daquela conta.
--
-- ─── Por que o item 2 mora aqui, e não na tela ──────────────────────────────
--
-- A tela manda quem tem senha provisória para a troca. Mas a senha abre sessão
-- no Supabase direto, sem passar pela tela — e com sessão, a API responde. Se
-- a concessão já tivesse virado acesso, a senha provisória leria as marcas, e
-- depois de vencida também. Aqui ela não vira: `converter_concessoes` recusa
-- login com senha provisória, e a marca de "provisória" mora em
-- `app_metadata`, que só o servidor escreve.
--
-- ─── Por que o item 3 existe ────────────────────────────────────────────────
--
-- Sem convite por e-mail, ninguém prova ser dono do endereço: o administrador
-- digita um e-mail e o login nasce. Se a conta B depois concedesse acesso a
-- esse mesmo e-mail, o acesso iria para quem tem a senha — que foi escolhida
-- por alguém da conta A. É o caminho de A ler B. Até existir confirmação de
-- e-mail, concessão de outra conta a um login criado por A fica PENDENTE, e a
-- resposta a B é a mesma de "ainda não entrou" — dizer "esse e-mail já tem
-- login em outra conta" contaria a B algo sobre A.
--
-- ─── Um furo antigo, fechado junto ──────────────────────────────────────────
--
-- `converter_concessoes` recebia o e-mail do PERFIL, e o perfil é escrito pela
-- própria pessoa. Um login novo que gravasse no perfil o e-mail de outra
-- pessoa colheria as concessões dela. Agora o e-mail vem de `auth.users`.

-- ─── 1. Nome e situação ─────────────────────────────────────────────────────

alter table public.concessoes_de_acesso
  add column nome text,
  add column revogada_em timestamptz,
  add column revogada_por uuid references auth.users(id),
  add constraint concessoes_de_acesso_nome_check
    check (nome is null or (nome = btrim(nome) and char_length(nome) between 1 and 120)),
  add constraint concessoes_de_acesso_revogacao_check
    check ((revogada_em is null) = (revogada_por is null));

-- Situação DERIVADA, não gravada: uma coluna escrita à parte poderia dizer
-- "ativa" numa linha revogada. Gerada, ela não tem como discordar dos fatos.
alter table public.concessoes_de_acesso
  add column situacao text generated always as (
    case
      when revogada_em is not null then 'revogada'
      when convertida_em is not null then 'ativa'
      else 'pendente'
    end) stored;

-- A pendência deixa de ser "não convertida" e passa a ser "nem convertida nem
-- revogada": revogada fica como histórico e não pode disputar o índice único.
drop index public.concessoes_de_acesso_pendente_idx;
create unique index concessoes_de_acesso_pendente_idx
  on public.concessoes_de_acesso (workspace_id, email, coalesce(brand_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where convertida_em is null and revogada_em is null;

drop index public.concessoes_de_acesso_email_idx;
create index concessoes_de_acesso_email_idx
  on public.concessoes_de_acesso (email) where convertida_em is null and revogada_em is null;

create index concessoes_de_acesso_revogada_por_idx
  on public.concessoes_de_acesso (revogada_por) where revogada_por is not null;

-- A tabela vira registro: só as funções escrevem. Antes, quem administrava
-- podia inserir e apagar direto — e uma linha "ativa" inserida à mão seria
-- histórico falso, e uma apagada, histórico perdido.
drop policy "Quem administra a conta concede" on public.concessoes_de_acesso;
drop policy "Quem administra a conta revoga o que ainda não virou acesso" on public.concessoes_de_acesso;
revoke all on public.concessoes_de_acesso from anon, authenticated;
grant select on public.concessoes_de_acesso to authenticated;

-- ─── 2. O que o servidor diz sobre um login ─────────────────────────────────
--
-- `app_metadata` é escrito só com a chave de serviço; a pessoa não o altera
-- pela própria sessão (o que ela altera é `user_metadata`).

create function private.senha_provisoria_ate(p_user_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when u.raw_app_meta_data->>'senha_provisoria_ate' ~ '^\d{4}-\d{2}-\d{2}T'
    then (u.raw_app_meta_data->>'senha_provisoria_ate')::timestamptz
  end
  from auth.users u where u.id = p_user_id;
$$;

create function private.conta_que_criou_o_login(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when u.raw_app_meta_data->>'criado_pela_conta'
         ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (u.raw_app_meta_data->>'criado_pela_conta')::uuid
  end
  from auth.users u where u.id = p_user_id;
$$;

revoke execute on function private.senha_provisoria_ate(uuid) from public, anon, authenticated;
revoke execute on function private.conta_que_criou_o_login(uuid) from public, anon, authenticated;

-- ─── 3. A conversão: o único lugar onde concessão vira acesso ───────────────

create or replace function private.converter_concessoes(p_user_id uuid, p_email text)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  c record;
  convertidas integer := 0;
  email_real text;
  criadora uuid;
begin
  if p_user_id is null then
    return 0;
  end if;

  -- O e-mail é o do LOGIN, nunca o recebido: quem chama a partir do perfil
  -- passa o que a pessoa escreveu no perfil. `p_email` fica na assinatura por
  -- compatibilidade e só serve de conferência.
  select lower(u.email) into email_real from auth.users u where u.id = p_user_id;
  if email_real is null or email_real is distinct from lower(btrim(coalesce(p_email, ''))) then
    return 0;
  end if;

  -- Senha provisória não dá acesso: a conversão espera a troca.
  if private.senha_provisoria_ate(p_user_id) is not null then
    return 0;
  end if;

  -- Login criado por uma conta colhe só o que aquela conta concedeu.
  criadora := private.conta_que_criou_o_login(p_user_id);

  for c in
    select * from public.concessoes_de_acesso
     where email = email_real
       and convertida_em is null and revogada_em is null
       and (criadora is null or workspace_id = criadora)
     order by concedida_em
  loop
    if c.papel = 'administrador' then
      insert into public.workspace_members (workspace_id, user_id, role)
      values (c.workspace_id, p_user_id, 'owner')
      on conflict (workspace_id, user_id) do update set role = 'owner';
    else
      insert into public.workspace_members (workspace_id, user_id, role)
      values (c.workspace_id, p_user_id, 'member')
      on conflict (workspace_id, user_id) do nothing;

      insert into public.brand_members (brand_id, workspace_id, user_id, capacidades, created_by)
      values (c.brand_id, c.workspace_id, p_user_id, array['consultar']::text[], c.concedida_por)
      on conflict (brand_id, user_id) do nothing;
    end if;

    update public.concessoes_de_acesso
       set convertida_em = now(), convertida_para = p_user_id
     where id = c.id;
    convertidas := convertidas + 1;
  end loop;

  return convertidas;
end;
$$;

revoke execute on function private.converter_concessoes(uuid, text) from public, anon, authenticated;

-- ─── 4. Conceder, agora com nome ────────────────────────────────────────────
--
-- A assinatura muda (ganha `p_nome`), então a antiga sai: com as duas, a
-- chamada de quatro argumentos seria ambígua.

drop function public.conceder_acesso(uuid, text, text, uuid[]);

create function public.conceder_acesso(
  p_workspace_id uuid, p_email text, p_papel text, p_marcas uuid[] default '{}', p_nome text default null)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  ator uuid := (select auth.uid());
  email_alvo text := lower(btrim(coalesce(p_email, '')));
  nome_limpo text := nullif(btrim(coalesce(p_nome, '')), '');
  pessoa uuid;
  marca uuid;
  quantas integer;
  espera boolean;
begin
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
  if nome_limpo is not null and char_length(nome_limpo) > 120 then
    raise exception 'nome longo demais' using errcode = '22023';
  end if;
  if p_papel not in ('administrador', 'consulta') then
    raise exception 'papel inválido' using errcode = '22023';
  end if;
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

  -- Fica pendente quem ainda não pode receber acesso: sem login; com senha
  -- provisória; ou com login criado por OUTRA conta (ver o cabeçalho).
  espera := pessoa is null
         or private.senha_provisoria_ate(pessoa) is not null
         or coalesce(private.conta_que_criou_o_login(pessoa), p_workspace_id) <> p_workspace_id;

  if espera then
    -- Conceder de novo a quem espera SUBSTITUI a pendência. A anterior fica
    -- como revogada, por quem substituiu — o registro diz o que aconteceu.
    nome_limpo := coalesce(nome_limpo, (
      select c.nome from public.concessoes_de_acesso c
       where c.workspace_id = p_workspace_id and c.email = email_alvo and c.nome is not null
       order by c.concedida_em desc limit 1));

    update public.concessoes_de_acesso
       set revogada_em = now(), revogada_por = ator
     where workspace_id = p_workspace_id and concessoes_de_acesso.email = email_alvo
       and convertida_em is null and revogada_em is null;

    if p_papel = 'administrador' then
      insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por, nome)
      values (p_workspace_id, null, email_alvo, 'administrador', ator, nome_limpo);
    else
      foreach marca in array p_marcas loop
        insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por, nome)
        values (p_workspace_id, marca, email_alvo, 'consulta', ator, nome_limpo);
      end loop;
    end if;
    return 'pendente';
  end if;

  if p_papel = 'administrador' then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (p_workspace_id, pessoa, 'owner')
    on conflict (workspace_id, user_id) do update set role = 'owner';
    insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por,
                                             convertida_em, convertida_para, nome)
    values (p_workspace_id, null, email_alvo, 'administrador', ator, now(), pessoa, nome_limpo);
  else
    insert into public.workspace_members (workspace_id, user_id, role)
    values (p_workspace_id, pessoa, 'member')
    on conflict (workspace_id, user_id) do nothing;
    foreach marca in array p_marcas loop
      insert into public.brand_members (brand_id, workspace_id, user_id, capacidades, created_by)
      values (marca, p_workspace_id, pessoa, array['consultar']::text[], ator)
      on conflict (brand_id, user_id) do update set capacidades = array['consultar']::text[];
      insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por,
                                               convertida_em, convertida_para, nome)
      values (p_workspace_id, marca, email_alvo, 'consulta', ator, now(), pessoa, nome_limpo);
    end loop;
  end if;
  return 'aplicada';
end;
$$;

revoke execute on function public.conceder_acesso(uuid, text, text, uuid[], text) from public, anon;
grant execute on function public.conceder_acesso(uuid, text, text, uuid[], text) to authenticated;

-- ─── 5. Revogar marca, não apaga ────────────────────────────────────────────

create or replace function public.revogar_acesso(p_workspace_id uuid, p_email text, p_marca uuid default null)
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

  -- Pendentes e ativas do alcance pedido viram revogadas, com autor e data.
  -- A trava do último administrador, abaixo, desfaz isto junto se disparar.
  update public.concessoes_de_acesso
     set revogada_em = now(), revogada_por = ator
   where workspace_id = p_workspace_id and concessoes_de_acesso.email = email_alvo
     and revogada_em is null
     and (p_marca is null or brand_id = p_marca);

  if pessoa is null then
    return 'pendencia-revogada';
  end if;

  if p_marca is not null then
    delete from public.brand_members bm
     where bm.workspace_id = p_workspace_id and bm.user_id = pessoa and bm.brand_id = p_marca;
    return 'marca-revogada';
  end if;

  if exists (select 1 from public.workspace_members wm
              where wm.workspace_id = p_workspace_id and wm.user_id = pessoa and wm.role = 'owner') then
    select count(*) into administradores from public.workspace_members wm
     where wm.workspace_id = p_workspace_id and wm.role = 'owner';
    if administradores <= 1 then
      raise exception 'a conta ficaria sem administrador'
        using errcode = 'check_violation', constraint = 'conta_sem_administrador';
    end if;
  end if;

  -- O vínculo é ESTADO (quem alcança o quê agora) e sai; a história fica na
  -- concessão revogada, acima.
  delete from public.brand_members bm
   where bm.workspace_id = p_workspace_id and bm.user_id = pessoa;
  delete from public.workspace_members wm
   where wm.workspace_id = p_workspace_id and wm.user_id = pessoa;
  return 'revogada';
end;
$$;

revoke execute on function public.revogar_acesso(uuid, text, uuid) from public, anon;
grant execute on function public.revogar_acesso(uuid, text, uuid) to authenticated;

-- ─── 6. A lista, com nome e prazo da senha ──────────────────────────────────

drop function public.pessoas_da_conta(uuid);

create function public.pessoas_da_conta(p_workspace_id uuid)
returns table (email text, nome text, papel text, marcas jsonb, pendente boolean,
               desde timestamptz, senha_provisoria_ate timestamptz)
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
  select lower(u.email)::text,
         coalesce(nullif(btrim(p.full_name), ''), (
           select c.nome from public.concessoes_de_acesso c
            where c.workspace_id = p_workspace_id and c.email = lower(u.email) and c.nome is not null
            order by c.concedida_em desc limit 1)),
         case when wm.role = 'owner' then 'administrador' else 'consulta' end,
         coalesce((
           select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.name) order by b.name)
             from public.brand_members bm
             join public.brands b on b.id = bm.brand_id
            where bm.user_id = wm.user_id and bm.workspace_id = p_workspace_id), '[]'::jsonb),
         false,
         wm.created_at,
         null::timestamptz
    from public.workspace_members wm
    join auth.users u on u.id = wm.user_id
    left join public.profiles p on p.id = wm.user_id
   where wm.workspace_id = p_workspace_id
  union all
  select c.email,
         max(c.nome),
         c.papel,
         coalesce((
           select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.name) order by b.name)
             from public.concessoes_de_acesso c2
             join public.brands b on b.id = c2.brand_id
            where c2.workspace_id = p_workspace_id and c2.email = c.email
              and c2.convertida_em is null and c2.revogada_em is null),
           '[]'::jsonb),
         true,
         min(c.concedida_em),
         -- O prazo só aparece para a conta que criou o login: para as outras,
         -- a pendência é igual a "ainda não entrou" (ver o cabeçalho).
         (select private.senha_provisoria_ate(u.id)
            from auth.users u
           where lower(u.email) = c.email
             and private.conta_que_criou_o_login(u.id) = p_workspace_id
           limit 1)
    from public.concessoes_de_acesso c
   where c.workspace_id = p_workspace_id and c.convertida_em is null and c.revogada_em is null
   group by c.email, c.papel;
end;
$$;

revoke execute on function public.pessoas_da_conta(uuid) from public, anon;
grant execute on function public.pessoas_da_conta(uuid) to authenticated;

-- ─── 7. Renovar a senha provisória ──────────────────────────────────────────
--
-- A senha nova é gerada e gravada pelo SERVIDOR, com a chave de serviço. Esta
-- função só responde se o pedido é legítimo, e devolve o login a renovar.
--
-- ⚖️ A regra é estreita de propósito: sem ela, "gerar nova senha" seria
-- trocar a senha de QUALQUER login pelo e-mail — tomar a conta de alguém. Só
-- se renova senha que ainda é provisória, de login criado por ESTA conta, com
-- concessão desta conta ainda pendente. Qualquer outro caso recebe a mesma
-- recusa, para não contar o que existe.

create function public.login_provisorio_da_conta(p_workspace_id uuid, p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  ator uuid := (select auth.uid());
  email_alvo text := lower(btrim(coalesce(p_email, '')));
  pessoa uuid;
begin
  if ator is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.workspace_members wm
     where wm.workspace_id = p_workspace_id and wm.user_id = ator and wm.role = 'owner'
  ) then
    raise exception 'só quem administra a conta renova senha' using errcode = '42501';
  end if;

  select u.id into pessoa from auth.users u where lower(u.email) = email_alvo limit 1;

  if pessoa is null
     or private.senha_provisoria_ate(pessoa) is null
     or private.conta_que_criou_o_login(pessoa) is distinct from p_workspace_id
     or not exists (
       select 1 from public.concessoes_de_acesso c
        where c.workspace_id = p_workspace_id and c.email = email_alvo
          and c.convertida_em is null and c.revogada_em is null)
  then
    raise exception 'não há senha provisória a renovar para este e-mail nesta conta'
      using errcode = '22023';
  end if;

  return pessoa;
end;
$$;

revoke execute on function public.login_provisorio_da_conta(uuid, text) from public, anon;
grant execute on function public.login_provisorio_da_conta(uuid, text) to authenticated;

-- ─── 8. Ativar depois da troca ──────────────────────────────────────────────
--
-- Chamada SÓ pelo servidor (chave de serviço), depois de conferir o prazo e de
-- trocar a senha e apagar a marca de provisória no mesmo pedido. Se a marca
-- ainda estiver lá, recusa: ativar antes da troca é exatamente o que o item 2
-- do cabeçalho proíbe.
--
-- Cria o perfil com o nome que o administrador digitou, para a pessoa não cair
-- no "diga quem você é" logo depois de trocar a senha. O gatilho do perfil já
-- converte; a chamada explícita cobre quem criou o perfil antes, pela API.

create function public.ativar_login(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  email_real text;
  criadora uuid;
begin
  select lower(u.email) into email_real from auth.users u where u.id = p_user_id;
  if email_real is null then
    raise exception 'login inexistente' using errcode = '22023';
  end if;
  if private.senha_provisoria_ate(p_user_id) is not null then
    raise exception 'a senha ainda é provisória' using errcode = '22023';
  end if;

  criadora := private.conta_que_criou_o_login(p_user_id);

  insert into public.profiles (id, email, full_name)
  values (p_user_id, email_real, (
    select c.nome from public.concessoes_de_acesso c
     where c.email = email_real and c.nome is not null
       and (criadora is null or c.workspace_id = criadora)
     order by c.concedida_em desc limit 1))
  on conflict (id) do nothing;

  perform private.converter_concessoes(p_user_id, email_real);

  return (select count(*)::integer from public.concessoes_de_acesso c
           where c.convertida_para = p_user_id and c.convertida_em = now());
end;
$$;

revoke execute on function public.ativar_login(uuid) from public, anon, authenticated;
grant execute on function public.ativar_login(uuid) to service_role;
