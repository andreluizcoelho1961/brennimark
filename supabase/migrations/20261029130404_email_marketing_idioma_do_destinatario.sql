/*
 * O e-mail de marketing passa a saber o idioma de CADA destinatário (29/10/2026).
 *
 * Até aqui `console_email_reservar` devolvia nome, e-mail, token e data do aceite, e a
 * rota mandava tudo em português — inclusive o rodapé legal, que diz quem manda,
 * por que a pessoa recebe e como sair. Quem se cadastrou pela tela em inglês recebia
 * esse rodapé em português.
 *
 * O idioma já está gravado: `cadastros_gratuitos.respostas ->> 'idioma'` (o idioma da
 * tela em que a pessoa se cadastrou, o mesmo que escolhe a versão do aceite). Só falta
 * devolvê-lo. Mudança só de FUNÇÃO: nenhuma tabela, coluna ou política muda, a assinatura
 * e o tipo de retorno são os mesmos (jsonb), e o que a rota antiga não lê ela ignora.
 * Reverter é reaplicar a definição de `20261021204259_envios_de_email.sql`.
 *
 * Valor desconhecido (ausente, `pt-BR` ou qualquer outra coisa) vira `pt-BR`: o idioma
 * padrão do produto, nunca uma recusa de envio.
 */

create or replace function public.console_email_reservar(
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
           'aceite_em', c.aceite_em,
           'idioma', case when c.respostas ->> 'idioma' = 'en' then 'en' else 'pt-BR' end)
           order by c.criado_em, c.id), '[]'::jsonb)
    into escolhidos
    from gravados g join public.cadastros_gratuitos c on c.id = g.cadastro_id;

  perform private.registrar_acao_da_equipe(
    'reservar envio de e-mail', 'campanha ' || p_campanha, null,
    jsonb_build_object('quantidade', jsonb_array_length(escolhidos), 'cargos', p_cargos, 'equipes', p_equipes, 'limite', p_limite),
    p_motivo);

  return escolhidos;
end;
$$;

-- `create or replace` mantém os privilégios; repetir aqui deixa o contrato explícito.
revoke all on function public.console_email_reservar(text, text[], text[], integer, text) from public, anon;
grant execute on function public.console_email_reservar(text, text[], text[], integer, text) to authenticated;
