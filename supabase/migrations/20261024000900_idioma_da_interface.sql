-- Idioma da interface por pessoa (23/10/2026) — fatia 2 do plano de inglês.
--
-- `null` quer dizer "ainda não escolheu": vale o idioma do navegador. A lista
-- é a mesma de `PRODUCT_LOCALES` em src/platform/locale.ts; um terceiro idioma
-- amplia a constraint por uma migration nova.
--
-- Sem política nem concessão novas: as três políticas de `profiles` são por
-- linha (a pessoa só lê, insere e altera o PRÓPRIO perfil) e as concessões são
-- da tabela, então a coluna herda ambas. A prova está em
-- scripts/prova-idioma-da-interface.sh.
--
-- `add column` sem default e anulável não reescreve a tabela.

alter table public.profiles add column locale text;

alter table public.profiles
  add constraint profiles_locale_check
  check (locale is null or locale in ('pt-BR', 'en'));
