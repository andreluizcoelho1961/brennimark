-- Tour de demonstração — fatia 3: devolver a pergunta que falhou e dizer quantas restam.
--
-- O contador de `demonstracao_gastar_pergunta` cobra ANTES de chamar a IA (é a
-- única ordem que não deixa duas abas furarem o limite). Se a IA falha antes de
-- dar a primeira palavra, o visitante não recebeu nada e não pode perder a
-- pergunta: sem `demonstracao_devolver_pergunta`, 2 perguntas por visitante
-- viram 1 num soluço do provedor.
--
-- Reversibilidade: duas funções novas, nenhuma tabela mexe. `drop function` desfaz.

create function public.demonstracao_devolver_pergunta(p_user uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  -- Só devolve o que foi gasto: nunca abaixo de zero.
  update public.demonstracao_visitantes
     set perguntas_feitas = perguntas_feitas - 1
   where user_id = p_user and perguntas_feitas > 0;
  if found then
    update public.demonstracao_uso_diario
       set perguntas = perguntas - 1
     where dia = hoje and perguntas > 0;
  end if;
end;
$$;

revoke all on function public.demonstracao_devolver_pergunta(uuid) from public, anon, authenticated;
grant execute on function public.demonstracao_devolver_pergunta(uuid) to service_role;

-- Quantas perguntas já fez, de quantas, e até quando vale a sessão. O visitante
-- lê a própria linha pela RLS, mas o LIMITE mora na configuração, que só a chave
-- de serviço lê: quem monta a faixa "1 de 2" pergunta aqui.
create function public.demonstracao_estado(p_user uuid)
returns table (feitas integer, limite integer, expira_em timestamptz)
language sql
stable
security definer
set search_path to ''
as $$
  select v.perguntas_feitas, c.perguntas_por_visitante, v.expira_em
    from public.demonstracao_visitantes v
    cross join private.demonstracao_config c
   where v.user_id = p_user;
$$;

revoke all on function public.demonstracao_estado(uuid) from public, anon, authenticated;
grant execute on function public.demonstracao_estado(uuid) to service_role;
