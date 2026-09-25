#!/usr/bin/env bash
#
# Roda a prova da conta removida (LGPD, 24/09): apagar um login funciona, a
# autoria vira "conta removida", o e-mail vira apelido anônimo estável, e as
# análises ficam com a marca.
#
# A prova constrói o próprio mundo e termina em `rollback`. Não deixa resíduo.
# Exige o stack local de pé com as migrations aplicadas.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-conta-removida.sql"
