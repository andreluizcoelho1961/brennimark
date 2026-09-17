-- Consumo de armazenamento por conta e por marca — ADR-0007 §8.1.
--
-- ─── O que é ─────────────────────────────────────────────────────────────
--
-- MEDIR, e só medir. Nada de limite, bloqueio, plano ou cobrança: o ADR separa
-- as duas coisas de propósito. O que ele exige agora é o dado, porque "não há
-- como reconstituir depois o que uma conta consumia no mês passado".
--
-- Duas peças:
--   1. `private.medir_consumo_de_armazenamento()` — o consumo de AGORA, lido do
--      próprio Storage. É a fonte da verdade: soma o tamanho que o Storage
--      registrou para cada objeto, e não o que alguma tabela diz que subiu.
--   2. `public.consumo_de_armazenamento` — uma FOTOGRAFIA por dia, gravada pelo
--      `pg_cron` às 03:17 UTC. É o histórico que a consulta de agora não guarda.
--
-- ─── Como cada arquivo encontra a sua marca ──────────────────────────────
--
-- Medido em produção em 17/09/2026, e não presumido:
--   - `brand-assets` e `analysis-evidence`: o caminho é `conta/marca/…`. A marca
--     sai do segundo segmento, conferido contra `brands` (texto contra texto,
--     nunca `::uuid`: um segmento fora do padrão faria a medição inteira falhar).
--   - `brand-imports`: o caminho é `conta/importação/…`, SEM a marca. Ela vem de
--     `brand_imports` ou de `brand_source_documents` pelo caminho exato. PDF que
--     ainda não virou importação conta para a CONTA, com marca nula — ocupa
--     espaço pago do mesmo jeito.
--
-- Arquivo cujo caminho não aponta para conta existente não é atribuído a
-- ninguém e não entra: não há a quem cobrar, e inventar dono seria pior.
--
-- ─── Decisão do André, 17/09 ─────────────────────────────────────────────
--
-- "Agora + fotografia diária", o que liga o `pg_cron` no banco. Reversível:
-- `cron.unschedule` desliga a fotografia, e nenhum dado de cliente depende dela.

create extension if not exists pg_cron;

create table public.consumo_de_armazenamento (
  dia          date not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- Nula = arquivo da conta sem marca (PDF enviado que não virou importação).
  -- Sem FK para `brands`: apagar a marca não pode apagar o histórico do que ela
  -- consumiu enquanto existia.
  brand_id     uuid,
  bucket_id    text not null,
  objetos      integer not null,
  bytes        bigint not null,
  medido_em    timestamptz not null default clock_timestamp(),

  constraint consumo_de_armazenamento_bucket_check
    check (bucket_id in ('brand-imports', 'brand-assets', 'analysis-evidence')),
  constraint consumo_de_armazenamento_numeros_check
    check (objetos >= 0 and bytes >= 0),
  -- Uma linha por dia, conta, marca e bucket. `nulls not distinct`: sem isto,
  -- duas linhas de "sem marca" no mesmo dia seriam aceitas como diferentes, e
  -- repetir a fotografia duplicaria o consumo sem marca.
  constraint consumo_de_armazenamento_uma_por_dia
    unique nulls not distinct (dia, workspace_id, brand_id, bucket_id)
);

create index consumo_de_armazenamento_conta_idx
  on public.consumo_de_armazenamento (workspace_id, dia desc);
create index consumo_de_armazenamento_marca_idx
  on public.consumo_de_armazenamento (brand_id, dia desc) where brand_id is not null;

alter table public.consumo_de_armazenamento enable row level security;

-- Quem lê é o dono da conta. Por conta, e não por marca, de propósito: espaço é
-- cobrado da conta, e é quem paga a conta que precisa ver o total — inclusive o
-- que não tem marca.
create policy "Dono da conta lê o consumo da conta" on public.consumo_de_armazenamento
  for select to authenticated
  using (workspace_id in (
    select wm.workspace_id from public.workspace_members wm
    where wm.user_id = (select auth.uid()) and wm.role = 'owner'
  ));

-- Só leitura para quem tem sessão. Escreve apenas a função de fotografia,
-- rodando como dono da tabela: ninguém "corrige" o consumo de ontem pela API.
grant select on public.consumo_de_armazenamento to authenticated;

-- ─── A medição de agora ──────────────────────────────────────────────────

create function private.medir_consumo_de_armazenamento()
returns table (workspace_id uuid, brand_id uuid, bucket_id text, objetos integer, bytes bigint)
language sql
stable
security definer
set search_path to ''
as $$
  with arquivos as (
    select o.bucket_id, o.name,
           coalesce((o.metadata->>'size')::bigint, 0) as tamanho,
           (storage.foldername(o.name))[1] as segmento_conta,
           (storage.foldername(o.name))[2] as segmento_dois
      from storage.objects o
     where o.bucket_id in ('brand-imports', 'brand-assets', 'analysis-evidence')
  ),
  atribuidos as (
    select w.id as workspace_id,
           case
             when a.bucket_id = 'brand-imports' then coalesce(
               (select i.brand_id from public.brand_imports i
                 where i.storage_path = a.name and i.workspace_id = w.id limit 1),
               (select d.brand_id from public.brand_source_documents d
                 where d.storage_path = a.name and d.workspace_id = w.id limit 1))
             else (select b.id from public.brands b
                    where b.id::text = a.segmento_dois and b.workspace_id = w.id)
           end as brand_id,
           a.bucket_id, a.tamanho
      from arquivos a
      join public.workspaces w on w.id::text = a.segmento_conta
  )
  select workspace_id, brand_id, bucket_id, count(*)::integer, sum(tamanho)::bigint
    from atribuidos
   group by workspace_id, brand_id, bucket_id;
$$;

revoke execute on function private.medir_consumo_de_armazenamento() from public, anon, authenticated;

-- ─── A fotografia do dia ─────────────────────────────────────────────────

create function private.fotografar_consumo_de_armazenamento()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  hoje date := (now() at time zone 'utc')::date;
  gravadas integer;
begin
  -- Repetir no mesmo dia SUBSTITUI a fotografia do dia, e não soma: o cron pode
  -- rodar de novo depois de uma falha, e alguém pode rodar à mão.
  -- Linha que existia de manhã e cujo arquivo saiu à tarde também sai.
  delete from public.consumo_de_armazenamento where dia = hoje;

  insert into public.consumo_de_armazenamento (dia, workspace_id, brand_id, bucket_id, objetos, bytes)
  select hoje, m.workspace_id, m.brand_id, m.bucket_id, m.objetos, m.bytes
    from private.medir_consumo_de_armazenamento() m;
  get diagnostics gravadas = row_count;
  return gravadas;
end;
$$;

revoke execute on function private.fotografar_consumo_de_armazenamento() from public, anon, authenticated;

-- A primeira fotografia sai já, e não amanhã: o histórico começa hoje.
select private.fotografar_consumo_de_armazenamento();

-- 03:17 UTC — meia-noite e pouco em Brasília, fora do horário de uso, e num
-- minuto que não é o :00 que todo mundo agenda.
select cron.schedule(
  'fotografar-consumo-de-armazenamento',
  '17 3 * * *',
  'select private.fotografar_consumo_de_armazenamento()'
);
