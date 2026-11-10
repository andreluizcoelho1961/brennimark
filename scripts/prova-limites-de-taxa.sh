#!/usr/bin/env bash
#
# Prova do limite de taxa (09/11/2026, A1): janela fixa por chave, chaves e janelas independentes e a
# autorização NEGATIVA (anon e authenticated não executam a função nem tocam a tabela).
# Aplica a migration DENTRO da própria transação e termina em `rollback`: nada fica no banco.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION="$(ls "$AQUI"/../supabase/migrations/*_limites_de_taxa.sql)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

{ printf '\\set ON_ERROR_STOP on\n\\pset pager off\nbegin;\n'; cat "$MIGRATION"; sed '1,/^begin;$/d' "$AQUI/prova-limites-de-taxa.sql"; } \
  | docker exec -i "$CONTAINER" psql -U postgres -q -f -
