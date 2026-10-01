-- Cobrança, fatia 2 — a compra e o Console da cobrança (01/10/2026).
--
-- Só funções, sobre as tabelas da fatia 1 (desenho aprovado pelo André em
-- 01/10). Nenhuma tabela nova, nenhuma coluna nova.
--
--   cobranca_preco_ativo      o checkout pergunta "qual preço do Stripe cobra
--                             este plano, nesta moeda?" — só a chave de serviço
--   console_cobranca          o painel: planos, preços e assinaturas — só a equipe
--   console_definir_plano     cria ou ajusta um plano (limites provisórios, André:
--                             "a gente ajusta no console")
--   console_registrar_preco   liga um preço do Stripe a um plano; o anterior da
--                             mesma moeda e intervalo fica inativo, não some
--   console_desativar_preco   tira um preço do checkout; assinaturas nele seguem
--
-- Toda ação do Console pede motivo e fica no registro da equipe, como as do #66.

-- ─── 1. O preço que o checkout cobra ─────────────────────────────────────

-- `p_so_a_venda`: a compra pelo site só oferece plano à venda; o link de
-- piloto, gerado pela equipe, oferece qualquer plano (o Piloto não está à venda).
create function public.cobranca_preco_ativo(p_plano text, p_moeda text, p_intervalo text, p_so_a_venda boolean)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select pr.id_externo
    from public.precos_do_plano pr
    join public.planos pl on pl.codigo = pr.plano
   where pr.plano = p_plano and pr.provedor = 'stripe' and pr.ativo
     and pr.moeda = upper(p_moeda) and pr.intervalo = p_intervalo
     and (pl.a_venda or not p_so_a_venda);
$$;

