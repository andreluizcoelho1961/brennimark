#!/usr/bin/env bash
#
# Roda a prova do registro de download do manual (fatia 3, 23/09): quem
# alcança a marca registra o PRÓPRIO download, o banco preenche o resto, só
# quem administra a marca lê, e ninguém reescreve.
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

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-downloads-do-manual.sql"
