#!/usr/bin/env bash
#
# Prova das funções SECURITY DEFINER executáveis por quem entra (09/11/2026, M3): lista aprovada,
# `anon` só no pareamento do Fonts, e toda `console_*` recusa quem não é da equipe. Roda contra o banco
# local (migrations aplicadas), dentro de uma transação que termina em `rollback`. FALHA se alguém
# criar uma função DEFINER nova executável por `authenticated` sem acrescentá-la à lista do .sql.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-funcoes-executaveis.sql"
