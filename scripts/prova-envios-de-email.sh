#!/usr/bin/env bash
#
# Roda a prova do registro de envios de e-mail de marketing (22/10/2026).
#
# Só a equipe alcança; elegibilidade, limites, "nunca duas vezes", cascata ao apagar
# o cadastro e registro da equipe valem no BANCO.
#
# A prova constrói o próprio mundo e termina em `rollback`. Não deixa resíduo.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-envios-de-email.sql"
