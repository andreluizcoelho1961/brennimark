/*
 * "Pessoas e acesso" deixa de listar os visitantes do tour (29/10/2026).
 *
 * Cada visitante do tour entra na conta de demonstração como `workspace_members`
 * (papel member) e como `brand_members` (consultar). `pessoas_da_conta` lista todo
 * membro da conta, então a tela do dono da Demonstração passaria a mostrar cada
 * visitante, com o nome que ele digitou e o e-mail sintético `.invalid`: até 200
 * por dia. Visitante não é "quem trabalha nas marcas da conta"; é um lead, que já
 * está em `cadastros_gratuitos`.
 *
 * Mudança só de FUNÇÃO: mesma assinatura, mesmo retorno, mesmas permissões. O único
 * acréscimo é o filtro `not private.visitante_do_tour(wm.user_id)` na primeira parte
 * (membros). Quem não é visitante continua listado exatamente como antes, e a
 * conferência de que só o administrador da conta vê a lista não muda.
 * Reverter é reaplicar a definição de `20260918213635_senha_provisoria.sql`.
 */

create or replace function public.pessoas_da_conta(p_workspace_id uuid)
returns table(email text, nome text, papel text, marcas jsonb, pendente boolean, desde timestamp with time zone, senha_provisoria_ate timestamp with time zone)
language plpgsql
security definer
set search_path to ''
as $function$
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
     and not private.visitante_do_tour(wm.user_id)
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
         (select private.senha_provisoria_ate(u.id)
            from auth.users u
           where lower(u.email) = c.email
             and private.conta_que_criou_o_login(u.id) = p_workspace_id
           limit 1)
    from public.concessoes_de_acesso c
   where c.workspace_id = p_workspace_id and c.convertida_em is null and c.revogada_em is null
   group by c.email, c.papel;
end;
$function$;

revoke execute on function public.pessoas_da_conta(uuid) from public, anon;
grant execute on function public.pessoas_da_conta(uuid) to authenticated;
