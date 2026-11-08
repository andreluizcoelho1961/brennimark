-- Os 8 planos da escada de 07/11/2026 (estudo-precos-planos-2026-11-07). FORA DE VENDA.
--
-- Autorização nominal do André em 08/11/2026. Só linhas em `planos`: não cria preço no Stripe,
-- não liga nada à venda e não toca em plano ou assinatura existente (`basico`, `medio`,
-- `premium` continuam como estão). O valor cobrado mora no Stripe; aqui ficam só a correspondência
-- do plano, o limite de marcas, o modo de IA e a franquia.
--
--   "traga a sua IA" (propria): sem franquia, sem teto do plano — o teto é da agência.
--   "com IA" (plataforma): franquia de perguntas por mês e um teto em dólar de SEGURANÇA
--     (cerca de 4x o custo medido de ~US$ 0,02 por pergunta), para um modelo caro ou um manual
--     enorme não furar a margem. A franquia é o limite de produto; o teto é só a rede de proteção.
--
-- Reversibilidade: apagar as 8 linhas enquanto nenhuma assinatura as usa.

insert into public.planos (codigo, nome, maximo_de_marcas, teto_mensal_do_vini_micros, armazenamento_bytes, a_venda, ordem, modo_de_ia, franquia_de_perguntas_por_mes) values
  ('uma-marca-sem-ia', 'Uma marca · traga a sua IA', 1,  0,         null, false, 10, 'propria',    null),
  ('uma-marca-com-ia', 'Uma marca · com IA',          1,  20000000,  null, false, 11, 'plataforma', 100),
  ('a-sem-ia',         '5 marcas · traga a sua IA',   5,  0,         null, false, 12, 'propria',    null),
  ('a-com-ia',         '5 marcas · com IA',           5,  60000000,  null, false, 13, 'plataforma', 300),
  ('b-sem-ia',         '15 marcas · traga a sua IA',  15, 0,         null, false, 14, 'propria',    null),
  ('b-com-ia',         '15 marcas · com IA',          15, 150000000, null, false, 15, 'plataforma', 1000),
  ('c-sem-ia',         '30 marcas · traga a sua IA',  30, 0,         null, false, 16, 'propria',    null),
  ('c-com-ia',         '30 marcas · com IA',          30, 300000000, null, false, 17, 'plataforma', 2000);
