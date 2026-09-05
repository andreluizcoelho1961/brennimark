-- M1.0 — o workspace ganha um slug persistido e único.
--
-- Por que dado e não derivação em tempo de execução: o slug é o primeiro
-- segmento da URL (/w/<slug>/b/<chave>/...). Derivá-lo do nome a cada
-- requisição significa que renomear a conta quebra todos os links já
-- compartilhados, e que duas contas de mesmo nome produzem a mesma URL — duas
-- falhas que não têm conserto depois que alguém salvou o endereço.
--
-- Ele é ESTÁVEL: nasce na criação e não é recalculado. O nome muda; a URL não.
-- Se um dia a conta precisar trocar de endereço, isso será uma operação
-- explícita, com redirecionamento — não um efeito colateral de editar um campo.
--
-- Único globalmente, não por workspace: ele identifica o workspace, e um
-- identificador que se repete não identifica nada.

-- 1. A coluna entra permissiva para a linha existente poder ser preenchida.
alter table public.workspaces add column slug text;

/**
 * Texto livre → candidato a slug.
 *
 * Sem a extensão `unaccent`: uma extensão a mais é uma dependência a mais no
 * projeto, e o mapa abaixo cobre o alfabeto latino, que é o caso real. O que
 * não sobrevive à normalização — nomes em japonês, árabe, cirílico — devolve
 * vazio, e quem chama trata isso com um identificador de reserva. Devolver
 * lixo seria pior que devolver nada.
 */
create or replace function public.slug_candidato(origem text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    trim(both '-' from
      regexp_replace(
        lower(translate(
          coalesce(origem, ''),
          'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑýÿÝ',
          'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnNyyY'
        )),
        '[^a-z0-9]+', '-', 'g'
      )
    ),
    ''
  );
$$;

/**
 * Candidato → slug livre, com teto de tamanho e desempate por sufixo.
 *
 * Palavras reservadas: `/w/<slug>` divide espaço com rotas que o produto ainda
 * pode querer criar (`/w/nova`, `/w/configuracoes`). Reservá-las agora custa
 * uma linha; descobrir a colisão depois custa migrar as URLs de um cliente.
 */
create or replace function public.slug_de_workspace_livre(origem text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  base text;
  candidato text;
  n integer := 1;
begin
  base := left(coalesce(public.slug_candidato(origem), ''), 40);

  -- Nada aproveitável, curto demais, ou reservado: identificador de reserva.
  if base is null or length(base) < 2
     or base in ('nova', 'novo', 'new', 'admin', 'api', 'docs', 'login',
                 'configuracoes', 'settings', 'onboarding', 'w', 'b') then
    base := 'conta-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end if;

  candidato := base;
  while exists (select 1 from public.workspaces where slug = candidato) loop
    n := n + 1;
    candidato := base || '-' || n;
    -- Teto: com muitas colisões, para de contar e sorteia.
    if n > 50 then
      candidato := base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
      exit;
    end if;
  end loop;

  return candidato;
end;
$$;

-- 2. Preenche o que já existe.
update public.workspaces
   set slug = public.slug_de_workspace_livre(name)
 where slug is null;

-- 3. Só então as garantias. Nesta ordem: sem os dados preenchidos, o not null
--    faria a migração falhar em vez de corrigir.
alter table public.workspaces
  alter column slug set not null,
  add constraint workspaces_slug_formato
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 63);

create unique index workspaces_slug_key on public.workspaces(slug);

/**
 * Todo workspace nasce com slug, venha de onde vier.
 *
 * O gatilho, e não um default da coluna: o valor depende de consultar a própria
 * tabela para desempatar, e um `default` não faz isso. E BEFORE INSERT, não a
 * aplicação: qualquer caminho de escrita — o gatilho de perfil, um script, o
 * painel do Supabase — passa por aqui. Deixar a geração na aplicação garante
 * que o primeiro caminho esquecido grave nulo, e a coluna é not null.
 */
create or replace function public.workspace_recebe_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.slug_de_workspace_livre(new.name);
  end if;
  return new;
end;
$$;

create trigger workspaces_slug_antes_de_inserir
  before insert on public.workspaces
  for each row execute function public.workspace_recebe_slug();

-- As funções são utilidades de servidor. Nenhum papel do cliente as executa:
-- gerar slug é decisão do banco no momento da criação, não uma chamada aberta.
revoke all on function public.slug_candidato(text) from public, anon, authenticated;
revoke all on function public.slug_de_workspace_livre(text) from public, anon, authenticated;
revoke all on function public.workspace_recebe_slug() from public, anon, authenticated;

comment on column public.workspaces.slug is
  'Identificador do workspace na URL (/w/<slug>). Estável: gerado na criação e '
  'não recalculado quando o nome muda. Único globalmente.';
