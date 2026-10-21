-- O registro dos envios de e-mail de marketing — 22/10/2026.
--
-- ─── O que é ─────────────────────────────────────────────────────────────
--
-- Cada vez que a equipe dispara uma campanha pelo Console, o banco anota, por
-- campanha e por pessoa, se o e-mail foi reservado, enviado ou falhou. A trava
-- é a restrição ÚNICA (campanha, pessoa): a mesma campanha nunca sai duas vezes
-- para a mesma pessoa, nem com dois cliques ao mesmo tempo.
--
-- O CONTEÚDO da campanha (assunto e texto) não mora aqui: mora no código
-- (`src/lib/email/campanhas.ts`), com teste. O banco só guarda o identificador.
--
-- ─── Quem alcança ────────────────────────────────────────────────────────
--
-- Só a EQUIPE. A tabela é fechada (RLS ligada sem política, `revoke all` de
-- anon e authenticated). A equipe opera por funções `console_email_*`,
-- SECURITY DEFINER com `search_path` vazio, que recusam com 42501 quem não é da
-- equipe e gravam a reserva no registro da equipe, com motivo.
--
-- ─── Quem recebe ─────────────────────────────────────────────────────────
--
-- Elegível = aceitou, confirmou o e-mail e não saiu (o mesmo critério do índice
-- `cadastros_gratuitos_elegiveis_idx`). Apagar o cadastro apaga o registro dos
-- envios dele (ON DELETE CASCADE): a exclusão pedida pela pessoa é completa.
--
-- ─── O ciclo ─────────────────────────────────────────────────────────────
--
--   reservar → (o servidor envia) → marcar enviado | falhou
--
-- "Falhou" volta a ser elegível na próxima reserva. Uma reserva que ficou
-- parada por mais de 15 minutos (o envio caiu no meio) também volta: é raro, e
-- escolhemos o risco de um reenvio ao de uma pessoa que nunca receberia.

create table public.envios_de_email (
  id            uuid primary key default gen_random_uuid(),
  campanha      text not null,
  cadastro_id   uuid not null references public.cadastros_gratuitos(id) on delete cascade,
  situacao      text not null default 'reservado',
  reservado_em  timestamptz not null default now(),
  concluido_em  timestamptz,

  constraint envios_um_por_pessoa       unique (campanha, cadastro_id),
  constraint envios_campanha_forma      check (campanha ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
  constraint envios_situacao_valida     check (situacao in ('reservado', 'enviado', 'falhou')),
  constraint envios_conclusao_coerente  check ((situacao = 'reservado') = (concluido_em is null))
);

create index envios_de_email_por_campanha on public.envios_de_email (campanha, situacao);

alter table public.envios_de_email enable row level security;
revoke all on table public.envios_de_email from public, anon, authenticated;

-- ─── Resumo: quantos podem receber, quantos já receberam ─────────────────

create function public.console_email_resumo(p_campanha text, p_cargos text[], p_equipes text[])
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
  return jsonb_build_object(
    'elegiveis', (select count(*) from public.cadastros_gratuitos c
                   where c.aceite_marketing and c.confirmado_em is not null and c.descadastrado_em is null),
    'alcance', (select count(*) from public.cadastros_gratuitos c
                 where c.aceite_marketing and c.confirmado_em is not null and c.descadastrado_em is null
                   and (coalesce(cardinality(p_cargos), 0) = 0 or c.cargo = any (p_cargos))
                   and (coalesce(cardinality(p_equipes), 0) = 0 or c.respostas ->> 'equipe' = any (p_equipes))
                   and not exists (select 1 from public.envios_de_email e
                                    where e.campanha = p_campanha and e.cadastro_id = c.id
                                      and (e.situacao = 'enviado'
                                           or (e.situacao = 'reservado' and e.reservado_em > now() - interval '15 minutes')))),
    'enviados', (select count(*) from public.envios_de_email e where e.campanha = p_campanha and e.situacao = 'enviado'),
    'falhas',   (select count(*) from public.envios_de_email e where e.campanha = p_campanha and e.situacao = 'falhou')
  );
end;
$$;

-- ─── Reservar: escolhe quem recebe agora e já marca, numa transação só ───

create function public.console_email_reservar(
  p_campanha text, p_cargos text[], p_equipes text[], p_limite integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  escolhidos jsonb;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  if p_limite is null or p_limite < 1 or p_limite > 25 then
    raise exception 'quantidade inválida' using errcode = '22023';
  end if;

  with candidatos as (
    select c.id
      from public.cadastros_gratuitos c
     where c.aceite_marketing and c.confirmado_em is not null and c.descadastrado_em is null
       and (coalesce(cardinality(p_cargos), 0) = 0 or c.cargo = any (p_cargos))
       and (coalesce(cardinality(p_equipes), 0) = 0 or c.respostas ->> 'equipe' = any (p_equipes))
       and not exists (select 1 from public.envios_de_email e
                        where e.campanha = p_campanha and e.cadastro_id = c.id
                          and (e.situacao = 'enviado'
                               or (e.situacao = 'reservado' and e.reservado_em > now() - interval '15 minutes')))
     order by c.criado_em, c.id
     limit p_limite
       for update of c skip locked
  ), gravados as (
    insert into public.envios_de_email (campanha, cadastro_id)
    select p_campanha, id from candidatos
    on conflict (campanha, cadastro_id)
      do update set situacao = 'reservado', reservado_em = now(), concluido_em = null
    returning cadastro_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'cadastro_id', c.id, 'email', c.email, 'nome', c.nome, 'token', c.token_de_saida,
           'aceite_em', c.aceite_em) order by c.criado_em, c.id), '[]'::jsonb)
    into escolhidos
    from gravados g join public.cadastros_gratuitos c on c.id = g.cadastro_id;

  perform private.registrar_acao_da_equipe(
    'reservar envio de e-mail', 'campanha ' || p_campanha, null,
    jsonb_build_object('quantidade', jsonb_array_length(escolhidos), 'cargos', p_cargos, 'equipes', p_equipes, 'limite', p_limite),
    p_motivo);

  return escolhidos;
end;
$$;

-- ─── Marcar: o desfecho de cada envio ────────────────────────────────────

create function public.console_email_marcar(p_campanha text, p_cadastro_id uuid, p_enviado boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  n integer;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  update public.envios_de_email
     set situacao = case when p_enviado then 'enviado' else 'falhou' end, concluido_em = now()
   where campanha = p_campanha and cadastro_id = p_cadastro_id and situacao = 'reservado';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'envio não encontrado ou já concluído' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.console_email_resumo(text, text[], text[]) from public, anon;
revoke all on function public.console_email_reservar(text, text[], text[], integer, text) from public, anon;
revoke all on function public.console_email_marcar(text, uuid, boolean) from public, anon;
grant execute on function public.console_email_resumo(text, text[], text[]) to authenticated;
grant execute on function public.console_email_reservar(text, text[], text[], integer, text) to authenticated;
grant execute on function public.console_email_marcar(text, uuid, boolean) to authenticated;
