#!/usr/bin/env bash
#
# Prova de concorrência das licenças do Fonts (16/10/2026).
#
# Duas ativações de computadores DIFERENTES, ao mesmo tempo, numa licença com um
# único lugar: só uma pode passar. A trava (`for update` na linha da licença) é o
# que garante isso, e um teste sequencial não a exercita.
#
# "Esperou de fato" é a asserção que faz a prova valer: a primeira sessão segura
# a transação por 1,5 s depois de ativar; se a segunda não tiver ficado esperando
# a trava (mediu menos que 1 s), as duas não se sobrepuseram e a prova não provou
# nada — ela reprova em vez de passar sem ter exercitado a trava.
#
# Esta prova COMITA (precisa de duas sessões) e limpa o que criou ao final.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
PSQL=(docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=0 -qAt)
EQ="f1f1f1f1-f1f1-41f1-81f1-f1f1f1f10001"
CA="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
CB="BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
TMP="$(mktemp -d)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

limpar() {
  "${PSQL[@]}" -c "delete from private.ativacoes_fonts where licenca_id in (select id from private.licencas_fonts where titular_email = 'concorrencia@prova.test');
                   delete from private.licencas_fonts where titular_email = 'concorrencia@prova.test';
                   delete from private.equipe_brennimark where user_id = '$EQ';
                   delete from auth.users where id = '$EQ';" >/dev/null 2>&1 || true
}
trap 'limpar; rm -rf "$TMP"' EXIT
limpar

"${PSQL[@]}" -c "insert into auth.users (id, email, aud, role) values ('$EQ', 'prova-concorrencia-fonts@local.test', 'authenticated', 'authenticated');
                 insert into private.equipe_brennimark (user_id, nome, motivo) values ('$EQ', 'Prova de concorrência', 'prova');" >/dev/null

LIC="$("${PSQL[@]}" <<SQL
set request.jwt.claims = '{"sub":"$EQ","role":"authenticated"}';
set role authenticated;
select (public.console_fonts_criar_licenca('studio', 1, 'Concorrência', 'concorrencia@prova.test', '', 90, 'prova de concorrência'))->>'id';
SQL
)"
LIC="$(echo "$LIC" | grep -E '^[0-9a-f-]{36}$' | head -1)"
[ -n "$LIC" ] || { echo "FALHA: a preparação não criou a licença" >&2; exit 1; }

# Sessão 1: ativa e SEGURA a transação por 1,5 s. Sessão 2: começa logo depois.
sessao() {  # $1 = código, $2 = segura (segundos), $3 = arquivo de saída
  local ini fim
  ini=$(python3 -c 'import time;print(time.time())')
  {
    cat <<SQL
begin;
set local request.jwt.claims = '{"sub":"$EQ","role":"authenticated"}';
set local role authenticated;
select 'RESULTADO ' || coalesce((public.console_fonts_ativar('$LIC', '$1', 'prova de concorrência'))->>'activation_id', 'nulo');
select pg_sleep($2);
commit;
SQL
  } | "${PSQL[@]}" 2>&1 | tr '\n' ' ' > "$3" || true
  fim=$(python3 -c 'import time;print(time.time())')
  python3 -c "print($fim - $ini)" > "$3.tempo"
}

sessao "$CA" 1.5 "$TMP/a" &
sleep 0.4
sessao "$CB" 0 "$TMP/b" &
wait

A="$(cat "$TMP/a")"; B="$(cat "$TMP/b")"
TEMPO_B="$(cat "$TMP/b.tempo")"
LUGARES="$("${PSQL[@]}" -c "select count(*) from private.ativacoes_fonts where licenca_id = '$LIC' and revogada_em is null")"

OKS=0; RECUSAS=0
for r in "$A" "$B"; do
  if [[ "$r" == *"RESULTADO "* && "$r" != *"ERROR"* ]]; then OKS=$((OKS+1)); fi
  if [[ "$r" == *"limite_de_dispositivos"* || "$r" == *"limite de dispositivos"* ]]; then RECUSAS=$((RECUSAS+1)); fi
done

echo "sessão A: $A"
echo "sessão B: $B  (levou ${TEMPO_B}s)"
echo "lugares ocupados no fim: $LUGARES"

falhou=0
[ "$OKS" = "1" ]      || { echo "FALHA: esperava exatamente 1 ativação aceita, houve $OKS"; falhou=1; }
[ "$RECUSAS" = "1" ]  || { echo "FALHA: esperava exatamente 1 recusa por limite, houve $RECUSAS"; falhou=1; }
[ "$LUGARES" = "1" ]  || { echo "FALHA: esperava 1 lugar ocupado, há $LUGARES"; falhou=1; }
python3 -c "import sys; sys.exit(0 if $TEMPO_B >= 1.0 else 1)" \
  || { echo "FALHA: a sessão B não ficou esperando a trava ($TEMPO_B s): as sessões não se sobrepuseram, a prova não provou nada"; falhou=1; }

if [ "$falhou" = "0" ]; then
  echo "PROVA COMPLETA: duas ativações simultâneas no último lugar — só uma passou, a outra esperou a trava e foi recusada."
else
  exit 1
fi
