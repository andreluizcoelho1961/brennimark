#!/usr/bin/env bash
#
# Roda a prova dos complementos (01/10/2026).
#
# Só quem edita a marca cria e publica; rascunho é só dele e nunca vira
# trecho do Vini; publicar guarda a versão; arquivar tira da leitura sem
# apagar; ninguém reescreve o histórico; outra conta não vê nada.
#
# A prova constrói o próprio mundo e termina em `rollback`. Não deixa resíduo.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-complementos.sql"