revoke all on function public.cobranca_preco_ativo(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.cobranca_preco_ativo(text, text, text, boolean) to service_role;

-- ─── 2. O painel da cobrança no Console ──────────────────────────────────

create function public.console_cobranca()
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
    'planos', coalesce((select jsonb_agg(jsonb_build_object(
        'codigo', pl.codigo, 'nome', pl.nome, 'maximo_de_marcas', pl.maximo_de_marcas,
        'teto_mensal_do_vini_micros', pl.teto_mensal_do_vini_micros,
        'armazenamento_bytes', pl.armazenamento_bytes, 'a_venda', pl.a_venda, 'ordem', pl.ordem,
        'assinaturas', (select count(*) from public.assinaturas a where a.plano = pl.codigo and a.situacao <> 'cancelada'))
        order by pl.ordem, pl.codigo) from public.planos pl), '[]'::jsonb),
    'precos', coalesce((select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'plano', pr.plano, 'provedor', pr.provedor, 'id_externo', pr.id_externo,
        'moeda', pr.moeda, 'intervalo', pr.intervalo, 'ativo', pr.ativo, 'criado_em', pr.created_at)
        order by pr.ativo desc, pr.plano, pr.moeda, pr.created_at desc) from public.precos_do_plano pr), '[]'::jsonb),
    'assinaturas', coalesce((select jsonb_agg(jsonb_build_object(
        'conta', w.name, 'workspace_id', a.workspace_id, 'plano', a.plano, 'situacao', a.situacao,
        'em_atraso_desde', a.em_atraso_desde, 'periodo_pago_ate', a.periodo_pago_ate,
        'cancelar_no_fim', a.cancelar_no_fim, 'cancelada_em', a.cancelada_em, 'moeda', a.moeda,
        'titular_email', a.titular_email, 'desde', a.created_at)
        order by a.created_at desc)
        from public.assinaturas a join public.workspaces w on w.id = a.workspace_id), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.console_cobranca() from public, anon;
grant execute on function public.console_cobranca() to authenticated;

-- ─── 3. Ajustar um plano ─────────────────────────────────────────────────

-- Cria o plano se o código for novo; senão, ajusta. Mudar o teto do Vini do
-- plano NÃO mexe nas contas que já assinam: o teto de cada conta é ajustado
-- na própria conta (aba IA e limites), e o do plano vale para quem entra
-- ou troca de plano depois.
create function public.console_definir_plano(p_codigo text, p_nome text, p_maximo_de_marcas integer,
                                             p_teto_mensal_do_vini_micros bigint, p_armazenamento_bytes bigint,
                                             p_a_venda boolean, p_ordem smallint, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  antes jsonb;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  select to_jsonb(pl) - 'created_at' - 'updated_at' into antes from public.planos pl where pl.codigo = p_codigo;

  insert into public.planos as pl (codigo, nome, maximo_de_marcas, teto_mensal_do_vini_micros, armazenamento_bytes, a_venda, ordem)
  values (p_codigo, btrim(p_nome), p_maximo_de_marcas, p_teto_mensal_do_vini_micros, p_armazenamento_bytes,
          coalesce(p_a_venda, false), coalesce(p_ordem, 0))
  on conflict (codigo) do update set
    nome = excluded.nome, maximo_de_marcas = excluded.maximo_de_marcas,
    teto_mensal_do_vini_micros = excluded.teto_mensal_do_vini_micros,
    armazenamento_bytes = excluded.armazenamento_bytes, a_venda = excluded.a_venda,
    ordem = excluded.ordem, updated_at = now();

  perform private.registrar_acao_da_equipe(
    case when antes is null then 'criar plano' else 'ajustar plano' end, 'plano ' || p_codigo, antes,
    (select to_jsonb(pl) - 'created_at' - 'updated_at' from public.planos pl where pl.codigo = p_codigo), p_motivo);
end;
$$;

revoke all on function public.console_definir_plano(text, text, integer, bigint, bigint, boolean, smallint, text) from public, anon;
grant execute on function public.console_definir_plano(text, text, integer, bigint, bigint, boolean, smallint, text) to authenticated;

-- ─── 4. Ligar e desligar preços ──────────────────────────────────────────

-- O preço novo da mesma moeda e intervalo SUBSTITUI o anterior no checkout;
-- o anterior fica inativo (e não some), porque assinaturas antigas continuam
-- nele e o webhook precisa reconhecê-lo.
create function public.console_registrar_preco(p_plano text, p_id_externo text, p_moeda text, p_intervalo text, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  novo uuid;
  substituido text;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  if btrim(coalesce(p_id_externo, '')) !~ '^price_[A-Za-z0-9_]+$' then
    raise exception 'o identificador do Stripe começa com price_' using errcode = '22023', hint = 'cobranca_preco_invalido';
  end if;

  update public.precos_do_plano set ativo = false
   where plano = p_plano and provedor = 'stripe' and moeda = upper(p_moeda) and intervalo = p_intervalo and ativo
  returning id_externo into substituido;

  insert into public.precos_do_plano (plano, provedor, id_externo, moeda, intervalo)
  values (p_plano, 'stripe', btrim(p_id_externo), upper(p_moeda), p_intervalo)
  returning id into novo;

  perform private.registrar_acao_da_equipe('registrar preço', 'plano ' || p_plano,
    case when substituido is null then null else jsonb_build_object('preco', substituido) end,
    jsonb_build_object('preco', btrim(p_id_externo), 'moeda', upper(p_moeda), 'intervalo', p_intervalo), p_motivo);
  return novo;
end;
$$;

revoke all on function public.console_registrar_preco(text, text, text, text, text) from public, anon;
grant execute on function public.console_registrar_preco(text, text, text, text, text) to authenticated;

create function public.console_desativar_preco(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  o_preco public.precos_do_plano%rowtype;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  update public.precos_do_plano set ativo = false where id = p_id and ativo returning * into o_preco;
  if not found then
    raise exception 'preço não encontrado ou já inativo' using errcode = 'P0002';
  end if;
  perform private.registrar_acao_da_equipe('desativar preço', 'plano ' || o_preco.plano,
    jsonb_build_object('preco', o_preco.id_externo, 'ativo', true), jsonb_build_object('preco', o_preco.id_externo, 'ativo', false), p_motivo);
end;
$$;

revoke all on function public.console_desativar_preco(uuid, text) from public, anon;
grant execute on function public.console_desativar_preco(uuid, text) to authenticated;
