-- Pareamento de um desktop Brennimark Fonts com uma conta Brennimark.
--
-- O app cria o token e o segredo de consulta localmente; o banco recebe só
-- SHA-256. Aprovar no navegador torna o token utilizável, mas não o revela.
-- Uma revogação futura basta preencher `revogado_em`: cada pedido do desktop
-- volta a validar o dispositivo no servidor.

create table public.fonts_pareamentos_de_dispositivo (
  id uuid primary key,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  segredo_hash text not null check (segredo_hash ~ '^[0-9a-f]{64}$'),
  origem_hash text not null check (origem_hash ~ '^[0-9a-f]{64}$'),
  rotulo_do_dispositivo text not null check (length(btrim(rotulo_do_dispositivo)) between 1 and 80)
    check (rotulo_do_dispositivo !~ '[[:cntrl:]]'),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  aprovado_em timestamptz,
  revogado_em timestamptz,
  ultimo_uso_em timestamptz,
  constraint fonts_pareamento_aprovacao_consistente check (
    (workspace_id is null and user_id is null and aprovado_em is null)
    or (workspace_id is not null and user_id is not null and aprovado_em is not null)
  ),
  constraint fonts_pareamento_expiracao_futura check (expira_em > criado_em)
);

create index fonts_pareamentos_pendentes_idx
  on public.fonts_pareamentos_de_dispositivo (expira_em)
  where aprovado_em is null and revogado_em is null;
create index fonts_pareamentos_workspace_idx
  on public.fonts_pareamentos_de_dispositivo (workspace_id, ultimo_uso_em desc)
  where revogado_em is null;
create index fonts_pareamentos_origem_idx
  on public.fonts_pareamentos_de_dispositivo (origem_hash, criado_em desc);

alter table public.fonts_pareamentos_de_dispositivo enable row level security;
revoke all on table public.fonts_pareamentos_de_dispositivo from public, anon, authenticated;
grant select, insert, update, delete on table public.fonts_pareamentos_de_dispositivo to service_role;

create function public.solicitar_pareamento_fonts(
  p_id uuid,
  p_token_hash text,
  p_segredo_hash text,
  p_origem_hash text,
  p_rotulo_do_dispositivo text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_segredo_hash !~ '^[0-9a-f]{64}$' or p_origem_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash de pareamento inválido' using errcode = '22023';
  end if;
  if length(btrim(p_rotulo_do_dispositivo)) not between 1 and 80 or p_rotulo_do_dispositivo ~ '[[:cntrl:]]' then
    raise exception 'rótulo de dispositivo inválido' using errcode = '22023';
  end if;
  if (select count(*) from public.fonts_pareamentos_de_dispositivo p
      where p.origem_hash = p_origem_hash and p.criado_em > now() - interval '10 minutes') >= 12 then
    raise exception 'limite temporário de pedidos de pareamento atingido' using errcode = 'P0003';
  end if;
  insert into public.fonts_pareamentos_de_dispositivo (id, token_hash, segredo_hash, origem_hash, rotulo_do_dispositivo, expira_em)
  values (p_id, p_token_hash, p_segredo_hash, p_origem_hash, btrim(p_rotulo_do_dispositivo), now() + interval '10 minutes');
exception when unique_violation then
  raise exception 'pareamento já existe' using errcode = '23505';
end;
$$;

revoke all on function public.solicitar_pareamento_fonts(uuid, text, text, text, text) from public;
grant execute on function public.solicitar_pareamento_fonts(uuid, text, text, text, text) to anon, authenticated;

create function public.aprovar_pareamento_fonts(p_id uuid, p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = auth.uid()
  ) then
    raise exception 'sem acesso à conta' using errcode = '42501';
  end if;
  update public.fonts_pareamentos_de_dispositivo
     set workspace_id = p_workspace_id, user_id = auth.uid(), aprovado_em = now()
   where id = p_id and aprovado_em is null and revogado_em is null and expira_em > now();
  if not found then
    raise exception 'pareamento ausente, vencido ou já aprovado' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.aprovar_pareamento_fonts(uuid, uuid) from public;
grant execute on function public.aprovar_pareamento_fonts(uuid, uuid) to authenticated;

create function public.consultar_pareamento_fonts(p_id uuid, p_segredo_hash text)
returns table (estado text)
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_segredo_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'segredo de pareamento inválido' using errcode = '22023';
  end if;
  return query
  select case
    when p.revogado_em is not null then 'revogado'
    when p.aprovado_em is not null then 'aprovado'
    when p.expira_em <= now() then 'vencido'
    else 'pendente'
  end
  from public.fonts_pareamentos_de_dispositivo p
  where p.id = p_id and p.segredo_hash = p_segredo_hash;
end;
$$;

revoke all on function public.consultar_pareamento_fonts(uuid, text) from public;
grant execute on function public.consultar_pareamento_fonts(uuid, text) to anon, authenticated;

create function public.validar_dispositivo_fonts(p_token_hash text)
returns table (workspace_id uuid, user_id uuid)
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;
  return query
  update public.fonts_pareamentos_de_dispositivo p
     set ultimo_uso_em = now()
   where p.token_hash = p_token_hash
     and p.aprovado_em is not null
     and p.revogado_em is null
     and exists (
       select 1 from public.workspace_members m
        where m.workspace_id = p.workspace_id and m.user_id = p.user_id
     )
  returning p.workspace_id, p.user_id;
end;
$$;

revoke all on function public.validar_dispositivo_fonts(text) from public, anon, authenticated;
grant execute on function public.validar_dispositivo_fonts(text) to service_role;
