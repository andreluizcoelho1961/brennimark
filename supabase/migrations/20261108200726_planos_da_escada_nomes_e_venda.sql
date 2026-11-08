-- Nomes da escada (Faísca, Ferro, Forja, Brasa) e abertura da venda. Autorização nominal do André, 08/11/2026.
-- Só texto e a_venda em `planos`: os códigos (chave das assinaturas e dos preços) não mudam.
-- Básico, Médio e Premium saem da vitrine (a_venda = false); assinaturas existentes seguem intactas.
-- Reversibilidade: UPDATE inverso.
update public.planos set nome = case codigo
  when 'uma-marca-sem-ia' then 'Faísca · traga a sua IA'
  when 'uma-marca-com-ia' then 'Faísca · com IA'
  when 'a-sem-ia'         then 'Ferro · traga a sua IA'
  when 'a-com-ia'         then 'Ferro · com IA'
  when 'b-sem-ia'         then 'Forja · traga a sua IA'
  when 'b-com-ia'         then 'Forja · com IA'
  when 'c-sem-ia'         then 'Brasa · traga a sua IA'
  when 'c-com-ia'         then 'Brasa · com IA'
end, a_venda = true
where codigo in ('uma-marca-sem-ia','uma-marca-com-ia','a-sem-ia','a-com-ia','b-sem-ia','b-com-ia','c-sem-ia','c-com-ia');

update public.planos set a_venda = false where codigo in ('basico','medio','premium');
