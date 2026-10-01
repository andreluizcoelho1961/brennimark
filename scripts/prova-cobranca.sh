#!/usr/bin/env bash
#
# Roda a prova dos cobrança (01/10/2026).
#
# Ninguém pela sessão escreve em cobrança; só o pagamento abre conta, e uma
# vez só; atraso, troca de plano e cancelamento não apagam nada; só o
# administrador lê a assinatura; o registro dos avisos não se apaga.
#
# A prova constrói o próprio mundo e termina em `rollback`. Não deixa resíduo.
set -euo pipefail

CONTAINER="${CONTAINER:-supabase_db_brennimark}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "FALHA: container $CONTAINER não responde. Suba o stack: npx supabase start" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -q -f - < "$AQUI/prova-cobranca.sql"

# ─── Concorrência: dois avisos do mesmo pagamento ao mesmo tempo ───────────
#
# O Stripe manda `checkout.session.completed` e `invoice.paid` quase juntos.
# Sem a trava, a segunda sessão não enxerga a conta que a primeira ainda não
# confirmou, abre outra e só esbarra na unicidade no fim — erro, e o Stripe
# repete. Com a trava, ela ESPERA e devolve a mesma conta.
#
# Esta parte confirma de verdade (duas sessões não se veem dentro de um
# `rollback`), então limpa o que criou ao sair, aconteça o que acontecer.
PSQL=(docker exec -i "$CONTAINER" psql -U postgres -q -tA -v ON_ERROR_STOP=1)
U='cb0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0c01'

limpar() {
  "${PSQL[@]}" >/dev/null <<SQL
do \$\$
declare c uuid;
begin
  select workspace_id into c from public.assinaturas where id_externo_assinatura = 'sub_prova_concorrencia';
  if c is not null then
    delete from public.assinaturas where workspace_id = c;
    delete from public.ai_budgets where workspace_id = c;
    delete from public.concessoes_de_acesso where workspace_id = c;
    delete from public.workspace_members where workspace_id = c;
    delete from public.workspaces where id = c;
  end if;
  delete from public.precos_do_plano where id_externo = 'price_prova_concorrencia';
  delete from auth.users where id = '$U';
end \$\$;
SQL
}
trap limpar EXIT
limpar

"${PSQL[@]}" <<SQL
insert into auth.users (id, email, aud, role) values ('$U', 'prova-cob-concorrencia@local.test', 'authenticated', 'authenticated');
insert into public.precos_do_plano (plano, provedor, id_externo, moeda, intervalo, ativo) values ('premium', 'stripe', 'price_prova_concorrencia', 'BRL', 'mes', false);
SQL

CHAMADA="select public.cobranca_sincronizar_assinatura('stripe', 'cus_c', 'sub_prova_concorrencia', 'price_prova_concorrencia', 'ativa', now(), false, 'brl', '$U', 'prova-cob-concorrencia@local.test', 'Agência Concorrente')"
ANTES=$("${PSQL[@]}" -c "select count(*) from public.workspaces")

# A primeira segura a transação aberta por 2 segundos depois de abrir a conta.
"${PSQL[@]}" -c "begin; set local role service_role; $CHAMADA; reset role; select pg_sleep(2); commit;" > /tmp/prova-cob-a.$$ &
PRIMEIRA=$!
sleep 0.5
INICIO=$(date +%s)
SEGUNDA_CONTA=$("${PSQL[@]}" -c "set role service_role; $CHAMADA;" | tail -1)
ESPEROU=$(( $(date +%s) - INICIO ))
wait "$PRIMEIRA"
PRIMEIRA_CONTA=$(grep -E '^[0-9a-f-]{36}$' /tmp/prova-cob-a.$$ | head -1); rm -f /tmp/prova-cob-a.$$
DEPOIS=$("${PSQL[@]}" -c "select count(*) from public.workspaces")

falhas=0
conferir() { if [ "$2" = "$3" ]; then echo "ok    $1"; else echo "FALHA $1 (esperado $2, obtido $3)"; falhas=$((falhas + 1)); fi; }
conferir "a segunda sessao ESPEROU a primeira (>= 1 s)" 1 "$([ "$ESPEROU" -ge 1 ] && echo 1 || echo 0)"
conferir "e devolveu a MESMA conta, sem erro" "$PRIMEIRA_CONTA" "$SEGUNDA_CONTA"
conferir "uma conta nasceu, nao duas" "$((ANTES + 1))" "$DEPOIS"
if [ "$falhas" -gt 0 ]; then echo "PROVA DE CONCORRENCIA FALHOU: $falhas" >&2; exit 1; fi
echo "PROVA DE CONCORRENCIA COMPLETA: 3 verificacoes, todas verdes"
