-- Pedidos de exportação — 08/10/2026 (desenho aprovado pelo André no mesmo dia:
-- "pode seguir com o desenho, B1 e B2").
--
-- A promessa (Termos, seção 13): "A exportação devolve os arquivos originais e
-- um índice do conteúdo, em até 15 dias depois do pedido." E o aviso de 30 dias
-- antes da exclusão (B1) manda o assinante pedir a exportação.
--
-- Decisão do André (08/10/2026): nesta primeira versão, quem administra a conta
-- PEDE pela tela (Configurações › Plano), a equipe recebe um e-mail e ENTREGA à
-- mão dentro dos 15 dias, marcando no Console. Automatizar quando houver volume.
--
-- Um pedido aberto por conta: pedir de novo devolve o que já está aberto, em
-- vez de criar outro (a tela mostra "pedido em tal data").
--
-- Reversibilidade: tabela nova, aditiva. Os pedidos são histórico da operação
-- e saem com a conta (a exclusão aos 12 meses leva a área inteira).

create table public.pedidos_de_exportacao (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  pedido_por    uuid references auth.users(id) on delete set null,
  pedido_em     timestamptz not null default now(),
  entregue_em   timestamptz,
  entregue_por  uuid references auth.users(id) on delete set null,
  -- Quem entregou só existe se houve entrega (o login de quem entregou pode
  -- sair depois, e a entrega continua registrada).
  constraint pedidos_de_exportacao_entrega_coerente check (entregue_por is null or entregue_em is not null),
  constraint pedidos_de_exportacao_entrega_depois_do_pedido check (entregue_em is null or entregue_em >= pedido_em)
);

-- Um pedido aberto por conta.
create unique index pedidos_de_exportacao_um_aberto
  on public.pedidos_de_exportacao (workspace_id) where entregue_em is null;
-- O Console lista os abertos, do mais antigo (o prazo de 15 dias corre).
create index pedidos_de_exportacao_abertos on public.pedidos_de_exportacao (pedido_em) where entregue_em is null;
create index pedidos_de_exportacao_pedido_por on public.pedidos_de_exportacao (pedido_por);
create index pedidos_de_exportacao_entregue_por on public.pedidos_de_exportacao (entregue_por);

-- Privilégios explícitos (o hospedado dá escrita a `authenticated` por padrão
-- em tabela nova; o local não). Ninguém escreve pela sessão: pedir é a função.
revoke all on public.pedidos_de_exportacao from public, anon, authenticated;
grant select on public.pedidos_de_exportacao to authenticated;
grant select, insert, update on public.pedidos_de_exportacao to service_role;
alter table public.pedidos_de_exportacao enable row level security;

create policy "O dono da conta lê os pedidos de exportação dela" on public.pedidos_de_exportacao
  for select to authenticated
  using (workspace_id in (
    select wm.workspace_id from public.workspace_members wm
     where wm.user_id = (select auth.uid()) and wm.role = 'owner'));

-- ─── 1. Pedir ─────────────────────────────────────────────────────────────
--
-- Só o DONO da conta. Devolve o pedido aberto (o novo, ou o que já existia) e
-- `novo`, para que só o primeiro pedido avise a equipe.
create function public.pedir_exportacao(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
  p public.pedidos_de_exportacao%rowtype;
  novo boolean := false;
begin
  if quem is null then
    raise exception 'é preciso entrar' using errcode = '28000';
  end if;
  if not exists (select 1 from public.workspace_members m
                  where m.workspace_id = p_workspace_id and m.user_id = quem and m.role = 'owner') then
    raise exception 'só quem administra a conta pede a exportação' using errcode = '42501';
  end if;

  -- Dois cliques ao mesmo tempo: o índice de um aberto por conta decide.
  insert into public.pedidos_de_exportacao (workspace_id, pedido_por)
  values (p_workspace_id, quem)
  on conflict (workspace_id) where entregue_em is null do nothing
  returning * into p;
  if found then
    novo := true;
  else
    select * into p from public.pedidos_de_exportacao
     where workspace_id = p_workspace_id and entregue_em is null;
  end if;

  return jsonb_build_object(
    'id', p.id, 'pedido_em', p.pedido_em, 'novo', novo,
    'conta', (select w.name from public.workspaces w where w.id = p_workspace_id),
    'pedido_por', (select u.email from auth.users u where u.id = quem)
  );
end;
$$;

revoke all on function public.pedir_exportacao(uuid) from public, anon;
grant execute on function public.pedir_exportacao(uuid) to authenticated;

-- ─── 2. O Console ─────────────────────────────────────────────────────────

create function public.console_pedidos_de_exportacao()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'workspace_id', p.workspace_id, 'conta', w.name,
      'pedido_em', p.pedido_em, 'pedido_por', u.email,
      'entregue_em', p.entregue_em,
      'titular_email', (select a.titular_email from public.assinaturas a where a.workspace_id = p.workspace_id))
      order by p.entregue_em is not null, p.pedido_em)
    from public.pedidos_de_exportacao p
    join public.workspaces w on w.id = p.workspace_id
    left join auth.users u on u.id = p.pedido_por
   where p.entregue_em is null or p.entregue_em > now() - interval '90 days'), '[]'::jsonb);
end;
$$;

create function public.console_marcar_exportacao_entregue(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  p public.pedidos_de_exportacao%rowtype;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then
    raise exception 'motivo de 3 a 500 caracteres' using errcode = '23514';
  end if;

  update public.pedidos_de_exportacao
     set entregue_em = now(), entregue_por = (select auth.uid())
   where id = p_id and entregue_em is null
  returning * into p;
  if not found then
    raise exception 'pedido não encontrado ou já entregue' using errcode = 'P0002';
  end if;

  perform private.registrar_acao_da_equipe('entregar exportação', 'conta ' || p.workspace_id::text,
    jsonb_build_object('pedido_em', p.pedido_em), jsonb_build_object('entregue_em', p.entregue_em), btrim(p_motivo));
end;
$$;

revoke all on function public.console_pedidos_de_exportacao() from public, anon;
revoke all on function public.console_marcar_exportacao_entregue(uuid, text) from public, anon;
grant execute on function public.console_pedidos_de_exportacao() to authenticated;
grant execute on function public.console_marcar_exportacao_entregue(uuid, text) to authenticated;
