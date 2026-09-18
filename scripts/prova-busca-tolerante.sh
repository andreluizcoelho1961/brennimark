#!/usr/bin/env bash
#
# Roda a prova da busca tolerante de trechos (defeito do ensaio de 18/09).
#
# "primary color" num manual que escreve "colour" voltava zero trechos, e a IA
# afirmava que a marca não documentava cor. A prova tranca as grafias, o plano B
# e o isolamento por marca e por conta.
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

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-busca-tolerante.sql"
