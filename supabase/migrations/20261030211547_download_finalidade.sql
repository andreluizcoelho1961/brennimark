-- Por que o original saiu do servidor: `download` ou `previa`.
--
-- O Kit e os Grids precisam do original do logo DENTRO do navegador para medir e
-- desenhar. O servidor assina o endereço e registra a linha antes — a regra do
-- ADR-0007 (registrar antes de o endereço existir) não muda. Mas o Registros
-- mostrava essa linha como "baixou", e abrir a tela parecia levar arquivo.
--
-- A coluna diz a verdade sobre cada linha. Nenhuma linha some e nenhuma muda:
-- as que já existem ficam `download`, que é o que o registro sempre afirmou.
--
-- `previa` só é gravado pela rota do kit, para UM arquivo, a pedido da própria
-- ferramenta (ver `finalidadeDoDownload`). Quem escreve direto na tabela pode
-- se rotular `previa`; é a mesma ressalva da policy de insert — a linha existe
-- e diz o arquivo, só o rótulo é declarado.

alter table public.brand_asset_downloads
  add column finalidade text not null default 'download';

alter table public.brand_asset_downloads
  add constraint brand_asset_downloads_finalidade_check
  check (finalidade in ('download', 'previa'));
