#!/usr/bin/env bash
#
# Roda a prova de que `enqueue_import_cleanup` enfileira de fato.
#
# A prova é SQL (`prova-limpeza-de-importacao.sql`): cada caso confere SQLSTATE
# e, onde o código é ambíguo, a mensagem exata. Constrói o próprio mundo e
# termina em `rollback` — não deixa resíduo.
#
# Exige o stack local de pé com as migrations aplicadas.
# Uso: scripts/prova-limpeza-de-importacao.sh
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

# `ON_ERROR_STOP` está no próprio SQL, e o último bloco levanta exceção se
# qualquer caso falhou — então o código de saída do psql é o veredito.
docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-limpeza-de-importacao.sql"
