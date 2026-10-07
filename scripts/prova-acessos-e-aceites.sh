#!/usr/bin/env bash
#
# Roda a prova dos registros de acesso (Marco Civil) e dos aceites dos
# documentos (07/10/2026). Constrói o próprio mundo e termina em `rollback`.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-acessos-e-aceites.sql"
