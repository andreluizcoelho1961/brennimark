-- D1 — Snapshot de esquema das tabelas fundacionais
--
-- Rodar no SQL Editor de CADA projeto Supabase existente (não apenas um).
-- Copiar o resultado inteiro e identificar de qual ambiente veio.
--
-- Comparar os snapshots entre si é a etapa 2 do PR-04: ambientes provisionados
-- manualmente em momentos diferentes costumam divergir, e o diff é o insumo
-- para decidir qual esquema vira a baseline canônica.
--
-- Somente leitura. Não altera nada.

with alvo as (
  select unnest(array['profiles','workspaces','workspace_members','ai_settings']) as tabela
),
colunas as (
  select c.table_name as tabela,
         jsonb_agg(jsonb_build_object(
           'coluna', c.column_name,
           'tipo', c.data_type,
           'udt', c.udt_name,
           'nulo', c.is_nullable,
           'default', c.column_default,
           'tamanho', c.character_maximum_length,
           'posicao', c.ordinal_position
         ) order by c.ordinal_position) as itens
  from information_schema.columns c
  join alvo a on a.tabela = c.table_name
  where c.table_schema = 'public'
  group by c.table_name
),
constraints as (
  select rel.relname as tabela,
         jsonb_agg(jsonb_build_object(
           'nome', con.conname,
           'tipo', case con.contype
                     when 'p' then 'primary key'
                     when 'f' then 'foreign key'
                     when 'u' then 'unique'
                     when 'c' then 'check'
                     else con.contype::text end,
           'definicao', pg_get_constraintdef(con.oid)
         ) order by con.conname) as itens
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  join alvo a on a.tabela = rel.relname
  where ns.nspname = 'public'
  group by rel.relname
),
indices as (
  select i.tablename as tabela,
         jsonb_agg(jsonb_build_object('nome', i.indexname, 'definicao', i.indexdef)
                   order by i.indexname) as itens
  from pg_indexes i
  join alvo a on a.tabela = i.tablename
  where i.schemaname = 'public'
  group by i.tablename
),
policies as (
  select p.tablename as tabela,
         jsonb_agg(jsonb_build_object(
           'nome', p.policyname,
           'permissiva', p.permissive,
           'papeis', p.roles,
           'comando', p.cmd,
           'using', p.qual,
           'with_check', p.with_check
         ) order by p.policyname) as itens
  from pg_policies p
  join alvo a on a.tabela = p.tablename
  where p.schemaname = 'public'
  group by p.tablename
),
triggers as (
  select rel.relname as tabela,
         jsonb_agg(jsonb_build_object('nome', tg.tgname, 'definicao', pg_get_triggerdef(tg.oid))
                   order by tg.tgname) as itens
  from pg_trigger tg
  join pg_class rel on rel.oid = tg.tgrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  join alvo a on a.tabela = rel.relname
  where ns.nspname = 'public' and not tg.tgisinternal
  group by rel.relname
),
grants as (
  select g.table_name as tabela,
         jsonb_agg(distinct jsonb_build_object('papel', g.grantee, 'privilegio', g.privilege_type)) as itens
  from information_schema.role_table_grants g
  join alvo a on a.tabela = g.table_name
  where g.table_schema = 'public'
  group by g.table_name
),
rls as (
  select rel.relname as tabela, rel.relrowsecurity as habilitada, rel.relforcerowsecurity as forcada
  from pg_class rel
  join pg_namespace ns on ns.oid = rel.relnamespace
  join alvo a on a.tabela = rel.relname
  where ns.nspname = 'public'
)
select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),
  'banco', current_database(),
  'versao_postgres', version(),
  'tabelas', (
    select jsonb_object_agg(a.tabela, jsonb_build_object(
      'existe', (r.tabela is not null),
      'rls_habilitada', r.habilitada,
      'rls_forcada', r.forcada,
      'colunas', coalesce(c.itens, '[]'::jsonb),
      'constraints', coalesce(k.itens, '[]'::jsonb),
      'indices', coalesce(i.itens, '[]'::jsonb),
      'policies', coalesce(p.itens, '[]'::jsonb),
      'triggers', coalesce(t.itens, '[]'::jsonb),
      'grants', coalesce(g.itens, '[]'::jsonb)
    ))
    from alvo a
    left join rls r on r.tabela = a.tabela
    left join colunas c on c.tabela = a.tabela
    left join constraints k on k.tabela = a.tabela
    left join indices i on i.tabela = a.tabela
    left join policies p on p.tabela = a.tabela
    left join triggers t on t.tabela = a.tabela
    left join grants g on g.tabela = a.tabela
  )
)) as snapshot;
