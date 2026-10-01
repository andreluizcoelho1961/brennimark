-- Cobrança — a base da assinatura paga (01/10/2026).
--
-- Desenho aprovado pelo André em 01/10 ("Autorizo o desenho do banco"):
--
--   planos               cada plano e os seus limites; o Console ajusta
--   precos_do_plano      o preço de cada plano POR PROVEDOR E MOEDA
--   assinaturas          a assinatura de cada conta; só o servidor escreve
--   eventos_de_cobranca  cada aviso do provedor; identificador único; nunca apagado
--
-- Provedor: Stripe (decisão de 01/10 — vender no mundo todo desde o início).
-- O provedor fica numa coluna com vocabulário fechado, e não no nome das
-- tabelas, para que um segundo provedor entre por migration pequena, sem
-- mexer no resto.
--
-- A CONTA NASCE DO AVISO DO PROVEDOR, nunca da página de volta do checkout.
-- O aviso chega assinado; a rota do webhook confere a assinatura e só então
-- chama `cobranca_sincronizar_assinatura`, que abre a conta pelo caminho que
-- já existe desde 18/09 (`private.abrir_conta_de_assinatura`).
--
-- Valores monetários NÃO moram aqui: o preço cobrado é o do provedor. Aqui
-- mora a correspondência "este preço do Stripe é o plano X".

-- ─── 1. Planos ───────────────────────────────────────────────────────────

