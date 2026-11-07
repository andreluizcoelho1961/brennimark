-- ADR-0009 (adendo de 07/11/2026): a IA depende do plano.
--
-- O plano diz de quem é a IA:
--   `plataforma`  a Brennimark fornece e paga (ADR-0008, sem mudança);
--   `propria`     a agência traz as chaves que já paga; a Brennimark só roteia.
--
-- O que esta migration cria (tudo ADITIVO; nada existente é alterado nem apagado):
--
--   1. `planos.modo_de_ia` e a função do Console que o troca;
--   2. `chaves_de_ia_da_conta`: até três encaixes por conta (texto, imagem,
--      reserva), com a chave CIFRADA pelo servidor. Nenhuma sessão de navegador
--      lê esta tabela; só funções, e a que devolve o texto cifrado é do servidor;
--   3. `registros_da_ia_propria`: registro append-only de quem aceitou o termo,
--      cadastrou, substituiu e apagou — nunca o valor da chave;
--   4. `vini_desligado_para`: o interruptor "usa o Vini" por pessoa, para a conta
--      inteira, em TODOS os planos. Sem linha = com Vini;
--   5. gatilho: trocar de plano `propria` para `plataforma` apaga as chaves da
--      conta (custódia só enquanto há razão), e registra.
--
-- Decisões do André (06 e 07/11/2026): o modo mora no PLANO; a chave nunca volta
-- à tela (só "termina em ••••1234"; para mudar, substitui); se a chave da agência
-- falha o Vini NÃO usa a nossa — isso é da camada de roteamento, fatia seguinte;
-- o interruptor vale para a conta inteira.
--
-- Não religa `ai_settings` nem `ai_routing_policies`: a tabela nova nasce com a
-- política certa, em vez de endurecer as de 29/08 (que deixavam qualquer membro
-- ler a chave cifrada).
--
-- O papel de "administrador da conta" é o `workspace_members.role = 'owner'`, o
-- mesmo da exportação (08/10). Quem executa as funções abertas à sessão
-- (`guardar_`, `apagar_`, `listar_`, `definir_`, `aceitar_`) é o navegador, com
-- o JWT da pessoa: o banco confere `auth.uid()` DENTRO da função. É a exceção
-- deliberada à regra "revoke de authenticated" do CLAUDE.md, a mesma de
-- `iniciar_exportacao`: a função responde só sobre quem pergunta, e a prova
-- negativa (scripts/prova-ia-por-plano.sh) mostra cada recusa pelo SQLSTATE.
--
-- FORA desta fatia, de propósito: o termo assinado NA COMPRA do plano (tabela
-- `aceites_de_documentos`, que é por pessoa e tem lista fechada de documentos)
-- e o roteamento (`resolveFeatureRouting`). Aqui só mora o aceite do
-- administrador ao ligar a conexão, que é a trava de banco.
--
-- Reversibilidade: tabelas e funções novas, mais uma coluna com padrão
-- `plataforma`. Desligar o modo `propria` deixa as tabelas paradas.

-- ─── 1. O modo no plano ──────────────────────────────────────────────────

alter table public.planos
  add column modo_de_ia text not null default 'plataforma'
  constraint planos_modo_de_ia_valido check (modo_de_ia in ('plataforma', 'propria'));

-- O modo não é segredo: o site pode dizer "traga a sua IA". As demais colunas
-- seguem com o grant por coluna da migration `cobranca_primeiro_acesso`.
grant select (modo_de_ia) on public.planos to anon, authenticated;

