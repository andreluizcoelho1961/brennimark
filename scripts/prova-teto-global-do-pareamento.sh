#!/usr/bin/env bash
#
# Prova do teto global e da limpeza em solicitar_pareamento_fonts (09/11/2026, M2). Aplica as migrations do
# pareamento DENTRO da própria transação e termina em `rollback`: nada fica no banco.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
M="$AQUI/../supabase/migrations"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

{ printf '\\set ON_ERROR_STOP on\n\\pset pager off\nbegin;\n'
  cat "$M"/*_fonts_device_pairing.sql "$M"/*_fonts_pareamento_aprovar_sem_anon.sql "$M"/*_fonts_pareamento_teto_global.sql
  cat "$AQUI/prova-teto-global-do-pareamento.sql"; } | docker exec -i "$CONTAINER" psql -U postgres -q -f -
