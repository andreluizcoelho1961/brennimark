#!/usr/bin/env bash
#
# Roda a prova da operação do Console (30/09/2026).
#
# Só a equipe pausa, retoma e lê a ficha; cada trava (geral, conta, marca)
# para o que diz parar e só isso; pausar marca não inventa teto; toda ação
# fica registrada com motivo.
#
# A prova constrói o próprio mundo e termina em `rollback`. Não deixa resíduo.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-operacao-do-console.sql"
