#!/usr/bin/env bash
#
# Prova da migration de índices, chave e policy de brand_members (09/11/2026). Aplica a migration DENTRO
# da própria transação e termina em `rollback`: nada fica no banco.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION="$(ls "$AQUI"/../supabase/migrations/*_indices_chave_e_policy_de_brand_members.sql)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

{ printf '\\set ON_ERROR_STOP on\n\\pset pager off\nbegin;\n'; cat "$MIGRATION" "$AQUI/prova-indices-e-brand-members.sql"; } \
  | docker exec -i "$CONTAINER" psql -U postgres -q -f -
