#!/usr/bin/env bash
#
# Mede o manifesto por página na escala do produto: 1.000 páginas.
#
# Payload, duração da transação B, custo da repetição e tamanho do relatório.
# A medição em si é SQL, pelo mesmo motivo da prova: ela roda dentro do banco,
# com a forma real dos objetos, e termina em `rollback`.
#
# Exige o stack local de pé com as migrations aplicadas.
# Uso: scripts/medir-manifesto-de-mil-paginas.sh
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/medir-manifesto-de-mil-paginas.sql"
