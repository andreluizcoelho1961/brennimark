-- Tour de demonstração — a marca do tour escolhida pelo IDIOMA da pessoa.
-- Decisão de 27/10/2026: a conta "Demonstração" tem duas marcas, o manual do
-- Brennimark em português e em inglês. Quem entra pela tela em inglês vê o manual
-- em inglês; os demais, o em português.
--
-- O que muda: `private.demonstracao_config` ganha `brand_id_en` (opcional; sem ele,
-- todos veem a marca em `brand_id`, que é a em português). `demonstracao_receber`
-- escolhe a marca pelo `p_idioma` e devolve a chave da que escolheu. O vínculo
-- (`consultar` e mais nada) passa a ser feito por uma função interna que recebe a
-- marca e RECUSA qualquer marca que não seja uma das duas configuradas — o cliente
-- nunca informa a marca, e uma configuração errada não vira acesso a outra marca.
--
-- Reversibilidade: uma coluna nova e uma função interna; `demonstracao_entrar`
-- segue existindo, com o mesmo contrato. Desfazer é `drop` da coluna e da função.

alter table private.demonstracao_config
  add column brand_id_en uuid,
  add constraint demonstracao_config_marca_en_fkey
    foreign key (brand_id_en, workspace_id)
    references public.brands(id, workspace_id) on delete set null (brand_id_en),
  add constraint demonstracao_config_marcas_distintas
    check (brand_id_en is null or brand_id_en <> brand_id);

-- O vínculo do visitante à marca, que só esta função e a chave de serviço alcançam.
create function private.demonstracao_vincular(p_user uuid, p_brand uuid)
returns timestamptz
language plpgsql
security definer
set search_path to ''
as $$
declare
  c      record;
  expira timestamptz;
begin
  if not private.visitante_do_tour(p_user) then
    raise exception 'sessao_nao_visitante' using errcode = 'P0001';
  end if;

  select * into c from private.demonstracao_config where ativo;
  if not found then
    raise exception 'demonstracao_inativa' using errcode = 'P0001';
  end if;

  -- Só as marcas do tour. Sem isto, um erro de quem chama viraria acesso a outra marca.
  if p_brand is distinct from c.brand_id and p_brand is distinct from c.brand_id_en then
    raise exception 'marca_fora_do_tour' using errcode = 'P0001';
  end if;

  insert into public.demonstracao_visitantes (user_id, expira_em)
  values (p_user, now() + make_interval(hours => c.validade_horas))
  on conflict (user_id) do nothing;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (c.workspace_id, p_user, 'member')
  on conflict do nothing;

  -- `consultar` e mais nada: é a cerca que impede upload e edição.
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades)
  values (p_brand, c.workspace_id, p_user, array['consultar']::text[])
  on conflict (brand_id, user_id) do nothing;

  select v.expira_em into expira from public.demonstracao_visitantes v where v.user_id = p_user;
  return expira;
end;
$$;

revoke all on function private.demonstracao_vincular(uuid, uuid) from public, anon, authenticated;

-- O contrato de sempre: vincula à marca em `brand_id` (a em português).
create or replace function public.demonstracao_entrar(p_user uuid)
returns timestamptz
language plpgsql
security definer
set search_path to ''
as $$
declare
  c record;
begin
  select * into c from private.demonstracao_config where ativo;
  if not found then
    -- A ordem das recusas de sempre: quem não é visitante é recusado antes do "tour parado".
    if not private.visitante_do_tour(p_user) then
      raise exception 'sessao_nao_visitante' using errcode = 'P0001';
    end if;
    raise exception 'demonstracao_inativa' using errcode = 'P0001';
  end if;
  return private.demonstracao_vincular(p_user, c.brand_id);
end;
$$;

revoke all on function public.demonstracao_entrar(uuid) from public, anon, authenticated;
grant execute on function public.demonstracao_entrar(uuid) to service_role;

create or replace function public.demonstracao_receber(
  p_user   uuid,
  p_nome   text,
  p_email  text,
  p_idioma text default 'pt-BR'
)
returns table (expira_em timestamptz, workspace_id uuid, marca_key text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  c         record;
  hoje      date := (now() at time zone 'America/Sao_Paulo')::date;
  ja_existe boolean;
  cadastro  uuid;
  expira    timestamptz;
  marca     uuid;
begin
  if not private.visitante_do_tour(p_user) then
    raise exception 'sessao_nao_visitante' using errcode = 'P0001';
  end if;

  select * into c from private.demonstracao_config where ativo;
  if not found then
    raise exception 'demonstracao_inativa' using errcode = 'P0001';
  end if;

  -- A marca é escolhida pelo idioma da tela; sem marca em inglês configurada, a em português.
  marca := case when p_idioma = 'en' and c.brand_id_en is not null then c.brand_id_en else c.brand_id end;

  select exists (select 1 from public.demonstracao_visitantes v where v.user_id = p_user)
    into ja_existe;

  if not ja_existe then
    insert into public.demonstracao_uso_diario as d (dia, entradas)
    values (hoje, 1)
    on conflict (dia) do update set entradas = d.entradas + 1
      where d.entradas < c.teto_entradas_dia;
    if not found then
      raise exception 'demonstracao_lotada' using errcode = 'P0001';
    end if;
  end if;

  insert into public.profiles (id, email, full_name, locale)
  values (
    p_user,
    -- Endereço sintético: o e-mail real fica só no cadastro.
    'visitante-' || substr(replace(p_user::text, '-', ''), 1, 8) || '@visitante.invalid',
    left(btrim(p_nome), 120),
    case when p_idioma in ('pt-BR', 'en') then p_idioma end
  )
  on conflict (id) do nothing;

  select g.id into cadastro from public.cadastros_gratuitos g where g.email = lower(btrim(p_email));

  expira := private.demonstracao_vincular(p_user, marca);

  update public.demonstracao_visitantes v
     set cadastro_id = cadastro
   where v.user_id = p_user and cadastro is not null;

  return query select expira, c.workspace_id, b.key
                 from public.brands b
                where b.id = marca and b.workspace_id = c.workspace_id;
end;
$$;

revoke all on function public.demonstracao_receber(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.demonstracao_receber(uuid, text, text, text) to service_role;
