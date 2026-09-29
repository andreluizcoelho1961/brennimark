#!/usr/bin/env bash
#
# Roda a prova da IA da plataforma (29/09/2026).
#
# Só a equipe muda rotas e limites, e toda mudança fica registrada com motivo;
# o cliente lê o próprio limite e não o altera; conta nova nasce com os
# limites padrão; e a reserva respeita o teto do MÊS.
#
# A prova constrói o próprio mundo e termina em `rollback`. Não deixa resíduo.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-ia-da-plataforma.sql"
