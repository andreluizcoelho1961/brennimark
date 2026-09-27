#!/usr/bin/env bash
#
# Roda a prova da ficha da paleta da marca (27/09/2026).
#
# Editar e aprovar são capacidades separadas (ADR-0002), e aqui a separação é
# do BANCO: quem edita nunca aprova, alterar o aprovado volta a rascunho, e
# nem outra marca da mesma conta nem outra conta alcançam a ficha.
#
# A prova constrói o próprio mundo e termina em `rollback`. Não deixa resíduo.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-paleta-da-marca.sql"
