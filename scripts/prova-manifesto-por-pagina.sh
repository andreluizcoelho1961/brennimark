#!/usr/bin/env bash
#
# Prova as garantias do documento-fonte e do manifesto por página.
#
# Por que existe como script versionado, e não como sessão de psql perdida:
# estas garantias são CONSTRAINTS, e constraint que ninguém reexecuta é
# constraint que alguém remove numa refatoração sem perceber. O mesmo motivo de
# `prova-de-concorrencia-ai-ledger.sh`.
#
# Exige o stack local de pé com a migration
# `20260910140000_documento_fonte_e_manifesto_por_pagina.sql` aplicada, e uma
# marca importada. Sem marca não há contexto real, e inventar um por SQL faria
# a prova rodar contra dado que o produto nunca cria.
#
# Uso: scripts/prova-manifesto-por-pagina.sh [chave-da-marca]
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
MARCA="${1:-}"

psql() { docker exec -i "$CONTAINER" psql -U postgres -A -t -F' | ' "$@"; }

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

if [ -z "$MARCA" ]; then
  MARCA=$(psql -c "select key from public.brands b
                   where exists (select 1 from public.brand_imports i where i.brand_id = b.id)
                   order by b.created_at desc limit 1;" | tr -d ' ')
fi
if [ -z "$MARCA" ]; then
  echo "FALHA: nenhuma marca com importação no stack local." >&2
  echo "       Importe um manual pela tela de importação — não recrie por SQL." >&2
  exit 1
fi

DONO=$(psql -c "select m.user_id from public.workspace_members m
                join public.brands b on b.workspace_id = m.workspace_id
                where b.key = '$MARCA' and m.role = 'owner' limit 1;" | tr -d ' ')
if [ -z "$DONO" ]; then
  echo "FALHA: marca $MARCA sem owner." >&2
  exit 1
fi

echo "Marca: $MARCA"
echo "Dono:  $DONO"
echo

falhas=0
verificar() { # nome, obtido, esperado
  if [ "$2" = "$3" ]; then
    printf '  ok    %-46s %s\n' "$1" "$2"
  else
    printf '  FALHA %-46s obtido=%s esperado=%s\n' "$1" "$2" "$3"
    falhas=$((falhas + 1))
  fi
}

# ── 1. As constraints recusam o que precisa ser recusado ────────────────────
#
# Cada caso roda numa transação própria que termina em rollback: a prova não
# pode deixar resíduo no banco de quem a executou.
recusa() { # nome, sql
  local saida
  saida=$(docker exec -i "$CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1 <<SQL 2>&1 || true
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"$DONO","role":"authenticated"}';
insert into public.brand_source_documents
  (workspace_id, brand_id, storage_path, pdf_sha256, byte_size, page_count, created_by)
select b.workspace_id, b.id, 'prova', i.pdf_sha256, 1, 47, '$DONO'
from public.brands b join public.brand_imports i on i.brand_id = b.id
where b.key = '$MARCA' limit 1;
$2
rollback;
SQL
)
  if echo "$saida" | grep -qiE "violates|duplicate key"; then
    printf '  ok    %-46s recusado pelo banco\n' "$1"
  else
    printf '  FALHA %-46s ACEITOU o que deveria recusar\n' "$1"
    falhas=$((falhas + 1))
  fi
}

echo "Constraints que tornam a ausência silenciosa impossível de escrever:"

recusa "sem-secao sem motivo" "
insert into public.brand_source_pages
  (workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt, tem_texto, cobertura)
select d.workspace_id, d.brand_id, d.id, 1, 100, 100, false, 'sem-secao'
from public.brand_source_documents d where d.storage_path = 'prova';"

recusa "secao sem vinculo de documento" "
insert into public.brand_source_pages
  (workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt, tem_texto, cobertura)
select d.workspace_id, d.brand_id, d.id, 2, 100, 100, true, 'secao'
from public.brand_source_documents d where d.storage_path = 'prova';"

recusa "pagina repetida no mesmo documento" "
insert into public.brand_source_pages
  (workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt, tem_texto, cobertura, motivo_da_cobertura)
select d.workspace_id, d.brand_id, d.id, 3, 100, 100, false, 'sem-secao', 'x'
from public.brand_source_documents d where d.storage_path = 'prova';
insert into public.brand_source_pages
  (workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt, tem_texto, cobertura, motivo_da_cobertura)
select d.workspace_id, d.brand_id, d.id, 3, 100, 100, false, 'sem-secao', 'y'
from public.brand_source_documents d where d.storage_path = 'prova';"

recusa "segunda edicao ativa da mesma marca" "
insert into public.brand_source_documents
  (workspace_id, brand_id, storage_path, pdf_sha256, byte_size, page_count, versao, created_by)
select d.workspace_id, d.brand_id, 'prova2', d.pdf_sha256, 1, 1, 99, '$DONO'
from public.brand_source_documents d where d.storage_path = 'prova';"

echo

# ── 2. A página SOBREVIVE à seção — a garantia central ─────────────────────
#
# Esta é a que o desenho errou na primeira versão: `on delete set null` mais a
# constraint de coerência tornavam o DELETE da seção IMPOSSÍVEL, e a curadoria
# abortaria com erro de constraint. O gatilho fecha a transição.
echo "A página sobrevive à seção apagada:"
resultado=$(docker exec -i "$CONTAINER" psql -U postgres -A -t -F'|' <<SQL 2>&1
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"$DONO","role":"authenticated"}';
insert into public.brand_source_documents
  (workspace_id, brand_id, storage_path, pdf_sha256, byte_size, page_count, created_by)
select b.workspace_id, b.id, 'prova', i.pdf_sha256, 1, 47, '$DONO'
from public.brands b join public.brand_imports i on i.brand_id = b.id
where b.key = '$MARCA' limit 1;
insert into public.brand_source_pages
  (workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt, tem_texto, cobertura, document_id)
select d.workspace_id, d.brand_id, d.id, 7, 1920, 1080, true, 'secao',
       (select id from public.brand_documents where brand_id = d.brand_id limit 1)
from public.brand_source_documents d where d.storage_path = 'prova';
delete from public.brand_documents
where id = (select document_id from public.brand_source_pages where pagina = 7 and source_document_id in
            (select id from public.brand_source_documents where storage_path = 'prova'));
select count(*)||'|'||max(cobertura)||'|'||(case when max(length(btrim(motivo_da_cobertura))) > 0 then 'com-motivo' else 'sem-motivo' end)
from public.brand_source_pages where pagina = 7 and source_document_id in
  (select id from public.brand_source_documents where storage_path = 'prova');
rollback;
SQL
)
linha=$(echo "$resultado" | grep -E '^[0-9]+\|' | tail -1)
verificar "a pagina continua existindo" "$(echo "$linha" | cut -d'|' -f1)" "1"
verificar "a cobertura virou sem-secao" "$(echo "$linha" | cut -d'|' -f2)" "sem-secao"
verificar "o motivo foi registrado" "$(echo "$linha" | cut -d'|' -f3)" "com-motivo"

