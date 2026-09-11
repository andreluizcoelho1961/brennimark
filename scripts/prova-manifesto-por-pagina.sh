#!/usr/bin/env bash
#
# Roda a prova do documento-fonte e do manifesto por página.
#
# A prova em si é SQL (`prova-manifesto-por-pagina.sql`), e isso é deliberado:
# a versão anterior era shell interpretando texto de erro, e tratava qualquer
# mensagem com "violates" como sucesso — um falso positivo estrutural. Em SQL,
# cada caso confere o NOME EXATO da constraint via `GET STACKED DIAGNOSTICS`.
#
# A prova constrói o próprio mundo — duas contas, duas marcas — e termina em
# `rollback`. Não depende de manual importado à mão e não deixa resíduo.
#
# Exige o stack local de pé com as migrations aplicadas.
# Uso: scripts/prova-manifesto-por-pagina.sh
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

# `ON_ERROR_STOP` está no próprio SQL, e o último bloco levanta exceção se
# qualquer caso falhou — então o código de saída do psql é o veredito.
docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-manifesto-por-pagina.sql"