create table public.planos (
  codigo                      text primary key check (codigo ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  nome                        text not null check (char_length(btrim(nome)) between 1 and 60),
  -- null = sem limite. O banco impõe o limite de marcas (fatia 3); a tela só avisa.
  maximo_de_marcas            integer check (maximo_de_marcas is null or maximo_de_marcas >= 1),
  -- O mesmo dinheiro de `ai_budgets`: micros de dólar do custo de IA da plataforma.
  teto_mensal_do_vini_micros  bigint not null check (teto_mensal_do_vini_micros >= 0),
  armazenamento_bytes         bigint check (armazenamento_bytes is null or armazenamento_bytes > 0),
  -- Plano à venda aparece no site; o Piloto não: ele só existe por link do Console.
  a_venda                     boolean not null default false,
  ordem                       smallint not null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

revoke all on public.planos from public, anon, authenticated;
grant select on public.planos to anon, authenticated;
alter table public.planos enable row level security;
create policy "Os planos são públicos" on public.planos for select to anon, authenticated using (true);

-- Valores PROVISÓRIOS (André, 01/10: "a gente ajusta no console"). As marcas
-- seguem o site; o teto do Vini parte do padrão da fase de pilotos (US$ 60/mês).
insert into public.planos (codigo, nome, maximo_de_marcas, teto_mensal_do_vini_micros, armazenamento_bytes, a_venda, ordem) values
  ('piloto',  'Piloto',  5,  60000000,  null, false, 0),
  ('basico',  'Básico',  5,  30000000,  null, true,  1),
  ('medio',   'Médio',   15, 60000000,  null, true,  2),
  ('premium', 'Premium', 30, 120000000, null, true,  3);

-- ─── 2. Preços: a ponte entre o plano e o provedor ───────────────────────

create table public.precos_do_plano (
  id          uuid primary key default gen_random_uuid(),
  plano       text not null references public.planos(codigo) on update cascade on delete restrict,
  provedor    text not null check (provedor in ('stripe')),
  -- O identificador do preço no provedor (no Stripe, `price_...`).
  id_externo  text not null check (char_length(id_externo) between 3 and 255),
  moeda       text not null check (moeda ~ '^[A-Z]{3}$'),
  intervalo   text not null check (intervalo in ('mes', 'ano')),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint precos_do_plano_id_externo_unico unique (provedor, id_externo)
);

-- Um preço ATIVO por plano, provedor, moeda e intervalo: o checkout precisa
-- saber qual oferecer sem escolher. Preço antigo fica (inativo) porque
-- assinaturas antigas continuam nele.
create unique index precos_do_plano_um_ativo
  on public.precos_do_plano (plano, provedor, moeda, intervalo) where ativo;

revoke all on public.precos_do_plano from public, anon, authenticated;
alter table public.precos_do_plano enable row level security;

-- ─── 3. Assinaturas ──────────────────────────────────────────────────────

create table public.assinaturas (
  id                     uuid primary key default gen_random_uuid(),
  -- Uma conta, uma assinatura. Quem volta depois de cancelar reaproveita a linha.
  workspace_id           uuid not null unique references public.workspaces(id) on delete restrict,
  plano                  text not null references public.planos(codigo) on update cascade on delete restrict,
  provedor               text not null check (provedor in ('stripe')),
  id_externo_cliente     text not null check (char_length(id_externo_cliente) between 3 and 255),
  id_externo_assinatura  text not null check (char_length(id_externo_assinatura) between 3 and 255),
  situacao               text not null check (situacao in ('ativa', 'em_atraso', 'cancelada')),
  -- Quando o atraso começou: os 7 dias de tolerância contam daqui.
  em_atraso_desde        timestamptz,
  periodo_pago_ate       timestamptz,
  cancelar_no_fim        boolean not null default false,
  cancelada_em           timestamptz,
  moeda                  text check (moeda is null or moeda ~ '^[A-Z]{3}$'),
  titular_email          text not null check (position('@' in titular_email) > 1),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint assinaturas_id_externo_unico unique (provedor, id_externo_assinatura),
  constraint assinaturas_atraso_coerente check ((situacao = 'em_atraso') = (em_atraso_desde is not null)),
  constraint assinaturas_cancelamento_coerente check ((situacao = 'cancelada') = (cancelada_em is not null))
);

create index assinaturas_plano on public.assinaturas (plano);

revoke all on public.assinaturas from public, anon, authenticated;
grant select on public.assinaturas to authenticated;
alter table public.assinaturas enable row level security;

-- O administrador da conta (dono) lê a assinatura dela. Ninguém escreve
-- pela sessão: toda escrita vem do servidor, depois do aviso assinado.
create policy "O administrador da conta lê a assinatura dela" on public.assinaturas
  for select to authenticated
  using (workspace_id in (
    select wm.workspace_id from public.workspace_members wm
     where wm.user_id = (select auth.uid()) and wm.role = 'owner'));

-- ─── 4. Eventos de cobrança: o registro de cada aviso ────────────────────

create table public.eventos_de_cobranca (
  id                     uuid primary key default gen_random_uuid(),
  provedor               text not null check (provedor in ('stripe')),
  -- O identificador do aviso no provedor (no Stripe, `evt_...`). O provedor
  -- REPETE o aviso quando não recebe resposta; o único é o que faz a
  -- repetição não ter efeito.
  id_externo             text not null check (char_length(id_externo) between 3 and 255),
  tipo                   text not null check (char_length(tipo) between 1 and 120),
  id_externo_assinatura  text,
  resultado              text check (resultado in ('processado', 'ignorado', 'falhou')),
  detalhe                text check (detalhe is null or char_length(detalhe) <= 500),
  tentativas             integer not null default 1 check (tentativas >= 1),
  recebido_em            timestamptz not null default now(),
  processado_em          timestamptz,
  constraint eventos_de_cobranca_id_externo_unico unique (provedor, id_externo),
  constraint eventos_de_cobranca_conclusao_coerente
    check ((resultado in ('processado', 'ignorado')) = (processado_em is not null))
);

create index eventos_de_cobranca_por_assinatura
  on public.eventos_de_cobranca (id_externo_assinatura, recebido_em desc)
  where id_externo_assinatura is not null;

revoke all on public.eventos_de_cobranca from public, anon, authenticated;
alter table public.eventos_de_cobranca enable row level security;

-- Nunca apagado: o histórico é o que responde a uma contestação. Nem a chave
-- de serviço apaga; um evento concluído também não volta atrás.
create function private.eventos_de_cobranca_imutaveis()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'eventos de cobrança não se apagam'
      using errcode = '42501', hint = 'eventos_de_cobranca_imutaveis';
  end if;
  if old.processado_em is not null
     or new.provedor is distinct from old.provedor
     or new.id_externo is distinct from old.id_externo
     or new.tipo is distinct from old.tipo
     or new.recebido_em is distinct from old.recebido_em then
    raise exception 'evento de cobrança concluído não muda'
      using errcode = '42501', hint = 'eventos_de_cobranca_imutaveis';
  end if;
  return new;
end;
$$;

revoke all on function private.eventos_de_cobranca_imutaveis() from public, anon, authenticated;

create trigger eventos_de_cobranca_imutaveis
  before update or delete on public.eventos_de_cobranca
  for each row execute function private.eventos_de_cobranca_imutaveis();

create trigger eventos_de_cobranca_sem_truncate
  before truncate on public.eventos_de_cobranca
  for each statement execute function private.eventos_de_cobranca_imutaveis();

-- ─── 5. Receber e concluir um aviso ──────────────────────────────────────

-- Devolve o que fazer com o aviso:
--   'novo'       primeira vez: processe
--   'repetir'    já chegou e falhou (ou não terminou): processe de novo
--   'concluido'  já foi processado: responda 200 e não faça nada
create function public.cobranca_receber_evento(p_provedor text, p_id_externo text, p_tipo text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  existente public.eventos_de_cobranca%rowtype;
begin
  insert into public.eventos_de_cobranca (provedor, id_externo, tipo)
  values (p_provedor, p_id_externo, p_tipo)
  on conflict (provedor, id_externo) do nothing;
  if found then
    return 'novo';
  end if;

  select * into existente from public.eventos_de_cobranca
   where provedor = p_provedor and id_externo = p_id_externo
   for update;
  if existente.processado_em is not null then
    return 'concluido';
  end if;
  update public.eventos_de_cobranca set tentativas = tentativas + 1 where id = existente.id;
  return 'repetir';
end;
$$;

revoke all on function public.cobranca_receber_evento(text, text, text) from public, anon, authenticated;
grant execute on function public.cobranca_receber_evento(text, text, text) to service_role;

create function public.cobranca_concluir_evento(p_provedor text, p_id_externo text, p_resultado text,
                                                p_detalhe text default null,
                                                p_id_externo_assinatura text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.eventos_de_cobranca
     set resultado = p_resultado,
         detalhe = left(p_detalhe, 500),
         id_externo_assinatura = coalesce(p_id_externo_assinatura, id_externo_assinatura),
         processado_em = case when p_resultado in ('processado', 'ignorado') then now() end
   where provedor = p_provedor and id_externo = p_id_externo and processado_em is null;
end;
$$;

revoke all on function public.cobranca_concluir_evento(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.cobranca_concluir_evento(text, text, text, text, text) to service_role;

-- ─── 6. Sincronizar a assinatura — e abrir a conta no primeiro pagamento ─

-- Recebe o estado JÁ traduzido para o vocabulário do produto. A tradução do
-- provedor (`active`, `past_due`…) fica no código do provedor, para que o
-- banco não saiba de Stripe além do nome.
--
--   p_situacao  'ativa' | 'em_atraso' | 'cancelada' | 'incompleta'
--   p_titular   o login do titular; se vier nulo, é o login com o e-mail do
--               titular, que o servidor garante antes de chamar
--
-- Devolve a conta, ou null quando não há nada a fazer (assinatura que nunca
-- pagou, ou aviso de uma assinatura que não é a vigente da conta).
create function public.cobranca_sincronizar_assinatura(
  p_provedor text,
  p_id_externo_cliente text,
  p_id_externo_assinatura text,
  p_id_externo_preco text,
  p_situacao text,
  p_periodo_pago_ate timestamptz,
  p_cancelar_no_fim boolean,
  p_moeda text,
  p_titular uuid,
  p_titular_email text,
  p_nome_da_conta text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  o_plano public.planos%rowtype;
  atual public.assinaturas%rowtype;
  conta uuid;
  o_email text := lower(btrim(p_titular_email));
  titular uuid := p_titular;
begin
  if p_situacao not in ('ativa', 'em_atraso', 'cancelada', 'incompleta') then
    raise exception 'situação desconhecida: %', p_situacao using errcode = '22023', hint = 'cobranca_situacao_desconhecida';
  end if;

  select pl.* into o_plano
    from public.precos_do_plano pr join public.planos pl on pl.codigo = pr.plano
   where pr.provedor = p_provedor and pr.id_externo = p_id_externo_preco;
  if not found then
    raise exception 'preço sem plano: %', p_id_externo_preco using errcode = '22023', hint = 'cobranca_preco_desconhecido';
  end if;

  -- Dois avisos da mesma assinatura chegam ao mesmo tempo (o checkout e a
  -- fatura paga, por exemplo). Sem esta trava, os dois veriam "não existe" e
  -- abririam DUAS contas.
  perform pg_advisory_xact_lock(hashtextextended('cobranca:' || p_provedor || ':' || p_id_externo_assinatura, 0));

  select * into atual from public.assinaturas
   where provedor = p_provedor and id_externo_assinatura = p_id_externo_assinatura
   for update;

  if not found then
    -- Só o pagamento abre conta. Assinatura que nunca pagou não vira nada.
    if p_situacao <> 'ativa' then
      return null;
    end if;
    if titular is null then
      select u.id into titular from auth.users u where lower(u.email) = o_email limit 1;
    end if;
    if titular is null then
      raise exception 'falta o titular' using errcode = '22004', hint = 'cobranca_sem_titular';
    end if;

    conta := private.abrir_conta_de_assinatura(
      coalesce(nullif(btrim(p_nome_da_conta), ''), o_email), o_email, titular);

    insert into public.assinaturas (workspace_id, plano, provedor, id_externo_cliente, id_externo_assinatura,
                                    situacao, periodo_pago_ate, cancelar_no_fim, moeda, titular_email)
    values (conta, o_plano.codigo, p_provedor, p_id_externo_cliente, p_id_externo_assinatura,
            'ativa', p_periodo_pago_ate, coalesce(p_cancelar_no_fim, false), upper(p_moeda), o_email);

    perform private.aplicar_plano_na_conta(conta, o_plano.codigo);
    return conta;
  end if;

  if p_situacao = 'incompleta' then
    return atual.workspace_id;
  end if;

  update public.assinaturas set
    plano            = o_plano.codigo,
    id_externo_cliente = p_id_externo_cliente,
    situacao         = p_situacao,
    em_atraso_desde  = case when p_situacao = 'em_atraso' then coalesce(atual.em_atraso_desde, now()) end,
    cancelada_em     = case when p_situacao = 'cancelada' then coalesce(atual.cancelada_em, now()) end,
    periodo_pago_ate = coalesce(p_periodo_pago_ate, atual.periodo_pago_ate),
    cancelar_no_fim  = coalesce(p_cancelar_no_fim, false),
    moeda            = coalesce(upper(p_moeda), atual.moeda),
    updated_at       = now()
   where id = atual.id;

  if o_plano.codigo is distinct from atual.plano then
    perform private.aplicar_plano_na_conta(atual.workspace_id, o_plano.codigo);
  end if;
  return atual.workspace_id;
end;
$$;

revoke all on function public.cobranca_sincronizar_assinatura(text, text, text, text, text, timestamptz, boolean, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.cobranca_sincronizar_assinatura(text, text, text, text, text, timestamptz, boolean, text, uuid, text, text)
  to service_role;

-- O plano define o teto mensal do Vini da conta. Só na abertura e na troca de
-- plano: entre uma e outra, o Console pode ajustar a conta à mão.
create function private.aplicar_plano_na_conta(p_workspace_id uuid, p_plano text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  teto bigint := (select pl.teto_mensal_do_vini_micros from public.planos pl where pl.codigo = p_plano);
begin
  /*
   * Atualizar e, se não houver, inserir — e não `on conflict`: a unicidade de
   * `ai_budgets` é (workspace_id, brand_id, period) sem NULLS NOT DISTINCT, e
   * com `brand_id` nulo o conflito nunca dispara. Um `on conflict` aqui
   * inseriria uma segunda linha mensal em silêncio.
   */
  update public.ai_budgets set limit_micros = teto, updated_at = now()
   where workspace_id = p_workspace_id and brand_id is null and period = 'monthly';
  if not found then
    insert into public.ai_budgets (workspace_id, brand_id, period, limit_micros, currency, kill_switch)
    values (p_workspace_id, null, 'monthly', teto, 'USD', false);
  end if;
end;
$$;

revoke all on function private.aplicar_plano_na_conta(uuid, text) from public, anon, authenticated;