echo

# ── 3. Autorização negativa — Condição 2 do ADR-0003 ───────────────────────
#
# Provar que A lê a sua NÃO é a prova. A prova é que A não lê a de B.
echo "Autorização negativa:"
estranho=$(docker exec -i "$CONTAINER" psql -U postgres -A -t <<SQL 2>&1
begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
select count(*) from public.brand_source_documents;
rollback;
SQL
)
verificar "estranho nao le documento-fonte algum" "$(echo "$estranho" | grep -E '^[0-9]+$' | tail -1)" "0"

anonimo=$(docker exec -i "$CONTAINER" psql -U postgres -A -t <<SQL 2>&1 || true
begin;
set local role anon;
select count(*) from public.brand_source_documents;
rollback;
SQL
)
if echo "$anonimo" | grep -qi "denied"; then
  printf '  ok    %-46s permission denied\n' "anonimo nao alcanca a tabela"
else
  printf '  FALHA %-46s NAO foi negado\n' "anonimo nao alcanca a tabela"
  falhas=$((falhas + 1))
fi

echo
if [ "$falhas" -eq 0 ]; then
  echo "PROVA COMPLETA: todas as garantias verificadas."
else
  echo "PROVA FALHOU: $falhas verificação(ões) fora do esperado."
  exit 1
fi
