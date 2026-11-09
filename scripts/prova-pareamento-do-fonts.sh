#!/usr/bin/env bash
#
# Prova do pareamento de dispositivos do Fonts (09/11/2026). Aplica a migration DENTRO da própria
# transação (o banco local pode não tê-la) e termina em `rollback`: nada fica no banco.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION="$(ls "$AQUI"/../supabase/migrations/*_fonts_device_pairing.sql)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

{ printf '\\set ON_ERROR_STOP on\nbegin;\n'; cat "$MIGRATION" "$AQUI"/../supabase/migrations/*_fonts_pareamento_aprovar_sem_anon.sql; cat "$AQUI/prova-pareamento-do-fonts.sql"; } \
  | docker exec -i "$CONTAINER" psql -U postgres -q -f -
