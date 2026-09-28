#!/usr/bin/env bash
#
# Roda a prova do Console da Brennimark (28/09/2026).
#
# O Console lê ENTRE CONTAS — o que nenhuma política de cliente permite. A
# prova confere que só a equipe passa, que a lista da equipe é inalcançável
# pela API, e que os números batem com o razão.
#
# A prova constrói o próprio mundo e termina em `rollback`. Não deixa resíduo.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-console-da-brennimark.sql"
