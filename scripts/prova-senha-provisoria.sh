#!/usr/bin/env bash
#
# Roda a prova da senha provisória (fatia 2 do plano da interface, 18/09).
#
# Senha provisória não dá acesso; a ativação é do servidor, depois da troca;
# renovar senha só vale para login provisório da própria conta; login criado
# por uma conta não recebe acesso de outra; revogar marca, não apaga.
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

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-senha-provisoria.sql"
