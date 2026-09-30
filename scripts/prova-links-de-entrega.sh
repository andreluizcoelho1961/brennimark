#!/usr/bin/env bash
#
# Roda a prova dos links de entrega (30/09/2026).
#
# Só quem administra a marca cria, lê e revoga link; o link entrega só os
# arquivos dele, na versão atual, com as páginas que os regem; baixar exige
# nome e e-mail e é registrado antes de o arquivo sair; revogado e vencido
# não entregam nada.
#
# A prova constrói o próprio mundo e termina em `rollback`. Não deixa resíduo.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-links-de-entrega.sql"
