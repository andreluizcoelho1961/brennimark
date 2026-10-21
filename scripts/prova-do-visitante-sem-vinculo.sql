-- Prova do visitante sem vínculo — tour de demonstração, fatia 2a (20/10/2026).
--
-- ─── Por que ela existe ─────────────────────────────────────────────────────
--
-- Ligar o login anônimo (`enable_anonymous_sign_ins`) faz com que QUALQUER
-- pessoa na internet, com a chave pública do projeto, obtenha um JWT do papel
-- `authenticated`. Até aqui `authenticated` queria dizer "alguém que se
-- cadastrou"; passa a querer dizer "qualquer um". Toda policy `to
-- authenticated` e toda função executável por esse papel fica ao alcance de
-- estranhos. Esta prova mede a superfície inteira, não só a do tour.
--
-- O visitante da prova é o pior caso útil: login anônimo, SEM perfil, SEM conta
-- e SEM marca (alguém que chamou `signInAnonymously` e nunca passou pela
-- entrada do tour). Num mundo POVOADO — duas contas, marcas, razão de IA,
-- registro de acesso —, porque contar zero linhas em tabela vazia não prova nada.
--
--   P. As policies: nenhuma deixa o visitante ler ou escrever sem um predicado
--      de vínculo, salvo as exceções DECLARADAS abaixo.
--   R. A RLS: toda tabela do `public` alcançável por `authenticated` ou `anon`
--      tem RLS ligada.
--   T. As tabelas: lidas COMO o visitante, todas devolvem zero linhas, salvo as
--      declaradas.
--   F. As funções: toda função do `public` executável pelo visitante é chamada
--      com argumentos de enchimento; ela precisa recusar, ou devolver vazio ou
--      falso. Qualquer outra resposta é achado e quebra a prova.
--
-- Uma exceção nova é DECISÃO: entra nas listas abaixo, com o motivo, na mesma
-- mudança que a cria. Mundo próprio, `rollback` no fim.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (conta_a uuid, marca_a uuid, conta_b uuid, marca_b uuid, dono_a uuid, dono_b uuid, visitante uuid);

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;

-- ─── As exceções declaradas ─────────────────────────────────────────────────
-- Cada linha é uma decisão. Para acrescentar uma, escreva o motivo.
create temp table excecoes (tipo text, nome text, motivo text);
-- (Nenhuma tabela é declarada legível ao visitante. O catálogo de planos é
-- aberto ao `anon` por policy, mas o `grant` de leitura é só do `anon`: o papel
-- `authenticated` — o do visitante — nem chega a ele. O caso T4 trava isso.)
-- Funções que respondem a qualquer um, por serem puras: nenhuma lê dado.
insert into excecoes values
  ('funcao-devolve', 'config_de_busca',
   'Função pura: traduz o código de idioma em configuração de busca. Não lê tabela nenhuma.');
-- Policies "abertas" (sem predicado de vínculo) aceitas, por tabela.policy.
insert into excecoes values
  ('policy-aberta', 'public.planos|Os planos são públicos',
   'Mesma decisão: leitura pública do catálogo de planos.');
-- Policies cujo predicado não cita vínculo direto, mas delega a outra tabela
-- que TEM RLS (a leitura só devolve o que aquela tabela deixa ver).
insert into excecoes values
  ('policy-delegada', 'storage.objects|Quem vê a análise vê a evidência',
   'Delega a public.analysis_runs, que tem RLS por marca: sem a análise, sem o arquivo.');

create function pg_temp.entrar_real(p_id uuid, p_email text) returns void
language plpgsql as $f$
begin
  insert into auth.users (id, email, aud, role) values (p_id, p_email, 'authenticated', 'authenticated');
  insert into public.profiles (id, email, full_name) values (p_id, p_email, split_part(p_email,'@',1));
end $f$;

-- ─── O mundo povoado ────────────────────────────────────────────────────────
do $$
declare
  u_a uuid := 'e0e0e0e0-0000-4000-8000-00000000000a';
  u_b uuid := 'e0e0e0e0-0000-4000-8000-00000000000b';
  u_v uuid := 'e0e0e0e0-0000-4000-8000-0000000000a1';
  ca uuid; cb uuid; ma uuid; mb uuid;
begin
  perform pg_temp.entrar_real(u_a, 'vs-dono-a@local.test');
  perform pg_temp.entrar_real(u_b, 'vs-dono-b@local.test');
  -- O visitante: login anônimo, sem perfil, sem nada.
  insert into auth.users (id, aud, role, is_anonymous) values (u_v, 'authenticated', 'authenticated', true);

  ca := private.abrir_conta_de_assinatura('Conta A da Prova', 'vs-dono-a@local.test', u_a);
  cb := private.abrir_conta_de_assinatura('Conta B da Prova', 'vs-dono-b@local.test', u_b);
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (ca, 'vs-a', 'Marca A', 'A', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into ma;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (cb, 'vs-b', 'Marca B', 'B', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into mb;

  insert into public.ai_ledger (workspace_id, brand_id, user_id, execution_id, task, reserved_micros, currency)
  values (ca, ma, u_a, gen_random_uuid(), 'assist', 100, 'USD'), (cb, mb, u_b, gen_random_uuid(), 'assist', 100, 'USD');
  insert into public.registros_de_acesso (user_id, ip) values (u_a, '203.0.113.7'), (u_b, '203.0.113.8');

  -- Uma linha no catálogo de planos, para a exceção declarada ser demonstrável.
  insert into public.planos (codigo, nome, teto_mensal_do_vini_micros) values ('vs-plano', 'Plano da Prova', 0);

  insert into mundo values (ca, ma, cb, mb, u_a, u_b, u_v);
end $$;

-- ═══ P. As policies ═════════════════════════════════════════════════════════
-- "Aberta" = leitura/escrita sem nenhum predicado: `using` nulo ou `true`.
create temp table policies_abertas as
select p.schemaname||'.'||p.tablename||'|'||p.policyname as chave, p.cmd
  from pg_policies p
 where p.schemaname in ('public','storage')
   and ('authenticated' = any(p.roles) or 'public' = any(p.roles) or 'anon' = any(p.roles))
   and (
        (p.cmd in ('SELECT','ALL','UPDATE','DELETE') and (p.qual is null or btrim(p.qual,'() ') = 'true'))
     or (p.cmd in ('INSERT','ALL','UPDATE') and (p.with_check is null and p.cmd = 'INSERT' or btrim(coalesce(p.with_check,'x'),'() ') = 'true'))
   );

-- "Delegada" = tem predicado, mas nenhum dos reconhecidos como vínculo.
create temp table policies_sem_vinculo as
select p.schemaname||'.'||p.tablename||'|'||p.policyname as chave
  from pg_policies p
 where p.schemaname in ('public','storage')
   and ('authenticated' = any(p.roles) or 'public' = any(p.roles) or 'anon' = any(p.roles))
   and p.cmd in ('SELECT','ALL')
   and p.qual is not null and btrim(p.qual,'() ') <> 'true'
   and p.qual !~* '(auth\.uid|auth\.jwt|tem_capacidade|workspace_members|brand_members|eh_da_equipe|sou_da_equipe|usuario_da_equipe)';

do $$
declare falhas text;
begin
  select string_agg(a.chave || ' [' || a.cmd || ']', '; ' order by a.chave) into falhas
    from policies_abertas a
   where not exists (select 1 from excecoes e where e.tipo = 'policy-aberta' and e.nome = a.chave);
  perform pg_temp.registrar('P1 nenhuma policy aberta fora das exceções declaradas', '(nenhuma)', coalesce(falhas, '(nenhuma)'));

  select string_agg(s.chave, '; ' order by s.chave) into falhas
    from policies_sem_vinculo s
   where not exists (select 1 from excecoes e where e.tipo in ('policy-delegada','policy-aberta') and e.nome = s.chave);
  perform pg_temp.registrar('P2 nenhuma policy de leitura sem predicado de vínculo fora das exceções', '(nenhuma)', coalesce(falhas, '(nenhuma)'));

  -- As exceções não podem apodrecer: cada uma precisa ainda existir.
  select string_agg(e.nome, '; ') into falhas
    from excecoes e
   where e.tipo in ('policy-aberta') and not exists (select 1 from policies_abertas a where a.chave = e.nome);
  perform pg_temp.registrar('P3 toda exceção de policy aberta declarada ainda existe', '(nenhuma)', coalesce(falhas, '(nenhuma)'));
end $$;

-- ═══ R. A RLS ═══════════════════════════════════════════════════════════════
do $$
declare falhas text;
begin
  select string_agg(c.relname, '; ' order by c.relname) into falhas
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity
     and (has_table_privilege('authenticated', c.oid, 'select,insert,update,delete')
          or has_table_privilege('anon', c.oid, 'select,insert,update,delete'));
  perform pg_temp.registrar('R1 toda tabela alcançável por authenticated/anon tem RLS', '(nenhuma)', coalesce(falhas, '(nenhuma)'));

  -- Visão alcançável por authenticated/anon ignora a RLS da tabela de baixo
  -- se não for `security_invoker`.
  select string_agg(c.relname, '; ' order by c.relname) into falhas
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     and (has_table_privilege('authenticated', c.oid, 'select') or has_table_privilege('anon', c.oid, 'select'))
     and not coalesce((select 'security_invoker=true' = any(c.reloptions)), false);
  perform pg_temp.registrar('R2 toda visão alcançável é security_invoker', '(nenhuma)', coalesce(falhas, '(nenhuma)'));
end $$;

-- ═══ T. As tabelas, lidas como o visitante ══════════════════════════════════
create temp table leituras (tabela text, linhas bigint, erro text);
do $$
declare
  m mundo%rowtype; t record; n bigint; e text;
begin
  select * into m from mundo;
  for t in
    select quote_ident(n.nspname)||'.'||quote_ident(c.relname) as qn, n.nspname||'.'||c.relname as nome
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','p','v')
       and has_table_privilege('authenticated', c.oid, 'select')
     order by 2
  loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', m.visitante, 'role', 'authenticated', 'is_anonymous', true)::text, true);
    set local role authenticated;
    begin
      execute 'select count(*) from ' || t.qn into n;
      e := null;
    exception when others then
      n := null; e := sqlstate;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    insert into leituras values (t.nome, n, e);
  end loop;
end $$;

do $$
declare falhas text; total int; lidas int;
begin
  select count(*), count(*) filter (where erro is null) into total, lidas from leituras;
  perform pg_temp.registrar('T1 a prova leu um número razoável de tabelas', 'true', (total >= 40)::text);

  select string_agg(l.tabela || '=' || l.linhas, '; ' order by l.tabela) into falhas
    from leituras l
   where l.linhas > 0
     and not exists (select 1 from excecoes e where e.tipo = 'tabela-legivel' and e.nome = l.tabela);  -- hoje, nenhuma
  perform pg_temp.registrar('T2 como visitante sem vínculo, toda tabela devolve zero linhas (fora as declaradas)', '(nenhuma)', coalesce(falhas, '(nenhuma)'));

  -- O mundo está povoado de verdade: sem isto, o zero acima seria vazio.
  perform pg_temp.registrar('T3 o mundo tem dados que o visitante PODERIA ver (marcas, razão, registros)', 'true',
    ((select count(*) from public.brands) >= 2 and (select count(*) from public.ai_ledger) >= 2
      and (select count(*) from public.registros_de_acesso) >= 2)::text);
  -- O catálogo de planos tem linhas e é aberto ao `anon`, mas o visitante (papel
  -- `authenticated`) não tem grant nenhum nele: a tabela nem entra na lista lida.
  perform pg_temp.registrar('T4 planos tem dados e o visitante não os alcança (grant só do anon)', 'true',
    ((select count(*) from public.planos) > 0 and not exists (select 1 from leituras where tabela = 'public.planos'))::text);
end $$;

-- ═══ F. As funções ══════════════════════════════════════════════════════════
create temp table chamadas (funcao text, resultado text, erro text);
do $$
declare
  m mundo%rowtype; f record; args text; r text; e text;
begin
  select * into m from mundo;
  for f in
    select p.oid, p.proname, p.proargtypes::oid[] as tipos
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
       -- Gatilhos e funções sem retorno utilizável não se chamam à mão.
       and p.prorettype <> 'trigger'::regtype
     order by p.proname, p.oid
  loop
    -- Argumentos de enchimento, do tipo certo. Tipo desconhecido vira NULL.
    select string_agg(
             case format_type(t, null)
               when 'uuid'                     then quote_literal(gen_random_uuid()::text) || '::uuid'
               when 'text'                     then '''x''::text'
               when 'character varying'        then '''x''::varchar'
               when 'integer'                  then '0'
               when 'bigint'                   then '0::bigint'
               when 'smallint'                 then '0::smallint'
               when 'numeric'                  then '0::numeric'
               when 'boolean'                  then 'false'
               when 'jsonb'                    then '''{}''::jsonb'
               when 'json'                     then '''{}''::json'
               when 'text[]'                   then '''{}''::text[]'
               when 'uuid[]'                   then '''{}''::uuid[]'
               when 'timestamp with time zone' then 'now()'
               when 'date'                     then 'current_date'
               when 'bytea'                    then '''\\x''::bytea'
               when 'inet'                     then '''127.0.0.1''::inet'
               when 'interval'                 then '''1 hour''::interval'
               else 'null::' || format_type(t, null)
             end, ', ' order by o)
      into args
      from unnest(f.tipos) with ordinality as x(t, o);

    perform set_config('request.jwt.claims',
      json_build_object('sub', m.visitante, 'role', 'authenticated', 'is_anonymous', true)::text, true);
    set local role authenticated;
    begin
      execute format('select public.%I(%s)::text', f.proname, coalesce(args, '')) into r;
      e := null;
    exception when others then
      r := null; e := sqlstate;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    insert into chamadas values (f.proname || '(' || coalesce(args, '') || ')', r, e);
  end loop;
end $$;

do $$
declare falhas text; total int;
begin
  select count(*) into total from chamadas;
  perform pg_temp.registrar('F1 a prova chamou um número razoável de funções', 'true', (total >= 40)::text);

  -- Recusar (qualquer erro), devolver nada ou devolver falso/zero é o esperado.
  -- Qualquer outra resposta é um achado.
  select string_agg(c.funcao || ' => ' || c.resultado, E'\n' order by c.funcao) into falhas
    from chamadas c
   where c.erro is null
     and c.resultado is not null
     and c.resultado not in ('f', 'false', '0', '', '{}', '[]', '(0)')
     and not exists (select 1 from excecoes e where e.tipo = 'funcao-devolve' and c.funcao like e.nome || '(%');
  perform pg_temp.registrar('F2 como visitante sem vínculo, toda função recusa ou devolve vazio/falso', '(nenhuma)', coalesce(falhas, '(nenhuma)'));
end $$;

select case when passou then 'ok   ' else 'FALHA' end as st, caso, esperado, obtido
from resultado order by ordem;

select case when count(*) filter (where not passou) = 0
            then 'PROVA COMPLETA: ' || count(*) || ' verificacoes, todas verdes'
            else 'PROVA FALHOU: ' || count(*) filter (where not passou) || ' de ' || count(*)
       end as veredito
from resultado;

do $$
declare n integer;
begin
  select count(*) filter (where not passou) into n from resultado;
  if n > 0 then
    raise exception 'PROVA FALHOU: % verificacao(oes)', n using errcode = 'P0001';
  end if;
end $$;

rollback;
