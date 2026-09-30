#!/usr/bin/env bash
#
# Roda a prova do consumo da conta (30/09/2026).
#
# Configurações › Consumo lê com a sessão de quem pede. Esta prova mostra que
# o dono lê o consumo da própria conta e só dela; que quem só consulta não lê
# nada; que quem administra uma marca lê só a dela; e que ninguém escreve.
#
# A prova constrói o próprio mundo e termina em `rollback`. Não deixa resíduo.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-consumo-da-conta.sql"