create function public.console_definir_modo_de_ia_do_plano(p_codigo text, p_modo text, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  antes jsonb;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  if p_modo not in ('plataforma', 'propria') then
    raise exception 'modo de IA desconhecido' using errcode = '22023', hint = 'ia_modo_desconhecido';
  end if;
  select jsonb_build_object('plano', pl.codigo, 'modo_de_ia', pl.modo_de_ia) into antes
    from public.planos pl where pl.codigo = p_codigo;
  if antes is null then
    raise exception 'plano inexistente' using errcode = 'P0002', hint = 'plano_inexistente';
  end if;
  update public.planos set modo_de_ia = p_modo, updated_at = now() where codigo = p_codigo;
  perform private.registrar_acao_da_equipe(
    'definir modo de IA do plano', 'plano ' || p_codigo, antes,
    jsonb_build_object('plano', p_codigo, 'modo_de_ia', p_modo), p_motivo);
end;
$$;

revoke all on function public.console_definir_modo_de_ia_do_plano(text, text, text) from public, anon;
grant execute on function public.console_definir_modo_de_ia_do_plano(text, text, text) to authenticated;

-- O modo da CONTA: o do plano da assinatura. Conta sem assinatura (demonstração,
-- contas anteriores à cobrança) fica em `plataforma`, que é o comportamento de hoje.
create function private.modo_de_ia_da_conta(p_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (select p.modo_de_ia
       from public.assinaturas a
       join public.planos p on p.codigo = a.plano
      where a.workspace_id = p_workspace_id),
    'plataforma');
$$;

revoke all on function private.modo_de_ia_da_conta(uuid) from public, anon, authenticated;

create function private.administra_a_conta(p_workspace_id uuid, p_pessoa uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select p_pessoa is not null and exists (
    select 1 from public.workspace_members m
     where m.workspace_id = p_workspace_id and m.user_id = p_pessoa and m.role = 'owner');
$$;

revoke all on function private.administra_a_conta(uuid, uuid) from public, anon, authenticated;

-- Pública para o servidor (chave de serviço) e para a dona da conta. Quem não
-- administra a conta recebe "nada", não "plataforma": a pergunta não vaza nada.
create function public.modo_de_ia_da_conta(p_workspace_id uuid)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
begin
  -- `auth.uid()` nulo = chave de serviço (a única que chega aqui sem pessoa; o
  -- `anon` não tem EXECUTE).
  if quem is not null and not private.administra_a_conta(p_workspace_id, quem) then
    return null;
  end if;
  return private.modo_de_ia_da_conta(p_workspace_id);
end;
$$;

revoke all on function public.modo_de_ia_da_conta(uuid) from public, anon;
grant execute on function public.modo_de_ia_da_conta(uuid) to authenticated, service_role;

-- ─── 2. O registro (append-only) ─────────────────────────────────────────

create table public.registros_da_ia_propria (
  id            bigint generated always as identity primary key,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  autor         uuid references auth.users(id) on delete set null,
  acao          text not null constraint registros_ia_propria_acao_valida
                check (acao in ('aceitar-termo', 'cadastrar', 'substituir', 'apagar', 'apagar-por-troca-de-plano')),
  encaixe       text constraint registros_ia_propria_encaixe_valido
                check (encaixe is null or encaixe in ('texto', 'imagem', 'reserva')),
  provedor      text,
  modelo        text,
  chave_final   text,
  versao_termo  text constraint registros_ia_propria_versao_em_data
                check (versao_termo is null or versao_termo ~ '^\d{4}-\d{2}-\d{2}$'),
  criado_em     timestamptz not null default now(),
  -- Aceitar o termo diz qual versão; as demais ações dizem qual encaixe.
  constraint registros_ia_propria_forma check (
    (acao = 'aceitar-termo' and versao_termo is not null)
    or (acao <> 'aceitar-termo' and encaixe is not null)
  )
);

create index registros_da_ia_propria_conta_idx on public.registros_da_ia_propria (workspace_id, criado_em desc);

alter table public.registros_da_ia_propria enable row level security;
revoke all on table public.registros_da_ia_propria from public, anon, authenticated;
-- Explícito: no hospedado tabela nova ganha privilégios por padrão, no local não.
grant select on table public.registros_da_ia_propria to authenticated;
grant select on table public.registros_da_ia_propria to service_role;

create policy "A dona da conta lê o registro da IA própria"
  on public.registros_da_ia_propria for select to authenticated
  using (exists (
    select 1 from public.workspace_members m
     where m.workspace_id = registros_da_ia_propria.workspace_id
       and m.user_id = (select auth.uid())
       and m.role = 'owner'));

-- Append-only: nada se edita. Apagar só quando a CONTA inteira some (a exclusão
-- aos 12 meses leva a área toda): a linha da conta já não existe.
create function private.registro_ia_propria_so_acrescenta()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'o registro da IA própria não se edita' using errcode = '42501', hint = 'ia_registro_so_acrescenta';
  end if;
  if exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
    raise exception 'o registro da IA própria não se apaga' using errcode = '42501', hint = 'ia_registro_so_acrescenta';
  end if;
  return old;
end;
$$;

revoke all on function private.registro_ia_propria_so_acrescenta() from public, anon, authenticated;

create trigger registro_ia_propria_so_acrescenta
  before update or delete on public.registros_da_ia_propria
  for each row execute function private.registro_ia_propria_so_acrescenta();

-- ─── 3. As chaves ────────────────────────────────────────────────────────

create table public.chaves_de_ia_da_conta (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  encaixe                 text not null constraint chaves_de_ia_encaixe_valido
                          check (encaixe in ('texto', 'imagem', 'reserva')),
  provedor                text not null constraint chaves_de_ia_provedor_valido
                          check (provedor in ('anthropic', 'openai', 'google', 'groq', 'openrouter')),
  modelo                  text not null constraint chaves_de_ia_modelo_valido
                          check (char_length(btrim(modelo)) between 1 and 120),
  -- AES-256-GCM (`src/lib/ai/crypto.ts`), cifrado no servidor com a chave-mestra
  -- da Vercel. Nunca sai por rota de navegador.
  chave_cifrada           text not null constraint chaves_de_ia_cifra_valida
                          check (char_length(chave_cifrada) between 1 and 4096),
  chave_iv                text not null constraint chaves_de_ia_iv_valido
                          check (char_length(chave_iv) between 1 and 64),
  -- Os quatro últimos caracteres, para a tela dizer "termina em ••••1234".
  chave_final             text not null constraint chaves_de_ia_final_valido
                          check (char_length(chave_final) between 1 and 8),
  -- Para trocar a chave-mestra um dia sem perder o que está guardado.
  versao_da_chave_mestra  smallint not null default 1 constraint chaves_de_ia_versao_valida
                          check (versao_da_chave_mestra >= 1),
  criada_por              uuid references auth.users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  testada_em              timestamptz,
  teste_ok                boolean,
  constraint chaves_de_ia_um_por_encaixe unique (workspace_id, encaixe)
);

alter table public.chaves_de_ia_da_conta enable row level security;
-- Nenhum papel de navegador toca na tabela. Só funções DEFINER (que rodam como
-- dono) e, para decifrar na hora de chamar o provedor, a chave de serviço.
revoke all on table public.chaves_de_ia_da_conta from public, anon, authenticated;
revoke all on table public.chaves_de_ia_da_conta from service_role;

-- ─── 4. O aceite e as chaves: as portas ──────────────────────────────────

create function public.aceitar_termo_de_ia_propria(p_workspace_id uuid, p_versao text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
begin
  if quem is null then
    raise exception 'é preciso entrar' using errcode = '28000';
  end if;
  if not private.administra_a_conta(p_workspace_id, quem) then
    raise exception 'só quem administra a conta aceita o termo' using errcode = '42501', hint = 'ia_so_a_dona';
  end if;
  if private.modo_de_ia_da_conta(p_workspace_id) <> 'propria' then
    raise exception 'o plano desta conta traz a IA da Brennimark' using errcode = 'P0001', hint = 'ia_conta_no_modo_da_plataforma';
  end if;
  insert into public.registros_da_ia_propria (workspace_id, autor, acao, versao_termo)
  values (p_workspace_id, quem, 'aceitar-termo', p_versao);
end;
$$;

revoke all on function public.aceitar_termo_de_ia_propria(uuid, text) from public, anon;
grant execute on function public.aceitar_termo_de_ia_propria(uuid, text) to authenticated;

create function public.guardar_chave_de_ia(
  p_workspace_id uuid, p_encaixe text, p_provedor text, p_modelo text,
  p_chave_cifrada text, p_chave_iv text, p_chave_final text, p_versao_da_chave_mestra smallint)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
  existia boolean;
begin
  if quem is null then
    raise exception 'é preciso entrar' using errcode = '28000';
  end if;
  if not private.administra_a_conta(p_workspace_id, quem) then
    raise exception 'só quem administra a conta guarda chaves' using errcode = '42501', hint = 'ia_so_a_dona';
  end if;
  if private.modo_de_ia_da_conta(p_workspace_id) <> 'propria' then
    raise exception 'o plano desta conta traz a IA da Brennimark' using errcode = 'P0001', hint = 'ia_conta_no_modo_da_plataforma';
  end if;
  -- Sem o termo aceito, nada é guardado: a responsabilidade pela escolha do
  -- provedor é da agência e precisa estar escrita antes (ADR-0009 §2.4).
  if not exists (select 1 from public.registros_da_ia_propria r
                  where r.workspace_id = p_workspace_id and r.acao = 'aceitar-termo') then
    raise exception 'aceite o termo antes de guardar uma chave' using errcode = 'P0001', hint = 'ia_sem_termo_aceito';
  end if;

  select exists (select 1 from public.chaves_de_ia_da_conta c
                  where c.workspace_id = p_workspace_id and c.encaixe = p_encaixe) into existia;

  insert into public.chaves_de_ia_da_conta as c
    (workspace_id, encaixe, provedor, modelo, chave_cifrada, chave_iv, chave_final, versao_da_chave_mestra, criada_por)
  values
    (p_workspace_id, p_encaixe, p_provedor, p_modelo, p_chave_cifrada, p_chave_iv, p_chave_final,
     coalesce(p_versao_da_chave_mestra, 1), quem)
  on conflict (workspace_id, encaixe) do update set
    provedor = excluded.provedor, modelo = excluded.modelo,
    chave_cifrada = excluded.chave_cifrada, chave_iv = excluded.chave_iv, chave_final = excluded.chave_final,
    versao_da_chave_mestra = excluded.versao_da_chave_mestra, criada_por = excluded.criada_por,
    updated_at = now(), testada_em = null, teste_ok = null;

  insert into public.registros_da_ia_propria (workspace_id, autor, acao, encaixe, provedor, modelo, chave_final)
  values (p_workspace_id, quem, case when existia then 'substituir' else 'cadastrar' end,
          p_encaixe, p_provedor, p_modelo, p_chave_final);
end;
$$;

revoke all on function public.guardar_chave_de_ia(uuid, text, text, text, text, text, text, smallint) from public, anon;
grant execute on function public.guardar_chave_de_ia(uuid, text, text, text, text, text, text, smallint) to authenticated;

create function public.apagar_chave_de_ia(p_workspace_id uuid, p_encaixe text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
  c public.chaves_de_ia_da_conta%rowtype;
begin
  if quem is null then
    raise exception 'é preciso entrar' using errcode = '28000';
  end if;
  if not private.administra_a_conta(p_workspace_id, quem) then
    raise exception 'só quem administra a conta apaga chaves' using errcode = '42501', hint = 'ia_so_a_dona';
  end if;
  delete from public.chaves_de_ia_da_conta
   where workspace_id = p_workspace_id and encaixe = p_encaixe
   returning * into c;
  if c.id is null then
    raise exception 'não há chave neste encaixe' using errcode = 'P0002', hint = 'ia_encaixe_vazio';
  end if;
  insert into public.registros_da_ia_propria (workspace_id, autor, acao, encaixe, provedor, modelo, chave_final)
  values (p_workspace_id, quem, 'apagar', c.encaixe, c.provedor, c.modelo, c.chave_final);
end;
$$;

revoke all on function public.apagar_chave_de_ia(uuid, text) from public, anon;
grant execute on function public.apagar_chave_de_ia(uuid, text) to authenticated;

-- O que a tela mostra: provedor, modelo e "termina em". Nunca o texto cifrado.
create function public.listar_chaves_de_ia(p_workspace_id uuid)
returns table (encaixe text, provedor text, modelo text, chave_final text, atualizada_em timestamptz,
               testada_em timestamptz, teste_ok boolean)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not private.administra_a_conta(p_workspace_id, (select auth.uid())) then
    raise exception 'só quem administra a conta vê as chaves' using errcode = '42501', hint = 'ia_so_a_dona';
  end if;
  return query
    select c.encaixe, c.provedor, c.modelo, c.chave_final, c.updated_at, c.testada_em, c.teste_ok
      from public.chaves_de_ia_da_conta c
     where c.workspace_id = p_workspace_id
     order by case c.encaixe when 'texto' then 1 when 'imagem' then 2 else 3 end;
end;
$$;

revoke all on function public.listar_chaves_de_ia(uuid) from public, anon;
grant execute on function public.listar_chaves_de_ia(uuid) to authenticated;

-- A ÚNICA porta que devolve o texto cifrado: só o servidor, para decifrar no
-- instante de chamar o provedor. Conta no modo da plataforma nunca recebe chave,
-- mesmo que sobre alguma (defesa em profundidade).
create function public.chave_de_ia_para_uso(p_workspace_id uuid, p_encaixe text)
returns table (provedor text, modelo text, chave_cifrada text, chave_iv text, versao_da_chave_mestra smallint)
language sql
stable
security definer
set search_path to ''
as $$
  select c.provedor, c.modelo, c.chave_cifrada, c.chave_iv, c.versao_da_chave_mestra
    from public.chaves_de_ia_da_conta c
   where c.workspace_id = p_workspace_id
     and c.encaixe = p_encaixe
     and private.modo_de_ia_da_conta(p_workspace_id) = 'propria';
$$;

revoke all on function public.chave_de_ia_para_uso(uuid, text) from public, anon, authenticated;
grant execute on function public.chave_de_ia_para_uso(uuid, text) to service_role;

-- O servidor anota o resultado do "Testar conexão" (sem enviar conteúdo de marca).
create function public.registrar_teste_de_chave_de_ia(p_workspace_id uuid, p_encaixe text, p_ok boolean)
returns void
language sql
security definer
set search_path to ''
as $$
  update public.chaves_de_ia_da_conta
     set testada_em = now(), teste_ok = p_ok
   where workspace_id = p_workspace_id and encaixe = p_encaixe;
$$;

revoke all on function public.registrar_teste_de_chave_de_ia(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.registrar_teste_de_chave_de_ia(uuid, text, boolean) to service_role;

-- ─── 5. Trocar de plano apaga as chaves ──────────────────────────────────

create function private.apagar_chaves_na_troca_de_plano()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  antes text;
  depois text;
begin
  select p.modo_de_ia into antes from public.planos p where p.codigo = old.plano;
  select p.modo_de_ia into depois from public.planos p where p.codigo = new.plano;
  if antes = 'propria' and depois is distinct from 'propria' then
    with apagadas as (
      delete from public.chaves_de_ia_da_conta where workspace_id = new.workspace_id returning *
    )
    insert into public.registros_da_ia_propria (workspace_id, autor, acao, encaixe, provedor, modelo, chave_final)
    select workspace_id, null, 'apagar-por-troca-de-plano', encaixe, provedor, modelo, chave_final from apagadas;
  end if;
  return new;
end;
$$;

revoke all on function private.apagar_chaves_na_troca_de_plano() from public, anon, authenticated;

create trigger apagar_chaves_na_troca_de_plano
  after update of plano on public.assinaturas
  for each row when (old.plano is distinct from new.plano)
  execute function private.apagar_chaves_na_troca_de_plano();

-- ─── 6. O interruptor "usa o Vini" por pessoa ────────────────────────────
--
-- Sem linha = com Vini (o comportamento de hoje). A linha é a EXCEÇÃO, feita
-- pela dona da conta. Vale para a conta inteira e para todos os planos.

create table public.vini_desligado_para (
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  desligado_por uuid references auth.users(id) on delete set null,
  desligado_em  timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index vini_desligado_para_pessoa_idx on public.vini_desligado_para (user_id);

alter table public.vini_desligado_para enable row level security;
revoke all on table public.vini_desligado_para from public, anon, authenticated;
grant select on table public.vini_desligado_para to authenticated;
grant select on table public.vini_desligado_para to service_role;

-- A própria pessoa vê a sua linha (a tela esconde o Vini); a dona vê todas.
create policy "A pessoa e a dona leem o interruptor do Vini"
  on public.vini_desligado_para for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.workspace_members m
                where m.workspace_id = vini_desligado_para.workspace_id
                  and m.user_id = (select auth.uid()) and m.role = 'owner'));

create function public.definir_vini_da_pessoa(p_workspace_id uuid, p_pessoa uuid, p_pode boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
begin
  if quem is null then
    raise exception 'é preciso entrar' using errcode = '28000';
  end if;
  if not private.administra_a_conta(p_workspace_id, quem) then
    raise exception 'só quem administra a conta liga e desliga o Vini' using errcode = '42501', hint = 'vini_so_a_dona';
  end if;
  -- A pessoa precisa ter acesso a esta conta: membro ou concedida a alguma marca dela.
  if not (exists (select 1 from public.workspace_members m
                   where m.workspace_id = p_workspace_id and m.user_id = p_pessoa)
          or exists (select 1 from public.brand_members b
                      where b.workspace_id = p_workspace_id and b.user_id = p_pessoa)) then
    raise exception 'esta pessoa não tem acesso à conta' using errcode = 'P0002', hint = 'vini_pessoa_sem_acesso';
  end if;

  if p_pode then
    delete from public.vini_desligado_para where workspace_id = p_workspace_id and user_id = p_pessoa;
  else
    insert into public.vini_desligado_para (workspace_id, user_id, desligado_por)
    values (p_workspace_id, p_pessoa, quem)
    on conflict (workspace_id, user_id) do nothing;
  end if;
end;
$$;

revoke all on function public.definir_vini_da_pessoa(uuid, uuid, boolean) from public, anon;
grant execute on function public.definir_vini_da_pessoa(uuid, uuid, boolean) to authenticated;

-- A pergunta da tela: "eu posso usar o Vini nesta conta?" (só sobre quem pergunta).
create function public.posso_usar_o_vini(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select (select auth.uid()) is not null
     and not exists (select 1 from public.vini_desligado_para v
                      where v.workspace_id = p_workspace_id and v.user_id = (select auth.uid()));
$$;

revoke all on function public.posso_usar_o_vini(uuid) from public, anon;
grant execute on function public.posso_usar_o_vini(uuid) to authenticated;

-- A pergunta do servidor, para barrar na rota do Vini (a interface só esconde).
create function public.pessoa_pode_usar_o_vini(p_workspace_id uuid, p_pessoa uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select p_pessoa is not null
     and not exists (select 1 from public.vini_desligado_para v
                      where v.workspace_id = p_workspace_id and v.user_id = p_pessoa);
$$;

revoke all on function public.pessoa_pode_usar_o_vini(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pessoa_pode_usar_o_vini(uuid, uuid) to service_role;
