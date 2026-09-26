#!/usr/bin/env bash
#
# Roda a prova dos sinônimos na busca de trechos (defeito do ensaio de 26/09).
#
# "Qual é o logotipo principal?" num manual que escreve "logo" e "preferencial"
# não achava a página que responde, e a IA afirmava que a marca não documentava.
# A prova tranca os sinônimos, a prioridade de todas as palavras, as grafias da
# busca tolerante e o isolamento por marca e por conta.
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

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-sinonimos-na-busca.sql"
