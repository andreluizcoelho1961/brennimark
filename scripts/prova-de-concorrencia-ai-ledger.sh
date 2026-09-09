#!/usr/bin/env bash
#
# Prova de concorrência do razão de IA — as quatro corridas.
#
# Recria, como artefato reexecutável, o ensaio que sustenta a migração
# `20260909014823_ai_ledger_exposicao_de_cobranca.sql`. O ensaio original
# rodou contra o stack local em 05/09 e se perdeu num `db reset` sem ter sido
# registrado; este script existe para que isso não dependa mais de memória.
#
# O que cada corrida prova NÃO é que o código compila: é que duas transações
# simultâneas sobre a MESMA linha do razão terminam num estado único e
# correto. Por isso cada corrida (a) força a segunda sessão a ESPERAR, e a
# espera é observada em `pg_stat_activity`, não presumida; e (b) confere o
# estado final da linha, que é onde o dinheiro fica.
#
# A corrida 1 roda duas vezes: contra as funções corrigidas e contra uma
# réplica pré-correção no schema `prova_antes`. Sem o "antes" isto não seria
# prova de nada — um teste que passa dos dois lados não testa a correção.
#
# Uso:
#   ./scripts/prova-de-concorrencia-ai-ledger.sh
#
# Exige o stack local de pé COM as duas migrações pendentes aplicadas.
# Não toca em produção: fala com o contêiner local e só com ele.
#
set -euo pipefail

CONTAINER="${DB_CONTAINER:-supabase_db_brennimark}"

