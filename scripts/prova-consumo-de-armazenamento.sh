#!/usr/bin/env bash
#
# Roda a prova do consumo de armazenamento (ADR-0007 §8.1).
#
# O projeto já exigia prova negativa entre CONTAS (ADR-0003, condição 2). Esta
# é a que faltava: entre MARCAS DA MESMA CONTA — o furo que o ADR-0007 §5
# condiciona a fechar antes de a biblioteca de assets ir ao ar.
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

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-consumo-de-armazenamento.sql"
