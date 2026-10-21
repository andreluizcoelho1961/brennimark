-- Licenças do Brennimark Fonts (beta) — 16/10/2026.
--
-- ─── O que é ─────────────────────────────────────────────────────────────
--
-- O beta do Fonts é gratuito, por convite, 90 dias. Quem emite a licença é a
-- EQUIPE, à mão, no Console: cria a licença (nome, plano, nº de dispositivos),
-- recebe o código público do computador do testador e gera o certificado
-- assinado para aquele computador. Não existe endpoint público.
--
-- Estas duas tabelas guardam só o que o site precisa saber: a licença e os
-- computadores autorizados. O catálogo de fontes de ninguém passa por aqui.
--
-- ─── Decisões (André, 16/10/2026) ────────────────────────────────────────
--
--   plano: 'beta' | 'individual' | 'studio'. Individual e beta: até 2
--   dispositivos. Estúdio: N escolhido na emissão (agência com vários
--   computadores).
--   validade: 90 dias CONTADOS DA CRIAÇÃO da licença — ativar tarde não
--   estende o prazo. A data fica na licença (`expira_em`), não na ativação.
--
-- ─── Onde moram e quem alcança ───────────────────────────────────────────
--
-- No schema `private`, que a API não expõe. Além disso: RLS ligada sem
-- política nenhuma e `revoke all` de anon e authenticated (no Supabase
-- hospedado, tabela nova nasce com escrita para `authenticated`).
-- A equipe opera por funções `console_fonts_*`, SECURITY DEFINER com
-- `search_path` vazio, que recusam com 42501 quem não é da equipe e gravam
-- cada ação no registro da equipe, com motivo.
--
-- A ASSINATURA não acontece no banco: a chave privada mora na Vercel. As
-- funções devolvem os campos do certificado; o código de servidor assina.
-- O certificado NÃO é guardado: é refeito a partir da linha, com os mesmos
-- bytes (Ed25519 é determinístico e o payload sai de campos fixos).
--
-- ─── Limites que o desenho assume ────────────────────────────────────────
--
-- Revogar NÃO derruba um certificado já emitido: o aplicativo valida offline
-- e ele vale até expirar (no máximo 90 dias). Revogar impede NOVAS emissões
-- e libera o lugar do dispositivo para outro computador.

-- ─── 1. Licenças ─────────────────────────────────────────────────────────

create sequence private.licencas_fonts_numero_seq;
revoke all on sequence private.licencas_fonts_numero_seq from public, anon, authenticated;

create table private.licencas_fonts (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null
                   default ('BMF-BETA-' || lpad(nextval('private.licencas_fonts_numero_seq')::text, 6, '0')),
  plano            text not null,
  max_dispositivos integer not null,
  titular_nome     text not null,
  titular_email    text not null,
  agencia          text not null default '',
  emitida_em       timestamptz not null default clock_timestamp(),
  expira_em        timestamptz not null,
  revogada_em      timestamptz,
  revogada_motivo  text,
  criada_por       uuid references auth.users(id) on delete set null,

  constraint licencas_fonts_numero_unico unique (numero),
  constraint licencas_fonts_plano_valido check (plano in ('beta', 'individual', 'studio')),
  constraint licencas_fonts_dispositivos_faixa check (max_dispositivos between 1 and 1000),
  -- Individual e beta são de UMA pessoa: no máximo 2 computadores.
  constraint licencas_fonts_individual_ate_dois check (plano = 'studio' or max_dispositivos <= 2),
  constraint licencas_fonts_nome_forma check (length(btrim(titular_nome)) between 1 and 120),
  constraint licencas_fonts_email_forma check (length(btrim(titular_email)) between 3 and 254 and titular_email like '%@%'),
  constraint licencas_fonts_validade_depois_da_emissao check (expira_em > emitida_em),
  constraint licencas_fonts_revogacao_com_motivo check ((revogada_em is null) = (revogada_motivo is null))
);

-- ─── 2. Ativações: um computador autorizado por linha ────────────────────

create table private.ativacoes_fonts (
  id                uuid primary key default gen_random_uuid(),
  licenca_id        uuid not null references private.licencas_fonts(id) on delete restrict,
  codigo_dispositivo text not null,
  ativada_em        timestamptz not null default clock_timestamp(),
  ativada_por       uuid references auth.users(id) on delete set null,
  revogada_em       timestamptz,
  revogada_motivo   text,

  -- O código público que o aplicativo mostra. Forma frouxa de propósito (letras,
  -- números e os símbolos de base64/base64url): o formato exato é do aplicativo.
  constraint ativacoes_fonts_codigo_forma check (codigo_dispositivo ~ '^[A-Za-z0-9+/_=-]{16,200}$'),
  constraint ativacoes_fonts_revogacao_com_motivo check ((revogada_em is null) = (revogada_motivo is null))
);

