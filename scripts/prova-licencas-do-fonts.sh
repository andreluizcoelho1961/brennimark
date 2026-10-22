#!/usr/bin/env bash
#
# Roda a prova das licenças do Brennimark Fonts (16/10/2026).
#
# Só a equipe alcança as licenças; limite de computadores, validade de 90 dias,
# revogação e registro das ações valem no BANCO.
#
# A prova constrói o próprio mundo e termina em `rollback`. Não deixa resíduo.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-licencas-do-fonts.sql"
