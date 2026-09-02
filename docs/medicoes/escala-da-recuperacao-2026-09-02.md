# Escala da recuperação — 2026-09-02

Pedido na revisão do A1: provar que o índice funciona com um manual realista,
não apenas com duas marcas pequenas.

## O que foi medido

Dados **sintéticos**, com a forma do GE_ID000 medida no aceite: 743 páginas,
152 seções. A marca real não foi publicada e nenhum conteúdo dela foi usado —
só as duas contagens. O texto sintético usa vocabulário de manual de marca
(cor, tipografia, grid, redução, área de respiro) para que o stemming do
português tenha o mesmo tipo de trabalho.

Três cenários, todos com uma marca VIZINHA no mesmo workspace usando o mesmo
vocabulário — sem ela, o teste provaria que a busca não encontra o que não
existe, em vez de provar que o filtro por `brand_id` é o que separa.

| cenário | trechos da marca | trechos na tabela |
|---|---|---|
| um manual | 304 | 380 |
| quarenta clientes | 304 | 6.460 |
| marca no teto do produto (500 seções) | 1.000 | 7.460 |

## Resultado

100 buscas, dez consultas diferentes em rodízio, depois de aquecer:

| cenário | média | pior | fontes por busca |
|---|---|---|---|
| 152 seções, 40 clientes na tabela | 1,11 ms | 1,89 ms | 5,6 (teto 8) |
| 500 seções — o teto do produto | 1,93 ms | 3,22 ms | 5,6 (teto 8) |

O número de fontes nunca passou de 8, que é o limite declarado.

## `EXPLAIN (ANALYZE, BUFFERS)`

Com 380 linhas na tabela, **Seq Scan** — correto, e é por isso que o teste com
duas marcas pequenas não provava nada.

Com 6.460 linhas, o plano passa a usar índice:

```
Limit  (cost=309.07..309.09 rows=8) (actual time=0.767..0.769 rows=8)
  Buffers: shared hit=164
  ->  Sort  (actual time=0.766..0.767 rows=8)
        Sort Key: ts_rank(...) DESC, c.slug, c.ordinal
        Sort Method: top-N heapsort  Memory: 26kB
        ->  Index Scan using brand_chunks_brand_idx  (actual time=0.103..0.679 rows=152)
              Index Cond: (brand_id = ...)
              Filter: (workspace_id = ANY(...) AND tsv @@ '''contr'' & ''cor'' & ''papel''')
              Rows Removed by Filter: 152
              Buffers: shared hit=155
Planning Time: 14.311 ms
Execution Time: 0.863 ms
```

## O achado que importa

**O índice GIN nunca é usado.** Quem faz o trabalho é o btree
`brand_chunks_brand_idx`, que estreita para os trechos da marca; o `tsv @@` vira
filtro sobre esse conjunto pequeno.

Forçando o planejador para longe do index scan (`enable_indexscan=off`,
`enable_seqscan=off`), ele escolhe **Bitmap Index Scan sobre o mesmo btree** —
não o GIN. Em nenhum plano medido o GIN aparece.

A razão é estrutural, não circunstancial: uma marca não pode ter mais de 500
seções, porque o importador recusa acima disso. Logo os trechos por marca são
limitados a cerca de mil, e varrer mil linhas filtrando por `tsv` é mais barato
que consultar o GIN e cruzar o resultado com o filtro de marca.

Custo do que não é usado: 4,4 MB de índice com 7.460 linhas, e escrita a cada
mudança de documento — uma importação de 500 seções faz mil inserções nele.

**Decidido: o GIN foi removido** (migração `20260902100000`). `btree_gin` foi
recusada — um GIN composto em `(brand_id, tsv)` resolveria, e adicionaria uma
extensão ao projeto para ganhar tempo que o teto de 500 seções já garante.

## Depois da remoção

Mesmo roteiro, mesma semeadura, GIN ausente:

| cenário | média | pior | fontes por busca |
|---|---|---|---|
| 152 seções, 40 clientes na tabela | **0,34 ms** | 0,99 ms | 5,6 |
| 500 seções — o teto do produto | **0,92 ms** | 1,49 ms | 5,6 |

Mais rápido que com o índice, não apenas igual. A tabela caiu de 16 MB para
12 MB — os 4 MB eram o GIN.

O plano no teto:

```
Limit  (actual time=2.158..2.161 rows=8)
  ->  Sort  Sort Method: top-N heapsort  Memory: 25kB
        ->  Bitmap Heap Scan on brand_chunks  (actual time=0.179..1.903 rows=500)
              Recheck Cond: (brand_id = ...)
              Filter: (workspace_id = ANY(...) AND tsv @@ ...)
              Rows Removed by Filter: 500
              Heap Blocks: exact=125
              ->  Bitmap Index Scan on brand_chunks_brand_idx  (rows=1000)
Execution Time: 2.854 ms
```

Mil trechos varridos, quinhentos descartados pelo filtro de texto, oito
devolvidos. É exatamente o custo previsto pelo teto de seções, e ele não cresce
com o número de marcas na tabela — o btree estreita antes.

Nota sobre a comparação: o `EXPLAIN` isolado mostra 2,85 ms contra os 0,92 ms
médios das cem chamadas porque inclui o custo de planejamento e a primeira
leitura fria. A média de cem chamadas é a medida mais próxima do uso real.

## Como reproduzir

`scripts/medir-escala-da-recuperacao.sql`. Ele semeia, mede e **remove tudo**
ao final. Rodado contra o projeto real com o banco vazio; conferido depois:
0 marcas, 0 documentos, 0 trechos, 0 assets, 0 análises, 0 arquivos.
