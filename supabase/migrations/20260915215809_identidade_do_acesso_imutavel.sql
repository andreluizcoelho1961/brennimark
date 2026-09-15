-- A identidade de uma concessão de acesso não muda — correção de 14/09/2026.
--
-- ─── O defeito, reproduzido antes de corrigir ────────────────────────────
--
-- Revisão externa de 14/09. A policy de update de `brand_members` deixa quem
-- administra a conta alterar QUALQUER coluna, inclusive `user_id` e
-- `brand_id`. E o gatilho do registro (`registrar_acesso_por_marca`) só
-- registra um update quando `capacidades` muda.
--
-- Juntas, as duas permitem mover uma concessão de uma pessoa para outra sem
-- deixar rastro. Reproduzido no banco local:
--
--   concessão de `editar` para rep-a            → registro: "rep-a concedido"
--   update set user_id = rep-b (mesmas capac.)  → nenhum evento
--   estado final: rep-b tem `editar`
--   registro final: só "rep-a concedido"
--
-- O registro passava a mentir por omissão sobre quem tem acesso — o oposto do
-- que ele existe para responder.
--
-- ─── A correção, e a alternativa recusada ────────────────────────────────
--
-- Recusada: ensinar o gatilho do registro a detectar troca de identidade e
-- gravar dois eventos. Funciona, mas mantém uma operação que não tem sentido
-- de produto — "a concessão da Ana agora é do Bruno" não é algo que alguém
-- queira fazer — e deixa o registro dependente de um caso especial que alguém
-- vai esquecer ao mexer no gatilho.
--
-- Adotada: as colunas de identidade são IMUTÁVEIS. Mudar a pessoa ou a marca
-- de um acesso passa a ser o que sempre foi de fato: revogar um e conceder
-- outro. Os dois caminhos já são registrados. O defeito deixa de ser corrigido
-- e passa a ser impossível.
--
-- Gatilho, e não GRANT por coluna: o gatilho vale para todo papel, inclusive a
-- chave de serviço e SQL de manutenção, que ignoram GRANT.

create function private.identidade_do_acesso_imutavel()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.brand_id     is distinct from old.brand_id
  or new.user_id      is distinct from old.user_id
  or new.workspace_id is distinct from old.workspace_id then
    raise exception 'a pessoa e a marca de um acesso não mudam: revogue e conceda de novo'
      using errcode = 'check_violation',
            constraint = 'brand_members_identidade_imutavel';
  end if;
  return new;
end;
$$;

revoke execute on function private.identidade_do_acesso_imutavel() from public, anon, authenticated;

-- BEFORE: a linha nunca chega a mudar, então o registro não tem o que omitir.
create trigger brand_members_identidade_imutavel
  before update on public.brand_members
  for each row execute function private.identidade_do_acesso_imutavel();
