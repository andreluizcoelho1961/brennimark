-- I1.3 — o bucket sobe para 100 MiB, e só agora.
--
-- O limite ficou em 50 MB de propósito enquanto o fluxo não estava pronto:
-- aceitar um arquivo de 100 MiB antes disso significaria subir o objeto e
-- falhar depois — deixando o arquivo órfão no Storage, ou recusando a
-- publicação de um manual que o produto disse aceitar.
--
-- O que precisava existir antes, e existe:
--
--   leitura única do buffer            um arquivo de 100 MiB não é lido duas vezes
--   validação por assinatura            recusa antes de qualquer parse
--   teto de 1.000 páginas               verificado antes de extrair o texto
--   agrupamento com teto de seções      1.000 páginas cabem sem perder nenhuma
--   prévia paginada                     40 itens no DOM, não mil
--   fila durável de limpeza             upload sem publicação não vira órfão
--
-- 104857600 = 100 * 1024 * 1024, o mesmo número que LIMITES_DE_IMPORTACAO usa
-- no cliente. Os dois precisam concordar: um cliente mais permissivo faz o
-- upload falhar depois de a pessoa esperar; um bucket mais permissivo aceita
-- arquivo que o leitor vai recusar.
update storage.buckets
set file_size_limit = 104857600
where id = 'brand-imports';