-- O mesmo computador não ocupa dois lugares na mesma licença.
create unique index ativacoes_fonts_um_lugar_por_computador
  on private.ativacoes_fonts (licenca_id, codigo_dispositivo) where revogada_em is null;
create index ativacoes_fonts_por_licenca on private.ativacoes_fonts (licenca_id);

alter table private.licencas_fonts enable row level security;
alter table private.ativacoes_fonts enable row level security;
revoke all on private.licencas_fonts from public, anon, authenticated;
revoke all on private.ativacoes_fonts from public, anon, authenticated;

-- ─── 3. Criar a licença ──────────────────────────────────────────────────

create function public.console_fonts_criar_licenca(
  p_plano text, p_max_dispositivos integer, p_titular_nome text, p_titular_email text,
  p_agencia text, p_dias integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  nova private.licencas_fonts;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  if p_dias is null or p_dias < 1 or p_dias > 400 then
    raise exception 'validade inválida' using errcode = '22023';
  end if;

  insert into private.licencas_fonts (plano, max_dispositivos, titular_nome, titular_email, agencia, expira_em, criada_por)
  values (p_plano, p_max_dispositivos, btrim(p_titular_nome), btrim(p_titular_email), coalesce(btrim(p_agencia), ''),
          clock_timestamp() + make_interval(days => p_dias), (select auth.uid()))
  returning * into nova;

  perform private.registrar_acao_da_equipe(
    'criar licença do Fonts', 'licença ' || nova.numero, null,
    jsonb_build_object('plano', nova.plano, 'dispositivos', nova.max_dispositivos, 'expira_em', nova.expira_em), p_motivo);

  return jsonb_build_object('id', nova.id, 'numero', nova.numero, 'expira_em', nova.expira_em);
end;
$$;

-- ─── 4. Ativar: registrar o computador e devolver os campos do certificado ─

-- Idempotente: pedir de novo para o MESMO computador devolve a mesma ativação,
-- sem ocupar outro lugar. A trava na linha da licença faz duas ativações
-- simultâneas no limite deixarem passar só uma.
create function public.console_fonts_ativar(p_licenca_id uuid, p_codigo text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  lic private.licencas_fonts;
  ativacao private.ativacoes_fonts;
  codigo text := btrim(coalesce(p_codigo, ''));
  ocupados integer;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;

  select * into lic from private.licencas_fonts where id = p_licenca_id for update;
  if not found then
    raise exception 'licença não encontrada' using errcode = 'P0002';
  end if;
  if lic.revogada_em is not null then
    raise exception 'licença revogada' using errcode = 'P0001', detail = 'licenca_revogada';
  end if;
  if lic.expira_em <= clock_timestamp() then
    raise exception 'licença vencida' using errcode = 'P0001', detail = 'licenca_vencida';
  end if;

  select * into ativacao from private.ativacoes_fonts
   where licenca_id = lic.id and codigo_dispositivo = codigo and revogada_em is null;

  if not found then
    select count(*) into ocupados from private.ativacoes_fonts where licenca_id = lic.id and revogada_em is null;
    if ocupados >= lic.max_dispositivos then
      raise exception 'limite de dispositivos' using errcode = 'P0001', detail = 'limite_de_dispositivos';
    end if;
    -- Código fora da forma: a constraint recusa com 23514, que a rota traduz.
    insert into private.ativacoes_fonts (licenca_id, codigo_dispositivo, ativada_por)
    values (lic.id, codigo, (select auth.uid()))
    returning * into ativacao;

    perform private.registrar_acao_da_equipe(
      'ativar computador no Fonts', 'licença ' || lic.numero, null,
      jsonb_build_object('ativacao', ativacao.id, 'lugares_usados', ocupados + 1, 'lugares', lic.max_dispositivos), p_motivo);
  end if;

  return jsonb_build_object(
    'license_id', lic.id, 'license_number', lic.numero, 'plan', lic.plano,
    'issued_at', ativacao.ativada_em, 'expires_at', lic.expira_em, 'max_devices', lic.max_dispositivos,
    'activation_id', ativacao.id, 'device_public_key', ativacao.codigo_dispositivo);
end;
$$;

-- Refaz os campos de um certificado já emitido (testador perdeu o arquivo).
create function public.console_fonts_ativacao(p_ativacao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  lic private.licencas_fonts;
  ativacao private.ativacoes_fonts;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  select * into ativacao from private.ativacoes_fonts where id = p_ativacao_id;
  if not found then
    raise exception 'ativação não encontrada' using errcode = 'P0002';
  end if;
  select * into lic from private.licencas_fonts where id = ativacao.licenca_id;
  if lic.revogada_em is not null or ativacao.revogada_em is not null then
    raise exception 'licença revogada' using errcode = 'P0001', detail = 'licenca_revogada';
  end if;
  if lic.expira_em <= clock_timestamp() then
    raise exception 'licença vencida' using errcode = 'P0001', detail = 'licenca_vencida';
  end if;
  return jsonb_build_object(
    'license_id', lic.id, 'license_number', lic.numero, 'plan', lic.plano,
    'issued_at', ativacao.ativada_em, 'expires_at', lic.expira_em, 'max_devices', lic.max_dispositivos,
    'activation_id', ativacao.id, 'device_public_key', ativacao.codigo_dispositivo);
end;
$$;

-- ─── 5. Revogar ──────────────────────────────────────────────────────────

create function public.console_fonts_revogar_ativacao(p_ativacao_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  lic_numero text;
  n integer;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  update private.ativacoes_fonts set revogada_em = clock_timestamp(), revogada_motivo = btrim(p_motivo)
   where id = p_ativacao_id and revogada_em is null;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'ativação não encontrada ou já revogada' using errcode = 'P0002';
  end if;
  select l.numero into lic_numero from private.ativacoes_fonts a
    join private.licencas_fonts l on l.id = a.licenca_id where a.id = p_ativacao_id;
  perform private.registrar_acao_da_equipe(
    'revogar computador no Fonts', 'licença ' || lic_numero, null, jsonb_build_object('ativacao', p_ativacao_id), p_motivo);
end;
$$;

create function public.console_fonts_revogar_licenca(p_licenca_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  lic_numero text;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  update private.licencas_fonts set revogada_em = clock_timestamp(), revogada_motivo = btrim(p_motivo)
   where id = p_licenca_id and revogada_em is null
  returning numero into lic_numero;
  if lic_numero is null then
    raise exception 'licença não encontrada ou já revogada' using errcode = 'P0002';
  end if;
  perform private.registrar_acao_da_equipe(
    'revogar licença do Fonts', 'licença ' || lic_numero, null, jsonb_build_object('licenca', p_licenca_id), p_motivo);
end;
$$;

-- ─── 6. Ler: licenças com os computadores ────────────────────────────────

create function public.console_fonts_licencas()
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
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'numero', l.numero, 'plano', l.plano, 'max_dispositivos', l.max_dispositivos,
      'titular_nome', l.titular_nome, 'titular_email', l.titular_email, 'agencia', l.agencia,
      'emitida_em', l.emitida_em, 'expira_em', l.expira_em, 'revogada_em', l.revogada_em,
      'ativacoes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id, 'codigo_dispositivo', a.codigo_dispositivo, 'ativada_em', a.ativada_em, 'revogada_em', a.revogada_em)
          order by a.ativada_em)
          from private.ativacoes_fonts a where a.licenca_id = l.id), '[]'::jsonb))
      order by l.emitida_em desc)
      from private.licencas_fonts l), '[]'::jsonb);
end;
$$;

-- ─── 7. Privilégios das funções ──────────────────────────────────────────

revoke all on function public.console_fonts_criar_licenca(text, integer, text, text, text, integer, text) from public, anon;
revoke all on function public.console_fonts_ativar(uuid, text, text) from public, anon;
revoke all on function public.console_fonts_ativacao(uuid) from public, anon;
revoke all on function public.console_fonts_revogar_ativacao(uuid, text) from public, anon;
revoke all on function public.console_fonts_revogar_licenca(uuid, text) from public, anon;
revoke all on function public.console_fonts_licencas() from public, anon;
grant execute on function public.console_fonts_criar_licenca(text, integer, text, text, text, integer, text) to authenticated;
grant execute on function public.console_fonts_ativar(uuid, text, text) to authenticated;
grant execute on function public.console_fonts_ativacao(uuid) to authenticated;
grant execute on function public.console_fonts_revogar_ativacao(uuid, text) to authenticated;
grant execute on function public.console_fonts_revogar_licenca(uuid, text) to authenticated;
grant execute on function public.console_fonts_licencas() to authenticated;