psql_() { docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
q()     { psql_ -c "$1"; }

falhas=0
ok()    { printf '  \033[32mOK\033[0m    %s\n' "$1"; }
falha() { printf '  \033[31mFALHA\033[0m %s\n' "$1"; falhas=$((falhas+1)); }
confere() { # confere <descrição> <esperado> <obtido>
  if [ "$2" = "$3" ]; then ok "$1 — $3"; else falha "$1 — esperado [$2], obtido [$3]"; fi
}

WS='11111111-1111-1111-1111-111111111111'
US='22222222-2222-2222-2222-222222222222'

# ─── Fixtures ───────────────────────────────────────────────────────────────
# Workspace e usuário próprios, com ids fixos, apagados no fim. A conta é do
# ensaio e de mais ninguém.
preparar() {
  q "
  delete from public.ai_ledger where workspace_id = '$WS';
  delete from public.workspace_members where workspace_id = '$WS';
  delete from public.workspaces where id = '$WS';
  delete from auth.users where id = '$US';
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
    values ('$US','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
            'prova-concorrencia@local', now(), now());
  insert into public.workspaces (id, name, slug) values ('$WS','Prova de concorrência','prova-concorrencia');
  insert into public.workspace_members (workspace_id, user_id, role) values ('$WS','$US','owner');
  " > /dev/null
}

# reserva <execution_id> <exposta: sim|nao> <idade_em_minutos>
reserva() {
  q "
  insert into public.ai_ledger
    (workspace_id, user_id, execution_id, task, status, reserved_micros, currency, created_at, charge_exposed_at)
  values
    ('$WS','$US','$1','assist','reserved', 5000, 'USD', now() - interval '$3 minutes',
     case when '$2' = 'sim' then now() - interval '$3 minutes' else null end);
  " > /dev/null
}

limpar() {
  q "
  drop schema if exists prova_antes cascade;
  delete from public.ai_ledger where workspace_id = '$WS';
  delete from public.workspace_members where workspace_id = '$WS';
  delete from public.workspaces where id = '$WS';
  delete from auth.users where id = '$US';
  " > /dev/null
}

# ─── A espera, observada e não presumida ────────────────────────────────────
# Devolve o número de backends bloqueados em Lock cuja consulta cita o alvo.
# Um zero aqui invalida a corrida: sem espera não houve disputa, e o resultado
# final teria vindo de execução serial por acidente de agendamento.
esperando() {
  q "select count(*) from pg_stat_activity
      where wait_event_type = 'Lock' and query like '%$1%' and pid <> pg_backend_pid();"
}

# ─── A réplica pré-correção ─────────────────────────────────────────────────
#
# `prova_antes.consolidar` é a função corrigida com EXATAMENTE duas coisas
# removidas: o `for update` da leitura e o predicado `and status = 'reserved'`
# do update. Nada mais. Isolar as duas guardas é o que torna o contraste
# atribuível a elas, e não a alguma outra diferença histórica da função.
#
# A invariante de exposição fica de pé aqui só para os fixtures serem os
# mesmos dos dois lados.
replica_pre_correcao() {
  q "
  create schema if not exists prova_antes;
  create or replace function prova_antes.consolidar(
    p_user_id uuid, p_execution_id uuid, p_settled_micros bigint,
    p_provider text, p_model text, p_usage_snapshot jsonb default null
  ) returns void language plpgsql security definer set search_path = '' as \$\$
  declare
    linha public.ai_ledger%rowtype;
  begin
    -- VERIFICAR: leitura sem trava.
    select * into linha from public.ai_ledger where execution_id = p_execution_id;
    if linha.id is null then
      raise exception 'no reservation for this execution' using errcode = 'P0002';
    end if;
    if linha.status <> 'reserved' then
      return;
    end if;
    -- A janela: entre o select acima e o update abaixo, outra transação pode
    -- liquidar a linha. Este update não repete o predicado, então sobrescreve.
    perform pg_sleep(0.3);
    -- DEPOIS AGIR: update sem repetir o predicado.
    update public.ai_ledger
       set status = 'settled', settled_micros = p_settled_micros,
           provider = p_provider, model = p_model, settled_at = now(),
           usage_snapshot = p_usage_snapshot
     where execution_id = p_execution_id;
  end;
  \$\$;
  " > /dev/null
}

# ─── O molde das corridas ───────────────────────────────────────────────────
#
# A segura o bloqueio dentro de uma transação explícita e dorme; B chega
# depois e tem de esperar. A ordem é imposta pelo relógio, mas o que se afirma
# não depende de quanto tempo cada uma levou: depende de A ter commitado
# primeiro e de B ter enxergado o resultado disso.
#
# corrida <rótulo> <sql-de-A> <sql-de-B> <fragmento-para-observar>
corrida() {
  local rotulo="$1" sqlA="$2" sqlB="$3" alvo="$4"
  printf '\n\033[1m%s\033[0m\n' "$rotulo"

  psql_ > /dev/null <<SQL &
begin;
$sqlA
select pg_sleep(3);
commit;
SQL
  local pidA=$!

  sleep 1
  psql_ -c "$sqlB" > /dev/null &
  local pidB=$!

  sleep 1
  local bloqueados; bloqueados=$(esperando "$alvo")
  if [ "$bloqueados" -ge 1 ]; then
    ok "a segunda sessão esperou de fato ($bloqueados backend em Lock)"
  else
    falha "nenhum backend em Lock — sem disputa, a corrida não prova nada"
  fi

  if wait "$pidA" 2>/dev/null; then
    ok "sessão A terminou sem erro"
  else
    falha "sessão A terminou com erro"
  fi

  if wait "$pidB" 2>/dev/null; then
    ok "sessão B terminou sem erro"
  else
    falha "sessão B terminou com erro"
  fi
}

# ─── As quatro corridas ─────────────────────────────────────────────────────

E1='aaaaaaa1-0000-0000-0000-000000000001'  # corrida 1, réplica pré-correção
E2='aaaaaaa1-0000-0000-0000-000000000002'  # corrida 1, funções corrigidas
E3='aaaaaaa1-0000-0000-0000-000000000003'  # corrida 2
E4='aaaaaaa1-0000-0000-0000-000000000004'  # corrida 3
E5='aaaaaaa1-0000-0000-0000-000000000005'  # corrida 4

preparar
replica_pre_correcao
trap limpar EXIT

# ── 1a. Duas liquidações concorrentes — ANTES da correção ───────────────────
# O defeito em estado puro: as duas gravam, a última vence. O razão fica com
# um número que nenhuma das duas execuções mediu sozinha.
reserva "$E1" sim 0
corrida "Corrida 1a — consolidar × consolidar, SEM \`for update\` (defeito esperado)" \
  "select prova_antes.consolidar('$US','$E1',111,'p','m','{\"quem\":\"A\"}');" \
  "select prova_antes.consolidar('$US','$E1',999,'p','m','{\"quem\":\"B\"}');" \
  "prova_antes.consolidar"
confere "a segunda liquidação sobrescreveu a primeira (o defeito)" "999" \
  "$(q "select settled_micros from public.ai_ledger where execution_id='$E1';")"

# ── 1b. A mesma corrida, com as funções corrigidas ──────────────────────────
# `for update` serializa; o predicado repetido impede o update cego. A segunda
# chamada vira o no-op que o comentário da função sempre prometeu.
reserva "$E2" sim 0
corrida "Corrida 1b — consolidar × consolidar, COM \`for update\` (idempotência)" \
  "select public.consolidar_execucao_de_ia_server('$US','$E2',111,'p','m','{\"quem\":\"A\"}');" \
  "select public.consolidar_execucao_de_ia_server('$US','$E2',999,'p','m','{\"quem\":\"B\"}');" \
  "consolidar_execucao_de_ia_server"
confere "a primeira liquidação prevaleceu" "111" \
  "$(q "select settled_micros from public.ai_ledger where execution_id='$E2';")"
confere "a segunda não deixou rastro" "A" \
  "$(q "select usage_snapshot->>'quem' from public.ai_ledger where execution_id='$E2';")"

# ── 2. Liquidar × liberar ───────────────────────────────────────────────────
# Liberar afirma que não houve custo. Chegando depois de uma liquidação, essa
# afirmação já é falsa — e a função tem de calar, não corrigir.
reserva "$E3" sim 0
corrida "Corrida 2 — consolidar × liberar" \
  "select public.consolidar_execucao_de_ia_server('$US','$E3',111,'p','m','{\"quem\":\"A\"}');" \
  "select public.liberar_reserva_de_ia_server('$US','$E3');" \
  "liberar_reserva_de_ia_server"
confere "a liquidação sobreviveu à liberação concorrente" "settled|111" \
  "$(q "select status||'|'||settled_micros from public.ai_ledger where execution_id='$E3';")"

# ── 3. Marcar exposição × expirar ───────────────────────────────────────────
# A corrida que motivou a coluna. A expiração chega para liberar uma reserva
# velha no exato instante em que ela passa a poder gerar cobrança. Liberar
# aqui apagaria custo real; o desfecho correto é liquidar pelo teto.
reserva "$E4" nao 30
corrida "Corrida 3 — marcar exposição × expirar" \
  "select public.marcar_exposicao_de_cobranca_server('$US','$E4');" \
  "select public.expirar_reservas_de_ia('$WS', interval '15 minutes');" \
  "expirar_reservas_de_ia"
confere "a reserva exposta foi liquidada pelo teto, não liberada" "settled|5000|expirada_apos_exposicao" \
  "$(q "select status||'|'||settled_micros||'|'||coalesce(usage_snapshot->>'motivo','-') from public.ai_ledger where execution_id='$E4';")"

# ── 4. Marcar exposição × liberar ───────────────────────────────────────────
# A janela estreita: abortar entre a marcação e o despacho. Nada libera uma
# reserva exposta — liquida-se pelo teto, que é o erro barato.
reserva "$E5" nao 0
corrida "Corrida 4 — marcar exposição × liberar" \
  "select public.marcar_exposicao_de_cobranca_server('$US','$E5');" \
  "select public.liberar_reserva_de_ia_server('$US','$E5');" \
  "liberar_reserva_de_ia_server"
confere "nada libera uma reserva exposta" "settled|5000|exposto_sem_uso_medido" \
  "$(q "select status||'|'||settled_micros||'|'||coalesce(usage_snapshot->>'motivo','-') from public.ai_ledger where execution_id='$E5';")"

# ─── Veredito ───────────────────────────────────────────────────────────────
printf '\n'
if [ "$falhas" -eq 0 ]; then
  printf '\033[32mAs quatro corridas passaram.\033[0m\n'
  exit 0
else
  printf '\033[31m%s asserção(ões) falharam.\033[0m\n' "$falhas"
  exit 1
fi
