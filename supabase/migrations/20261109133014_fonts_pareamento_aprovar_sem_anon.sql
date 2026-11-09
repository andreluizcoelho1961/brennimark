-- `aprovar_pareamento_fonts` é só de quem entrou (authenticated). O hospedado dá EXECUTE a `anon`
-- por privilégio padrão em função nova, e `revoke ... from public` não o remove: tira-se explícito.
-- Não era brecha (a função recusa auth.uid() nulo com 42501), mas a regra do projeto é não deixar
-- SECURITY DEFINER executável por quem não precisa.
revoke execute on function public.aprovar_pareamento_fonts(uuid, uuid) from anon;
